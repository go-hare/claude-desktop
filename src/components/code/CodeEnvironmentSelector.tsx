import { Check, Cloud, Database, Laptop, Server } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type CodeEnvironmentKind = 'local' | 'ssh' | 'bridge' | 'remote' | 'pool';

type EnvOption = {
  value: CodeEnvironmentKind;
  label: string;
  icon: typeof Laptop;
  available: boolean;
  unavailableReason?: string;
};

const OPTIONS: EnvOption[] = [
  { value: 'local', label: 'Local', icon: Laptop, available: true },
  { value: 'ssh', label: 'SSH', icon: Server, available: false, unavailableReason: 'SSH configuration is unavailable.' },
  { value: 'bridge', label: 'Bridge', icon: Database, available: false, unavailableReason: 'Bridge environment unavailable.' },
  { value: 'remote', label: 'Remote', icon: Cloud, available: false, unavailableReason: 'Remote environments are not configured.' },
  { value: 'pool', label: 'Self-hosted pool', icon: Database, available: false, unavailableReason: 'No self-hosted pool is connected.' },
];

type Props = {
  disabled?: boolean;
  value: CodeEnvironmentKind;
  onChange: (next: CodeEnvironmentKind) => void;
};

export default function CodeEnvironmentSelector({ disabled, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((item) => item.value === value) || OPTIONS[0];
  const CurrentIcon = current.icon;

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-[24px] items-center gap-g3 rounded-r5 px-p3 text-body text-t7 transition-colors hover:bg-t2 hover:text-t8 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <CurrentIcon size={14} strokeWidth={1.7} />
        {current.label}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-g5 box-border w-[224px] overflow-hidden rounded-[14px] border border-t2 bg-[var(--surface-popover)] px-[6px] py-[6px] text-left shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
        >
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = option.value === value;
            const tooltip = option.available ? undefined : option.unavailableReason;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                disabled={!option.available}
                title={tooltip}
                onClick={() => {
                  if (!option.available) return;
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-g4 rounded-r5 px-p4 py-[6px] text-left text-body text-t9 transition-colors hover:bg-t2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Icon size={14} strokeWidth={1.7} className="shrink-0" />
                <span className="flex-1 truncate">{option.label}</span>
                {active ? <Check size={14} strokeWidth={2.2} className="text-t7" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
