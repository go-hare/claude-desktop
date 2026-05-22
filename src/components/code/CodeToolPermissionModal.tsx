import { useEffect, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { summarizeToolInput } from './codeToolSummary';

export type ToolPermissionRequest = {
  request_id: string;
  tool_use_id: string;
  tool_name: string;
  tool_input: Record<string, any>;
};

export type RememberScope = 'none' | 'session' | 'project' | 'project-local' | 'user';

const SCOPE_OPTIONS: Array<{ value: RememberScope; label: string }> = [
  { value: 'session', label: '仅本会话' },
  { value: 'project', label: '本项目' },
  { value: 'project-local', label: '本项目（仅本机）' },
  { value: 'user', label: '所有项目（全局）' },
];

type Props = {
  request: ToolPermissionRequest | null;
  onDecision: (decision: 'allow' | 'deny', scope: RememberScope) => Promise<void> | void;
};

export default function CodeToolPermissionModal({ request, onDecision }: Props) {
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null);
  const [remember, setRemember] = useState(false);
  const [scope, setScope] = useState<RememberScope>('session');
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);

  useEffect(() => {
    setBusy(null);
    setRemember(false);
    setScope('session');
    setScopeMenuOpen(false);
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
      const effectiveScope: RememberScope = decision === 'allow' && remember ? scope : 'none';
      await onDecision(decision, effectiveScope);
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
  const scopeLabel = SCOPE_OPTIONS.find((s) => s.value === scope)?.label || '仅本会话';

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
      <div className="epitaxy-approval-card w-[480px] max-w-[90vw] rounded-[14px] border border-t2 bg-[var(--surface-popover)] p-[20px] shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
        <h2 className="m-0 text-heading text-t9">Allow {request.tool_name}?</h2>
        {summary ? (
          <p className="mt-g4 truncate text-body text-t7" title={summary}>{summary}</p>
        ) : null}
        <pre className="mt-g4 max-h-[280px] overflow-auto whitespace-pre-wrap break-words rounded-r5 bg-t1 px-p4 py-p3 text-code text-t7">{inputText}</pre>
        <div className="mt-g5 flex items-center gap-g3">
          <input
            id="remember-toggle"
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-[14px] w-[14px] cursor-pointer"
          />
          <label htmlFor="remember-toggle" className="cursor-pointer text-body text-t7">
            始终允许 {request.tool_name}
          </label>
          <div className="relative inline-flex">
            <button
              type="button"
              disabled={!remember}
              onClick={() => setScopeMenuOpen((value) => !value)}
              className="inline-flex h-[24px] items-center gap-g2 rounded-r5 border border-t3 bg-z0 px-p3 text-footnote text-t7 hover:bg-t2 disabled:opacity-40 disabled:cursor-default disabled:hover:bg-z0"
            >
              <span>{scopeLabel}</span>
              <ChevronDown size={11} strokeWidth={1.7} />
            </button>
            {scopeMenuOpen && remember ? (
              <div role="menu" className="absolute bottom-full left-0 z-10 mb-g3 w-[200px] overflow-hidden rounded-[10px] border border-t2 bg-[var(--surface-popover)] px-[6px] py-[6px] shadow-[0_8px_28px_rgba(0,0,0,0.12)]">
                {SCOPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitem"
                    onClick={() => { setScope(option.value); setScopeMenuOpen(false); }}
                    className="flex w-full items-center gap-g3 rounded-r5 px-p3 py-[5px] text-left text-footnote text-t8 hover:bg-t2"
                  >
                    <span className="flex-1">{option.label}</span>
                    {scope === option.value ? <Check size={12} strokeWidth={2.2} className="text-t7" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
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
