const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');

const DEFAULT_DESKTOP_SUPPORT_NAME = 'Claude';
const DEFAULT_CODE_SUPPORT_NAME = 'Claude-3p';
const DEFAULT_APP_DISPLAY_NAME = 'Claude Desktop';

function getDefaultAppDataRoot() {
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support');
    }
    if (process.platform === 'win32') {
        return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    }
    return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function resolveRuntimePaths() {
    const appDataRoot = getDefaultAppDataRoot();
    const appSupportDir = process.env.CLAUDE_DESKTOP_DATA_DIR || path.join(appDataRoot, DEFAULT_DESKTOP_SUPPORT_NAME);
    const codeSupportDir = process.env.CLAUDE_3P_DATA_DIR || path.join(appDataRoot, DEFAULT_CODE_SUPPORT_NAME);
    const claudeCodeDir = process.env.CLAUDE_CODE_RUNTIME_DIR || path.join(codeSupportDir, 'claude-code');
    const workspacesDir = process.env.CLAUDE_DESKTOP_WORKSPACES_DIR || path.join(appSupportDir, 'workspaces');

    return {
        appDisplayName: process.env.CLAUDE_DESKTOP_APP_DISPLAY_NAME || DEFAULT_APP_DISPLAY_NAME,
        appSupportDir,
        codeSupportDir,
        claudeConfigDir: codeSupportDir,
        claudeCodeDir,
        workspacesDir,
    };
}

function configureRuntimePaths() {
    const runtimePaths = resolveRuntimePaths();

    app.setName(runtimePaths.appDisplayName);
    app.setPath('userData', ensureDir(runtimePaths.appSupportDir));

    process.env.CLAUDE_DESKTOP_DATA_DIR = runtimePaths.appSupportDir;
    process.env.CLAUDE_3P_DATA_DIR = ensureDir(runtimePaths.codeSupportDir);
    process.env.CLAUDE_CODE_RUNTIME_DIR = ensureDir(runtimePaths.claudeCodeDir);
    process.env.CLAUDE_DESKTOP_WORKSPACES_DIR = ensureDir(runtimePaths.workspacesDir);
    process.env.CLAUDE_CONFIG_DIR = ensureDir(runtimePaths.claudeConfigDir);

    return runtimePaths;
}

module.exports = {
    configureRuntimePaths,
    resolveRuntimePaths,
};
