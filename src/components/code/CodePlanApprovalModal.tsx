import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type PlanApprovalRequest = {
  request_id: string;
  tool_use_id: string;
  plan: string;
};

type Props = {
  request: PlanApprovalRequest | null;
  onDecision: (decision: 'allow' | 'deny') => Promise<void> | void;
};

export default function CodePlanApprovalModal({ request, onDecision }: Props) {
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null);

  useEffect(() => { setBusy(null); }, [request?.request_id]);

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
    try { await onDecision(decision); } finally { setBusy(null); }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Approve plan"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) decide('deny');
      }}
    >
      <div className="w-[640px] max-w-[92vw] max-h-[80vh] flex flex-col rounded-[14px] border border-t2 bg-[var(--surface-popover)] shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
        <div className="px-p6 py-p5 border-b border-t3">
          <h2 className="m-0 text-heading text-t9">批准这个计划？</h2>
          <p className="mt-g2 text-footnote text-t6">
            批准后会切到「接受编辑」模式，Claude 直接执行计划；拒绝则保持在计划模式继续讨论。
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-p6 py-p5">
          <div className="markdown-body text-body text-t8" style={{ color: 'var(--text-claude-model-body)' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {request.plan || '(empty plan)'}
            </ReactMarkdown>
          </div>
        </div>
        <div className="px-p6 py-p5 border-t border-t3 flex justify-end gap-g4">
          <button
            type="button"
            onClick={() => decide('deny')}
            disabled={busy === 'allow'}
            className="inline-flex h-[28px] items-center rounded-r5 px-p5 text-body text-t7 hover:bg-t2 disabled:opacity-50"
          >
            {busy === 'deny' ? '处理中…' : '继续讨论'}
          </button>
          <button
            type="button"
            onClick={() => decide('allow')}
            disabled={busy === 'deny'}
            className="inline-flex h-[28px] items-center rounded-r5 bg-t9 px-p5 text-body text-z0 hover:bg-t8 disabled:opacity-50"
          >
            {busy === 'allow' ? '处理中…' : '批准并执行'}
          </button>
        </div>
      </div>
    </div>
  );
}
