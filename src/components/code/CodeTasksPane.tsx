import { useEffect, useState } from 'react';

type ToolCall = {
  id: string;
  name: string;
  input?: any;
  content?: string;
  status: 'running' | 'done' | 'error';
  startedAt?: number;
  endedAt?: number;
};

function formatInput(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

const STATUS_LABEL: Record<ToolCall['status'], string> = {
  running: '运行中',
  done: '完成',
  error: '出错',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

function ToolDuration({ tool, now }: { tool: ToolCall; now: number }) {
  if (!tool.startedAt) return null;
  const end = tool.status === 'running' ? now : tool.endedAt || now;
  const elapsed = Math.max(0, end - tool.startedAt);
  return <span className="shrink-0 tabular-nums text-footnote text-t5">{formatDuration(elapsed)}</span>;
}

export default function CodeTasksPane({ toolCalls }: { toolCalls: ToolCall[] }) {
  const hasRunning = toolCalls.some((tool) => tool.status === 'running' && tool.startedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [hasRunning]);

  if (!toolCalls.length) {
    return <div className="flex h-full items-center justify-center text-center text-t5">No tasks yet.</div>;
  }

  const total = toolCalls.length;
  const done = toolCalls.filter((tool) => tool.status === 'done').length;
  const errors = toolCalls.filter((tool) => tool.status === 'error').length;
  const running = toolCalls.filter((tool) => tool.status === 'running').length;
  const ordered = [...toolCalls].reverse();

  return (
    <div className="flex flex-col gap-g4 p-p6 text-body text-t7">
      <div className="flex flex-wrap items-center gap-g4 text-footnote text-t6">
        <span>{done} / {total} done</span>
        {running ? <span className="text-extended-yellow">{running} running</span> : null}
        {errors ? <span className="text-extended-pink">{errors} error{errors === 1 ? '' : 's'}</span> : null}
      </div>
      {ordered.map((tool) => {
        const inputText = formatInput(tool.input);
        const indicator = tool.status === 'running'
          ? 'bg-extended-yellow'
          : tool.status === 'error'
            ? 'bg-extended-pink'
            : 'bg-extended-green';
        return (
          <details key={tool.id} className="rounded-r5 border border-t3 bg-z0 px-p5 py-p4" open={tool.status === 'running'}>
            <summary className="flex cursor-pointer list-none items-center gap-g4">
              <span className={'inline-block h-[6px] w-[6px] shrink-0 rounded-full ' + indicator + (tool.status === 'running' ? ' animate-pulse' : '')} />
              <span className="min-w-0 flex-1 truncate text-body-medium text-t8">{tool.name}</span>
              <ToolDuration tool={tool} now={now} />
              <span
                className={
                  'shrink-0 text-footnote ' +
                  (tool.status === 'error' ? 'text-extended-pink' : tool.status === 'running' ? 'text-extended-yellow' : 'text-t5')
                }
              >
                {STATUS_LABEL[tool.status]}
              </span>
            </summary>
            {inputText ? (
              <pre className="mt-g4 overflow-x-auto whitespace-pre-wrap break-words text-code text-t6">{inputText}</pre>
            ) : null}
            {tool.content ? (
              <pre className="mt-g4 overflow-x-auto whitespace-pre-wrap break-words text-code text-t7">{tool.content}</pre>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}
