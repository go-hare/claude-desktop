import { app, BrowserWindow } from 'electron';
import { installIpcRouter } from './ipc/router';
import { installAppProtocolHandler, registerAppProtocolScheme } from './protocol/appProtocol';
import { createMainWindow } from './windows/mainWindow';

registerAppProtocolScheme();

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
