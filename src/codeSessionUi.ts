export type CodeTranscriptMode = 'normal' | 'thinking' | 'verbose' | 'summary';
export type CodeTextSize = 's' | 'm' | 'l';
export type CodeSidePane = 'diff' | 'terminal' | 'tasks' | 'plan' | 'transcript';

export type CodeSessionUiEvent =
  | { type: 'setTranscriptMode'; mode: CodeTranscriptMode }
  | { type: 'setTextSize'; size: CodeTextSize }
  | { type: 'toggleSidePane'; pane: CodeSidePane }
  | { type: 'closeSidePane' };

const CODE_SESSION_UI_EVENT = 'hare-code-session-ui';

export function dispatchCodeSessionUiEvent(detail: CodeSessionUiEvent) {
  window.dispatchEvent(new CustomEvent<CodeSessionUiEvent>(CODE_SESSION_UI_EVENT, { detail }));
}

export function addCodeSessionUiListener(handler: (detail: CodeSessionUiEvent) => void) {
  const listener = (event: Event) => {
    handler((event as CustomEvent<CodeSessionUiEvent>).detail);
  };
  window.addEventListener(CODE_SESSION_UI_EVENT, listener);
  return () => window.removeEventListener(CODE_SESSION_UI_EVENT, listener);
}
