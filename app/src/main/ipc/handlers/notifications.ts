import { Notification } from 'electron';
import type { IpcRegistry } from '../registry';

export function registerNotificationsHandlers(reg: IpcRegistry) {
  // Toast — surface in main process console; ion-dist also renders its own
  // toast UI, so this is mostly diagnostic.
  reg.method('claude.web', 'Toast', 'showToast', (payload) => {
    console.log('[rebuild:toast]', payload);
  });

  // Navigation — SPA-internal navigation. The renderer drives this client
  // side; we just acknowledge.
  reg.method('claude.web', 'Navigation', 'navigate', () => undefined);

  // MenuEvents
  reg.method('claude.web', 'MenuEvents', 'closeWindow', () => undefined);
  reg.method('claude.web', 'MenuEvents', 'openFile', () => undefined);

  // BrowserNavigation — these mirror the Electron back/forward state for
  // the embedded WebContentsView. Phase 0 has no embedded view yet, so we
  // return inert defaults.
  reg.method('claude.web', 'BrowserNavigation', 'goBack', () => undefined);
  reg.method('claude.web', 'BrowserNavigation', 'goForward', () => undefined);
  reg.method('claude.web', 'BrowserNavigation', 'navigationState', () => ({
    canGoBack: false,
    canGoForward: false,
  }));
  reg.method('claude.web', 'BrowserNavigation', 'reportNavigationState', () => undefined);
  reg.method('claude.web', 'BrowserNavigation', 'requestMainMenuPopup', () => undefined);

  // DesktopNotifications
  reg.method('claude.web', 'DesktopNotifications', 'getAuthorizationStatus', () => 'authorized');
  reg.method('claude.web', 'DesktopNotifications', 'requestAuthorization', () => 'authorized');
  reg.method('claude.web', 'DesktopNotifications', 'openNotificationSettings', () => undefined);
  reg.method('claude.web', 'DesktopNotifications', 'showNotification', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const { title, body } = payload as { title?: string; body?: string };
    if (!Notification.isSupported()) return;
    new Notification({ title: title ?? 'Claude', body: body ?? '' }).show();
  });
}
