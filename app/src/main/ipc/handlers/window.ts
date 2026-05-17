import { BrowserWindow, nativeTheme } from 'electron';
import type { IpcRegistry } from '../registry';

function focusedOrFirstWindow(): BrowserWindow | null {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  return win && !win.isDestroyed() ? win : null;
}

export function registerWindowHandlers(reg: IpcRegistry) {
  // WindowControl
  reg.method('claude.web', 'WindowControl', 'close', () => {
    focusedOrFirstWindow()?.close();
  });
  reg.method('claude.web', 'WindowControl', 'focus', () => {
    focusedOrFirstWindow()?.focus();
  });
  reg.method('claude.web', 'WindowControl', 'resize', (width, height) => {
    const win = focusedOrFirstWindow();
    if (!win) return;
    if (typeof width === 'number' && typeof height === 'number') {
      win.setSize(Math.round(width), Math.round(height));
    }
  });
  reg.method('claude.web', 'WindowControl', 'setThemeMode', (mode) => {
    if (mode === 'system' || mode === 'light' || mode === 'dark') {
      nativeTheme.themeSource = mode;
    }
  });
  reg.method('claude.web', 'WindowControl', 'setIncognitoMode', () => {
    // No-op: phase 0 doesn't track incognito state.
  });
  reg.method('claude.web', 'WindowControl', 'captureScreenshot', async () => {
    const win = focusedOrFirstWindow();
    if (!win) return null;
    const image = await win.webContents.capturePage();
    return image.toDataURL();
  });

  // WindowState
  reg.method('claude.web', 'WindowState', 'getFullscreen', () => {
    return focusedOrFirstWindow()?.isFullScreen() ?? false;
  });
  reg.method('claude.web', 'WindowState', 'getVisibility', () => {
    return focusedOrFirstWindow()?.isVisible() ?? false;
  });
  reg.method('claude.web', 'WindowState', 'getZoomFactor', () => {
    return focusedOrFirstWindow()?.webContents.getZoomFactor() ?? 1;
  });

  // MainWindowTitleBar — these are normally implemented by the title-bar
  // preload running in the main_window shell. The SPA frame inside calls
  // them too, so we wire up no-op / health-true defaults.
  reg.method('claude.internal.ui', 'MainWindowTitleBar', 'titleBarReady', () => undefined);
  reg.method('claude.internal.ui', 'MainWindowTitleBar', 'updateTitleBar', () => undefined);
  reg.method('claude.internal.ui', 'MainWindowTitleBar', 'showLoadError', () => undefined);
  reg.method('claude.internal.ui', 'MainWindowTitleBar', 'hideLoadError', () => undefined);
  reg.method('claude.internal.ui', 'MainWindowTitleBar', 'isClaudeCurrentlyHealthy', () => true);
  reg.method('claude.internal.ui', 'MainWindowTitleBar', 'requestMainMenuPopup', () => undefined);
  reg.method('claude.internal.ui', 'MainWindowTitleBar', 'requestReloadMainView', () => {
    focusedOrFirstWindow()?.webContents.reload();
  });
}
