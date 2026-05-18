/**
 * `claude.web::Resources` — opportunistic helpers ion-dist invokes during
 * the chat surface lifecycle (file mention picker, focused-cwd hint).
 * Returning empty/null is fine for phase 0.x: the SPA's call sites
 * (`Le?.setFocusedCwd?.(...)`, `Le?.fetchMentionOptions?.(...)`) tolerate
 * missing methods, but throwing IPC errors floods the renderer console
 * with "IPC method not implemented".
 */

import type { IpcRegistry } from '../registry';

export function registerResourcesHandlers(reg: IpcRegistry) {
  reg.method('claude.web', 'Resources', 'setFocusedCwd', () => undefined);
  reg.method('claude.web', 'Resources', 'fetchMentionOptions', () => []);
}
