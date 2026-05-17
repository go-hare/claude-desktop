/**
 * In-memory app preferences. Mirrors what the official build persists via
 * electron-store, but we'll skip persistence until phase 1 — the SPA only
 * needs read-after-write consistency within a session.
 */

import { app } from 'electron';
import { homedir } from 'node:os';
import type { IpcRegistry } from '../registry';

const DEFAULT_PREFERENCES: Record<string, unknown> = {
  theme: 'system',
  send_message_shortcut: 'enter',
  // Anything else SPA reads will surface as `undefined` — most preference
  // accessors in ion-dist do `prefs?.x ?? defaultValue`.
};

const preferences: Record<string, unknown> = { ...DEFAULT_PREFERENCES };

/**
 * App-feature map consumed by ion-dist's `XK` store. The SPA accesses
 * features as `appFeatures.<name>.status` (via the YK(map, name) helper
 * which falls back to `{status: "unavailable"}`), NOT as boolean flags.
 *
 * Status values:
 *   - "supported"   → feature is enabled, render the surface
 *   - "unsupported" → feature explicitly disabled (org / version gated)
 *   - "unavailable" → feature isn't known to this build (default)
 *
 * IMPORTANT: XK store gets initial state from `window.desktopBootFeatures`
 * (set in preload), then OVERWRITES it with this IPC return when the SPA
 * calls `getSupportedFeatures()` during bootstrap. So this map MUST match
 * the preload's `desktopBootFeatures` — any flag missing here gets
 * downgraded to "unavailable" after IPC resolves.
 *
 * Names are discovered by grepping `chillingSloth*` and `YK(<store>, ...)`
 * calls in the SPA bundle. Adding more here is cheap.
 */
const SUPPORTED_FEATURES: Record<string, { status: 'supported' | 'unsupported' | 'unavailable' }> = {
  // Window chrome — when `supported`, SPA suppresses the in-sidebar
  // "协作 / 代码" mode toggle (it expects the host to draw a native top
  // bar instead). Keep unsupported so the toggle renders.
  desktopTopBar: { status: 'unsupported' },
  // Claude Code surface gates. Five flags discovered by grepping
  // `chillingSloth*` in ion-dist; all must be `supported` for the full
  // Code-mode sidebar (toggle + 定时任务 etc) to appear.
  chillingSlothEnterprise: { status: 'supported' },
  chillingSlothFeat: { status: 'supported' },
  chillingSlothLocal: { status: 'supported' },
  chillingSlothLocation: { status: 'supported' },
  chillingSlothPool: { status: 'supported' },
  // CCD scheduled-tasks surface — required for "定时任务" sidebar item.
  ccdPlugins: { status: 'supported' },
  // Cowork / Yukon desktop gates. These are needed for the official
  // 协作 / 代码 shell to render instead of falling back to the reduced local UI.
  coworkKappa: { status: 'supported' },
  yukonSilver: { status: 'supported' },
  yukonSilverGems: { status: 'supported' },
  yukonSilverGemsCache: { status: 'supported' },
  // Still disabled until we wire real host capabilities.
  computerUse: { status: 'unsupported' },
  nativeQuickEntry: { status: 'unsupported' },
  quickEntryDictation: { status: 'unsupported' },
};

export function registerSettingsHandlers(reg: IpcRegistry) {
  // AppConfig
  reg.method('claude.settings', 'AppConfig', 'getAppConfig', () => ({
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
    isUsingBuiltInNodeForMcp: true,
    isDxtAutoUpdatesEnabled: false,
  }));
  reg.method('claude.settings', 'AppConfig', 'setAppFeature', () => undefined);
  reg.method('claude.settings', 'AppConfig', 'setIsDxtAutoUpdatesEnabled', () => undefined);
  reg.method('claude.settings', 'AppConfig', 'setIsUsingBuiltInNodeForMcp', () => undefined);

  // AppFeatures
  reg.method('claude.settings', 'AppFeatures', 'getSupportedFeatures', () => SUPPORTED_FEATURES);

  // AppPreferences
  reg.method('claude.settings', 'AppPreferences', 'getPreferences', () => ({ ...preferences }));
  reg.method('claude.settings', 'AppPreferences', 'setPreference', (key, value) => {
    if (typeof key !== 'string') return undefined;
    preferences[key] = value;
    reg.broadcastEvent('claude.settings', 'AppPreferences', 'preferencesChanged', {
      ...preferences,
    });
    return undefined;
  });

  // DesktopInfo
  reg.method('claude.settings', 'DesktopInfo', 'getSystemInfo', () => ({
    platform: process.platform,
    arch: process.arch,
    osVersion: process.getSystemVersion?.() ?? '',
    appVersion: app.getVersion(),
    home: homedir(),
    locale: app.getLocale(),
  }));
  reg.method('claude.settings', 'DesktopInfo', 'showLogsInFileManager', () => undefined);
}
