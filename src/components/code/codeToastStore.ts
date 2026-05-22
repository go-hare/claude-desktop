import { useEffect, useState } from 'react';

export type CodeToast = {
  id: string;
  kind: 'info' | 'success' | 'error';
  message: string;
};

type Listener = (toasts: CodeToast[]) => void;

let toasts: CodeToast[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function pushToast(message: string, kind: CodeToast['kind'] = 'info', durationMs = 3500): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  toasts = [...toasts, { id, kind, message }];
  emit();
  if (durationMs > 0) {
    window.setTimeout(() => dismissToast(id), durationMs);
  }
  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function pushError(message: string, durationMs = 5000) {
  return pushToast(message, 'error', durationMs);
}

export function pushSuccess(message: string, durationMs = 2500) {
  return pushToast(message, 'success', durationMs);
}

export function useCodeToasts(): CodeToast[] {
  const [snapshot, setSnapshot] = useState<CodeToast[]>(toasts);
  useEffect(() => {
    const listener: Listener = (next) => setSnapshot(next);
    listeners.add(listener);
    setSnapshot(toasts);
    return () => { listeners.delete(listener); };
  }, []);
  return snapshot;
}
