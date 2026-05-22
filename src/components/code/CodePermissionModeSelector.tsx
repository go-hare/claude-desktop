import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type CodePermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

type ModeOption = {
  value: CodePermissionMode;
  label: string;
  hotkey?: string;
  needsConfirm?: { title: string; body: string; confirm: string };
};

const OPTIONS: ModeOption[] = [
  { value: 'default', label: '请求权限', hotkey: '1' },
  { value: 'acceptEdits', label: '接受编辑', hotkey: '2' },
  { value: 'plan', label: '计划模式', hotkey: '3' },
  {
    value: 'bypassPermissions',
    label: '绕过权限',
    hotkey: '4',
    needsConfirm: {
      title: '绕过所有权限？',
      body: 'Claude 会读取、修改、执行文件而不再询问，包括可能具有破坏性的命令。请只在隔离或可丢弃的环境里使用。',
      confirm: '绕过权限',
    },
  },
];

const COMPACT_LABEL: Record<CodePermissionMode, string> = {
  default: '请求权限',
  acceptEdits: '接受编辑',
  bypassPermissions: '绕过权限',
  plan: '计划模式',
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

  // ⇧Ctrl M cycles through modes; while menu open, 1–4 picks directly
  useEffect(() => {
    if (disabled) return;
    const onKey = (event: KeyboardEvent) => {
      const isCycle = event.shiftKey && (event.ctrlKey || event.metaKey) && (event.key === 'M' || event.key === 'm');
      if (isCycle) {
        event.preventDefault();
        const idx = OPTIONS.findIndex((option) => option.value === value);
        const next = OPTIONS[(idx + 1) % OPTIONS.length];
        if (next.needsConfirm && next.value !== value) {
          setConfirm(next);
        } else {
          onChange(next.value);
        }
        return;
      }
      if (open && /^[1-4]$/.test(event.key)) {
        const target = OPTIONS.find((option) => option.hotkey === event.key);
        if (target) {
          event.preventDefault();
          select(target);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [disabled, open, value, onChange]);

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
            className="absolute bottom-full left-0 z-50 mb-g5 box-border w-[220px] overflow-hidden rounded-[14px] border border-t2 bg-[var(--surface-popover)] px-[6px] py-[6px] text-left shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
          >
            <div className="flex items-center gap-g3 px-p4 py-[6px] text-footnote text-t6">
              <span className="flex-1">模式</span>
              <Kbd>⇧</Kbd>
              <Kbd>Ctrl</Kbd>
              <Kbd>M</Kbd>
            </div>
            {OPTIONS.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  onClick={() => select(option)}
                  className="flex w-full items-center gap-g4 rounded-r5 px-p4 py-[6px] text-left text-body text-t9 transition-colors hover:bg-t2"
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {active ? <Check size={14} strokeWidth={2.2} className="text-t7" /> : null}
                  {option.hotkey ? <span className="text-footnote text-t5 tabular-nums">{option.hotkey}</span> : null}
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
                取消
              </button>
              <button
                type="button"
                onClick={accept}
                className="inline-flex h-[28px] items-center rounded-r5 bg-t9 px-p5 text-body text-z0 hover:bg-t8"
              >
                {confirm.needsConfirm?.confirm || '确认'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-r3 border border-t3 bg-z0 px-[4px] text-[10px] font-medium text-t6 leading-none">
      {children}
    </span>
  );
}
