import { useCodeToasts, dismissToast, type CodeToast } from './codeToastStore';
import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';

const COLORS: Record<CodeToast['kind'], string> = {
  info: 'border-t3 bg-z0 text-t8',
  success: 'border-extended-green bg-extended-10-green text-extended-green',
  error: 'border-extended-pink bg-extended-10-pink text-extended-pink',
};

function Icon({ kind }: { kind: CodeToast['kind'] }) {
  const props = { size: 14, strokeWidth: 1.8 };
  if (kind === 'success') return <CheckCircle2 {...props} />;
  if (kind === 'error') return <AlertTriangle {...props} />;
  return <Info {...props} />;
}

export default function CodeToastViewport() {
  const toasts = useCodeToasts();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-[24px] right-[24px] z-[1100] flex flex-col gap-g3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={'epitaxy-notification-enter pointer-events-auto flex max-w-[400px] items-start gap-g4 rounded-[10px] border px-p5 py-p4 text-body shadow-[0_8px_28px_rgba(0,0,0,0.12)] ' + COLORS[toast.kind]}
        >
          <span className="mt-[2px] shrink-0"><Icon kind={toast.kind} /></span>
          <span className="min-w-0 flex-1 break-words">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
            className="shrink-0 rounded-r4 text-current/70 hover:bg-t2"
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
