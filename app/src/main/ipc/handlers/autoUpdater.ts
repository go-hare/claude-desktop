/**
 * AutoUpdater stubs. Phase 0.3 reports "no update available" so the SPA's
 * update banner stays hidden. Phase 1.5 wires up `electron-updater`.
 */

import type { IpcRegistry } from '../registry';

const initialState = {
  status: 'idle' as 'idle' | 'checking' | 'downloading' | 'available' | 'error',
  pendingRestart: false,
  version: null as string | null,
};

let state = initialState;

export function registerAutoUpdaterHandlers(reg: IpcRegistry) {
  reg.method('claude.web', 'AutoUpdater', 'checkForUpdates', () => ({ updateAvailable: false }));
  reg.method('claude.web', 'AutoUpdater', 'cancelPendingRestart', () => {
    state = { ...state, pendingRestart: false };
    reg.broadcastStoreUpdate('claude.web', 'AutoUpdater', 'updaterStateStore', state);
  });
  reg.method('claude.web', 'AutoUpdater', 'restartToUpdate', () => undefined);
  reg.method('claude.web', 'AutoUpdater', 'restartToUpdateWhenIdle', () => undefined);
  reg.method('claude.web', 'AutoUpdater', 'getRunningLocalSessionCount', () => 0);

  reg.store('claude.web', 'AutoUpdater', 'updaterStateStore', {
    getState: () => state,
  });
}
