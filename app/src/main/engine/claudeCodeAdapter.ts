/**
 * Claude Code engine adapter — wraps `@anthropic-ai/claude-agent-sdk` so the
 * IPC layer can drive real conversations from `LocalSessions.sendMessage`.
 *
 * Per-session state lives in this module: a `cwd`, a `model`, an
 * `AbortController` for the active query, and a flag tracking whether the
 * SDK already persisted a JSONL file for this session (so we know whether
 * to pass `resume`).
 *
 * Lifecycle:
 *   start(opts)              → register a session, no SDK call yet
 *   sendMessage(opts)        → fire query(), stream SDKMessages out via onEvent
 *   interrupt(sessionId)     → abort the current AbortController
 *   cleanup(sessionId)       → drop the record (caller may keep JSONL on disk)
 *
 * Streaming-input mode (one query, many prompts) is the proper Claude Code
 * shape but requires plumbing an AsyncIterable prompt source through the
 * IPC. Phase 0.4 keeps it simple: each sendMessage spawns its own query
 * with `resume: sessionId` after the first turn, so the SDK loads prior
 * messages from JSONL and appends. Phase 0.5 can switch to streaming if
 * latency between turns becomes an issue.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

interface SessionRecord {
  /** SPA-facing id, e.g. "local_<uuid>". */
  sessionId: string;
  /** Bare UUID passed to the SDK's sessionId/resume options. */
  sdkSessionId: string;
  cwd: string;
  model?: string;
  title?: string;
  createdAt: number;
  lastActivityAt: number;
  /** True after the first sendMessage completes — SDK has persisted JSONL. */
  hasHistory: boolean;
  /** Active query's abort controller. Null when idle. */
  abortController: AbortController | null;
}

export interface StartSessionOptions {
  sessionId: string;
  cwd: string;
  model?: string;
  title?: string;
}

export interface SendMessageOptions {
  sessionId: string;
  prompt: string;
}

export type SdkEventHandler = (sessionId: string, message: SDKMessage) => void;

/**
 * Locate Git-Bash on Windows. The Claude Code CLI shells out via bash for
 * tools like Bash/Glob, so without this the subprocess exits with code 1
 * and the SDK surfaces "Claude Code process exited with code 1" — silently
 * from the SPA's point of view. Honors a user-provided
 * `CLAUDE_CODE_GIT_BASH_PATH` first; otherwise derives bash from `where git`
 * and falls back to common install locations.
 */
function findGitBash(): string | undefined {
  if (process.platform !== 'win32') return undefined;
  const fromEnv = process.env.CLAUDE_CODE_GIT_BASH_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  try {
    const out = execSync('where git', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const gitExe = out.split(/\r?\n/).map((l) => l.trim()).find((l) => l.toLowerCase().endsWith('git.exe'));
    if (gitExe) {
      // <root>\cmd\git.exe or <root>\mingw64\bin\git.exe → <root>\bin\bash.exe
      const candidates = [
        join(dirname(dirname(gitExe)), 'bin', 'bash.exe'),
        join(dirname(dirname(dirname(gitExe))), 'bin', 'bash.exe'),
      ];
      for (const c of candidates) if (existsSync(c)) return c;
    }
  } catch {
    // `where git` not on PATH — fall through to common locations.
  }

  for (const c of [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ]) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

const GIT_BASH_PATH = findGitBash();
if (process.platform === 'win32' && !GIT_BASH_PATH) {
  console.warn(
    '[engine] git-bash not found. Install Git for Windows or set CLAUDE_CODE_GIT_BASH_PATH; ' +
      'Claude Code subprocess will fail to start until then.',
  );
} else if (GIT_BASH_PATH) {
  console.log('[engine] using git-bash at', GIT_BASH_PATH);
}

/**
 * Resolve the Claude Code CLI entrypoint shipped with the SDK. The SDK's
 * auto-detection (`new URL('cli.js', import.meta.url)`) only works when
 * `sdk.mjs` runs from inside its own package directory; under electron-vite's
 * SSR bundle the URL resolves to `out/main/cli.js`, which doesn't exist.
 * Force the path by walking the import.meta.url chain through `require.resolve`.
 */
function resolveClaudeCli(): string | undefined {
  try {
    const req = createRequire(import.meta.url);
    const sdkPkg = req.resolve('@anthropic-ai/claude-agent-sdk/package.json');
    const cli = join(dirname(sdkPkg), 'cli.js');
    if (existsSync(cli)) return cli;
  } catch {
    // fall through
  }
  // Last resort: vendored layout under app/.
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // dev: out/main → ../vendor/...
    join(moduleDir, '..', 'vendor', '@anthropic-ai', 'claude-agent-sdk', 'cli.js'),
    // packaged: resources/app/out/main → ../../vendor/...
    join(moduleDir, '..', '..', 'vendor', '@anthropic-ai', 'claude-agent-sdk', 'cli.js'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return undefined;
}

const CLAUDE_CLI_PATH = resolveClaudeCli();
if (!CLAUDE_CLI_PATH) {
  console.warn('[engine] Claude Code CLI not found — query() will fail.');
} else {
  console.log('[engine] using claude-cli at', CLAUDE_CLI_PATH);
}

/**
 * Strip the SPA's `local_` prefix to derive a UUID the Claude Code SDK
 * accepts. The SPA encodes session type into the id (`id.startsWith("local_")
 * ? "local" : "remote"`, ion-dist c11959232), but the SDK's `sessionId` /
 * `resume` options must be plain UUIDs. We keep the prefixed id on the IPC
 * surface and pass the bare UUID downstream.
 */
function toSdkSessionId(spaId: string): string {
  return spaId.startsWith('local_') ? spaId.slice('local_'.length) : spaId;
}

export class ClaudeCodeAdapter {
  private sessions = new Map<string, SessionRecord>();

  constructor(private readonly onEvent: SdkEventHandler) {}

  startSession(opts: StartSessionOptions): void {
    if (this.sessions.has(opts.sessionId)) {
      // Re-register is a no-op; lets the SPA's idempotent `start` calls work.
      return;
    }
    const now = Date.now();
    this.sessions.set(opts.sessionId, {
      sessionId: opts.sessionId,
      sdkSessionId: toSdkSessionId(opts.sessionId),
      cwd: opts.cwd,
      model: opts.model,
      title: opts.title,
      createdAt: now,
      lastActivityAt: now,
      hasHistory: false,
      abortController: null,
    });
  }

  /**
   * Snapshot of a session in the SPA's expected `getSession` shape. The
   * SPA's local-session meta fetcher (ion-dist c4bf44b41 → U.fetchMeta)
   * passes this object straight through a mapping function that reads
   * `sessionId/title/originCwd/cwd/isRunning/isArchived/model/effort/...`.
   * Returning `null` makes the SPA show a "session could not be found"
   * splash — we lazy-register any `local_*` id we don't already track so a
   * dev-server restart (which drops in-memory state) doesn't strand the SPA
   * on its persisted URL. The SDK's JSONL on disk is the real history
   * source; this map only covers the live cwd/model/abort handle.
   */
  getSessionSnapshot(sessionId: string, lazyCwd?: string): Record<string, unknown> | null {
    let record = this.sessions.get(sessionId);
    if (!record && sessionId.startsWith('local_') && lazyCwd) {
      this.startSession({ sessionId, cwd: lazyCwd });
      record = this.sessions.get(sessionId);
    }
    if (!record) return null;
    return {
      sessionId: record.sessionId,
      title: record.title ?? null,
      originCwd: record.cwd,
      cwd: record.cwd,
      worktreePath: null,
      homePath: null,
      sshConfig: null,
      isRunning: record.abortController !== null,
      isArchived: false,
      model: record.model ?? null,
      effort: null,
      permissionMode: null,
      color: null,
      autoFixEnabled: false,
      bridgeSessionId: null,
      loops: null,
      createdAt: record.createdAt,
      lastActivityAt: record.lastActivityAt,
      promptSuggestion: null,
      postTurnSummary: null,
    };
  }

  listSessionSnapshots(): Array<Record<string, unknown>> {
    return [...this.sessions.keys()]
      .map((id) => this.getSessionSnapshot(id))
      .filter((s): s is Record<string, unknown> => s !== null);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  async sendMessage({ sessionId, prompt }: SendMessageOptions): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) {
      throw new Error(`Unknown session ${sessionId}`);
    }
    if (record.abortController) {
      throw new Error(`Session ${sessionId} already has an in-flight query`);
    }

    const controller = new AbortController();
    record.abortController = controller;

    // SDK rejects sessionId+resume together (without forkSession). Pin our
    // UUID on the first turn; on subsequent turns pass `resume` so the JSONL
    // is loaded — the resumed session keeps the same UUID.
    const idOptions = record.hasHistory
      ? ({ resume: record.sdkSessionId } as const)
      : ({ sessionId: record.sdkSessionId } as const);

    const env: Record<string, string | undefined> = { ...process.env };
    if (GIT_BASH_PATH) env.CLAUDE_CODE_GIT_BASH_PATH = GIT_BASH_PATH;

    try {
      const q = query({
        prompt,
        options: {
          ...idOptions,
          cwd: record.cwd,
          model: record.model,
          abortController: controller,
          env,
          ...(CLAUDE_CLI_PATH ? { pathToClaudeCodeExecutable: CLAUDE_CLI_PATH } : {}),
          stderr: (line) => console.error('[claude-cli]', line.trimEnd()),
        },
      });

      for await (const message of q) {
        // Best-effort broadcast. If a listener throws (e.g. window torn
        // down) we keep streaming so SDK side completes cleanly and
        // persists the JSONL.
        try {
          this.onEvent(sessionId, message);
        } catch (err) {
          console.warn('[engine] onEvent handler threw', err);
        }
      }

      record.hasHistory = true;
      record.lastActivityAt = Date.now();
    } finally {
      record.abortController = null;
    }
  }

  async interrupt(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record?.abortController) return;
    record.abortController.abort();
    // The for-await loop in sendMessage will exit; we don't await it here
    // because sendMessage's caller already has its own promise chain.
  }

  cleanup(sessionId: string): void {
    const record = this.sessions.get(sessionId);
    if (!record) return;
    record.abortController?.abort();
    this.sessions.delete(sessionId);
  }
}
