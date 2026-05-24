const { contextBridge, ipcRenderer } = require('electron');

const EIPC_PREFIX = '$eipc_message$_ea5fa1fd-aa4e-4f73-a689-0f14f3e8be79_$_';
const eipcChannel = (namespace, interfaceName, method) => (
    `${EIPC_PREFIX}${namespace}_$_${interfaceName}_$_${method}`
);

const claudeWeb = {
    CCDScheduledTasks: {
        getAllScheduledTasks: () => ipcRenderer.invoke(
            eipcChannel('claude.web', 'CCDScheduledTasks', 'getAllScheduledTasks'),
        ),
        getScheduledTaskFileContent: (scheduledTaskId) => ipcRenderer.invoke(
            eipcChannel('claude.web', 'CCDScheduledTasks', 'getScheduledTaskFileContent'),
            scheduledTaskId,
        ),
        createScheduledTask: (payload) => ipcRenderer.invoke(
            eipcChannel('claude.web', 'CCDScheduledTasks', 'createScheduledTask'),
            payload,
        ),
        updateScheduledTask: (payload) => ipcRenderer.invoke(
            eipcChannel('claude.web', 'CCDScheduledTasks', 'updateScheduledTask'),
            payload,
        ),
        updateScheduledTaskFileContent: (scheduledTaskId, content) => ipcRenderer.invoke(
            eipcChannel('claude.web', 'CCDScheduledTasks', 'updateScheduledTaskFileContent'),
            scheduledTaskId,
            content,
        ),
        updateScheduledTaskStatus: (scheduledTaskId, status) => ipcRenderer.invoke(
            eipcChannel('claude.web', 'CCDScheduledTasks', 'updateScheduledTaskStatus'),
            scheduledTaskId,
            status,
        ),
        removeApprovedPermission: (scheduledTaskId, permissionId) => ipcRenderer.invoke(
            eipcChannel('claude.web', 'CCDScheduledTasks', 'removeApprovedPermission'),
            scheduledTaskId,
            permissionId,
        ),
    },
    DesktopNotifications: {
        getAuthorizationStatus: () => ipcRenderer.invoke(
            eipcChannel('claude.web', 'DesktopNotifications', 'getAuthorizationStatus'),
        ),
        requestAuthorization: () => ipcRenderer.invoke(
            eipcChannel('claude.web', 'DesktopNotifications', 'requestAuthorization'),
        ),
        openNotificationSettings: () => ipcRenderer.invoke(
            eipcChannel('claude.web', 'DesktopNotifications', 'openNotificationSettings'),
        ),
        showNotification: (payload) => ipcRenderer.invoke(
            eipcChannel('claude.web', 'DesktopNotifications', 'showNotification'),
            payload,
        ),
    },
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

    // Bridge port — main may bind to a different port if 30080 is taken.
    // `getBridgePort()` returns the port main is currently listening on;
    // `onBridgePort` fires when bridge restarts on a different port.
    getBridgePort: () => ipcRenderer.invoke('get-bridge-port'),
    onBridgePort: (callback) => ipcRenderer.on('bridge:port', (_, port) => callback(port)),

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
