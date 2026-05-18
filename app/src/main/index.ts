import { app, BrowserWindow, Menu } from 'electron';
import { installIpcRouter } from './ipc/router';
import { installAppProtocolHandler, registerAppProtocolScheme } from './protocol/appProtocol';
import { createMainWindow } from './windows/mainWindow';

registerAppProtocolScheme();

// The SPA already provides its own command palette and per-window controls,
// so the default Electron application menu (File / Edit / View / Window /
// Help) is dead chrome. Drop it on Windows/Linux, where it would otherwise
// render as a top menu strip, and clear it on macOS too — keyboard shortcuts
// for copy/paste/select-all still work via the renderer's default bindings.
Menu.setApplicationMenu(null);

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.whenReady()
    .then(async () => {
      installIpcRouter();
      await installAppProtocolHandler();
      const mainWindow = createMainWindow();

      app.on('second-instance', () => {
        if (mainWindow.isDestroyed()) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      });

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createMainWindow();
        }
      });
    })
    .catch((error) => {
      console.error('[rebuild] failed to start app:', error);
      app.quit();
    });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
