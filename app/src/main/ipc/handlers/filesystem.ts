import { BrowserWindow, dialog, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import type { IpcRegistry } from '../registry';

function activeWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

interface BrowseOptions {
  defaultPath?: string;
  filters?: Electron.FileFilter[];
  title?: string;
}

export function registerFilesystemHandlers(reg: IpcRegistry) {
  reg.method('claude.web', 'FileSystem', 'browseFolder', async (rawOpts) => {
    const opts = (rawOpts ?? {}) as BrowseOptions;
    const win = activeWindow();
    const result = await (win
      ? dialog.showOpenDialog(win, { ...opts, properties: ['openDirectory'] })
      : dialog.showOpenDialog({ ...opts, properties: ['openDirectory'] }));
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  reg.method('claude.web', 'FileSystem', 'browseFolders', async (rawOpts) => {
    const opts = (rawOpts ?? {}) as BrowseOptions;
    const win = activeWindow();
    const result = await (win
      ? dialog.showOpenDialog(win, { ...opts, properties: ['openDirectory', 'multiSelections'] })
      : dialog.showOpenDialog({
          ...opts,
          properties: ['openDirectory', 'multiSelections'],
        }));
    return result.canceled ? [] : result.filePaths;
  });

  reg.method('claude.web', 'FileSystem', 'browseFiles', async (rawOpts) => {
    const opts = (rawOpts ?? {}) as BrowseOptions;
    const win = activeWindow();
    const result = await (win
      ? dialog.showOpenDialog(win, { ...opts, properties: ['openFile', 'multiSelections'] })
      : dialog.showOpenDialog({ ...opts, properties: ['openFile', 'multiSelections'] }));
    return result.canceled ? [] : result.filePaths;
  });

  reg.method('claude.web', 'FileSystem', 'readLocalFile', async (path) => {
    if (typeof path !== 'string') throw new Error('readLocalFile: path must be string');
    return readFile(path, 'utf8');
  });

  reg.method('claude.web', 'FileSystem', 'writeLocalFile', async (path, contents) => {
    if (typeof path !== 'string') throw new Error('writeLocalFile: path must be string');
    if (typeof contents !== 'string') throw new Error('writeLocalFile: contents must be string');
    await writeFile(path, contents, 'utf8');
  });

  reg.method('claude.web', 'FileSystem', 'showInFolder', (path) => {
    if (typeof path === 'string') shell.showItemInFolder(path);
  });
}
