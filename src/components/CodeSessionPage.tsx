import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, FileDiff, Folder, ListChecks, ListTodo, Plus, Terminal, X, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getConversation, getGenerationStatus, getStreamStatus, reconnectStream, sendMessage, stopGeneration, updateConversation } from '../api';
import { addStreaming, removeStreaming } from '../streamingState';
import CodeDraftClawd from './CodeDraftClawd';
import {
  addCodeSessionUiListener,
  dispatchCodeSessionUiEvent,
  type CodeSidePane,
  type CodeTextSize,
  type CodeTranscriptMode,
} from '../codeSessionUi';
import CodeEnvironmentSelector from './code/CodeEnvironmentSelector';
import CodeModelEffortSelector, {
  effortFromModel,
  getLocalCodeModels,
  toCodeModelString,
  type CodeEffort,
  type CodeModelOption,
} from './code/CodeModelEffortSelector';
import CodePermissionModeSelector, { type CodePermissionMode } from './code/CodePermissionModeSelector';

type CodeToolCall = {
  id: string;
  name: string;
  input?: unknown;
  content?: string;
  status: 'running' | 'done' | 'error';
  textBefore?: string;
};

type CodeMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  thinking?: string;
  error?: boolean;
  is_compact_boundary?: boolean;
  toolCalls?: CodeToolCall[];
};

const CODE_TEXT_SIZE_STORAGE_KEY = 'epitaxy.chatTextSize';

function getInitialCodeTextSize(): CodeTextSize {
  if (typeof window === 'undefined') return 'm';
  const value = window.localStorage.getItem(CODE_TEXT_SIZE_STORAGE_KEY);
  return value === 's' || value === 'l' ? value : 'm';
}

const sidePaneTitle: Record<CodeSidePane, string> = {
  diff: 'Diff',
  terminal: 'Terminal',
  tasks: 'Tasks',
  plan: 'Plan',
  transcript: 'Transcript',
};

const sidePaneIcon: Record<CodeSidePane, React.ReactNode> = {
  diff: <FileDiff size={16} strokeWidth={1.8} />,
  terminal: <Terminal size={16} strokeWidth={1.8} />,
  tasks: <ListTodo size={16} strokeWidth={1.8} />,
  plan: <ListChecks size={16} strokeWidth={1.8} />,
  transcript: null,
};

function extractTextContent(content: unknown): string {
  if (!content) return '';
  if (typeof content !== 'string') return String(content);
  if (content.startsWith('[')) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((block: any) => block && block.type === 'text' && block.text)
          .map((block: any) => block.text)
          .join('\n');
      }
    } catch {
      return content;
    }
  }
  return content;
}

function normalizeMessages(rawMessages: any[] = []): CodeMessage[] {
  return rawMessages
    .filter((message) => message && ['user', 'assistant', 'system'].includes(message.role))
    .map((message) => ({
      id: message.id || `${message.role}-${message.created_at || Math.random()}`,
      role: message.role,
      content: extractTextContent(message.content),
      created_at: message.created_at,
      thinking: message.thinking,
      is_compact_boundary: message.is_compact_boundary,
      toolCalls: Array.isArray(message.toolCalls)
        ? message.toolCalls.map((tool: any) => ({
          id: tool.id || tool.tool_use_id || `${tool.name}-${Math.random()}`,
          name: tool.name || tool.tool_name || 'tool',
          input: tool.input,
          content: tool.content,
          status: tool.is_error ? 'error' : 'done',
          textBefore: tool.textBefore,
        }))
        : undefined,
    }));
}

function folderLabel(folder?: string | null) {
  if (!folder) return '选择文件夹...';
  return folder.split(/[\\/]/).filter(Boolean).pop() || folder;
}

function formatInput(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function createAssistantPlaceholder(): CodeMessage {
  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: '',
    created_at: new Date().toISOString(),
    toolCalls: [],
  };
}

function applyGenerationSnapshot(message: CodeMessage, snapshot: any): CodeMessage {
  return {
    ...message,
    content: snapshot?.text ?? message.content ?? '',
    thinking: snapshot?.thinking ?? message.thinking,
    toolCalls: Array.isArray(snapshot?.toolCalls)
      ? snapshot.toolCalls.map((tool: any) => ({
        id: tool.id || tool.tool_use_id || `${tool.name}-${Math.random()}`,
        name: tool.name || tool.tool_name || 'tool',
        input: tool.input,
        content: tool.result || tool.content,
        status: tool.status === 'error' || tool.is_error ? 'error' : tool.status === 'running' ? 'running' : 'done',
        textBefore: tool.textBefore,
      }))
      : message.toolCalls,
  };
}

function appendOrUpdateAssistant(
  messages: CodeMessage[],
  updater: (message: CodeMessage) => CodeMessage,
): CodeMessage[] {
  const next = [...messages];
  const index = next.length - 1;
  if (index >= 0 && next[index].role === 'assistant') {
    next[index] = updater(next[index]);
    return next;
  }
  return [...next, updater(createAssistantPlaceholder())];
}

function EpitaxyMarkdown({ content }: { content: string }) {
  return (
    <div className="epitaxy-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ToolList({ tools }: { tools?: CodeToolCall[] }) {
  if (!tools?.length) return null;
  return (
    <div className="flex flex-col gap-g3">
      {tools.map((tool) => (
        <details key={tool.id} className="rounded-r6 bg-t1 px-p6 py-p5 text-body text-t7">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-g6">
            <span className="truncate font-medium">{tool.name}</span>
            <span className="shrink-0 text-footnote text-t6">
              {tool.status === 'running' ? '运行中' : tool.status === 'error' ? '出错' : '完成'}
            </span>
          </summary>
          {formatInput(tool.input) ? (
            <pre className="mt-g5 whitespace-pre-wrap text-code text-t7">{formatInput(tool.input)}</pre>
          ) : null}
          {tool.content ? (
            <pre className="mt-g5 whitespace-pre-wrap text-code text-t7">{tool.content}</pre>
          ) : null}
        </details>
      ))}
    </div>
  );
}

function UserMessage({ message }: { message: CodeMessage }) {
  return (
    <div className="group/msg flex justify-start w-full">
      <div className="flex max-w-[75%] min-w-0 flex-col items-start gap-g6">
        <div className="relative flex max-w-full select-text flex-col gap-g4 rounded-r7 rounded-bl-[var(--r1)] bg-[var(--ui-user-message-background)] px-p8 py-p6 text-[var(--ui-user-message-primary-text)]">
          <p className="text-body whitespace-pre-wrap [overflow-wrap:anywhere] text-pretty">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ message, streaming }: { message: CodeMessage; streaming: boolean }) {
  if (message.is_compact_boundary) {
    return (
      <div className="text-footnote text-t6">
        {message.content || 'Context auto-compacted.'}
      </div>
    );
  }

  return (
    <div className="group/msg flex flex-col w-full [--leading-body:19px]">
      <div className="flex flex-col gap-[var(--chat-item-gap)] select-text">
        {message.thinking ? (
          <div className="text-body text-t6 italic whitespace-pre-wrap break-words">{message.thinking}</div>
        ) : null}
        <ToolList tools={message.toolCalls} />
        {message.content ? (
          <div className={message.error ? 'text-extended-pink' : undefined}>
            <EpitaxyMarkdown content={message.content} />
          </div>
        ) : streaming ? (
          <div className="flex items-center gap-g3 py-p2" aria-label="Claude 正在输入">
            <span className="epitaxy-dot" />
            <span className="epitaxy-dot" />
            <span className="epitaxy-dot" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function filterMessagesForMode(messages: CodeMessage[], mode: CodeTranscriptMode) {
  return messages
    .filter((message) => message.role !== 'system' || message.is_compact_boundary)
    .map((message) => {
      if (message.role !== 'assistant') return message;
      if (mode === 'verbose') return message;
      if (mode === 'thinking') return { ...message, content: '' };
      if (mode === 'summary') {
        const toolCount = message.toolCalls?.length || 0;
        const summary = [
          message.thinking ? message.thinking.split('\n')[0] : '',
          message.content ? message.content.split('\n').find(Boolean) : '',
          toolCount ? `${toolCount} tool ${toolCount === 1 ? 'call' : 'calls'}` : '',
        ].filter(Boolean).join('\n');
        return { ...message, thinking: undefined, content: summary || message.content };
      }
      return { ...message, thinking: undefined };
    });
}

function CodeSidePaneView({
  pane,
  messages,
  cwd,
  onClose,
}: {
  pane: CodeSidePane;
  messages: CodeMessage[];
  cwd?: string | null;
  onClose: () => void;
}) {
  const toolCalls = useMemo(() => messages.flatMap((message) => message.toolCalls || []), [messages]);
  return (
    <aside className="w-[360px] max-w-[42vw] min-w-[300px] shrink-0 border-l border-t3 bg-z1 flex flex-col">
      <div className="flex h-[44px] shrink-0 items-center gap-g4 border-b border-t3 px-p6">
        <span className="flex h-[24px] w-[24px] items-center justify-center text-t6">{sidePaneIcon[pane]}</span>
        <span className="min-w-0 flex-1 truncate text-body-medium text-t8">{sidePaneTitle[pane]}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-r5 text-t6 hover:bg-t2 hover:text-t8">
          <X size={16} strokeWidth={1.9} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-p6 text-body text-t7">
        {pane === 'transcript' ? (
          <div className="flex flex-col gap-g6">
            {messages.length ? messages.map((message) => (
              <div key={message.id} className="rounded-r5 border border-t3 bg-z0 p-p5">
                <div className="mb-g3 text-footnote text-t5">{message.role}</div>
                <pre className="whitespace-pre-wrap break-words font-sans text-body text-t8">{message.thinking || message.content || '(empty)'}</pre>
              </div>
            )) : <div className="text-t5">No messages yet.</div>}
          </div>
        ) : pane === 'tasks' ? (
          <div className="flex flex-col gap-g4">
            {toolCalls.length ? toolCalls.map((tool) => (
              <div key={tool.id} className="rounded-r5 border border-t3 bg-z0 p-p5">
                <div className="flex items-center justify-between gap-g4">
                  <span className="truncate text-body-medium text-t8">{tool.name}</span>
                  <span className="shrink-0 text-footnote text-t6">{tool.status}</span>
                </div>
                {tool.input ? <pre className="mt-g4 whitespace-pre-wrap break-words text-code text-t6">{formatInput(tool.input)}</pre> : null}
              </div>
            )) : <div className="text-t5">No tasks yet.</div>}
          </div>
        ) : pane === 'terminal' ? (
          <div className="rounded-r5 bg-[#1f1f1f] p-p6 font-mono text-code text-[#eeeeee]">
            <div>$ cd {cwd || '~'}</div>
            <div className="mt-g2 text-[#999]">Terminal pane is ready for local session integration.</div>
          </div>
        ) : pane === 'plan' ? (
          <div className="flex h-full items-center justify-center text-center text-t5">No plan yet.</div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-t5">No diff yet.</div>
        )}
      </div>
    </aside>
  );
}

type ComposerProps = {
  busy: boolean;
  disabled?: boolean;
  effort: CodeEffort;
  cwd?: string | null;
  modelLabel?: string;
  modelOptions: CodeModelOption[];
  permissionMode: CodePermissionMode;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onModelEffortChange: (next: { model: string; effort: CodeEffort }) => void;
  onPermissionModeChange: (next: CodePermissionMode) => void;
  onSubmit: () => void;
  onStop: () => void;
};

function CodeSessionComposer({
  busy,
  disabled,
  effort,
  cwd,
  modelLabel,
  modelOptions,
  permissionMode,
  value,
  error,
  onChange,
  onModelEffortChange,
  onPermissionModeChange,
  onSubmit,
  onStop,
}: ComposerProps) {
  return (
    <div className="relative shrink-0 flex flex-col gap-g5 [contain:layout]">
      <CodeDraftClawd />
      <div className="epitaxy-prompt effect-prompt-blur relative isolate rounded-r7 bg-[var(--surface-prompt-blur)] transition-shadow duration-300 focus-within:bg-[var(--surface-prompt-focus-hover)] focus-within:effect-prompt-focus">
        <div className="relative flex w-full">
          <div className="epitaxy-prompt-input flex-1 min-w-0 text-heading text-t9">
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                onSubmit();
              }}
              disabled={busy || disabled}
              rows={1}
              placeholder={disabled ? 'Start a local session first' : '描述任务或提出问题'}
              className="epitaxy-code-textarea"
            />
          </div>
          <div className="flex self-end p-p7 pl-p3">
            <button
              type="button"
              aria-label={busy ? '停止' : '发送'}
              onClick={busy ? onStop : onSubmit}
              disabled={busy ? false : disabled || !value.trim()}
              className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t6 transition-colors hover:bg-t2 hover:text-t8 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {busy ? <Square size={12} strokeWidth={2} /> : <CornerDownLeft size={16} strokeWidth={1.9} />}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full flex items-center gap-g5 py-[4px]">
        <div className="flex min-w-0 items-center gap-g5">
          <CodeEnvironmentSelector disabled value="local" onChange={() => {}} />
          <button type="button" className="inline-flex h-[24px] max-w-[240px] items-center gap-g3 rounded-r5 px-p3 text-body text-t7 hover:bg-t2" title={cwd || undefined}>
            <Folder size={14} strokeWidth={1.7} />
            <span className="truncate">{folderLabel(cwd)}</span>
          </button>
          <CodePermissionModeSelector
            disabled={busy || disabled}
            value={permissionMode}
            onChange={onPermissionModeChange}
          />
          <button type="button" className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t7 hover:bg-t2" aria-label="添加">
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-g4 text-body text-t6">
          <CodeModelEffortSelector
            disabled={busy || disabled}
            model={modelLabel || 'claude-sonnet-4-6'}
            effort={effort}
            models={modelOptions}
            onChange={onModelEffortChange}
          />
        </div>
      </div>
      {error ? <div className="text-footnote text-extended-pink select-text">{error}</div> : null}
    </div>
  );
}

export default function CodeSessionPage({ onConversationUpdated }: { onConversationUpdated?: () => void }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollRef = useRef<number | null>(null);
  const streamRunRef = useRef(0);
  const [messages, setMessages] = useState<CodeMessage[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptMode, setTranscriptMode] = useState<CodeTranscriptMode>('normal');
  const [textSize, setTextSize] = useState<CodeTextSize>(getInitialCodeTextSize);
  const [sidePane, setSidePane] = useState<CodeSidePane | null>(null);
  const [modelOptions] = useState(getLocalCodeModels);

  const initialMessage = (location.state as any)?.initialMessage;
  const modelFromState = (location.state as any)?.model;
  const effortFromState = (location.state as any)?.effort;
  const permissionModeFromState = (location.state as any)?.permissionMode as CodePermissionMode | undefined;
  const modelLabel = conversation?.model || modelFromState || 'claude-sonnet-4-6';
  const effort = effortFromModel(modelLabel, conversation?.code_effort || effortFromState);
  const permissionMode: CodePermissionMode = (
    conversation?.code_permission_mode
      || permissionModeFromState
      || (typeof window !== 'undefined' ? localStorage.getItem('code_default_permission_mode') as CodePermissionMode | null : null)
      || 'default'
  );

  const stopPolling = useCallback(() => {
    if (!pollRef.current) return;
    window.clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const isActiveRun = useCallback((runId: number) => streamRunRef.current === runId, []);

  const beginRun = useCallback(() => {
    streamRunRef.current += 1;
    return streamRunRef.current;
  }, []);

  const finishRun = useCallback((runId: number) => {
    if (!isActiveRun(runId)) return false;
    abortControllerRef.current = null;
    stopPolling();
    setLoading(false);
    if (id) removeStreaming(id);
    return true;
  }, [id, isActiveRun, stopPolling]);

  const loadConversation = useCallback(async (options?: { silent?: boolean }) => {
    if (!id) return;
    if (!options?.silent) setLoaded(false);
    try {
      const data = await getConversation(id);
      setConversation(data);
      setMessages(normalizeMessages(data.messages || []));
      setError(null);
    } catch (err: any) {
      setError(err?.message || '加载 Code 会话失败。');
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    return () => {
      streamRunRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      stopPolling();
      if (id) removeStreaming(id);
    };
  }, [id, stopPolling]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [messages, loading]);

  const updateLastAssistant = useCallback((updater: (message: CodeMessage) => CodeMessage, runId?: number) => {
    if (runId && !isActiveRun(runId)) return;
    setMessages((current) => {
      const next = [...current];
      const index = next.length - 1;
      if (index >= 0 && next[index].role === 'assistant') {
        next[index] = updater(next[index]);
      }
      return next;
    });
  }, [isActiveRun]);

  const pollConversationTitle = useCallback(() => {
    if (!id) return;
    const refresh = async () => {
      try {
        const data = await getConversation(id);
        setConversation(data);
        window.dispatchEvent(new CustomEvent('conversationTitleUpdated'));
        onConversationUpdated?.();
      } catch {
        // 标题生成失败不影响当前会话显示。
      }
    };
    refresh();
    window.setTimeout(refresh, 3000);
    window.setTimeout(refresh, 6000);
  }, [id, onConversationUpdated]);

  const startGenerationPolling = useCallback((runId: number) => {
    if (!id) return;
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      if (!isActiveRun(runId)) return;
      try {
        const status = await getGenerationStatus(id);
        if (!status?.active || status.status !== 'generating') {
          finishRun(runId);
          await loadConversation({ silent: true });
          pollConversationTitle();
          return;
        }
        setMessages((current) => appendOrUpdateAssistant(current, (message) => applyGenerationSnapshot(message, status)));
      } catch {
        stopPolling();
      }
    }, 1500);
  }, [finishRun, id, isActiveRun, loadConversation, pollConversationTitle, stopPolling]);

  const reconnectActiveStream = useCallback(async () => {
    if (!id || initialMessage || loading || !conversation?.code_cwd) return;
    try {
      const status = await getStreamStatus(id);
      if (!status.active) {
        const generation = await getGenerationStatus(id).catch(() => null);
        if (generation?.active && generation.status === 'generating') {
          const runId = beginRun();
          addStreaming(id);
          setLoading(true);
          setMessages((current) => appendOrUpdateAssistant(current, (message) => applyGenerationSnapshot(message, generation)));
          startGenerationPolling(runId);
        }
        return;
      }

      const runId = beginRun();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      addStreaming(id);
      setLoading(true);
      setMessages((current) => appendOrUpdateAssistant(current, (message) => message));

      reconnectStream(
        id,
        (_delta, full) => {
          updateLastAssistant((message) => ({ ...message, content: full }), runId);
        },
        async (full) => {
          updateLastAssistant((message) => ({ ...message, content: full }), runId);
          finishRun(runId);
          await loadConversation({ silent: true });
          pollConversationTitle();
        },
        (message) => {
          updateLastAssistant((current) => ({ ...current, content: message, error: true }), runId);
          finishRun(runId);
          pollConversationTitle();
        },
        (_thinkingDelta, thinkingFull) => {
          updateLastAssistant((message) => ({ ...message, thinking: thinkingFull }), runId);
        },
        (event, message, data) => {
          if (event === 'status' && data?.message) {
            updateLastAssistant((current) => ({ ...current, thinking: data.message }), runId);
          }
          if (event === 'compact_boundary') {
            setMessages((current) => [
              ...current,
              {
                id: `compact-${Date.now()}`,
                role: 'system',
                content: message || 'Context auto-compacted by engine.',
                is_compact_boundary: true,
                created_at: new Date().toISOString(),
              },
            ]);
          }
        },
        (toolEvent: any) => {
          updateLastAssistant((message) => {
            const toolCalls = [...(message.toolCalls || [])];
            const index = toolCalls.findIndex((tool) => tool.id === toolEvent.tool_use_id);
            if (toolEvent.type === 'start') {
              const nextTool: CodeToolCall = {
                id: toolEvent.tool_use_id,
                name: toolEvent.tool_name || 'tool',
                input: toolEvent.tool_input,
                status: 'running',
                textBefore: toolEvent.textBefore,
              };
              if (index >= 0) toolCalls[index] = { ...toolCalls[index], ...nextTool };
              else toolCalls.push(nextTool);
            }
            if (toolEvent.type === 'input' && index >= 0) {
              toolCalls[index] = { ...toolCalls[index], input: toolEvent.tool_input };
            }
            if (toolEvent.type === 'done' && index >= 0) {
              toolCalls[index] = {
                ...toolCalls[index],
                content: toolEvent.content,
                status: toolEvent.is_error ? 'error' : 'done',
              };
            }
            return { ...message, toolCalls };
          }, runId);
        },
        controller.signal,
      );
    } catch {
      // Reconnect is opportunistic; normal loaded transcript stays usable.
    }
  }, [beginRun, conversation?.code_cwd, finishRun, id, initialMessage, loadConversation, loading, pollConversationTitle, startGenerationPolling, updateLastAssistant]);

  useEffect(() => {
    if (!loaded) return;
    reconnectActiveStream();
  }, [loaded, reconnectActiveStream]);

  useEffect(() => {
    return addCodeSessionUiListener((event) => {
      if (event.type === 'setTranscriptMode') setTranscriptMode(event.mode);
      if (event.type === 'setTextSize') {
        window.localStorage.setItem(CODE_TEXT_SIZE_STORAGE_KEY, event.size);
        setTextSize(event.size);
      }
      if (event.type === 'toggleSidePane') setSidePane((current) => current === event.pane ? null : event.pane);
      if (event.type === 'closeSidePane') setSidePane(null);
    });
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.chatTextSize = textSize;
    return () => {
      delete document.documentElement.dataset.chatTextSize;
    };
  }, [textSize]);

  const submitMessage = useCallback(async (textOverride?: string) => {
    if (!id || loading) return;
    if (loaded && !conversation?.code_cwd) {
      setError('Start a local session first to use Code.');
      return;
    }
    const text = (textOverride ?? inputText).trim();
    if (!text) return;

    const userMessage: CodeMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    const assistantMessage = createAssistantPlaceholder();

    setInputText('');
    setError(null);
    setLoading(true);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    const runId = beginRun();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    addStreaming(id);

    await sendMessage(
      id,
      text,
      null,
      (_delta, full) => {
        updateLastAssistant((message) => ({ ...message, content: full }), runId);
      },
      async (full) => {
        updateLastAssistant((message) => ({ ...message, content: full }), runId);
        finishRun(runId);
        await loadConversation({ silent: true });
        pollConversationTitle();
      },
      (message) => {
        updateLastAssistant((current) => ({ ...current, content: message, error: true }), runId);
        finishRun(runId);
        pollConversationTitle();
      },
      (_thinkingDelta, thinkingFull) => {
        updateLastAssistant((message) => ({ ...message, thinking: thinkingFull }), runId);
      },
      (event, _message, data) => {
        if (!isActiveRun(runId)) return;
        if (event === 'metadata' && data?.user_message_id) {
          setMessages((current) => current.map((message) => (
            message.id === userMessage.id ? { ...message, id: data.user_message_id } : message
          )));
        }
        if (event === 'status' && data?.message) {
          updateLastAssistant((message) => ({ ...message, thinking: data.message }), runId);
        }
        if (event === 'compact_boundary') {
          setMessages((current) => [
            ...current,
            {
              id: `compact-${Date.now()}`,
              role: 'system',
              content: 'Context auto-compacted by engine.',
              is_compact_boundary: true,
              created_at: new Date().toISOString(),
            },
          ]);
        }
      },
      undefined,
      undefined,
      undefined,
      undefined,
      (toolEvent: any) => {
        updateLastAssistant((message) => {
          const toolCalls = [...(message.toolCalls || [])];
          const index = toolCalls.findIndex((tool) => tool.id === toolEvent.tool_use_id);
          if (toolEvent.type === 'start') {
            const nextTool: CodeToolCall = {
              id: toolEvent.tool_use_id,
              name: toolEvent.tool_name || 'tool',
              input: toolEvent.tool_input,
              status: 'running',
              textBefore: toolEvent.textBefore,
            };
            if (index >= 0) toolCalls[index] = { ...toolCalls[index], ...nextTool };
            else toolCalls.push(nextTool);
          }
          if (toolEvent.type === 'input' && index >= 0) {
            toolCalls[index] = { ...toolCalls[index], input: toolEvent.tool_input };
          }
          if (toolEvent.type === 'done' && index >= 0) {
            toolCalls[index] = {
              ...toolCalls[index],
              content: toolEvent.content,
              status: toolEvent.is_error ? 'error' : 'done',
            };
          }
          return { ...message, toolCalls };
        }, runId);
      },
      controller.signal,
    );
  }, [beginRun, conversation?.code_cwd, finishRun, id, inputText, isActiveRun, loadConversation, loaded, loading, pollConversationTitle, updateLastAssistant]);

  useEffect(() => {
    if (!id || !loaded || !initialMessage) return;
    const flagKey = `code-initial-sent:${id}`;
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, '1');
    navigate(location.pathname, { replace: true, state: {} });
    submitMessage(initialMessage);
  }, [id, initialMessage, loaded, location.pathname, navigate, submitMessage]);

  const stop = useCallback(() => {
    if (!id) return;
    const runId = streamRunRef.current;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stopPolling();
    setLoading(false);
    removeStreaming(id);
    stopGeneration(id)
      .then(() => {
        finishRun(runId);
        loadConversation({ silent: true });
      })
      .catch(() => {});
  }, [finishRun, id, loadConversation, stopPolling]);

  const blocksLocalCodeSession = loaded && conversation && !conversation.code_cwd;

  const handleModelEffortChange = useCallback(async ({ model: nextModel, effort: nextEffort }: { model: string; effort: CodeEffort }) => {
    if (!id || loading || blocksLocalCodeSession) return;
    const normalizedModel = toCodeModelString(nextModel, nextEffort);
    const previousConversation = conversation;
    setConversation((current: any) => current ? { ...current, model: normalizedModel, code_effort: nextEffort } : current);
    localStorage.setItem('default_model', normalizedModel);
    localStorage.setItem('code_default_effort', nextEffort);
    try {
      const updated = await updateConversation(id, {
        model: normalizedModel,
        code_effort: nextEffort,
        research_mode: false,
      });
      setConversation(updated);
      window.dispatchEvent(new CustomEvent('conversationTitleUpdated'));
      onConversationUpdated?.();
    } catch (err: any) {
      setConversation(previousConversation);
      setError(err?.message || '更新模型设置失败。');
    }
  }, [blocksLocalCodeSession, conversation, id, loading, onConversationUpdated]);

  const handlePermissionModeChange = useCallback(async (next: CodePermissionMode) => {
    if (!id || blocksLocalCodeSession) return;
    const previousConversation = conversation;
    setConversation((current: any) => current ? { ...current, code_permission_mode: next } : current);
    localStorage.setItem('code_default_permission_mode', next);
    try {
      const updated = await updateConversation(id, { code_permission_mode: next });
      setConversation(updated);
      onConversationUpdated?.();
    } catch (err: any) {
      setConversation(previousConversation);
      setError(err?.message || '更新权限模式失败。');
    }
  }, [blocksLocalCodeSession, conversation, id, onConversationUpdated]);

  const visibleMessages = useMemo(
    () => filterMessagesForMode(messages, transcriptMode),
    [messages, transcriptMode],
  );

  return (
    <main className="epitaxy-root epitaxy-code-page epitaxy-code-session select-none h-full w-full flex flex-col">
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 relative isolate [--epitaxy-scrim-inset-end:16px]">
          <div aria-hidden="true" className="epitaxy-top-scrim" />
          <div aria-hidden="true" className="epitaxy-bottom-scrim" style={{ opacity: 1 }} />
          <div ref={scrollRef} className="epitaxy-code-scroll h-full overflow-y-auto overflow-x-hidden [contain:strict]">
            {!loaded ? (
              <div className="h-full flex items-center justify-center text-body text-t5">加载中...</div>
            ) : blocksLocalCodeSession ? (
              <div className="h-full flex items-center justify-center text-body text-t5">Start a local session first to use Code.</div>
            ) : visibleMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-body text-t5">No messages yet.</div>
            ) : (
              <div className="epitaxy-chat-column epitaxy-chat-size flex flex-col gap-[var(--chat-turn-gap)] pt-[28px] pb-[32px]">
                {visibleMessages.map((message, index) => (
                  message.role === 'user'
                    ? <UserMessage key={message.id} message={message} />
                    : <AssistantMessage key={message.id} message={message} streaming={loading && index === visibleMessages.length - 1} />
                ))}
              </div>
            )}
          </div>
        </div>
        {sidePane ? (
          <CodeSidePaneView
            pane={sidePane}
            messages={messages}
            cwd={conversation?.code_cwd}
            onClose={() => {
              setSidePane(null);
              dispatchCodeSessionUiEvent({ type: 'closeSidePane' });
            }}
          />
        ) : null}
      </div>

      <div className="epitaxy-code-composer-region epitaxy-chat-column epitaxy-chat-size relative shrink-0 flex flex-col gap-g5 [contain:layout]">
        <CodeSessionComposer
          busy={loading}
          disabled={!!blocksLocalCodeSession}
          effort={effort}
          cwd={conversation?.code_cwd}
          modelLabel={modelLabel}
          modelOptions={modelOptions}
          permissionMode={permissionMode}
          value={inputText}
          error={error}
          onChange={(value) => {
            setInputText(value);
            if (error) setError(null);
          }}
          onModelEffortChange={handleModelEffortChange}
          onPermissionModeChange={handlePermissionModeChange}
          onSubmit={() => submitMessage()}
          onStop={stop}
        />
      </div>
    </main>
  );
}
