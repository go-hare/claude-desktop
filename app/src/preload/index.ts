import { contextBridge } from 'electron';
import { buildAllNamespaces } from './services';

const namespaces = buildAllNamespaces();

for (const [ns, services] of Object.entries(namespaces)) {
  // ion-dist accesses these via `globalThis["claude.web"].LocalSessions...`
  // — the namespace string contains a dot so the SPA can't dotted-access it.
  contextBridge.exposeInMainWorld(ns, services);
}

/**
 * `window.claudeAppBindings` is a small shortcut/keybinding + MCP surface
 * that ion-dist's `jw()` hook (in c5f4e1303) checks alongside a userAgent
 * `Claude/<version>` match to decide if it's running inside the first-party
 * Claude Desktop app. If the bindings object is missing, route gates like
 * /epitaxy redirect to the public-web onboarding fallback.
 *
 * Phase 0 stubs: no-op everything except returning safe shapes. Real
 * keybinding plumbing comes later when we have a globalShortcut bridge.
 */
contextBridge.exposeInMainWorld('claudeAppBindings', {
  registerBinding: (_key: string, _handler: unknown) => undefined,
  unregisterBinding: (_key: string) => undefined,
  listMcpServers: async (): Promise<unknown[]> => [],
  connectToMcpServer: async (_args: unknown) => ({ ok: false }),
  openMcpSettings: () => undefined,
});

/**
 * `window.desktopBootFeatures` is a synchronous feature map the SPA reads
 * BEFORE any IPC resolves. It controls render-time decisions like:
 *   - desktopTopBar: when "supported", the SPA suppresses the in-sidebar
 *     mode-toggle ("协作 / 代码" tabs) because it expects the host shell
 *     to draw its own native top bar.
 *   - chillingSlothEnterprise: gate for the /epitaxy route.
 * Same shape as IPC `AppFeatures.getSupportedFeatures()` but read sync via
 * `QK()` in index-BELzQL5P. The IPC call updates a *different* store (XK)
 * — both must agree to avoid hydration glitches.
 */
const desktopBootFeatures: Record<string, { status: 'supported' | 'unsupported' | 'unavailable' }> = {
  // Show the in-sidebar 协作/代码 toggle by leaving the native top bar off.
  desktopTopBar: { status: 'unsupported' },
  // Claude Code surface gates. The SPA references ALL of these; missing
  // any one drops Code-mode features (toggle, scheduled tasks, etc.).
  // Discovered in the official preload's `pw()` builder + grepped for in
  // ion-dist `chillingSloth*` references.
  chillingSlothEnterprise: { status: 'supported' },
  chillingSlothFeat: { status: 'supported' },
  chillingSlothLocal: { status: 'supported' },
  chillingSlothLocation: { status: 'supported' },
  chillingSlothPool: { status: 'supported' },
  // CCD scheduled-tasks surface — required for the "定时任务" sidebar item
  // to appear in Code mode.
  ccdPlugins: { status: 'supported' },
  // Cowork / Yukon desktop gates. Keep these in sync with
  // AppFeatures.getSupportedFeatures() to avoid first-render downgrades.
  coworkKappa: { status: 'supported' },
  yukonSilver: { status: 'supported' },
  yukonSilverGems: { status: 'supported' },
  yukonSilverGemsCache: { status: 'supported' },
  // Still disabled until the host side exists.
  computerUse: { status: 'unsupported' },
  nativeQuickEntry: { status: 'unsupported' },
  quickEntryDictation: { status: 'unsupported' },
};
contextBridge.exposeInMainWorld('desktopBootFeatures', desktopBootFeatures);

// Force `cowork-remote-backend` Zustand store to local before the SPA reads
// it. Synchronous top-level write — the SPA's persist middleware hydrates
// at module-init time, which happens before `DOMContentLoaded`. Setting
// inside that listener is too late: the in-memory store has already
// captured `isRemote: true` from the bundle default.
//
// Also pre-seed `code-selected-environment-id` to the local-env constant
// (`__local__` aka `rK` in index-BELzQL5P) so the env-kind selector
// (Vwt/Xe in c11959232) routes new sessions through `LocalSessions.start`
// (our SDK adapter) instead of the cloud anthropic_cloud backend.
try {
  window.localStorage.setItem(
    'cowork-remote-backend',
    JSON.stringify({
      state: { isRemote: false, savedAt: Date.now() },
      version: 1,
    }),
  );
  // Persisted as a primitive string by the Cc localStorage hook.
  if (window.localStorage.getItem('code-selected-environment-id') === null) {
    window.localStorage.setItem('code-selected-environment-id', JSON.stringify('__local__'));
  }
} catch (err) {
  console.warn('[rebuild:preload] failed to seed local-env defaults', err);
}

contextBridge.exposeInMainWorld('__CLAUDE_DESKTOP_REBUILD__', {
  phase: 'phase-0.3-ipc',
  protocol: 'app://localhost/',
  namespaces: Object.keys(namespaces),
});
