import { Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type CodeEffort = 'low' | 'medium' | 'high' | 'max';

export type CodeModelOption = {
  id: string;
  name: string;
  enabled?: number | boolean;
};

const DEFAULT_MODELS: CodeModelOption[] = [
  { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', enabled: 1 },
];

const EFFORT_OPTIONS: Array<{ value: CodeEffort; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];

function stripThinking(model: string) {
  return (model || '').replace(/-thinking$/, '');
}

export function toCodeModelString(model: string, _effort: CodeEffort) {
  return stripThinking(model || 'claude-sonnet-4-6');
}

export function effortFromModel(model?: string | null, fallback?: string | null): CodeEffort {
  const saved = (fallback || '').toLowerCase();
  if (saved === 'low' || saved === 'medium' || saved === 'high' || saved === 'max') return saved;
  return typeof model === 'string' && model.endsWith('-thinking') ? 'high' : 'medium';
}

export function displayCodeModelName(name?: string, id?: string) {
  for (const candidate of [id, name]) {
    if (!candidate) continue;
    const match = candidate.match(/(?:claude-)?(opus|sonnet|haiku)-(\d+)-(\d+)/i);
    if (match) {
      const tier = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
      return `${tier} ${match[2]}.${match[3]}`;
    }
  }
  const raw = name || id || 'Model';
  const lastSlash = raw.lastIndexOf('/');
  return (lastSlash >= 0 ? raw.slice(lastSlash + 1) : raw).replace(/-/g, ' ');
}

export function getLocalCodeModels(): CodeModelOption[] {
  if (typeof window === 'undefined') return DEFAULT_MODELS;
  try {
    const models = JSON.parse(localStorage.getItem('chat_models') || '[]');
    if (Array.isArray(models) && models.length > 0) {
      return models
        .filter((model: any) => model?.id)
        .map((model: any) => ({
          id: stripThinking(String(model.id)),
          name: model.name || model.id,
          enabled: model.enabled ?? 1,
        }));
    }
  } catch {}
  const saved = localStorage.getItem('default_model');
  if (saved) return [{ id: stripThinking(saved), name: displayCodeModelName(undefined, saved), enabled: 1 }];
  return DEFAULT_MODELS;
}

function isEnabled(model: CodeModelOption) {
  return model.enabled === undefined || model.enabled === true || Number(model.enabled) === 1;
}

function ShortcutKey({ children }: { children: string }) {
  return (
    <span className="inline-flex h-[20px] min-w-[24px] items-center justify-center rounded-r4 border border-t2 bg-t1 px-p2 text-[11px] leading-[14px] text-t6 shadow-[inset_0_-1px_0_var(--t2)]">
      {children}
    </span>
  );
}

type Props = {
  disabled?: boolean;
  model: string;
  effort: CodeEffort;
  models?: CodeModelOption[];
  align?: 'left' | 'right';
  onChange: (next: { model: string; effort: CodeEffort }) => void;
};

export default function CodeModelEffortSelector({
  disabled,
  model,
  effort,
  models,
  align = 'right',
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseModel = stripThinking(model || 'claude-sonnet-4-6');
  const modelOptions = useMemo(() => {
    const list = models?.length ? models : DEFAULT_MODELS;
    const seen = new Set<string>();
    const unique: CodeModelOption[] = [];
    for (const item of list) {
      const id = stripThinking(item.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push({ ...item, id });
    }
    if (!seen.has(baseModel)) unique.unshift({ id: baseModel, name: displayCodeModelName(undefined, baseModel), enabled: 1 });
    return unique;
  }, [baseModel, models]);
  const currentModel = modelOptions.find((item) => item.id === baseModel);
  const currentLabel = displayCodeModelName(currentModel?.name, baseModel);
  const effortLabel = EFFORT_OPTIONS.find((item) => item.value === effort)?.label || 'Medium';

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const select = (nextModel: string, nextEffort: CodeEffort) => {
    onChange({ model: toCodeModelString(nextModel, nextEffort), effort: nextEffort });
  };

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-[24px] items-center rounded-r5 px-p3 text-body text-t6 transition-colors hover:bg-t2 hover:text-t8 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent"
      >
        <span className="truncate">{currentLabel} · {effortLabel}</span>
      </button>
      {open ? (
        <div className={`absolute bottom-full z-50 mb-g5 box-border w-[162px] overflow-hidden rounded-[14px] border border-t2 bg-[var(--surface-popover)] px-[14px] py-[12px] text-left shadow-[0_8px_28px_rgba(0,0,0,0.12)] ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="flex items-center justify-between pb-[5px]">
            <div className="text-[13px] leading-[18px] text-t6">模型</div>
            <div className="flex gap-[4px]">
              <ShortcutKey>⇧</ShortcutKey>
              <ShortcutKey>⌘</ShortcutKey>
              <ShortcutKey>I</ShortcutKey>
            </div>
          </div>
          <div className="flex flex-col">
            {modelOptions.map((item) => {
              const active = item.id === baseModel;
              const enabled = isEnabled(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!enabled}
                  onClick={() => {
                    select(item.id, effort);
                    setOpen(false);
                  }}
                  className="flex h-[26px] items-center justify-between rounded-r5 px-0 text-[13px] leading-[18px] text-t9 transition-colors hover:bg-t2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="truncate">{displayCodeModelName(item.name, item.id)}</span>
                  {active ? <Check size={14} strokeWidth={2.2} /> : null}
                </button>
              );
            })}
          </div>
          <div className="my-[5px] h-px bg-t2" />
          <div className="flex items-center justify-between pb-[5px]">
            <div className="text-[13px] leading-[18px] text-t6">Effort</div>
            <div className="flex gap-[4px]">
              <ShortcutKey>⇧</ShortcutKey>
              <ShortcutKey>⌘</ShortcutKey>
              <ShortcutKey>E</ShortcutKey>
            </div>
          </div>
          <div className="flex flex-col">
            {EFFORT_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  select(baseModel, item.value);
                  setOpen(false);
                }}
                className="flex h-[26px] items-center justify-between rounded-r5 px-0 text-[13px] leading-[18px] text-t9 transition-colors hover:bg-t2"
              >
                <span>{item.label}</span>
                {item.value === effort ? <Check size={14} strokeWidth={2.2} /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
