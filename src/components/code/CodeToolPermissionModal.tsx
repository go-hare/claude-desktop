import { useEffect, useState } from 'react';
import { summarizeToolInput } from './codeToolSummary';

export type ToolPermissionRequest = {
  request_id: string;
  tool_use_id: string;
  tool_name: string;
  tool_input: Record<string, any>;
};

type Props = {
  request: ToolPermissionRequest | null;
  onDecision: (decision: 'allow' | 'deny') => Promise<void> | void;
};

export default function CodeToolPermissionModal({ request, onDecision }: Props) {
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null);

  useEffect(() => {
    setBusy(null);
  }, [request?.request_id]);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        decide('deny');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.request_id, busy]);

  if (!request) return null;

  const decide = async (decision: 'allow' | 'deny') => {
    if (busy) return;
    setBusy(decision);
    try {
      await onDecision(decision);
    } finally {
      setBusy(null);
    }
  };

  const summary = summarizeToolInput(request.tool_name, request.tool_input);
  let inputText = '';
  try {
    inputText = JSON.stringify(request.tool_input, null, 2);
  } catch {
    inputText = String(request.tool_input);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Allow ${request.tool_name}?`}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) decide('deny');
      }}
    >
      <div className="w-[480px] max-w-[90vw] rounded-[14px] border border-t2 bg-[var(--surface-popover)] p-[20px] shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
        <h2 className="m-0 text-heading text-t9">Allow {request.tool_name}?</h2>
        {summary ? (
          <p className="mt-g4 truncate text-body text-t7" title={summary}>{summary}</p>
        ) : null}
        <pre className="mt-g4 max-h-[280px] overflow-auto whitespace-pre-wrap break-words rounded-r5 bg-t1 px-p4 py-p3 text-code text-t7">{inputText}</pre>
        <div className="mt-g6 flex justify-end gap-g4">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => decide('deny')}
            className="inline-flex h-[28px] items-center rounded-r5 px-p5 text-body text-t7 hover:bg-t2 disabled:opacity-50"
          >
            {busy === 'deny' ? 'Denying…' : 'Deny'}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => decide('allow')}
            className="inline-flex h-[28px] items-center rounded-r5 bg-t9 px-p5 text-body text-z0 hover:bg-t8 disabled:opacity-50"
          >
            {busy === 'allow' ? 'Allowing…' : 'Allow'}
          </button>
        </div>
      </div>
    </div>
  );
}
