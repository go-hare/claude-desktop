const { contextBridge, ipcRenderer } = require('electron');

const EIPC_PREFIX = '$eipc_message$_ea5fa1fd-aa4e-4f73-a689-0f14f3e8be79_$_';
const eipcChannel = (namespace, interfaceName, method) => (
    `${EIPC_PREFIX}${namespace}_$_${interfaceName}_$_${method}`
);

const claudeWeb = {
    FileSystem: {
        showInFolder: (filePath) => ipcRenderer.invoke(
            eipcChannel('claude.web', 'FileSystem', 'showInFolder'),
            filePath,
        ),
    },
    LocalSessions: {
        getInstalledEditors: (cwd) => ipcRenderer.invoke(
            eipcChannel('claude.web', 'LocalSessions', 'getInstalledEditors'),
            cwd,
        ),
        openInEditor: (targetPath, editorType, sshConfig, line) => ipcRenderer.invoke(
            eipcChannel('claude.web', 'LocalSessions', 'openInEditor'),
            targetPath,
            editorType,
            sshConfig,
            line,
        ),
    },
};

contextBridge.exposeInMainWorld('claude.web', claudeWeb);

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Zoom change listener
    onZoomChanged: (callback) => ipcRenderer.on('zoom-changed', (_, factor) => callback(factor)),
    // Platform info
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getAppPath: () => ipcRenderer.invoke('get-app-path'),

    // File system
    selectDirectory: () => ipcRenderer.invoke('select-directory'),

    // Check if running in Electron
    isElectron: true,

    // Core Functions
    exportWorkspace: (workspaceId, contextMarkdown, defaultFilename) => ipcRenderer.invoke('export-workspace', workspaceId, contextMarkdown, defaultFilename),

    // File explorer: open folder containing a file, or open a folder directly
    getInstalledEditors: (cwd) => claudeWeb.LocalSessions.getInstalledEditors(cwd),
    openInEditor: (targetPath, editorType, sshConfig, line) => (
        claudeWeb.LocalSessions.openInEditor(targetPath, editorType, sshConfig, line)
    ),
    showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
    revealConfig: () => ipcRenderer.invoke('reveal-config'),

    // Window resize
    resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', width, height),

    // Open external URL in system browser (for OAuth flows etc.)
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Auto-update events
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status) => callback(status)),
    installUpdate: () => ipcRenderer.invoke('install-update'),
});
