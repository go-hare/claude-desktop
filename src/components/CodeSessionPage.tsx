import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Folder, Laptop, Plus, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getConversation, sendMessage, stopGeneration } from '../api';
import CodeDraftClawd from './CodeDraftClawd';

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

type ComposerProps = {
  busy: boolean;
  cwd?: string | null;
  modelLabel?: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
};

function CodeSessionComposer({ busy, cwd, modelLabel, value, error, onChange, onSubmit, onStop }: ComposerProps) {
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
              disabled={busy}
              rows={1}
              placeholder="描述任务或提出问题"
              className="epitaxy-code-textarea"
            />
          </div>
          <div className="flex self-end p-p7 pl-p3">
            <button
              type="button"
              aria-label={busy ? '停止' : '发送'}
              onClick={busy ? onStop : onSubmit}
              disabled={!busy && !value.trim()}
              className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t6 transition-colors hover:bg-t2 hover:text-t8 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {busy ? <Square size={12} strokeWidth={2} /> : <CornerDownLeft size={16} strokeWidth={1.9} />}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full flex items-center gap-g5 py-[4px]">
        <div className="flex min-w-0 items-center gap-g5">
          <button type="button" className="inline-flex h-[24px] items-center gap-g3 rounded-r5 px-p3 text-body text-t7 hover:bg-t2">
            <Laptop size={14} strokeWidth={1.7} />
            本地
          </button>
          <button type="button" className="inline-flex h-[24px] max-w-[240px] items-center gap-g3 rounded-r5 px-p3 text-body text-t7 hover:bg-t2" title={cwd || undefined}>
            <Folder size={14} strokeWidth={1.7} />
            <span className="truncate">{folderLabel(cwd)}</span>
          </button>
          <button type="button" className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t7 hover:bg-t2" aria-label="添加">
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-g4 text-body text-t6">
          <span className="truncate">{modelLabel || 'claude-sonnet-4-6'} · 中</span>
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
  const [messages, setMessages] = useState<CodeMessage[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialMessage = (location.state as any)?.initialMessage;
  const modelFromState = (location.state as any)?.model;
  const modelLabel = modelFromState || conversation?.model;

  const loadConversation = useCallback(async () => {
    if (!id) return;
    setLoaded(false);
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
    const node = scrollRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [messages, loading]);

  const updateLastAssistant = useCallback((updater: (message: CodeMessage) => CodeMessage) => {
    setMessages((current) => {
      const next = [...current];
      const index = next.length - 1;
      if (index >= 0 && next[index].role === 'assistant') {
        next[index] = updater(next[index]);
      }
      return next;
    });
  }, []);

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

  const submitMessage = useCallback(async (textOverride?: string) => {
    if (!id || loading) return;
    const text = (textOverride ?? inputText).trim();
    if (!text) return;

    const userMessage: CodeMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    const assistantMessage: CodeMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      toolCalls: [],
    };

    setInputText('');
    setError(null);
    setLoading(true);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    await sendMessage(
      id,
      text,
      null,
      (_delta, full) => {
        updateLastAssistant((message) => ({ ...message, content: full }));
      },
      (full) => {
        updateLastAssistant((message) => ({ ...message, content: full }));
        abortControllerRef.current = null;
        setLoading(false);
        pollConversationTitle();
      },
      (message) => {
        updateLastAssistant((current) => ({ ...current, content: message, error: true }));
        abortControllerRef.current = null;
        setLoading(false);
      },
      (_thinkingDelta, thinkingFull) => {
        updateLastAssistant((message) => ({ ...message, thinking: thinkingFull }));
      },
      (event, _message, data) => {
        if (event === 'metadata' && data?.user_message_id) {
          setMessages((current) => current.map((message) => (
            message.id === userMessage.id ? { ...message, id: data.user_message_id } : message
          )));
        }
        if (event === 'status' && data?.message) {
          updateLastAssistant((message) => ({ ...message, thinking: data.message }));
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
        });
      },
      controller.signal,
    );
  }, [id, inputText, loading, pollConversationTitle, updateLastAssistant]);

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
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    stopGeneration(id).catch(() => {});
  }, [id]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role !== 'system' || message.is_compact_boundary),
    [messages],
  );

  return (
    <main className="epitaxy-root epitaxy-code-page epitaxy-code-session select-none h-full w-full flex flex-col">
      <div className="flex-1 min-h-0 relative isolate [--epitaxy-scrim-inset-end:16px]">
        <div aria-hidden="true" className="epitaxy-top-scrim" />
        <div aria-hidden="true" className="epitaxy-bottom-scrim" style={{ opacity: 1 }} />
        <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden [contain:strict]">
          {!loaded ? (
            <div className="h-full flex items-center justify-center text-body text-t5">加载中...</div>
          ) : visibleMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-body text-t5">No messages yet.</div>
          ) : (
            <div className="epitaxy-chat-column epitaxy-chat-size flex flex-col gap-[var(--chat-turn-gap)] pt-[48px] pb-[32px]">
              {visibleMessages.map((message, index) => (
                message.role === 'user'
                  ? <UserMessage key={message.id} message={message} />
                  : <AssistantMessage key={message.id} message={message} streaming={loading && index === visibleMessages.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="epitaxy-chat-column epitaxy-chat-size relative shrink-0 flex flex-col gap-g5 [contain:layout]">
        <CodeSessionComposer
          busy={loading}
          cwd={conversation?.code_cwd}
          modelLabel={modelLabel}
          value={inputText}
          error={error}
          onChange={(value) => {
            setInputText(value);
            if (error) setError(null);
          }}
          onSubmit={() => submitMessage()}
          onStop={stop}
        />
      </div>
    </main>
  );
}
