/**
 * LocalSessions handlers. Read-side methods return empty/safe defaults
 * (phase 0.3 carry-overs); write-side methods that drive a real
 * conversation are wired to `ClaudeCodeAdapter` from phase 0.4 onward.
 *
 * SPA flow (c4bf44b41 → H() in ion-dist):
 *   const { sessionId } = await LocalSessions.start({ cwd, model, ... })
 *   await LocalSessions.sendMessage({ sessionId, prompt, ... })
 *   → SDK events stream back via the LocalSessions.onEvent broadcast.
 */

import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { IpcRegistry } from '../registry';
import type { ClaudeCodeAdapter } from '../../engine/claudeCodeAdapter';

interface StartArgs {
  /**
   * SPA-generated id, e.g. `local_<uuid>`. ion-dist's session-type detection
   * lives entirely in this id (id.startsWith('local_') → 'local', else
   * 'remote'), so we MUST keep it; sending back our own UUID here flips the
   * surface into a remote/cowork session and the chat header shows a cloud
   * icon instead of a laptop.
   */
  sessionId?: string;
  cwd?: string;
  model?: string;
  /** First user message — SPA fires `start` with the prompt instead of a
   * separate sendMessage on session creation. */
  message?: string;
  title?: string;
  // SPA may pass other fields (folders, mcpServers, useWorktree, ...) — we
  // ignore the ones we don't model yet.
}

interface SendMessageArgs {
  sessionId: string;
  prompt?: string;
  message?: string;
  // SPA's H() shapes vary slightly; accept either field name.
}

export function registerLocalSessionsHandlers(reg: IpcRegistry, engine: ClaudeCodeAdapter) {
  reg.method('claude.web', 'LocalSessions', 'getAll', () => engine.listSessionSnapshots());
  reg.method('claude.web', 'LocalSessions', 'getSession', (sessionId) => {
    if (typeof sessionId !== 'string') return null;
    return engine.getSessionSnapshot(sessionId, homedir());
  });
  reg.method('claude.web', 'LocalSessions', 'getDetectedProjects', () => []);
  reg.method('claude.web', 'LocalSessions', 'getInstalledEditors', () => []);
  reg.method('claude.web', 'LocalSessions', 'getSupportedCommands', () => []);
  reg.method('claude.web', 'LocalSessions', 'isFolderTrusted', () => true);
  reg.method('claude.web', 'LocalSessions', 'addTrustedFolder', () => undefined);
  reg.method('claude.web', 'LocalSessions', 'addDirectories', () => []);
  reg.method('claude.web', 'LocalSessions', 'archive', () => undefined);
  reg.method('claude.web', 'LocalSessions', 'delete', (sessionId) => {
    if (typeof sessionId === 'string') engine.cleanup(sessionId);
    return undefined;
  });
  reg.method('claude.web', 'LocalSessions', 'checkGitAvailable', () => true);
  reg.method('claude.web', 'LocalSessions', 'getGitInfo', () => null);
  reg.method('claude.web', 'LocalSessions', 'getCodeStats', () => ({
    // SPA stats panel (qx component in c11959232) reads many fields:
    //   for (const h of stats.dailyActivity)   ← must be iterable
    //   for (const h of stats.dailyModelTokens) ← must be iterable
    //   stats.streaks.currentStreak / .longestStreak
    //   stats.modelUsage[modelKey] (object map)
    //   stats.totalSessions / totalMessages / totalTokens / activeDays
    // Missing any of these throws inside the qx render path.
    dailyActivity: [],
    dailyModelTokens: [],
    modelUsage: {},
    streaks: { currentStreak: 0, longestStreak: 0 },
    totalSessions: 0,
    totalMessages: 0,
    totalTokens: 0,
    activeDays: 0,
  }));
  reg.method('claude.web', 'LocalSessions', 'getContextUsage', () => ({
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }));
  reg.method('claude.web', 'LocalSessions', 'getDefaultEffort', () => 'medium');
  reg.method('claude.web', 'LocalSessions', 'getEffort', () => 'medium');
  reg.method('claude.web', 'LocalSessions', 'setEffort', () => undefined);
  reg.method('claude.web', 'LocalSessions', 'getDefaultPermissionMode', () => 'default');
  reg.method('claude.web', 'LocalSessions', 'getPermissionMode', () => 'default');
  reg.method('claude.web', 'LocalSessions', 'setPermissionMode', () => undefined);
  reg.method('claude.web', 'LocalSessions', 'setModel', () => undefined);
  reg.method('claude.web', 'LocalSessions', 'setMcpServers', () => undefined);
  reg.method('claude.web', 'LocalSessions', 'setFocusedSession', () => undefined);
  reg.method('claude.web', 'LocalSessions', 'updateSession', () => undefined);
  reg.method('claude.web', 'LocalSessions', 'getTranscript', () => []);

  reg.method('claude.web', 'LocalSessions', 'start', (rawArgs) => {
    const args = (rawArgs as StartArgs | undefined) ?? {};
    // Honour the SPA's id when it provides one (the standard new-session
    // flow does, with a `local_<uuid>` shape). Only synthesise a fallback —
    // also `local_`-prefixed — for callers that didn't.
    const sessionId =
      typeof args.sessionId === 'string' && args.sessionId.length > 0
        ? args.sessionId
        : `local_${randomUUID()}`;

    const rawCwd =
      typeof args.cwd === 'string' && args.cwd.length > 0 ? args.cwd : homedir();
    // SPA passes "~" when no folder picked — Windows spawn won't expand it,
    // and the SDK's child_process call fails with ENOENT (which the SDK
    // surfaces as a misleading "executable not found"). Expand here.
    const cwd =
      rawCwd === '~' || rawCwd.startsWith('~/') || rawCwd.startsWith('~\\')
        ? rawCwd === '~'
          ? homedir()
          : `${homedir()}${rawCwd.slice(1)}`
        : rawCwd;

    engine.startSession({
      sessionId,
      // SDK requires an absolute path. Fall back to home dir when SPA
      // hasn't selected one yet so `query()` doesn't reject.
      cwd,
      model: typeof args.model === 'string' ? args.model : undefined,
      title: typeof args.title === 'string' ? args.title : undefined,
    });

    // SPA's H() flow passes the first user prompt as `message`. Fire it
    // off without awaiting so `start` can return synchronously — events
    // stream back through the broadcast channel.
    if (typeof args.message === 'string' && args.message.length > 0) {
      void engine
        .sendMessage({ sessionId, prompt: args.message })
        .catch((err) => {
          console.error('[rebuild:engine] start.sendMessage failed', err);
        });
    }

    return { sessionId };
  });

  reg.method('claude.web', 'LocalSessions', 'stop', (sessionId) => {
    if (typeof sessionId === 'string') void engine.interrupt(sessionId);
    return undefined;
  });
  reg.method('claude.web', 'LocalSessions', 'stopTask', (sessionId) => {
    if (typeof sessionId === 'string') void engine.interrupt(sessionId);
    return undefined;
  });
  reg.method('claude.web', 'LocalSessions', 'interrupt', (sessionId) => {
    if (typeof sessionId === 'string') void engine.interrupt(sessionId);
    return undefined;
  });
  reg.method('claude.web', 'LocalSessions', 'cancelQueuedMessage', () => undefined);

  reg.method('claude.web', 'LocalSessions', 'sendMessage', async (rawArgs) => {
    const args = rawArgs as SendMessageArgs;
    if (!args || typeof args.sessionId !== 'string') {
      throw new Error('sendMessage requires a sessionId');
    }
    const prompt = args.prompt ?? args.message;
    if (typeof prompt !== 'string' || prompt.length === 0) {
      throw new Error('sendMessage requires a non-empty prompt');
    }
    // The SPA may call sendMessage on a session it created via `start`,
    // OR (during fork / resume flows) on one we haven't seen yet. In the
    // latter case we lazily register with the user's home dir so the
    // first turn still works; SPA can later call `updateSession` to
    // amend the cwd.
    if (!engine.hasSession(args.sessionId)) {
      engine.startSession({ sessionId: args.sessionId, cwd: homedir() });
    }
    await engine.sendMessage({ sessionId: args.sessionId, prompt });
    return undefined;
  });
}
