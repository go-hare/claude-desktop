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

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

interface SessionRecord {
  sessionId: string;
  cwd: string;
  model?: string;
  /** True after the first sendMessage completes — SDK has persisted JSONL. */
  hasHistory: boolean;
  /** Active query's abort controller. Null when idle. */
  abortController: AbortController | null;
}

export interface StartSessionOptions {
  sessionId: string;
  cwd: string;
  model?: string;
}

export interface SendMessageOptions {
  sessionId: string;
  prompt: string;
}

export type SdkEventHandler = (sessionId: string, message: SDKMessage) => void;

export class ClaudeCodeAdapter {
  private sessions = new Map<string, SessionRecord>();

  constructor(private readonly onEvent: SdkEventHandler) {}

  startSession(opts: StartSessionOptions): void {
    if (this.sessions.has(opts.sessionId)) {
      // Re-register is a no-op; lets the SPA's idempotent `start` calls work.
      return;
    }
    this.sessions.set(opts.sessionId, {
      sessionId: opts.sessionId,
      cwd: opts.cwd,
      model: opts.model,
      hasHistory: false,
      abortController: null,
    });
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

    try {
      const q = query({
        prompt,
        options: {
          sessionId,
          cwd: record.cwd,
          model: record.model,
          abortController: controller,
          // Resume the SDK-persisted JSONL on subsequent turns so the model
          // sees prior conversation context.
          ...(record.hasHistory ? { resume: sessionId } : {}),
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
