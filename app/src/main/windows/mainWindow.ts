import { BrowserWindow, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
// Initial entry. Map by ion-dist's HK() router function:
//   /claude-code-desktop[...]      → mode "code"      ← rich Code-mode sidebar (toggle + 定时任务)
//   /epitaxy                       → mode "epitaxy"   ← lacks code-mode tab key, sidebar degrades
//   /code, /code/...               → mode "epitaxy"   ← same degradation
//   /task, /task/...               → mode "task"      ← Cowork sidebar
//   /new, /chat/..., /recents      → mode "chat"      ← Chat sidebar
//
// We want "code" mode (the Claude Code surface). The mode-toggle in the
// sidebar (协作 / 代码) only renders when the active mode key matches a
// tab key in Zje's array (task or code) — "epitaxy" doesn't, which is
// why /epitaxy lands on a degraded sidebar without the toggle.
const ENTRY_URL = 'app://localhost/claude-code-desktop';

function isAppUrl(url: string) {
  try {
    return new URL(url).protocol === 'app:';
  } catch {
    return false;
  }
}

function installDiagnostics(win: BrowserWindow) {
  let uiProbeCount = 0;

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.warn('[rebuild:web] failed to load', { errorCode, errorDescription, validatedURL });
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.warn('[rebuild:web] console', { level, message, line, sourceId });
    }
  });

  // Capture session reference once. session can outlive webContents (it's
  // shared across windows that share a partition), so we install listeners
  // that internally guard against the originating window being destroyed.
  const { session } = win.webContents;

  const onError = (details: Electron.OnErrorOccurredListenerDetails) => {
    if (win.isDestroyed()) return;
    if (details.resourceType === 'image' || details.resourceType === 'font') {
      return;
    }
    console.warn('[rebuild:web] request failed', {
      url: details.url,
      method: details.method,
      type: details.resourceType,
      error: details.error,
    });
  };

  const onCompleted = (details: Electron.OnCompletedListenerDetails) => {
    if (win.isDestroyed()) return;
    if (details.statusCode >= 400 && details.resourceType !== 'image' && details.resourceType !== 'font') {
      console.warn('[rebuild:web] request completed', {
        url: details.url,
        method: details.method,
        type: details.resourceType,
        statusCode: details.statusCode,
      });
    }
  };

  session.webRequest.onErrorOccurred(onError);
  session.webRequest.onCompleted(onCompleted);

  win.webContents.on('did-finish-load', () => {
    if (uiProbeCount >= 2) return;
    uiProbeCount += 1;
    setTimeout(() => {
      if (win.isDestroyed()) return;
      void win.webContents
        .executeJavaScript(
          `(() => Promise.resolve(globalThis["claude.settings"]?.AppFeatures?.getSupportedFeatures?.()).then((features) => {
            // Read SPA bootstrap data from React Query cache via DevTools-style fiber walk.
            // Look for any element whose hooks expose 'isLoading' / 'activeOrganization' state.
            const aside = document.querySelector('aside.dframe-sidebar');
            let bootstrapData = null;
            let curContext = null;
            if (aside) {
              const fk = Object.keys(aside).find(k => k.startsWith('__reactFiber'));
              let f = aside[fk];
              while (f && (!bootstrapData || !curContext)) {
                // Walk hook list (memoizedState linked list)
                let hook = f.memoizedState;
                let hi = 0;
                while (hook && hi < 30) {
                  const ms = hook.memoizedState;
                  if (ms && typeof ms === 'object') {
                    if (ms.activeOrganization && ms.account && !bootstrapData) {
                      bootstrapData = {
                        accountUuid: ms.account.uuid,
                        orgUuid: ms.activeOrganization?.uuid,
                        isLoading: ms.isLoading,
                        hasGrowthbook: !!ms.growthbook,
                      };
                    }
                    if (ms.featureGateEnabled !== undefined && !curContext) {
                      curContext = {
                        featureGateEnabled: ms.featureGateEnabled,
                        status: ms.status,
                        considerEnabledForNonUI: ms.considerEnabledForNonUI,
                        loading: ms.loading,
                      };
                    }
                  }
                  hook = hook.next;
                  hi++;
                }
                if (!f.return) break;
                f = f.return;
              }
            }
            // Test: look up cookie / storage to confirm dframe-store has mergedExperience
            let dframeStore = null;
            try {
              const raw = localStorage.getItem('dframe-store');
              if (raw) {
                const parsed = JSON.parse(raw);
                dframeStore = {
                  collapsed: parsed.state?.collapsed,
                  mergedExperience: parsed.state?.mergedExperience,
                  lastKnownMode: parsed.state?.lastKnownMode,
                };
              }
            } catch {}
            return {
              href: location.href,
              togglePresent: Boolean(document.querySelector('.df-pills')),
              bootstrapData,
              curContext,
              dframeStore,
              coworkBackend: (() => { try { return localStorage.getItem('cowork-remote-backend'); } catch { return null; } })(),
              appFeatures: features ?? null,
            };
          }).catch((error) => ({ probeError: String(error), stack: error?.stack?.slice(0, 500), href: location.href })))()`,
          true,
        )
        .then((state) => {
          console.warn('[rebuild:ui-probe]', state);
        })
        .catch((error) => {
          console.warn('[rebuild:ui-probe] failed', error);
        });
    }, 1500);
  });

  // Detach listeners when the window goes away so they don't leak across
  // reload cycles (and don't fire after webContents teardown).
  win.once('closed', () => {
    try {
      session.webRequest.onErrorOccurred(null);
      session.webRequest.onCompleted(null);
    } catch {
      // session may already be torn down — best-effort detach.
    }
  });
}

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Claude',
    backgroundColor: '#ffffff',
    show: false,
    // Frameless chrome on every platform.
    //   macOS: `hiddenInset` keeps the traffic-light overlay at the top-left.
    //   Windows/Linux: `hidden` removes the native chrome; `titleBarOverlay`
    //   re-injects the system min/max/close controls in the top-right so the
    //   user can still close the window without a custom button. Without
    //   this, Electron renders a full native title bar (with the app icon
    //   and a "Claude" string) above the SPA — that's the strip the
    //   reference screenshot doesn't have.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform !== 'darwin'
      ? {
          titleBarOverlay: {
            // Match the SPA's light surface. Windows reserves this strip
            // behind the system min/max/close buttons; if it doesn't match
            // the SPA background, a colored band leaks through across the
            // top of the window.
            color: '#ffffff',
            symbolColor: '#1a1a1a',
            height: 32,
          },
        }
      : {}),
    trafficLightPosition: { x: 12, y: 14 },
    // Let the SPA's CSS region declarations control which areas drag the
    // window (via `app-region: drag`/`-webkit-app-region: drag`). ion-dist's
    // sidebar header has `draggable` className that's the cue.
    webPreferences: {
      preload: join(moduleDir, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Tag the userAgent with `Claude/<version>` so ion-dist's desktop-detection
  // regex (`/claude(nest|gov)?\/([^ ]+)/i` in c5f4e1303) recognises us as the
  // first-party Claude desktop app. Without this, routes like /epitaxy fall
  // back to the public web onboarding ("Code with Claude anywhere") because
  // the SPA assumes we're a regular browser session.
  const ua = win.webContents.getUserAgent() + ' Claude/1.0.0';
  win.webContents.setUserAgent(ua);

  installDiagnostics(win);

  win.once('ready-to-show', () => {
    win.show();
  });

  // ion-dist labels its top header strip `draggable` (= `-webkit-app-region:
  // drag`) so users can drag the window from the empty space. The class is
  // applied to the whole flex container, which means children — including
  // the hamburger / sidebar toggle / search / back / forward buttons — also
  // inherit drag, and Windows then swallows their mousedown as a window-move
  // gesture. macOS doesn't notice because its traffic-light overlay sits in
  // a separate region. Force every interactive descendant back to no-drag.
  win.webContents.on('did-finish-load', () => {
    if (win.isDestroyed()) return;
    void win.webContents.insertCSS(
      `.draggable button,
       .draggable a,
       .draggable [role="button"],
       .draggable input,
       .draggable [data-no-drag] {
         -webkit-app-region: no-drag;
       }`,
    );
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Only intercept navigations that try to leave our `app://` origin.
  // Any in-app route (/task, /epitaxy, /code, /new, /chat/..., etc.) is
  // the SPA's own client-side router doing its job — we MUST NOT redirect
  // those, or React Router and our window state get out of sync.
  win.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) {
      return;
    }
    event.preventDefault();
    void shell.openExternal(url);
  });

  void win.loadURL(ENTRY_URL);

  return win;
}
