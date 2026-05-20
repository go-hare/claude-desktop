const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut, session } = require('electron');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { autoUpdater } = require('electron-updater');
const { configureRuntimePaths } = require('./runtime-paths.cjs');

const runtimePaths = configureRuntimePaths();
console.log('[Runtime] userData:', runtimePaths.appSupportDir);
console.log('[Runtime] Claude-3p data:', runtimePaths.codeSupportDir);
console.log('[Runtime] CLAUDE_CONFIG_DIR:', runtimePaths.claudeConfigDir);
console.log('[Runtime] claude-code data:', runtimePaths.claudeCodeDir);

// Load build-time secrets before requiring bridge-server so they're available on process.env.
// secrets.json is gitignored — populated by CI at build time from GitHub Actions secrets.
// In dev just export the env vars in your shell (or put them in this file locally).
try {
    const secretsPath = path.join(__dirname, 'secrets.json');
    if (fs.existsSync(secretsPath)) {
        const s = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
        for (const [k, v] of Object.entries(s)) {
            if (!process.env[k]) process.env[k] = String(v);
        }
    }
} catch (_) {}

const { initServer, enableNodeModeForChildProcesses } = require('./bridge-server.cjs');
const { attachPtyWebSocket } = require('./pty-service.cjs');
const { getGlobalConfigFilePath } = require('./connector-mcp-config.cjs');

// Fix Chinese garbled text in Windows console by switching to UTF-8 code page
if (process.platform === 'win32') {
    try { require('child_process').execSync('chcp 65001', { stdio: 'ignore' }); } catch (_) {}
    process.stdout.setEncoding?.('utf8');
    process.stderr.setEncoding?.('utf8');
}

// Squirrel startup handler removed — using NSIS installer, not Squirrel

let mainWindow;
let bridgeHttpServer = null;
let bridgeRestartTimer = null;

const isDev = process.env.NODE_ENV === 'development';

const EIPC_PREFIX = '$eipc_message$_ea5fa1fd-aa4e-4f73-a689-0f14f3e8be79_$_';
const eipcChannel = (namespace, interfaceName, method) => (
    `${EIPC_PREFIX}${namespace}_$_${interfaceName}_$_${method}`
);

const CodeEditorType = {
    VSCode: 'vscode',
    Cursor: 'cursor',
    Zed: 'zed',
    Windsurf: 'windsurf',
    Xcode: 'xcode',
};

const editorDefinitions = {
    [CodeEditorType.VSCode]: { protocol: 'vscode://', name: 'VS Code' },
    [CodeEditorType.Cursor]: { protocol: 'cursor://', name: 'Cursor' },
    [CodeEditorType.Zed]: { protocol: 'zed://', name: 'Zed' },
    [CodeEditorType.Windsurf]: { protocol: 'windsurf://', name: 'Windsurf' },
    [CodeEditorType.Xcode]: { protocol: 'xcode://', name: 'Xcode', platform: 'darwin' },
};

async function findXcodeProjectFile(cwd) {
    if (!cwd) return null;
    const findInDirectory = async (dirPath) => {
        let entries;
        try {
            entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        } catch (_) {
            return null;
        }
        const workspace = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.xcworkspace'));
        if (workspace) return path.join(dirPath, workspace.name);
        const project = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.xcodeproj'));
        if (project) return path.join(dirPath, project.name);
        const swiftPackage = entries.find((entry) => entry.isFile() && entry.name === 'Package.swift');
        return swiftPackage ? path.join(dirPath, swiftPackage.name) : null;
    };

    const directMatch = await findInDirectory(cwd);
    if (directMatch) return directMatch;
    for (const childDir of ['ios', 'macos', 'apple']) {
        const childMatch = await findInDirectory(path.join(cwd, childDir));
        if (childMatch) return childMatch;
    }
    return null;
}

async function getInstalledEditors(cwd) {
    const editors = [];
    for (const [type, definition] of Object.entries(editorDefinitions)) {
        if (definition.platform && definition.platform !== process.platform) continue;
        try {
            const appInfo = await app.getApplicationInfoForProtocol(definition.protocol);
            const installed = !!appInfo?.path;
            if (type === CodeEditorType.Xcode && installed && cwd && !await findXcodeProjectFile(cwd)) {
                continue;
            }
            let iconDataUrl;
            if (installed && appInfo.path) {
                let icon = appInfo.icon;
                if (!icon || icon.isEmpty()) {
                    icon = await app.getFileIcon(appInfo.path, { size: 'normal' });
                }
                if (icon && !icon.isEmpty()) {
                    iconDataUrl = icon.resize({ width: 32, height: 32 }).toDataURL();
                }
            }
            editors.push({ type, name: definition.name, installed, iconDataUrl });
        } catch (_) {
            editors.push({ type, name: definition.name, installed: false });
        }
    }
    return editors;
}

async function isVSCodeInstalled() {
    try {
        const appInfo = await app.getApplicationInfoForProtocol('vscode://');
        return !!appInfo?.path;
    } catch (_) {
        return false;
    }
}

async function openInEditor(targetPath, editorType, sshConfig, line) {
    const definition = editorDefinitions[editorType];
    if (!definition) {
        console.error(`[Editor] Unknown editor type: ${editorType}`);
        return false;
    }
    try {
        const appInfo = await app.getApplicationInfoForProtocol(definition.protocol);
        if (!appInfo?.path) return false;

        if (editorType === CodeEditorType.Xcode) {
            if (sshConfig) return false;
            const xcodeProject = await findXcodeProjectFile(targetPath);
            if (!xcodeProject) {
                console.info(`[Editor] No Xcode project file found in ${targetPath}`);
                return false;
            }
            const stat = await fs.promises.lstat(xcodeProject);
            if (stat.isSymbolicLink()) {
                console.warn(`[Editor] Refusing to open Xcode symlink: ${xcodeProject}`);
                return false;
            }
            const result = await shell.openPath(xcodeProject);
            if (result) {
                console.error(`[Editor] shell.openPath failed for Xcode: ${result}`);
                return false;
            }
            return true;
        }

        const lineSuffix = line !== undefined ? `:${line}` : '';
        let editorUrl;
        if (sshConfig) {
            const sshHost = sshConfig.sshHost;
            const normalizedPath = targetPath.replace(/\\/g, '/');
            editorUrl = `${definition.protocol}vscode-remote/ssh-remote+${sshHost}${normalizedPath}${lineSuffix}`;
        } else {
            const normalizedPath = targetPath.replace(/\\/g, '/');
            editorUrl = `${definition.protocol}file/${encodeURIComponent(normalizedPath).replace(/%2F/g, '/')}${lineSuffix}`;
        }
        await shell.openExternal(editorUrl);
        return true;
    } catch (error) {
        console.error('[Editor] Failed to open editor:', error && (error.stack || error.message || error));
        return false;
    }
}

async function openInVSCode(targetPath) {
    return openInEditor(targetPath, CodeEditorType.VSCode);
}

function startBridgeServer() {
    if (bridgeHttpServer?.listening) {
        return bridgeHttpServer;
    }

    if (bridgeRestartTimer) {
        clearTimeout(bridgeRestartTimer);
        bridgeRestartTimer = null;
    }

    const appServer = initServer(mainWindow);
    const httpServer = appServer.listen(30080, '127.0.0.1', () => {
        bridgeHttpServer = httpServer;
        console.log('Bridge Server running on http://127.0.0.1:30080');
    });
    attachPtyWebSocket(httpServer);

    httpServer.on('error', (error) => {
        console.error('[Bridge] Server error:', error && (error.stack || error.message || error));
        if (bridgeHttpServer === httpServer) {
            bridgeHttpServer = null;
        }
    });

    httpServer.on('close', () => {
        console.warn('[Bridge] Server closed');
        if (bridgeHttpServer === httpServer) {
            bridgeHttpServer = null;
        }
        if (app.isQuitting || bridgeRestartTimer) return;
        bridgeRestartTimer = setTimeout(() => {
            bridgeRestartTimer = null;
            if (!app.isQuitting) {
                try {
                    startBridgeServer();
                } catch (error) {
                    console.error('[Bridge] Restart failed:', error && (error.stack || error.message || error));
                }
            }
        }, 1000);
    });

    bridgeHttpServer = httpServer;
    return httpServer;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1150,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        // Platform-specific window chrome
        ...(process.platform === 'darwin'
            ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 12 } }
            : {
                titleBarStyle: 'hidden',
                titleBarOverlay: {
                    color: '#00000000',
                    symbolColor: '#808080',
                    height: 44
                }
            }),
        icon: path.join(__dirname, '..', 'public', process.platform === 'win32' ? 'favicon.ico' : 'favicon.png'),
        backgroundColor: '#F8F8F6',
        show: false, // Show after ready-to-show to prevent flash
    });

    // Reset zoom to default on startup & register zoom shortcuts
    mainWindow.once('ready-to-show', () => {
        mainWindow.webContents.setZoomFactor(1.0);
        mainWindow.show();
    });

    // Zoom keyboard shortcuts — Electron doesn't handle Ctrl+= (plus) by default on some layouts
    const TITLE_BAR_BASE_HEIGHT = 44;
    const applyZoom = (factor) => {
        const wc = mainWindow.webContents;
        wc.setZoomFactor(factor);
        // Keep native title bar overlay at consistent visual size regardless of zoom
        if (process.platform !== 'darwin') {
            try {
                mainWindow.setTitleBarOverlay({
                    color: '#00000000',
                    symbolColor: '#808080',
                    height: Math.round(TITLE_BAR_BASE_HEIGHT * factor),
                });
            } catch (_) {}
        }
        // Notify renderer so CSS can compensate
        wc.send('zoom-changed', factor);
    };

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (!input.control && !input.meta) return;
        const wc = mainWindow.webContents;
        const current = wc.getZoomFactor();
        if (input.key === '=' || input.key === '+') {
            event.preventDefault();
            applyZoom(Math.min(+(current + 0.1).toFixed(1), 2.0));
        } else if (input.key === '-') {
            event.preventDefault();
            applyZoom(Math.max(+(current - 0.1).toFixed(1), 0.5));
        } else if (input.key === '0') {
            event.preventDefault();
            applyZoom(1.0);
        }
    });

    if (isDev) {
        // In development, load from Vite dev server
        mainWindow.loadURL('http://localhost:3000');
    } else {
        // In production, load the built files
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }
    // mainWindow.webContents.openDevTools();

    // Open all external links in the system browser, not in the app
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        // Allow hash navigation (file:// with #) and localhost dev server
        if (url.startsWith('file://') || url.startsWith('http://localhost')) return;
        event.preventDefault();
        shell.openExternal(url);
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        if (level >= 2) {
            try { require('fs').appendFileSync(require('path').join(require('electron').app.getPath('userData'), 'frontend-error.log'), `[Frontend Error] ${message} at ${sourceId}:${line}\n`); } catch (_) {}
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    session.defaultSession.setPermissionCheckHandler((_webContents, permission, _origin, details) => {
        if (permission === 'media') {
            const mediaTypes = details?.mediaTypes || [];
            return mediaTypes.includes('audio');
        }
        return false;
    });

    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
        if (permission === 'media') {
            const mediaTypes = details?.mediaTypes || [];
            callback(mediaTypes.includes('audio'));
            return;
        }
        callback(false);
    });

    // macOS: clear quarantine flags on bundled bun binary. Downloaded .dmg/.zip
    // files get Apple's com.apple.quarantine xattr, and since our bun binary is
    // unsigned, Gatekeeper silently blocks execution — the engine subprocess just
    // exits immediately with no output. This one-liner strips the flag so bun can
    // run. Safe to call every launch (no-op if already cleared or on non-Mac).
    if (process.platform === 'darwin') {
        try {
            const engineBin = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'engine', 'bin');
            require('child_process').execSync(`xattr -cr "${engineBin}" 2>/dev/null || true`, { stdio: 'ignore' });
        } catch (_) {}
    }

    // Start Bridge Server
    startBridgeServer();

    createWindow();

    // No SDK subprocess needed — using direct API calls
    enableNodeModeForChildProcesses();

    // Auto-update is disabled for custom local builds. Keeping the upstream
    // feed enabled would overwrite the bundled local engine on relaunch.
    const autoUpdateEnabled = process.env.CLAUDE_DESKTOP_ENABLE_AUTO_UPDATE === '1';
    if (!isDev && autoUpdateEnabled) {
        autoUpdater.setFeedURL({
            provider: 'generic',
            url: 'https://clawparrot.com/updates',
        });
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.logger = console;

        autoUpdater.on('update-available', (info) => {
            console.log('[Update] New version available:', info.version);
            if (mainWindow) {
                mainWindow.webContents.send('update-status', { type: 'available', version: info.version });
            }
        });

        autoUpdater.on('download-progress', (progress) => {
            if (mainWindow) {
                mainWindow.webContents.send('update-status', { type: 'progress', percent: Math.round(progress.percent) });
            }
        });

        autoUpdater.on('update-downloaded', (info) => {
            console.log('[Update] Downloaded:', info.version);
            if (mainWindow) {
                mainWindow.webContents.send('update-status', { type: 'downloaded', version: info.version });
            }
            // Don't auto-quit — let the user click "Relaunch" in the UI.
            // On Mac, quitAndInstall's isForceRunAfter param is ignored,
            // so we use app.relaunch() + app.exit() to ensure the app restarts.
        });

        autoUpdater.on('error', (err) => {
            console.error('[Update] Error:', err.message);
            if (mainWindow) {
                mainWindow.webContents.send('update-status', { type: 'error', message: err.message });
            }
        });

        autoUpdater.on('update-not-available', (info) => {
            console.log('[Update] Already up-to-date:', info.version);
        });

        // Check for updates after 15 seconds (give network time to settle),
        // then every 10 minutes (more frequent for users on unstable networks)
        const doCheck = () => {
            console.log('[Update] Checking for updates...');
            autoUpdater.checkForUpdates().catch(err => {
                console.error('[Update] Check failed:', err.message);
            });
        };
        setTimeout(doCheck, 15000);
        setInterval(doCheck, 10 * 60 * 1000);
    }

    app.on('activate', () => {
        // macOS: re-create window when dock icon clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
    if (bridgeRestartTimer) {
        clearTimeout(bridgeRestartTimer);
        bridgeRestartTimer = null;
    }
    if (bridgeHttpServer) {
        try { bridgeHttpServer.close(); } catch (_) {}
        bridgeHttpServer = null;
    }
});

// IPC Handlers for future bridge communication
ipcMain.handle('get-app-path', () => app.getPath('userData'));
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('install-update', () => {
    // On Mac, autoUpdater.quitAndInstall() doesn't reliably relaunch the app.
    // Use app.relaunch() + app.exit() to ensure the app restarts on all platforms.
    if (process.platform === 'darwin') {
        app.relaunch();
        app.exit(0);
    } else {
        autoUpdater.quitAndInstall(true, true);
    }
});
ipcMain.handle('open-external', (_, url) => { const { shell } = require('electron'); shell.openExternal(url); });
ipcMain.handle('reveal-config', () => {
    const configPath = getGlobalConfigFilePath();
    const parentDir = path.dirname(configPath);
    fs.mkdirSync(parentDir, { recursive: true });
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ mcpServers: {} }, null, 2) + '\n', 'utf8');
    }
    shell.showItemInFolder(configPath);
    return { success: true, path: configPath };
});
ipcMain.handle('resize-window', (_, width, height) => {
    if (mainWindow) {
        mainWindow.setSize(width, height);
        mainWindow.center();
    }
});

ipcMain.handle(
    eipcChannel('claude.web', 'LocalSessions', 'isVSCodeInstalled'),
    () => isVSCodeInstalled(),
);
ipcMain.handle(
    eipcChannel('claude.web', 'LocalSessions', 'openInVSCode'),
    (_, targetPath) => openInVSCode(targetPath),
);
ipcMain.handle(
    eipcChannel('claude.web', 'LocalSessions', 'getInstalledEditors'),
    (_, cwd) => getInstalledEditors(cwd),
);
ipcMain.handle(
    eipcChannel('claude.web', 'LocalSessions', 'openInEditor'),
    (_, targetPath, editorType, sshConfig, line) => openInEditor(targetPath, editorType, sshConfig, line),
);

ipcMain.handle('get-installed-editors', (_, cwd) => getInstalledEditors(cwd));

ipcMain.handle('open-in-editor', (_, targetPath, editorType, sshConfig, line) => (
    openInEditor(targetPath, editorType, sshConfig, line)
));

ipcMain.handle(eipcChannel('claude.web', 'FileSystem', 'showInFolder'), async (_, filePath) => {
    if (filePath) shell.showItemInFolder(filePath);
});

// Open the folder containing the given file path in system explorer
// Returns true if opened, false if file/folder not found
const recentlyOpenedFolders = new Map(); // path → timestamp, prevents duplicate opens
ipcMain.handle('show-item-in-folder', (event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return false;
    // Deduplicate: ignore if same folder was opened within last 2 seconds
    const folder = path.dirname(filePath);
    const now = Date.now();
    const lastOpened = recentlyOpenedFolders.get(folder);
    if (lastOpened && now - lastOpened < 2000) return true;
    recentlyOpenedFolders.set(folder, now);
    // Cleanup old entries
    for (const [k, v] of recentlyOpenedFolders) {
        if (now - v > 5000) recentlyOpenedFolders.delete(k);
    }
    shell.showItemInFolder(filePath);
    return true;
});

// Open a folder directly in system explorer
const recentlyOpenedDirs = new Map();
ipcMain.handle('open-folder', (event, folderPath) => {
    if (!folderPath || !fs.existsSync(folderPath)) return false;
    const now = Date.now();
    const lastOpened = recentlyOpenedDirs.get(folderPath);
    if (lastOpened && now - lastOpened < 2000) return true;
    recentlyOpenedDirs.set(folderPath, now);
    for (const [k, v] of recentlyOpenedDirs) {
        if (now - v > 5000) recentlyOpenedDirs.delete(k);
    }
    shell.openPath(folderPath);
    return true;
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle('export-workspace', async (event, workspaceId, contextMarkdown, defaultFilename) => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            title: '导出模型对话工作空间',
            defaultPath: defaultFilename,
            filters: [
                { name: 'Zip Archives', extensions: ['zip'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (result.canceled || !result.filePath) {
            return { success: false, reason: 'canceled' };
        }

        const zipDest = result.filePath;
        const workspacePath = path.join(app.getPath('userData'), 'workspaces', workspaceId);

        // 确保对应的 workspace 目录存在 (即使之前因为没有发生过相关文件操作而没创建)
        if (!fs.existsSync(workspacePath)) {
            fs.mkdirSync(workspacePath, { recursive: true });
        }

        // 把前段归集的完整文本上下文放进去一起归档
        fs.writeFileSync(path.join(workspacePath, 'chat_context.md'), contextMarkdown || '', 'utf-8');

        // 执行异步 zip 打包保存
        return await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipDest);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Sets the compression level.
            });

            output.on('close', () => {
                resolve({ success: true, path: zipDest, size: archive.pointer() });
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);

            // 将整个文件夹里的所有文件平摊塞入这个压缩包里 (不用多套一层文件夹壳)
            archive.directory(workspacePath, false);

            archive.finalize();
        });
    } catch (err) {
        console.error("Export Workspace Failed:", err);
        throw err;
    }
});
