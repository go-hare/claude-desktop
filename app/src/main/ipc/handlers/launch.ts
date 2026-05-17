/**
 * Launch is the SPA's preview/dev-server panel. We surface "not available"
 * so the SPA renders an empty state instead of crashing.
 */

import type { IpcRegistry } from '../registry';

export function registerLaunchHandlers(reg: IpcRegistry) {
  reg.method('claude.web', 'Launch', 'isAvailable', () => false);
  reg.method('claude.web', 'Launch', 'getConfiguredServices', () => []);
  reg.method('claude.web', 'Launch', 'getLogs', () => []);
  // SPA expects state to be the array of servers directly (it calls
  // `state.filter(s => s.status === "starting" || ...)`). Returning an
  // object wrapper makes `.filter` undefined and crashes the boundary.
  reg.store('claude.web', 'Launch', 'activeServersStore', {
    getState: () => [] as Array<{ serverId: string; status: string }>,
  });
}
