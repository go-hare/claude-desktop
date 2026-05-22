import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, CornerDownLeft, Copy, FileDiff, FileText, Folder, Image as ImageIcon, ListChecks, ListTodo, NotebookText, Paperclip, Pencil, Plus, RotateCcw, Settings, Square, Terminal, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './MarkdownRenderer';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { compactConversation, decideToolPermission, deleteConversation, deleteMessagesFrom, getAttachmentUrl, getContextSize, getConversation, getEffectiveConfig, getGenerationStatus, getStreamStatus, getToolAllowlist, listSlashCommands, reconnectStream, revokeToolAllowlist, sendMessage, stopGeneration, updateConversation, uploadFile, type CustomSlashCommand, type EffectiveConfig, type UploadResult } from '../api';
import { copyToClipboard } from '../utils/clipboard';
import { pushError, pushSuccess } from './code/codeToastStore';
import CodeToastViewport from './code/CodeToastViewport';
import { addStreaming, removeStreaming } from '../streamingState';
import CodeDraftClawd from './CodeDraftClawd';
import {
  addCodeSessionUiListener,
  dispatchCodeSessionUiEvent,
  TRANSCRIPT_MODE_ITEMS,
  type CodeSidePane,
  type CodeTextSize,
  type CodeTranscriptMode,
} from '../codeSessionUi';
import CodeEnvironmentSelector, { type CodeEnvironmentKind } from './code/CodeEnvironmentSelector';
import CodeTerminal from './code/CodeTerminal';
import CodeDiffPane from './code/CodeDiffPane';
import CodePlanPane from './code/CodePlanPane';
import CodeTasksPane from './code/CodeTasksPane';
import CodeToolPermissionModal, { type ToolPermissionRequest } from './code/CodeToolPermissionModal';
import CodePlanApprovalModal, { type PlanApprovalRequest } from './code/CodePlanApprovalModal';
import CodeSubagentsModal from './code/CodeSubagentsModal';
import SparkSpinner from './code/SparkSpinner';
import { detectSlashQuery, matchSlashCommands, BUILTIN_SLASH_COMMANDS, type CodeSlashCommand } from './code/codeSlashCommands';
import { summarizeToolInput } from './code/codeToolSummary';
import CodeModelEffortSelector, {
  effortFromModel,
  getLocalCodeModels,
  toCodeModelString,
  type CodeEffort,
  type CodeModelOption,
} from './code/CodeModelEffortSelector';
import CodePermissionModeSelector, { permissionModeShortLabel, type CodePermissionMode } from './code/CodePermissionModeSelector';

type CodeToolCall = {
  id: string;
  name: string;
  input?: unknown;
  content?: string;
  status: 'running' | 'done' | 'error';
  textBefore?: string;
  startedAt?: number;
  endedAt?: number;
};

type CodeMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  thinking?: string;
  error?: boolean;
  is_compact_boundary?: boolean;
  is_local_notice?: boolean;
  toolCalls?: CodeToolCall[];
  attachments?: Array<{ fileId?: string; fileName?: string; fileType?: string; mimeType?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
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
  settings: '设置',
};

const sidePaneIcon: Record<CodeSidePane, React.ReactNode> = {
  diff: <FileDiff size={16} strokeWidth={1.8} />,
  terminal: <Terminal size={16} strokeWidth={1.8} />,
  tasks: <ListTodo size={16} strokeWidth={1.8} />,
  plan: <ListChecks size={16} strokeWidth={1.8} />,
  transcript: null,
  settings: <Settings size={16} strokeWidth={1.8} />,
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
      attachments: Array.isArray(message.attachments) ? message.attachments : undefined,
      usage: message.usage,
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

function formatTokens(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '') + 'k';
  return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }: any) {
            // Hand pre> to <code> renderer below — our CodeBlock wraps
            // syntax-highlighted code blocks itself.
            return <>{children}</>;
          },
          code({ node, className, children, ...props }: any) {
            const isBlock = className?.startsWith('language-') || (node?.position?.start?.line !== node?.position?.end?.line);
            const language = className?.replace('language-', '') || '';
            if (isBlock) {
              const codeText = String(children).replace(/\n$/, '');
              return <CodeBlock language={language} code={codeText} className={className} />;
            }
            // Inline code: let .epitaxy-markdown :not(pre)>code style it.
            return <code {...props}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeEmptyState({ cwd, onPick }: { cwd?: string | null; onPick: (text: string) => void }) {
  const folderName = cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() || cwd : null;
  const examples = [
    { title: '解释项目', text: '简要分析一下当前代码库的整体结构和主要模块。' },
    { title: '查找 bug', text: '帮我检查最近改动的文件里有没有潜在的 bug 或边界情况漏洞。' },
    { title: '写测试', text: '为最近修改的关键函数补一些单元测试。' },
    { title: '小重构', text: '挑一个最值得重构的函数，给出改进建议并实现。' },
  ];
  return (
    <div className="h-full flex items-center justify-center px-4">
      <div className="epitaxy-chat-column epitaxy-chat-size flex flex-col items-center gap-g6 text-center">
        <div className="flex flex-col gap-g3">
          <h2 className="text-heading-3 text-t8 font-semibold">开始一个新会话</h2>
          <p className="text-body text-t6">
            {folderName ? <>当前目录 <span className="font-mono text-t7">{folderName}</span>，可以直接提问或选择下面的示例</> : '可以直接提问，或选择下面的示例'}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-g4 w-full">
          {examples.map((example) => (
            <button
              key={example.title}
              type="button"
              onClick={() => onPick(example.text)}
              className="text-left rounded-r6 border border-t3 bg-t1 hover:bg-t2 hover:border-t4 transition-colors px-p5 py-p4 flex flex-col gap-g2"
            >
              <span className="text-body font-medium text-t8">{example.title}</span>
              <span className="text-footnote text-t6 line-clamp-2">{example.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CollapsedText({ text, limit = 1500 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const truncated = text.length > limit;
  const displayed = !truncated || expanded ? text : text.slice(0, limit);  return (
    <div className="flex flex-col gap-g3">
      <pre className="overflow-x-auto whitespace-pre-wrap text-code text-t7">{displayed}{truncated && !expanded ? '…' : ''}</pre>
      {truncated ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
          className="self-start text-footnote text-t6 hover:text-t8"
        >
          {expanded ? 'Collapse' : `Show ${text.length - limit} more chars`}
        </button>
      ) : null}
    </div>
  );
}

function ToolElapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  return <span className="tabular-nums">{seconds}s</span>;
}

function ToolList({ tools }: { tools?: CodeToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!tools?.length) return null;

  // Always collapse into a single dim summary line ("已运行 N 命令") that
  // expands to the full per-tool list. Matches the official dense layout
  // where a turn's tool calls don't visually compete with the prose.
  const running = tools.some((t) => t.status === 'running');
  const errored = tools.some((t) => t.status === 'error');
  const summarySuffix = running ? '（进行中）' : errored ? '（部分失败）' : '';

  return (
    <div className="flex flex-col gap-g3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="inline-flex items-center gap-g2 self-start text-footnote text-t6 hover:text-t8"
        aria-expanded={expanded}
      >
        <ChevronRight size={12} strokeWidth={1.7} className={(expanded ? 'rotate-90 ' : '') + 'transition-transform'} />
        <span>已运行 {tools.length} 个命令{summarySuffix}</span>
      </button>
      {expanded ? (
        <div className="flex flex-col gap-g3">
          {tools.map((tool) => (
            <ToolListItem key={tool.id} tool={tool} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolListItem({ tool }: { tool: CodeToolCall }) {
  const inputText = formatInput(tool.input);
  const summary = summarizeToolInput(tool.name, tool.input as any);
  return (
    <details className="rounded-r6 bg-t1 px-p6 py-p5 text-body text-t7">
      <summary className="flex cursor-pointer list-none items-center gap-g4">
        <span className="shrink-0 font-medium">{tool.name}</span>
        {summary ? (
          <span className="min-w-0 flex-1 truncate text-footnote text-t6" title={summary}>{summary}</span>
        ) : <span className="flex-1" />}
        <span className="shrink-0 text-footnote text-t6 inline-flex items-center gap-g2">
          {tool.status === 'running' ? (
            <>
              <span className="epitaxy-dot h-[6px] w-[6px]" />
              {tool.startedAt ? <ToolElapsed startedAt={tool.startedAt} /> : '运行中'}
            </>
          ) : tool.status === 'error' ? '出错' : '完成'}
        </span>
      </summary>
      {inputText ? (
        <pre className="mt-g5 whitespace-pre-wrap text-code text-t7">{inputText}</pre>
      ) : null}
      {tool.content ? <div className="mt-g5"><CollapsedText text={tool.content} /></div> : null}
    </details>
  );
}

type MessageAction = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
};

function MessageActions({ actions }: { actions: MessageAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="flex items-center gap-g3 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          aria-label={action.label}
          title={action.label}
          className={'inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t6 transition-colors hover:bg-t2 ' + (action.danger ? 'hover:text-extended-pink' : 'hover:text-t8')}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}

function MessageAttachmentList({ attachments }: { attachments: NonNullable<CodeMessage['attachments']> }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-g3">
      {attachments.map((attachment, idx) => {
        if (!attachment.fileId) return null;
        const url = getAttachmentUrl(attachment.fileId);
        if (attachment.fileType === 'image') {
          return (
            <a key={attachment.fileId || idx} href={url} target="_blank" rel="noopener noreferrer" className="block max-w-[240px] overflow-hidden rounded-r5 border border-t3">
              <img src={url} alt={attachment.fileName || 'image'} className="block max-h-[200px] w-auto" />
            </a>
          );
        }
        return (
          <a
            key={attachment.fileId || idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[260px] items-center gap-g3 rounded-r5 border border-t3 bg-z0 px-p3 py-[3px] text-footnote text-t7 hover:bg-t2"
            title={attachment.fileName}
          >
            <FileText size={12} strokeWidth={1.7} />
            <span className="truncate">{attachment.fileName || attachment.fileId}</span>
          </a>
        );
      })}
    </div>
  );
}

function UserMessage({ message, actions }: { message: CodeMessage; actions: MessageAction[] }) {
  return (
    <div className="group/msg flex flex-col items-start gap-g3 w-full">
      <div className="flex w-full justify-start">
        <div className="flex max-w-[75%] min-w-0 flex-col items-start gap-g4">
          {message.attachments?.length ? <MessageAttachmentList attachments={message.attachments} /> : null}
          <div className="relative flex max-w-full select-text flex-col gap-g4 rounded-r7 rounded-bl-[var(--r1)] bg-[var(--ui-user-message-background)] px-p7 py-p5 text-[var(--ui-user-message-primary-text)]">
            <p className="text-body whitespace-pre-wrap [overflow-wrap:anywhere] text-pretty">{message.content}</p>
          </div>
        </div>
      </div>
      <MessageActions actions={actions} />
    </div>
  );
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s}s`;
}

function StreamingPending({ startedAt }: { startedAt?: string }) {
  const start = useMemo(() => {
    const t = startedAt ? Date.parse(startedAt) : NaN;
    return Number.isFinite(t) ? t : Date.now();
  }, [startedAt]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-g3 py-p2 text-footnote text-t6" aria-label="Claude 正在输入">
      <SparkSpinner size="m" />
      <span className="tabular-nums">{formatElapsed(now - start)}</span>
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <div className="flex flex-col gap-g2">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="inline-flex items-center gap-g2 self-start text-footnote text-t6 hover:text-t8"
        aria-expanded={expanded}
      >
        <ChevronRight size={12} strokeWidth={1.7} className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
        <span>思考</span>
      </button>
      {expanded ? (
        <div className="rounded-r5 border-l-2 border-t3 pl-p4 text-body text-t6 italic whitespace-pre-wrap break-words leading-[1.5]">
          {text}
        </div>
      ) : null}
    </div>
  );
}

function AssistantMessage({ message, streaming, actions }: { message: CodeMessage; streaming: boolean; actions: MessageAction[] }) {
  if (message.is_compact_boundary) {
    return (
      <div className="text-footnote text-t6">
        {message.content || 'Context auto-compacted.'}
      </div>
    );
  }
  if (message.is_local_notice) {
    return (
      <div className="text-footnote text-t6">{message.content}</div>
    );
  }

  return (
    <div className="group/msg flex flex-col w-full [--leading-body:19px]">
      <div className="flex flex-col gap-[var(--chat-item-gap)] select-text">
        {message.thinking ? (
          <ThinkingBlock text={message.thinking} />
        ) : null}
        <ToolList tools={message.toolCalls} />
        {message.content ? (
          <div className={message.error ? 'text-extended-pink' : undefined}>
            <EpitaxyMarkdown content={message.content} />
          </div>
        ) : streaming ? (
          <StreamingPending startedAt={message.created_at} />
        ) : null}
      </div>
      {!streaming ? <MessageActions actions={actions} /> : null}
    </div>
  );
}

function filterMessagesForMode(messages: CodeMessage[], mode: CodeTranscriptMode) {
  return messages
    .filter((message) => message.role !== 'system' || message.is_compact_boundary || message.is_local_notice)
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
  settingsContent,
}: {
  pane: CodeSidePane;
  messages: CodeMessage[];
  cwd?: string | null;
  onClose: () => void;
  settingsContent?: React.ReactNode;
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
      {pane === 'terminal' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <CodeTerminal cwd={cwd} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {pane === 'transcript' ? (
            <div className="flex flex-col gap-g6 p-p6 text-body text-t7">
              {messages.length ? messages.map((message) => (
                <div key={message.id} className="rounded-r5 border border-t3 bg-z0 p-p5">
                  <div className="mb-g3 text-footnote text-t5">{message.role}</div>
                  <pre className="whitespace-pre-wrap break-words font-sans text-body text-t8">{message.thinking || message.content || '(empty)'}</pre>
                </div>
              )) : <div className="flex h-full items-center justify-center text-center text-t5">No messages yet.</div>}
            </div>
          ) : pane === 'tasks' ? (
            <CodeTasksPane toolCalls={toolCalls} />
          ) : pane === 'plan' ? (
            <CodePlanPane toolCalls={toolCalls} />
          ) : pane === 'settings' ? (
            settingsContent || null
          ) : (
            <CodeDiffPane toolCalls={toolCalls} />
          )}
        </div>
      )}
    </aside>
  );
}

type ComposerAttachment = {
  fileId: string;
  fileName: string;
  fileType: 'image' | 'document' | 'text';
  uploading?: boolean;
  error?: string;
};

function CodeSettingsPane({
  conversation,
  modelLabel,
  permissionMode,
  allowlist,
  draftValue,
  lastUsage,
  contextInfo,
  effectiveConfig,
  mcpErrors,
  onRevoke,
  onClearAllowlist,
  onClearDraft,
  onRename,
  onDelete,
  onCompact,
  onManageSubagents,
}: {
  conversation: any | null;
  modelLabel: string;
  permissionMode: CodePermissionMode;
  allowlist: string[];
  draftValue: string;
  lastUsage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | null;
  contextInfo: { tokens: number; limit: number } | null;
  effectiveConfig: EffectiveConfig;
  mcpErrors: Record<string, string>;
  onRevoke: (tool: string) => void;
  onClearAllowlist: () => void;
  onClearDraft: () => void;
  onRename: (next: string) => void;
  onDelete: () => void;
  onCompact: () => void;
  onManageSubagents: () => void;
}) {
  return (
    <div className="flex flex-col gap-g6 p-p6 text-body text-t8">
      <section className="flex flex-col gap-g3">
        <h3 className="text-footnote text-t6 uppercase tracking-wide">会话</h3>
        <div className="flex flex-col gap-g2 rounded-r5 border border-t3 bg-z0 p-p5">
          <div className="flex justify-between gap-g4">
            <span className="text-t6">标题</span>
            <span className="min-w-0 flex-1 truncate text-right">{conversation?.title || '(未命名)'}</span>
          </div>
          <div className="flex justify-between gap-g4">
            <span className="text-t6">目录</span>
            <span className="min-w-0 flex-1 truncate text-right font-mono text-footnote" title={conversation?.code_cwd || ''}>{conversation?.code_cwd || '-'}</span>
          </div>
          <div className="flex justify-between gap-g4">
            <span className="text-t6">创建时间</span>
            <span className="text-right text-footnote text-t7">{conversation?.created_at ? new Date(conversation.created_at).toLocaleString() : '-'}</span>
          </div>
          <div className="flex justify-between gap-g4">
            <span className="text-t6">ID</span>
            <span className="min-w-0 flex-1 truncate text-right font-mono text-footnote text-t6" title={conversation?.id || ''}>{conversation?.id || '-'}</span>
          </div>
        </div>
        <div className="flex gap-g3">
          <button
            type="button"
            onClick={() => {
              const next = window.prompt('重命名会话', conversation?.title || '');
              if (next === null) return;
              const trimmed = next.trim();
              if (!trimmed || trimmed === conversation?.title) return;
              onRename(trimmed);
            }}
            className="inline-flex items-center gap-g2 rounded-r5 border border-t3 px-p4 py-p3 text-footnote text-t7 hover:bg-t2"
          >
            <Pencil size={13} strokeWidth={1.7} /> 重命名
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-g3">
        <h3 className="text-footnote text-t6 uppercase tracking-wide">引擎</h3>
        <div className="flex flex-col gap-g2 rounded-r5 border border-t3 bg-z0 p-p5">
          <div className="flex justify-between gap-g4">
            <span className="text-t6">模型</span>
            <span className="text-right">{modelLabel}</span>
          </div>
          <div className="flex justify-between gap-g4">
            <span className="text-t6">权限模式</span>
            <span className="text-right">{permissionModeShortLabel(permissionMode)}</span>
          </div>
          {contextInfo && contextInfo.limit > 0 ? (
            (() => {
              const pct = Math.min(100, Math.round((contextInfo.tokens / contextInfo.limit) * 100));
              const crit = pct >= 90;
              const warn = pct >= 75;
              const barColor = crit ? 'bg-extended-pink' : warn ? 'bg-extended-yellow' : 'bg-t7';
              return (
                <div className="flex flex-col gap-g2 pt-g2">
                  <div className="flex justify-between gap-g4 text-footnote">
                    <span className="text-t6">上下文</span>
                    <span className="tabular-nums text-t7">
                      {contextInfo.tokens.toLocaleString()} / {contextInfo.limit.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="h-[4px] w-full overflow-hidden rounded-full bg-t2">
                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  {pct >= 75 ? (
                    <button
                      type="button"
                      onClick={onCompact}
                      className="self-start text-footnote text-t6 hover:text-t8 underline"
                    >
                      压缩上下文
                    </button>
                  ) : null}
                </div>
              );
            })()
          ) : null}
          {lastUsage ? (
            <div className="flex justify-between gap-g4">
              <span className="text-t6">最近一次用量</span>
              <span className="text-right tabular-nums text-footnote text-t7">
                输入 {lastUsage.input_tokens || 0} · 输出 {lastUsage.output_tokens || 0}
                {lastUsage.cache_read_input_tokens ? ` · 缓存读 ${lastUsage.cache_read_input_tokens}` : ''}
              </span>
            </div>
          ) : null}
        </div>
        <p className="text-footnote text-t6">在 composer 底部修改模型与权限模式。</p>
      </section>

      <section className="flex flex-col gap-g3">
        <header className="flex items-center justify-between">
          <h3 className="text-footnote text-t6 uppercase tracking-wide">始终允许的工具</h3>
          {allowlist.length > 1 ? (
            <button type="button" onClick={onClearAllowlist} className="text-footnote text-t6 hover:text-t8">全部撤销</button>
          ) : null}
        </header>
        {allowlist.length === 0 ? (
          <p className="text-footnote text-t6">暂无。在权限弹窗里勾选「始终允许」即可添加。</p>
        ) : (
          <ul className="flex flex-wrap gap-g2">
            {allowlist.map((tool) => (
              <li key={tool} className="inline-flex items-center gap-g2 rounded-r5 border border-t3 bg-z0 px-p4 py-p3 text-footnote text-t7">
                <span>{tool}</span>
                <button type="button" onClick={() => onRevoke(tool)} aria-label={`撤销 ${tool}`} className="text-t5 hover:text-extended-pink">
                  <X size={12} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-g3">
        <h3 className="text-footnote text-t6 uppercase tracking-wide">已生效配置</h3>
        <div className="flex flex-col gap-g2 rounded-r5 border border-t3 bg-z0 p-p5 text-footnote text-t7">
          <div className="flex justify-between gap-g4">
            <span className="text-t6">MCP servers</span>
            <span className="text-right">
              {Object.keys(effectiveConfig.mcp).length === 0 ? '—' : Object.keys(effectiveConfig.mcp).map((name) => (
                <span key={name} className="inline-flex items-center gap-g2 mr-g3">
                  <span className={mcpErrors[name] ? 'text-extended-pink' : ''} title={mcpErrors[name] || ''}>{name}</span>
                  {mcpErrors[name] ? <span className="text-extended-pink" title={mcpErrors[name]}>!</span> : null}
                </span>
              ))}
            </span>
          </div>
          <div className="flex justify-between gap-g4">
            <span className="text-t6">Subagents</span>
            <span className="text-right">
              {Object.keys(effectiveConfig.agents).length === 0 ? '—' : Object.keys(effectiveConfig.agents).join(', ')}
              <button onClick={onManageSubagents} className="ml-g3 text-footnote text-t6 hover:text-t8 underline">管理</button>
            </span>
          </div>
          <div className="flex justify-between gap-g4">
            <span className="text-t6">Hooks</span>
            <span className="text-right">
              {Object.keys(effectiveConfig.hooks).length === 0
                ? '—'
                : Object.entries(effectiveConfig.hooks).map(([k, n]) => `${k}×${n}`).join(', ')}
            </span>
          </div>
        </div>
        <p className="text-footnote text-t6">在 ~/.claude/settings.json 或 &lt;cwd&gt;/.claude/settings.json 里配置；保存后下次会话生效。</p>
      </section>

      <section className="flex flex-col gap-g3">
        <h3 className="text-footnote text-t6 uppercase tracking-wide">草稿</h3>
        <div className="rounded-r5 border border-t3 bg-z0 p-p5 text-footnote text-t7">
          {draftValue ? (
            <>
              <div className="line-clamp-3 break-words">{draftValue}</div>
              <button type="button" onClick={onClearDraft} className="mt-g3 text-footnote text-t6 hover:text-extended-pink">清空草稿</button>
            </>
          ) : (
            <span className="text-t6">无未发送的草稿。</span>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-g3">
        <h3 className="text-footnote text-t6 uppercase tracking-wide">危险操作</h3>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-g2 rounded-r5 border border-extended-pink/40 px-p4 py-p3 text-footnote text-extended-pink hover:bg-extended-pink/10"
        >
          <Trash2 size={13} strokeWidth={1.7} /> 删除整个会话
        </button>
      </section>
    </div>
  );
}

function BusySpinner() {
  return (
    <span
      className="block h-[14px] w-[14px] rounded-full border-2 border-current border-t-transparent animate-spin"
      style={{ borderRightColor: 'transparent' }}
    />
  );
}

function ContextRing({
  busy,
  contextInfo,
  lastUsage,
}: {
  busy: boolean;
  contextInfo: { tokens: number; limit: number } | null;
  lastUsage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const tokens = contextInfo?.tokens || 0;
  const limit = contextInfo?.limit || 0;
  const pct = limit > 0 ? Math.min(100, Math.round((tokens / limit) * 100)) : 0;
  const crit = pct >= 90;
  const warn = pct >= 75;
  const ringColor = crit ? 'var(--color-extended-pink, #d946a3)' : warn ? 'var(--color-extended-yellow, #d4a017)' : 'var(--color-extended-blue, #4a8cf7)';
  const ringFill = limit > 0
    ? `conic-gradient(${ringColor} ${pct}%, var(--t3, #e5e3df) ${pct}% 100%)`
    : 'conic-gradient(var(--t3, #e5e3df) 0% 100%)';

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={limit > 0 ? `上下文 ${pct}%` : '上下文'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={limit > 0 ? `上下文 ${tokens.toLocaleString()} / ${limit.toLocaleString()} (${pct}%)` : '等待用量数据'}
        onClick={() => setOpen((value) => !value)}
        className={'relative inline-flex h-[16px] w-[16px] items-center justify-center rounded-full ' + (busy ? 'animate-spin' : '')}
        style={{ background: ringFill }}
      >
        <span className="block h-[10px] w-[10px] rounded-full bg-z0" />
      </button>
      {open ? (
        <div
          role="dialog"
          className="absolute bottom-full right-0 z-50 mb-g4 w-[260px] rounded-[10px] border border-t2 bg-[var(--surface-popover)] px-p5 py-p4 shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
        >
          <div className="flex items-center justify-between gap-g4 text-footnote">
            <span className="text-t6">上下文窗口</span>
            <span className="tabular-nums text-t8">
              {limit > 0 ? <>{formatTokens(tokens)} / {formatTokens(limit)} ({pct}%)</> : '—'}
            </span>
          </div>
          <div className="mt-g3 h-[4px] w-full overflow-hidden rounded-full bg-t2">
            <div className="h-full" style={{ width: `${pct}%`, background: ringColor }} />
          </div>
          {lastUsage ? (
            <div className="mt-g3 flex flex-col gap-[2px] text-footnote text-t6">
              <span>输入 {(lastUsage.input_tokens || 0).toLocaleString()} · 输出 {(lastUsage.output_tokens || 0).toLocaleString()}</span>
              {lastUsage.cache_read_input_tokens ? <span>缓存读 {lastUsage.cache_read_input_tokens.toLocaleString()}</span> : null}
              {lastUsage.cache_creation_input_tokens ? <span>缓存写 {lastUsage.cache_creation_input_tokens.toLocaleString()}</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TranscriptModeButton({
  mode,
  onChange,
  disabled,
}: {
  mode: CodeTranscriptMode;
  onChange: (next: CodeTranscriptMode) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const current = TRANSCRIPT_MODE_ITEMS.find((item) => item.mode === mode);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`成绩单视图：${current?.label || mode}`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t6 hover:bg-t2 hover:text-t8 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <NotebookText size={14} strokeWidth={1.7} />
      </button>
      {open ? (
        <div role="menu" className="absolute bottom-full left-0 z-50 mb-g5 w-[180px] overflow-hidden rounded-[14px] border border-t2 bg-[var(--surface-popover)] px-[6px] py-[6px] shadow-[0_8px_28px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-g3 px-p4 py-[6px] text-footnote text-t6">
            <span className="flex-1">成绩单视图</span>
            <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-r3 border border-t3 px-[4px] text-[10px] text-t6">Ctrl</span>
            <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-r3 border border-t3 px-[4px] text-[10px] text-t6">O</span>
          </div>
          {TRANSCRIPT_MODE_ITEMS.map((item) => {
            const active = item.mode === mode;
            return (
              <button
                key={item.mode}
                type="button"
                role="menuitem"
                onClick={() => { onChange(item.mode); setOpen(false); }}
                className="flex w-full items-center gap-g4 rounded-r5 px-p4 py-[6px] text-left text-body text-t9 hover:bg-t2"
              >
                <span className="flex-1">{item.label}</span>
                {active ? <Check size={13} strokeWidth={2.2} className="text-t7" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ComposerPlusMenu({
  disabled,
  cwd,
  onPickFiles,
  onOpenSettings,
}: {
  disabled?: boolean;
  cwd?: string | null;
  onPickFiles: () => void;
  onOpenSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const cwdShort = cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() || cwd : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label="更多"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t7 hover:bg-t2 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Plus size={14} strokeWidth={2} />
      </button>
      {open ? (
        <div role="menu" className="absolute bottom-full left-0 z-50 mb-g5 w-[260px] overflow-hidden rounded-[14px] border border-t2 bg-[var(--surface-popover)] px-[6px] py-[6px] shadow-[0_8px_28px_rgba(0,0,0,0.12)]">
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onPickFiles(); }}
            className="flex w-full items-center gap-g4 rounded-r5 px-p4 py-[6px] text-left text-body text-t9 hover:bg-t2"
          >
            <Paperclip size={14} strokeWidth={1.7} />
            <span className="flex-1">添加附件</span>
          </button>
          {cwd ? (
            <div className="flex w-full items-center gap-g4 px-p4 py-[6px] text-left text-footnote text-t6" title={cwd}>
              <Folder size={14} strokeWidth={1.7} />
              <span className="flex-1 truncate">{cwdShort}</span>
              <span className="text-t5">cwd</span>
            </div>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onOpenSettings(); }}
            className="flex w-full items-center gap-g4 rounded-r5 px-p4 py-[6px] text-left text-body text-t9 hover:bg-t2"
          >
            <Settings size={14} strokeWidth={1.7} />
            <span className="flex-1">设置</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

type ComposerProps = {
  busy: boolean;
  disabled?: boolean;
  effort: CodeEffort;
  cwd?: string | null;
  environment: CodeEnvironmentKind;
  modelLabel?: string;
  modelOptions: CodeModelOption[];
  permissionMode: CodePermissionMode;
  transcriptMode: CodeTranscriptMode;
  value: string;
  error: string | null;
  attachments: ComposerAttachment[];
  allowlist: string[];
  onChange: (value: string) => void;
  onEnvironmentChange: (next: CodeEnvironmentKind) => void;
  onModelEffortChange: (next: { model: string; effort: CodeEffort }) => void;
  onPermissionModeChange: (next: CodePermissionMode) => void;
  onTranscriptModeChange: (next: CodeTranscriptMode) => void;
  onPickFiles: (files: FileList) => void;
  onRemoveAttachment: (fileId: string) => void;
  onRevokeAllowlist: (tool: string) => void;
  onOpenSettings: () => void;
  lastUsage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | null;
  contextInfo: { tokens: number; limit: number } | null;
  slashCommands: CodeSlashCommand[];
  onSubmit: () => void;
  onStop: () => void;
};

function CodeSessionComposer({
  busy,
  disabled,
  effort,
  cwd,
  environment,
  modelLabel,
  modelOptions,
  permissionMode,
  transcriptMode,
  value,
  error,
  attachments,
  allowlist,
  onChange,
  onEnvironmentChange,
  onModelEffortChange,
  onPermissionModeChange,
  onTranscriptModeChange,
  onPickFiles,
  onRemoveAttachment,
  onRevokeAllowlist,
  onOpenSettings,
  lastUsage,
  contextInfo,
  slashCommands,
  onSubmit,
  onStop,
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);

  const slashQuery = useMemo(() => {
    if (!slashOpen) return null;
    const node = textareaRef.current;
    if (!node) return null;
    return detectSlashQuery(value, node.selectionStart ?? value.length);
  }, [slashOpen, value]);
  const slashSuggestions = useMemo(() => {
    if (slashQuery == null) return [];
    return matchSlashCommands(slashQuery, slashCommands);
  }, [slashQuery, slashCommands]);

  useEffect(() => {
    if (!slashSuggestions.length) {
      setSlashOpen(false);
      return;
    }
    if (slashIndex >= slashSuggestions.length) setSlashIndex(0);
  }, [slashSuggestions, slashIndex]);

  useEffect(() => {
    return addCodeSessionUiListener((event) => {
      if (event.type === 'focusComposer') {
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        const len = node.value.length;
        try { node.setSelectionRange(len, len); } catch {}
      }
    });
  }, []);

  const replaceSlashWithCommand = (command: string) => {
    const node = textareaRef.current;
    if (!node) return;
    const caret = node.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const lastNewline = before.lastIndexOf('\n');
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const slashIndex = before.indexOf('/', lineStart);
    if (slashIndex === -1) return;
    const next = before.slice(0, slashIndex) + '/' + command + ' ' + after;
    onChange(next);
    setSlashOpen(false);
    requestAnimationFrame(() => {
      const cursor = slashIndex + command.length + 2;
      node.focus();
      node.setSelectionRange(cursor, cursor);
    });
  };

  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={'relative shrink-0 flex flex-col gap-g5 [contain:layout] ' + (dragOver ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-claude-main)] rounded-r7' : '')}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files?.length) {
          event.preventDefault();
          onPickFiles(event.dataTransfer.files);
        }
        setDragOver(false);
      }}
      onPaste={(event) => {
        const items = event.clipboardData?.items;
        if (!items || !items.length) return;
        const files: File[] = [];
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
        if (!files.length) return;
        event.preventDefault();
        const list = new DataTransfer();
        files.forEach((file) => list.items.add(file));
        onPickFiles(list.files);
      }}
    >
      <CodeDraftClawd />
      {allowlist.length ? (
        (() => {
          const VISIBLE = 3;
          const visible = allowlist.slice(0, VISIBLE);
          const hidden = allowlist.length - visible.length;
          return (
            <div className="flex flex-wrap items-center gap-g3 text-footnote text-t5">
              <span>始终允许：</span>
              {visible.map((tool) => (
                <span key={tool} className="inline-flex items-center gap-g3 rounded-r5 border border-t3 bg-t1 px-p3 py-[2px] text-t7">
                  <span>{tool}</span>
                  <button
                    type="button"
                    aria-label={`Revoke ${tool}`}
                    onClick={() => onRevokeAllowlist(tool)}
                    className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-r4 text-t5 hover:bg-t2 hover:text-t8"
                  >
                    <X size={10} strokeWidth={2} />
                  </button>
                </span>
              ))}
              {hidden > 0 ? (
                <button
                  type="button"
                  onClick={() => dispatchCodeSessionUiEvent({ type: 'toggleSidePane', pane: 'settings' })}
                  className="text-footnote text-t6 hover:text-t8 underline"
                  title="在设置里管理"
                >
                  +{hidden} 个
                </button>
              ) : null}
            </div>
          );
        })()
      ) : null}
      {attachments.length ? (
        <div className="flex flex-wrap gap-g3">
          {attachments.map((attachment) => (
            <div key={attachment.fileId} className={'inline-flex max-w-[260px] items-center gap-g3 rounded-r5 border border-t3 bg-t1 px-p3 py-[3px] text-footnote ' + (attachment.error ? 'text-extended-pink' : 'text-t7')}>
              {attachment.fileType === 'image' ? <ImageIcon size={12} strokeWidth={1.7} /> : <FileText size={12} strokeWidth={1.7} />}
              <span className="truncate" title={attachment.fileName}>{attachment.fileName}</span>
              {attachment.uploading ? <span className="shrink-0 text-t5">…</span> : null}
              <button
                type="button"
                aria-label={`Remove ${attachment.fileName}`}
                onClick={() => onRemoveAttachment(attachment.fileId)}
                className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-r4 text-t5 hover:bg-t2 hover:text-t8"
              >
                <X size={10} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="epitaxy-prompt effect-prompt-blur relative isolate rounded-r7 bg-[var(--surface-prompt-blur)] transition-shadow duration-300 focus-within:bg-[var(--surface-prompt-focus-hover)] focus-within:effect-prompt-focus">
        {slashOpen && slashSuggestions.length ? (
          <div
            role="listbox"
            className="absolute bottom-full left-0 z-40 mb-g3 box-border w-[320px] overflow-hidden rounded-[14px] border border-t2 bg-[var(--surface-popover)] px-[6px] py-[6px] text-left shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
          >
            {slashSuggestions.map((command, idx) => (
              <button
                key={command.name}
                type="button"
                role="option"
                aria-selected={idx === slashIndex}
                onMouseEnter={() => setSlashIndex(idx)}
                onClick={() => replaceSlashWithCommand(command.name)}
                className={'flex w-full flex-col items-start gap-[2px] rounded-r5 px-p4 py-[6px] text-left transition-colors ' + (idx === slashIndex ? 'bg-t2' : 'hover:bg-t2')}
              >
                <div className="flex items-center gap-g3 text-body text-t9">
                  <span>/{command.name}</span>
                  {command.source && command.source !== 'builtin' ? (
                    <span className="rounded-r3 border border-t3 px-[4px] text-[10px] font-medium uppercase tracking-wide text-t5 leading-[14px]">
                      {command.source}
                    </span>
                  ) : null}
                </div>
                <span className="text-footnote text-t5">{command.description}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="relative flex w-full">
          <div className="epitaxy-prompt-input flex-1 min-w-0 text-heading text-t9">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
                const caret = event.target.selectionStart ?? event.target.value.length;
                const query = detectSlashQuery(event.target.value, caret);
                setSlashOpen(query != null);
                setSlashIndex(0);
              }}
              onKeyDown={(event) => {
                if (slashOpen && slashSuggestions.length) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setSlashIndex((current) => (current + 1) % slashSuggestions.length);
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSlashIndex((current) => (current - 1 + slashSuggestions.length) % slashSuggestions.length);
                    return;
                  }
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    replaceSlashWithCommand(slashSuggestions[slashIndex].name);
                    return;
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setSlashOpen(false);
                    return;
                  }
                  if (event.key === 'Tab') {
                    event.preventDefault();
                    replaceSlashWithCommand(slashSuggestions[slashIndex].name);
                    return;
                  }
                }
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
        <div className="flex min-w-0 items-center gap-g4">
          <CodePermissionModeSelector
            disabled={busy || disabled}
            value={permissionMode}
            onChange={onPermissionModeChange}
          />
          <TranscriptModeButton
            disabled={busy || disabled}
            mode={transcriptMode}
            onChange={onTranscriptModeChange}
          />
          <ComposerPlusMenu
            disabled={busy || disabled}
            cwd={cwd}
            onPickFiles={() => fileInputRef.current?.click()}
            onOpenSettings={onOpenSettings}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = event.target.files;
              if (files && files.length) onPickFiles(files);
              event.target.value = '';
            }}
          />
        </div>
        <div className="ml-auto flex items-center gap-g4 text-body text-t6">
          <CodeModelEffortSelector
            disabled={busy || disabled}
            model={modelLabel || 'claude-sonnet-4-6'}
            effort={effort}
            models={modelOptions}
            onChange={onModelEffortChange}
          />
          <ContextRing busy={busy} contextInfo={contextInfo} lastUsage={lastUsage} />
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
  const [inputText, setInputText] = useState(() => {
    if (typeof window === 'undefined' || !id) return '';
    return window.localStorage.getItem(`code-draft:${id}`) || '';
  });
  const lastDraftIdRef = useRef<string | null>(id || null);
  useEffect(() => {
    if (!id) return;
    if (lastDraftIdRef.current !== id) {
      const next = window.localStorage.getItem(`code-draft:${id}`) || '';
      lastDraftIdRef.current = id;
      setInputText(next);
    }
  }, [id]);
  useEffect(() => {
    if (!id) return;
    if (lastDraftIdRef.current !== id) return;
    if (inputText) {
      window.localStorage.setItem(`code-draft:${id}`, inputText);
    } else {
      window.localStorage.removeItem(`code-draft:${id}`);
    }
  }, [id, inputText]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lastUsage, setLastUsage] = useState<{ input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | null>(null);
  const [contextInfo, setContextInfo] = useState<{ tokens: number; limit: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcriptMode, setTranscriptMode] = useState<CodeTranscriptMode>('normal');
  const [textSize, setTextSize] = useState<CodeTextSize>(getInitialCodeTextSize);
  const [sidePane, setSidePane] = useState<CodeSidePane | null>(null);
  const [modelOptions] = useState(getLocalCodeModels);
  const [environment, setEnvironment] = useState<CodeEnvironmentKind>('local');
  const [permissionQueue, setPermissionQueue] = useState<ToolPermissionRequest[]>([]);
  const [planApproval, setPlanApproval] = useState<PlanApprovalRequest | null>(null);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [customCommands, setCustomCommands] = useState<CustomSlashCommand[]>([]);
  const [effectiveConfig, setEffectiveConfig] = useState<EffectiveConfig>({ mcp: {}, agents: {}, hooks: {} });
  const [mcpErrors, setMcpErrors] = useState<Record<string, string>>({});
  const [subagentsOpen, setSubagentsOpen] = useState(false);

  const refreshAllowlist = useCallback(async () => {
    if (!id) return;
    try {
      const result = await getToolAllowlist(id);
      setAllowlist(Array.isArray(result.tools) ? result.tools : []);
    } catch {
      // ignore — bridge may not have it yet
    }
  }, [id]);

  useEffect(() => {
    refreshAllowlist();
  }, [refreshAllowlist]);

  useEffect(() => {
    let cancelled = false;
    listSlashCommands(conversation?.code_cwd || null)
      .then((res) => { if (!cancelled) setCustomCommands(res.commands || []); })
      .catch(() => { if (!cancelled) setCustomCommands([]); });
    return () => { cancelled = true; };
  }, [conversation?.code_cwd]);

  useEffect(() => {
    let cancelled = false;
    getEffectiveConfig(conversation?.code_cwd || null)
      .then((cfg) => { if (!cancelled) setEffectiveConfig(cfg); })
      .catch(() => { if (!cancelled) setEffectiveConfig({ mcp: {}, agents: {}, hooks: {} }); });
    return () => { cancelled = true; };
  }, [conversation?.code_cwd]);

  const allSlashCommands = useMemo<CodeSlashCommand[]>(() => {
    const builtinNames = new Set(BUILTIN_SLASH_COMMANDS.map((c) => c.name));
    const customMapped: CodeSlashCommand[] = customCommands
      .filter((c) => !builtinNames.has(c.name))
      .map((c) => ({
        name: c.name,
        description: c.description || (c.source === 'project' ? 'Project command' : 'User command'),
        source: c.source,
        body: c.body,
      }));
    return [...BUILTIN_SLASH_COMMANDS, ...customMapped];
  }, [customCommands]);

  const handleRevokeAllowlist = useCallback(async (tool: string) => {
    if (!id) return;
    setAllowlist((current) => current.filter((name) => name !== tool));
    try {
      await revokeToolAllowlist(id, tool);
    } catch (err: any) {
      pushError(err?.message || `撤销 ${tool} 失败`);
      refreshAllowlist();
    }
  }, [id, refreshAllowlist]);

  const handleClearAllowlist = useCallback(async () => {
    if (!id) return;
    const previous = allowlist;
    setAllowlist([]);
    try {
      await Promise.all(previous.map((tool) => revokeToolAllowlist(id, tool)));
    } catch (err: any) {
      pushError(err?.message || '清空白名单失败');
      refreshAllowlist();
    }
  }, [id, allowlist, refreshAllowlist]);

  const handleClearDraft = useCallback(() => {
    if (!id) return;
    setInputText('');
    window.localStorage.removeItem(`code-draft:${id}`);
    pushSuccess('草稿已清空');
  }, [id]);

  const handleRenameSession = useCallback(async (next: string) => {
    if (!id) return;
    const prev = conversation?.title;
    setConversation((current: any) => current ? { ...current, title: next } : current);
    try {
      await updateConversation(id, { title: next });
      window.dispatchEvent(new CustomEvent('conversationTitleUpdated'));
    } catch (err: any) {
      setConversation((current: any) => current ? { ...current, title: prev } : current);
      pushError(err?.message || '重命名失败');
    }
  }, [id, conversation?.title]);

  const handleDeleteSession = useCallback(async () => {
    if (!id) return;
    if (!window.confirm(`删除会话 "${conversation?.title || '(未命名)'}"？此操作不可撤销。`)) return;
    try {
      await deleteConversation(id);
      try { window.localStorage.removeItem(`code-draft:${id}`); } catch {}
      navigate('/code', { replace: true });
    } catch (err: any) {
      pushError(err?.message || '删除会话失败');
    }
  }, [id, conversation?.title, navigate]);

  const initialMessage = (location.state as any)?.initialMessage;
  const modelFromState = (location.state as any)?.model;
  const effortFromState = (location.state as any)?.effort;
  const permissionModeFromState = (location.state as any)?.permissionMode as CodePermissionMode | undefined;
  const modelLabel = conversation?.model || modelFromState || 'claude-sonnet-4-6';
  const effort = effortFromModel(modelLabel, conversation?.code_effort || effortFromState);
  const rawPermissionMode = (
    conversation?.code_permission_mode
      || permissionModeFromState
      || (typeof window !== 'undefined' ? localStorage.getItem('code_default_permission_mode') as CodePermissionMode | null : null)
      || 'default'
  ) as CodePermissionMode;
  // 'auto' was a legacy mode no longer offered by the SDK; treat it as 'acceptEdits'.
  const permissionMode: CodePermissionMode = rawPermissionMode === ('auto' as CodePermissionMode) ? 'acceptEdits' : rawPermissionMode;

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

  const refreshContextInfo = useCallback(async () => {
    if (!id) return;
    try {
      const info = await getContextSize(id);
      if (info && typeof info.tokens === 'number' && typeof info.limit === 'number') {
        setContextInfo(info);
      }
    } catch {
      // bridge may not have it on older builds — ignore
    }
  }, [id]);

  const loadConversation = useCallback(async (options?: { silent?: boolean }) => {
    if (!id) return;
    if (!options?.silent) setLoaded(false);
    try {
      const data = await getConversation(id);
      setConversation(data);
      const normalized = normalizeMessages(data.messages || []);
      setMessages(normalized);
      const lastAssistantUsage = [...normalized].reverse().find((message) => message.role === 'assistant' && message.usage)?.usage;
      if (lastAssistantUsage) setLastUsage(lastAssistantUsage);
      setError(null);
      refreshContextInfo();
    } catch (err: any) {
      setError(err?.message || '加载 Code 会话失败。');
    } finally {
      setLoaded(true);
    }
  }, [id, refreshContextInfo]);

  const handleCompactNow = useCallback(async () => {
    if (!id) return;
    try {
      const result = await compactConversation(id);
      setMessages((current) => [
        ...current,
        {
          id: `system-${Date.now()}`,
          role: 'system',
          content: `Context compacted (${result.messagesCompacted} messages, ~${result.tokensSaved} tokens saved).`,
          created_at: new Date().toISOString(),
          is_local_notice: true,
        },
      ]);
      await loadConversation({ silent: true });
      pushSuccess('上下文已压缩');
    } catch (err: any) {
      pushError(err?.message || '压缩失败');
    }
  }, [id, loadConversation]);

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

  const isAtBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (!isAtBottomRef.current) return;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [messages, loading]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      const atBottom = distance < 80;
      isAtBottomRef.current = atBottom;
      setShowScrollDown(!atBottom && node.scrollHeight > node.clientHeight + 200);
    };
    onScroll();
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [loaded]);

  const scrollToBottom = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, []);

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
          if (event === 'usage' && data?.usage) {
            setLastUsage(data.usage);
            refreshContextInfo();
          }
          if (event === 'tool_permission_request' && data) {
            setPermissionQueue((current) => [
              ...current,
              {
                request_id: data.request_id,
                tool_use_id: data.tool_use_id,
                tool_name: data.tool_name,
                tool_input: data.tool_input || {},
              },
            ]);
          }
          if (event === 'tool_permission_blocked' && data) {
            pushError(`${data.tool_name || '工具'} 被 hook 阻止：${data.reason || '无原因'}`);
          }
          if (event === 'plan_approval_request' && data) {
            setPlanApproval({
              request_id: data.request_id,
              tool_use_id: data.tool_use_id,
              plan: typeof data.plan === 'string' ? data.plan : '',
            });
          }
          if (event === 'mcp_server_error' && data) {
            const server = String(data.server || 'unknown');
            const msg = String(data.message || '');
            setMcpErrors((current) => ({ ...current, [server]: msg }));
            pushError(`MCP ${server}: ${msg.slice(0, 120)}`);
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
                startedAt: Date.now(),
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
                endedAt: Date.now(),
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

    const slashMatch = /^\/(\w+)(?:\s+(.*))?$/s.exec(text);
    if (slashMatch && !textOverride) {
      const command = slashMatch[1];
      const rest = (slashMatch[2] || '').trim();
      if (command === 'clear') {
        setInputText('');
        setError(null);
        setMessages([]);
        return;
      }
      if (command === 'cwd') {
        setInputText('');
        setError(null);
        setMessages((current) => [
          ...current,
          {
            id: `system-${Date.now()}`,
            role: 'system',
            content: `cwd: ${conversation?.code_cwd || '(none)'}`,
            created_at: new Date().toISOString(),
            is_local_notice: true,
          },
        ]);
        return;
      }
      if (command === 'help') {
        setInputText('');
        setError(null);
        const builtinLine = '内建命令: /clear, /compact [说明], /cwd, /help';
        const customLines = customCommands.length
          ? '\n自定义命令:\n' + customCommands.map((c) => `  /${c.name}${c.description ? ` — ${c.description}` : ''} (${c.source})`).join('\n')
          : '';
        setMessages((current) => [
          ...current,
          {
            id: `system-${Date.now()}`,
            role: 'system',
            content: builtinLine + customLines,
            created_at: new Date().toISOString(),
            is_local_notice: true,
          },
        ]);
        return;
      }
      if (command === 'compact') {
        setInputText('');
        setError(null);
        try {
          const result = await compactConversation(id, rest || undefined);
          setMessages((current) => [
            ...current,
            {
              id: `system-${Date.now()}`,
              role: 'system',
              content: `Context compacted (${result.messagesCompacted} messages, ~${result.tokensSaved} tokens saved).`,
              created_at: new Date().toISOString(),
              is_local_notice: true,
            },
          ]);
          await loadConversation({ silent: true });
        } catch (err: any) {
          setError(err?.message || 'Compaction failed');
        }
        return;
      }
      // Custom commands from .claude/commands/*.md — substitute $ARGUMENTS
      // (and {{args}}) with the rest of the line, then resubmit as a normal
      // user message. Skills (no body) fall through to the engine which loads
      // the matching SKILL.md itself.
      const custom = customCommands.find((c) => c.name === command);
      if (custom && custom.body) {
        const expanded = custom.body
          .replace(/\$ARGUMENTS\b/g, rest)
          .replace(/\{\{\s*args\s*\}\}/g, rest);
        setInputText('');
        setError(null);
        return submitMessage(expanded);
      }
    }

    const pendingAttachments = attachments.filter((attachment) => !attachment.uploading && !attachment.error);
    const apiAttachments = pendingAttachments.length
      ? pendingAttachments.map((attachment) => ({
          fileId: attachment.fileId,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
        }))
      : null;

    const userMessage: CodeMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    const assistantMessage = createAssistantPlaceholder();

    setInputText('');
    setAttachments([]);
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
      apiAttachments,
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
        if (event === 'tool_permission_request' && data) {
          setPermissionQueue((current) => [
            ...current,
            {
              request_id: data.request_id,
              tool_use_id: data.tool_use_id,
              tool_name: data.tool_name,
              tool_input: data.tool_input || {},
            },
          ]);
        }
        if (event === 'tool_permission_blocked' && data) {
          pushError(`${data.tool_name || '工具'} 被 hook 阻止：${data.reason || '无原因'}`);
        }
        if (event === 'plan_approval_request' && data) {
          setPlanApproval({
            request_id: data.request_id,
            tool_use_id: data.tool_use_id,
            plan: typeof data.plan === 'string' ? data.plan : '',
          });
        }
        if (event === 'mcp_server_error' && data) {
          const server = String(data.server || 'unknown');
          const msg = String(data.message || '');
          setMcpErrors((current) => ({ ...current, [server]: msg }));
          pushError(`MCP ${server}: ${msg.slice(0, 120)}`);
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
              startedAt: Date.now(),
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
              endedAt: Date.now(),
            };
          }
          return { ...message, toolCalls };
        }, runId);
      },
      controller.signal,
    );
  }, [attachments, beginRun, conversation?.code_cwd, customCommands, finishRun, id, inputText, isActiveRun, loadConversation, loaded, loading, pollConversationTitle, updateLastAssistant]);

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
      pushError(err?.message || '更新模型设置失败。');
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
      pushError(err?.message || '更新权限模式失败。');
    }
  }, [blocksLocalCodeSession, conversation, id, onConversationUpdated]);

  const visibleMessages = useMemo(
    () => filterMessagesForMode(messages, transcriptMode),
    [messages, transcriptMode],
  );

  const handlePermissionDecision = useCallback(async (decision: 'allow' | 'deny', scope: 'none' | 'session' | 'project' | 'project-local' | 'user') => {
    if (!id) return;
    const next = permissionQueue[0];
    if (!next) return;
    try {
      await decideToolPermission(id, next.request_id, next.tool_use_id, decision, undefined, scope !== 'none' ? scope : undefined);
      if (decision === 'allow' && scope !== 'none') {
        refreshAllowlist();
      }
    } catch (err: any) {
      pushError(err?.message || '提交权限决定失败。');
    } finally {
      setPermissionQueue((current) => current.slice(1));
    }
  }, [id, permissionQueue, refreshAllowlist]);

  const handlePlanDecision = useCallback(async (decision: 'allow' | 'deny') => {
    if (!id || !planApproval) return;
    try {
      await decideToolPermission(id, planApproval.request_id, planApproval.tool_use_id, decision);
      if (decision === 'allow') {
        // bridge has flipped conv to acceptEdits — refresh local view.
        await loadConversation({ silent: true });
      }
    } catch (err: any) {
      pushError(err?.message || '提交计划决定失败。');
    } finally {
      setPlanApproval(null);
    }
  }, [id, planApproval, loadConversation]);

  const handlePickFiles = useCallback((files: FileList) => {
    if (!id) return;
    const list = Array.from(files);
    list.forEach((file) => {
      const placeholderId = `pending-${Date.now()}-${file.name}`;
      const placeholder: ComposerAttachment = {
        fileId: placeholderId,
        fileName: file.name,
        fileType: file.type.startsWith('image/') ? 'image' : 'document',
        uploading: true,
      };
      setAttachments((current) => [...current, placeholder]);
      uploadFile(file, undefined, id)
        .then((result: UploadResult) => {
          setAttachments((current) => current.map((attachment) =>
            attachment.fileId === placeholderId
              ? { fileId: result.fileId, fileName: result.fileName, fileType: result.fileType, uploading: false }
              : attachment,
          ));
        })
        .catch((err) => {
          setAttachments((current) => current.map((attachment) =>
            attachment.fileId === placeholderId
              ? { ...attachment, uploading: false, error: err?.message || 'upload failed' }
              : attachment,
          ));
        });
    });
  }, [id]);

  const handleRemoveAttachment = useCallback((fileId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.fileId !== fileId));
  }, []);

  const handleCopyMessage = useCallback((message: CodeMessage) => {
    const text = message.content
      || message.thinking
      || (message.toolCalls?.map((tool) => `${tool.name}: ${tool.content || ''}`).join('\n\n'))
      || '';
    if (!text) return;
    copyToClipboard(text).then((ok) => {
      if (ok) pushSuccess('已复制');
      else pushError('复制失败');
    });
  }, []);

  const handleDeleteFrom = useCallback(async (messageId: string) => {
    if (!id || loading) return;
    try {
      await deleteMessagesFrom(id, messageId);
      await loadConversation({ silent: true });
    } catch (err: any) {
      pushError(err?.message || '删除失败。');
    }
  }, [id, loadConversation, loading]);

  const handleRegenerate = useCallback(async (assistantMessageId: string) => {
    if (!id || loading) return;
    const index = messages.findIndex((message) => message.id === assistantMessageId);
    if (index <= 0) return;
    let userMessage: CodeMessage | null = null;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') { userMessage = messages[i]; break; }
    }
    if (!userMessage || !userMessage.content) return;
    try {
      await deleteMessagesFrom(id, assistantMessageId);
      await loadConversation({ silent: true });
      submitMessage(userMessage.content);
    } catch (err: any) {
      pushError(err?.message || '重新生成失败。');
    }
  }, [id, loadConversation, loading, messages, submitMessage]);

  const handleEditUser = useCallback(async (userMessage: CodeMessage) => {
    if (!id || loading) return;
    const currentDraft = inputText.trim();
    if (currentDraft && currentDraft !== userMessage.content.trim()) {
      const ok = window.confirm('当前 composer 里有未发送的内容。继续编辑会替换它，确认吗？');
      if (!ok) return;
    }
    setInputText(userMessage.content);
    try {
      await deleteMessagesFrom(id, userMessage.id);
      await loadConversation({ silent: true });
      dispatchCodeSessionUiEvent({ type: 'focusComposer' });
    } catch (err: any) {
      pushError(err?.message || '准备编辑失败。');
    }
  }, [id, loadConversation, loading, inputText]);

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
              <CodeEmptyState
                cwd={conversation?.code_cwd}
                onPick={(text) => {
                  setInputText(text);
                  dispatchCodeSessionUiEvent({ type: 'focusComposer' });
                }}
              />
            ) : (
              <div className="epitaxy-chat-column epitaxy-chat-size flex flex-col gap-[var(--chat-turn-gap)] pt-[28px] pb-[32px]">
                {visibleMessages.map((message, index) => {
                  if (message.role === 'user') {
                    const userActions: MessageAction[] = [
                      { icon: <Copy size={14} strokeWidth={1.7} />, label: '复制', onClick: () => handleCopyMessage(message) },
                      { icon: <Pencil size={14} strokeWidth={1.7} />, label: '编辑并重发', onClick: () => handleEditUser(message) },
                      { icon: <Trash2 size={14} strokeWidth={1.7} />, label: '删除该条及之后', onClick: () => handleDeleteFrom(message.id), danger: true },
                    ];
                    return <UserMessage key={message.id} message={message} actions={userActions} />;
                  }
                  const assistantActions: MessageAction[] = message.is_compact_boundary || message.is_local_notice
                    ? []
                    : [
                        { icon: <Copy size={14} strokeWidth={1.7} />, label: '复制', onClick: () => handleCopyMessage(message) },
                        { icon: <RotateCcw size={14} strokeWidth={1.7} />, label: '重新生成', onClick: () => handleRegenerate(message.id) },
                        { icon: <Trash2 size={14} strokeWidth={1.7} />, label: '删除该条及之后', onClick: () => handleDeleteFrom(message.id), danger: true },
                      ];
                  return <AssistantMessage key={message.id} message={message} streaming={loading && index === visibleMessages.length - 1} actions={assistantActions} />;
                })}
              </div>
            )}
          </div>
          {showScrollDown ? (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center h-8 w-8 rounded-full bg-bg-100 border border-t3 shadow-md text-t7 hover:bg-bg-200 transition-colors"
              title="滚动到底部"
              aria-label="滚动到底部"
            >
              <ChevronDown size={16} strokeWidth={2} />
            </button>
          ) : null}
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
            settingsContent={
              <CodeSettingsPane
                conversation={conversation}
                modelLabel={modelLabel}
                permissionMode={permissionMode}
                allowlist={allowlist}
                draftValue={inputText}
                lastUsage={lastUsage}
                contextInfo={contextInfo}
                effectiveConfig={effectiveConfig}
                mcpErrors={mcpErrors}
                onRevoke={handleRevokeAllowlist}
                onClearAllowlist={handleClearAllowlist}
                onClearDraft={handleClearDraft}
                onRename={handleRenameSession}
                onDelete={handleDeleteSession}
                onCompact={handleCompactNow}
                onManageSubagents={() => setSubagentsOpen(true)}
              />
            }
          />
        ) : null}
      </div>

      <div className="epitaxy-code-composer-region epitaxy-chat-column epitaxy-chat-size relative shrink-0 flex flex-col gap-g5 [contain:layout]">
        <CodeSessionComposer
          busy={loading}
          disabled={!!blocksLocalCodeSession}
          effort={effort}
          cwd={conversation?.code_cwd}
          environment={environment}
          modelLabel={modelLabel}
          modelOptions={modelOptions}
          permissionMode={permissionMode}
          transcriptMode={transcriptMode}
          value={inputText}
          error={error}
          attachments={attachments}
          allowlist={allowlist}
          onChange={(value) => {
            setInputText(value);
            if (error) setError(null);
          }}
          onEnvironmentChange={(next) => {
            setEnvironment(next);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('code_default_environment', next);
            }
            if (next === 'local') setError(null);
          }}
          onModelEffortChange={handleModelEffortChange}
          onPermissionModeChange={handlePermissionModeChange}
          onTranscriptModeChange={(mode) => {
            setTranscriptMode(mode);
            dispatchCodeSessionUiEvent({ type: 'setTranscriptMode', mode });
          }}
          onPickFiles={handlePickFiles}
          onRemoveAttachment={handleRemoveAttachment}
          onRevokeAllowlist={handleRevokeAllowlist}
          onSubmit={() => submitMessage()}
          onStop={stop}
          onOpenSettings={() => dispatchCodeSessionUiEvent({ type: 'toggleSidePane', pane: 'settings' })}
          lastUsage={lastUsage}
          contextInfo={contextInfo}
          slashCommands={allSlashCommands}
        />
      </div>
      <CodeToolPermissionModal
        request={permissionQueue[0] || null}
        onDecision={handlePermissionDecision}
      />
      <CodePlanApprovalModal
        request={planApproval}
        onDecision={handlePlanDecision}
      />
      <CodeSubagentsModal
        open={subagentsOpen}
        cwd={conversation?.code_cwd}
        onClose={() => {
          setSubagentsOpen(false);
          // user may have added/removed agents — refresh the summary chips
          getEffectiveConfig(conversation?.code_cwd || null)
            .then(setEffectiveConfig)
            .catch(() => {});
        }}
      />
      <CodeToastViewport />
    </main>
  );
}
