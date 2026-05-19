import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type CodePermissionMode = 'default' | 'acceptEdits' | 'auto' | 'bypassPermissions' | 'plan';

type ModeOption = {
  value: CodePermissionMode;
  label: string;
  description?: string;
  needsConfirm?: { title: string; body: string };
};

const OPTIONS: ModeOption[] = [
  { value: 'default', label: 'Accept' },
  { value: 'acceptEdits', label: 'Accept and allow edits' },
  {
    value: 'auto',
    label: 'Accept and auto mode',
    description: 'Claude will decide which actions are safe to run without asking. Longer tasks run uninterrupted, with extra safeguards against prompt injection.',
    needsConfirm: {
      title: 'Enable auto mode?',
      body: 'Claude will decide which actions are safe to run without asking. Longer tasks run uninterrupted, with extra safeguards against prompt injection.',
    },
  },
  {
    value: 'bypassPermissions',
    label: 'Accept and bypass permissions',
    description: 'Claude will read, edit, and execute files without asking — including potentially destructive commands. Only use this in isolated or disposable environments.',
    needsConfirm: {
      title: 'Bypass all permissions?',
      body: 'Claude will read, edit, and execute files without asking — including potentially destructive commands. Only use this in isolated or disposable environments.',
    },
  },
  { value: 'plan', label: 'Plan mode' },
];

const COMPACT_LABEL: Record<CodePermissionMode, string> = {
  default: 'Accept',
  acceptEdits: 'Allow edits',
  auto: 'Auto mode',
  bypassPermissions: 'Bypass',
  plan: 'Plan',
};

export function permissionModeShortLabel(mode: CodePermissionMode) {
  return COMPACT_LABEL[mode] || COMPACT_LABEL.default;
}

type Props = {
  disabled?: boolean;
  value: CodePermissionMode;
  onChange: (next: CodePermissionMode) => void;
};

export default function CodePermissionModeSelector({ disabled, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<ModeOption | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    if (!confirm) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirm(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirm]);

  const select = (option: ModeOption) => {
    if (option.needsConfirm && option.value !== value) {
      setConfirm(option);
      return;
    }
    onChange(option.value);
    setOpen(false);
  };

  const accept = () => {
    if (!confirm) return;
    onChange(confirm.value);
    setConfirm(null);
    setOpen(false);
  };

  return (
    <>
      <div ref={rootRef} className="relative inline-flex">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="rounded-r5 px-p3 py-p2 text-body text-t6 transition-colors hover:bg-t2 hover:text-t8 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent"
        >
          {permissionModeShortLabel(value)}
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute bottom-full left-0 z-50 mb-g5 box-border w-[260px] overflow-hidden rounded-[14px] border border-t2 bg-[var(--surface-popover)] px-[6px] py-[6px] text-left shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
          >
            {OPTIONS.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  onClick={() => select(option)}
                  className="flex w-full items-center justify-between gap-g4 rounded-r5 px-p4 py-[6px] text-left text-body text-t9 transition-colors hover:bg-t2"
                >
                  <span className="truncate">{option.label}</span>
                  {active ? <Check size={14} strokeWidth={2.2} className="text-t7" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {confirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={confirm.needsConfirm?.title}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirm(null);
          }}
        >
          <div className="w-[400px] rounded-[14px] border border-t2 bg-[var(--surface-popover)] p-[20px] shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
            <h2 className="m-0 text-heading text-t9">{confirm.needsConfirm?.title}</h2>
            <p className="mt-g4 text-body text-t7">{confirm.needsConfirm?.body}</p>
            <div className="mt-g6 flex justify-end gap-g4">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="inline-flex h-[28px] items-center rounded-r5 px-p5 text-body text-t7 hover:bg-t2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={accept}
                className="inline-flex h-[28px] items-center rounded-r5 bg-t9 px-p5 text-body text-z0 hover:bg-t8"
              >
                {confirm.value === 'bypassPermissions' ? 'Bypass permissions' : 'Enable auto mode'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
