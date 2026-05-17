/**
 * LocalAgentModeSessions stubs — phase 0.3 returns empty/safe defaults so
 * the SPA's React Query trees resolve. Real engine integration is phase 0.4.
 *
 * The SPA's onboarding flow in particular blocks until `getAll`,
 * `getTrustedFolders`, and the bridge status store all return — without
 * these the chat surface stays unrendered.
 */

import type { IpcRegistry } from '../registry';

export function registerLocalAgentModeHandlers(reg: IpcRegistry) {
  // Lists / lookups
  reg.method('claude.web', 'LocalAgentModeSessions', 'getAll', () => []);
  reg.method('claude.web', 'LocalAgentModeSessions', 'getSession', () => null);
  reg.method('claude.web', 'LocalAgentModeSessions', 'getTranscript', () => []);
  reg.method('claude.web', 'LocalAgentModeSessions', 'searchSessions', () => []);
  reg.method('claude.web', 'LocalAgentModeSessions', 'getSessionsForScheduledTask', () => []);

  // Trust / consent
  reg.method('claude.web', 'LocalAgentModeSessions', 'getTrustedFolders', () => []);
  reg.method('claude.web', 'LocalAgentModeSessions', 'isFolderTrusted', () => true);
  reg.method('claude.web', 'LocalAgentModeSessions', 'getBridgeConsent', () => ({
    granted: false,
  }));
  reg.method(
    'claude.web',
    'LocalAgentModeSessions',
    'getSessionsBridgeEnabled',
    () => false,
  );

  // MCP / commands
  reg.method('claude.web', 'LocalAgentModeSessions', 'getDirectMcpServerStatuses', () => ({}));
  reg.method('claude.web', 'LocalAgentModeSessions', 'getSupportedCommands', () => []);

  // Skills
  reg.method('claude.web', 'LocalAgentModeSessions', 'listLocalSkills', () => []);
  reg.method('claude.web', 'LocalAgentModeSessions', 'getLocalSkillFiles', () => []);

  // Drafts
  reg.method('claude.web', 'LocalAgentModeSessions', 'setDraftSessionFolders', () => undefined);

  // Stores — bridge status mirrors the on-device "agent bridge" connectivity.
  // We claim disconnected so the SPA renders the local-only UI path.
  reg.store('claude.web', 'LocalAgentModeSessions', 'sessionsBridgeStatusStore', {
    getState: () => ({
      enabled: false,
      status: 'disconnected',
    }),
  });
}
