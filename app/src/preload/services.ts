/**
 * Service registry and factory for the renderer-side IPC bridge.
 *
 * The official Claude Desktop preload exposes `globalThis["claude.web"]`,
 * `globalThis["claude.settings"]`, etc. — each holding service objects
 * (LocalSessions, AppConfig, …) whose methods either invoke a routing key
 * over `ipcRenderer` (async methods), subscribe to a routing key (events),
 * or wrap a `{getState, getStateSync, onStateChange}` triplet (stores).
 *
 * We mirror that shape but route every call through a single channel
 * (`REBUILD_RPC_CHANNEL`) so the main process can dispatch centrally. The
 * SPA can't tell the difference: it just sees plain async methods,
 * `onXxx(cb) → unsubscribe`, and stores.
 */

import { ipcRenderer } from 'electron';
import {
  REBUILD_EVENT_CHANNEL,
  REBUILD_RPC_CHANNEL,
  type RpcEventMessage,
  type RpcRequest,
  type RpcResponse,
  eventChannelKey,
  storeUpdateKey,
} from '../shared/ipcProtocol';

interface ServiceSpec {
  /** Async method names → ipcRenderer.invoke + return value */
  methods?: readonly string[];
  /**
   * Event names. Renderer-side helper is `on<EventName>` (with first letter
   * capitalised, matching the official SPA convention like
   * `onGlobalShortcutChange`). Subscribers receive only the payload.
   */
  events?: readonly string[];
  /**
   * Store names ending with `Store`. Renderer-side helper is the same name
   * exposing `{getState(), getStateSync(), onStateChange(cb)}`.
   */
  stores?: readonly string[];
}

type Registry = Record<string, Record<string, ServiceSpec>>;

async function callMethod(
  ns: string,
  cls: string,
  method: string,
  args: unknown[],
): Promise<unknown> {
  const req: RpcRequest = { kind: 'method', ns, cls, method, args };
  const res = (await ipcRenderer.invoke(REBUILD_RPC_CHANNEL, req)) as RpcResponse;
  if (!res.ok) {
    const err = new Error(res.error);
    if (res.code) (err as Error & { code?: string }).code = res.code;
    throw err;
  }
  return res.value;
}

async function callStore(
  ns: string,
  cls: string,
  store: string,
  action: 'getState' | 'getStateSync',
): Promise<unknown> {
  const req: RpcRequest = { kind: 'store', ns, cls, store, action };
  const res = (await ipcRenderer.invoke(REBUILD_RPC_CHANNEL, req)) as RpcResponse;
  if (!res.ok) {
    throw new Error(res.error);
  }
  return res.value;
}

type Listener = (payload: unknown) => void;
const eventListeners = new Map<string, Set<Listener>>();
const storeListeners = new Map<string, Set<Listener>>();
let eventChannelInstalled = false;

function ensureEventChannelInstalled() {
  if (eventChannelInstalled) return;
  eventChannelInstalled = true;
  ipcRenderer.on(REBUILD_EVENT_CHANNEL, (_event, msg: RpcEventMessage) => {
    const key =
      msg.kind === 'event'
        ? eventChannelKey(msg.ns, msg.cls, msg.event)
        : storeUpdateKey(msg.ns, msg.cls, msg.store);
    const target = msg.kind === 'event' ? eventListeners : storeListeners;
    const subs = target.get(key);
    if (!subs) return;
    for (const cb of subs) {
      try {
        cb(msg.payload);
      } catch (err) {
        console.error('[rebuild:preload] listener threw', err);
      }
    }
  });
}

function subscribeEvent(key: string, cb: Listener): () => void {
  ensureEventChannelInstalled();
  let subs = eventListeners.get(key);
  if (!subs) {
    subs = new Set();
    eventListeners.set(key, subs);
  }
  subs.add(cb);
  return () => {
    subs!.delete(cb);
  };
}

function subscribeStore(key: string, cb: Listener): () => void {
  ensureEventChannelInstalled();
  let subs = storeListeners.get(key);
  if (!subs) {
    subs = new Set();
    storeListeners.set(key, subs);
  }
  subs.add(cb);
  return () => {
    subs!.delete(cb);
  };
}

function eventHandlerName(event: string): string {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

function buildService(ns: string, cls: string, spec: ServiceSpec): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  for (const method of spec.methods ?? []) {
    obj[method] = (...args: unknown[]) => callMethod(ns, cls, method, args);
  }

  for (const event of spec.events ?? []) {
    const handlerName = eventHandlerName(event);
    obj[handlerName] = (cb: Listener) =>
      subscribeEvent(eventChannelKey(ns, cls, event), cb);
  }

  for (const storeName of spec.stores ?? []) {
    obj[storeName] = {
      getState: () => callStore(ns, cls, storeName, 'getState'),
      getStateSync: () => {
        // Synchronous variant intentionally omitted — sendSync blocks the
        // renderer thread and we have no caller using it yet. If a store
        // needs it later, we'll plumb it through then.
        throw new Error(`getStateSync not implemented for ${ns}::${cls}.${storeName}`);
      },
      onStateChange: (cb: Listener) =>
        subscribeStore(storeUpdateKey(ns, cls, storeName), cb),
    };
  }

  return obj;
}

/**
 * Service registry. Methods listed here are wired to the preload bridge
 * even if the main process hasn't implemented them yet (they'll throw
 * NOT_AVAILABLE at call time). Add a new method by listing it here AND
 * registering a handler in main/ipc/handlers.
 *
 * Scope = "phase 0.3 minimum to get the SPA past startup": ~70 methods
 * across the 17-class core. Anything not listed is simply not callable
 * by the SPA, which the SPA's `globalThis["..."]?.X` checks tolerate.
 */
export const REGISTRY: Registry = {
  'claude.web': {
    Account: {
      methods: ['setAccountDetails'],
    },
    Auth: {
      methods: ['doAuthInBrowser'],
    },
    DeepLink: {
      methods: ['handleDeepLink'],
    },
    Toast: {
      methods: ['showToast'],
    },
    Navigation: {
      methods: ['navigate'],
    },
    MenuEvents: {
      methods: ['closeWindow', 'openFile'],
    },
    BrowserNavigation: {
      methods: [
        'goBack',
        'goForward',
        'navigationState',
        'reportNavigationState',
        'requestMainMenuPopup',
      ],
    },
    WindowControl: {
      methods: [
        'captureScreenshot',
        'close',
        'focus',
        'resize',
        'setIncognitoMode',
        'setThemeMode',
      ],
    },
    WindowState: {
      methods: ['getFullscreen', 'getVisibility', 'getZoomFactor'],
      events: [
        'fullscreenChanged',
        'visibilityChanged',
        'zoomFactorChanged',
        'cuDockStateChanged',
      ],
    },
    DesktopNotifications: {
      methods: [
        'getAuthorizationStatus',
        'openNotificationSettings',
        'requestAuthorization',
        'showNotification',
      ],
      events: ['onNotificationClicked'],
    },
    AutoUpdater: {
      methods: [
        'cancelPendingRestart',
        'checkForUpdates',
        'getRunningLocalSessionCount',
        'restartToUpdate',
        'restartToUpdateWhenIdle',
      ],
      events: ['updaterState'],
      stores: ['updaterStateStore'],
    },
    ClaudeCode: {
      methods: ['checkGitAvailable', 'getStatus', 'prepare', 'resolveLocalSettings'],
    },
    FileSystem: {
      methods: [
        'browseFiles',
        'browseFolder',
        'browseFolders',
        'readLocalFile',
        'showInFolder',
        'writeLocalFile',
      ],
    },
    Resources: {
      methods: [
        'fetchMentionOptions',
        'listProjectFiles',
        'searchFileContents',
        'setFocusedCwd',
      ],
    },
    LocalSessions: {
      methods: [
        'addDirectories',
        'addTrustedFolder',
        'archive',
        'cancelQueuedMessage',
        'checkGitAvailable',
        'delete',
        'getAll',
        'getCodeStats',
        'getContextUsage',
        'getDefaultEffort',
        'getDefaultPermissionMode',
        'getDetectedProjects',
        'getEffort',
        'getGitInfo',
        'getInstalledEditors',
        'getPermissionMode',
        'getSession',
        'getSupportedCommands',
        'getTranscript',
        'interrupt',
        'isFolderTrusted',
        'sendMessage',
        'setEffort',
        'setFocusedSession',
        'setMcpServers',
        'setModel',
        'setPermissionMode',
        'start',
        'stop',
        'stopTask',
        'updateSession',
      ],
      events: ['onEvent', 'onToolPermissionRequest'],
    },
    LocalAgentModeSessions: {
      methods: [
        'getAll',
        'getSession',
        'getTranscript',
        'getTrustedFolders',
        'isFolderTrusted',
        'getSessionsBridgeEnabled',
        'getBridgeConsent',
        'getDirectMcpServerStatuses',
        'getSupportedCommands',
        'getLocalSkillFiles',
        'listLocalSkills',
        'searchSessions',
        'getSessionsForScheduledTask',
        'setDraftSessionFolders',
      ],
      events: [
        'onEvent',
        'onToolPermissionRequest',
        'onBridgePermissionPreflight',
        'onCoworkFromMain',
        'onDirectMcpServerStatusesChanged',
        'onRemoteSessionStart',
        'sessionsBridgeStatus',
      ],
      stores: ['sessionsBridgeStatusStore'],
    },
    Launch: {
      methods: ['getConfiguredServices', 'getLogs', 'isAvailable'],
      stores: ['activeServersStore'],
    },
    CCDScheduledTasks: {
      methods: [
        'getAllScheduledTasks',
        'getScheduledTaskFileContent',
        'createScheduledTask',
        'updateScheduledTask',
        'updateScheduledTaskFileContent',
        'updateScheduledTaskStatus',
        'removeApprovedPermission',
      ],
      events: ['onScheduledTaskEvent'],
    },
  },
  'claude.settings': {
    AppConfig: {
      methods: [
        'getAppConfig',
        'setAppFeature',
        'setIsDxtAutoUpdatesEnabled',
        'setIsUsingBuiltInNodeForMcp',
      ],
    },
    AppFeatures: {
      methods: ['getSupportedFeatures'],
    },
    AppPreferences: {
      methods: ['getPreferences', 'setPreference'],
      events: ['preferencesChanged'],
    },
    DesktopInfo: {
      methods: ['getSystemInfo', 'showLogsInFileManager'],
    },
  },
  'claude.skills': {
    Skills: {
      methods: ['previewSkillFile'],
    },
  },
  'claude.hybrid': {
    DesktopIntl: {
      methods: ['getInitialLocale', 'requestLocaleChange'],
      events: ['localeChanged'],
    },
  },
  'claude.internal.ui': {
    MainWindowTitleBar: {
      methods: [
        'hideLoadError',
        'isClaudeCurrentlyHealthy',
        'requestMainMenuPopup',
        'requestReloadMainView',
        'showLoadError',
        'titleBarReady',
        'updateTitleBar',
      ],
    },
  },
};

export function buildAllNamespaces(): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const [ns, classes] of Object.entries(REGISTRY)) {
    const out: Record<string, unknown> = {};
    for (const [cls, spec] of Object.entries(classes)) {
      out[cls] = buildService(ns, cls, spec);
    }
    result[ns] = out;
  }
  return result;
}
