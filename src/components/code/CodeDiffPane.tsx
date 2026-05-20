import { useMemo } from 'react';

type ToolCall = {
  id: string;
  name: string;
  input?: any;
  content?: string;
  status: 'running' | 'done' | 'error';
};

type DiffEntry = {
  toolId: string;
  kind: 'edit' | 'write' | 'notebook';
  before: string;
  after: string;
  cellId?: string;
  editMode?: string;
  status: ToolCall['status'];
};

function shortPath(filePath: string) {
  const segments = filePath.split(/[\\/]/).filter(Boolean);
  if (segments.length <= 2) return filePath;
  return segments.slice(-2).join('/');
}

function toEntry(tool: ToolCall): { filePath: string; entry: DiffEntry } | null {
  const input = tool.input;
  if (!input || typeof input !== 'object') return null;

  if (tool.name === 'Edit') {
    const filePath = typeof input.file_path === 'string' ? input.file_path : null;
    if (!filePath) return null;
    return {
      filePath,
      entry: {
        toolId: tool.id,
        kind: 'edit',
        before: typeof input.old_string === 'string' ? input.old_string : '',
        after: typeof input.new_string === 'string' ? input.new_string : '',
        status: tool.status,
      },
    };
  }

  if (tool.name === 'Write') {
    const filePath = typeof input.file_path === 'string' ? input.file_path : null;
    if (!filePath) return null;
    return {
      filePath,
      entry: {
        toolId: tool.id,
        kind: 'write',
        before: '',
        after: typeof input.content === 'string' ? input.content : '',
        status: tool.status,
      },
    };
  }

  if (tool.name === 'NotebookEdit') {
    const filePath = typeof input.notebook_path === 'string' ? input.notebook_path : null;
    if (!filePath) return null;
    return {
      filePath,
      entry: {
        toolId: tool.id,
        kind: 'notebook',
        before: '',
        after: typeof input.new_source === 'string' ? input.new_source : '',
        cellId: typeof input.cell_id === 'string' ? input.cell_id : undefined,
        editMode: typeof input.edit_mode === 'string' ? input.edit_mode : 'replace',
        status: tool.status,
      },
    };
  }

  return null;
}

function entryLabel(entry: DiffEntry): string {
  if (entry.kind === 'write') return 'Write (full file)';
  if (entry.kind === 'notebook') {
    return `NotebookEdit ${entry.editMode || 'replace'}${entry.cellId ? ` · cell ${entry.cellId}` : ''}`;
  }
  return 'Edit';
}

function lineCounts(entry: DiffEntry): { adds: number; dels: number } {
  const adds = entry.after ? entry.after.split('\n').length : 0;
  const dels = entry.before ? entry.before.split('\n').length : 0;
  return { adds, dels };
}

function DiffBody({ entry }: { entry: DiffEntry }) {
  return (
    <div className="flex flex-col gap-g3">
      {entry.before ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-r5 bg-extended-10-pink px-p4 py-p3 text-code text-extended-pink">{entry.before.split('\n').map((line) => `- ${line}`).join('\n')}</pre>
      ) : null}
      {entry.after ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-r5 bg-extended-10-green px-p4 py-p3 text-code text-extended-green">{entry.after.split('\n').map((line) => `+ ${line}`).join('\n')}</pre>
      ) : null}
    </div>
  );
}

export default function CodeDiffPane({ toolCalls }: { toolCalls: ToolCall[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, DiffEntry[]>();
    for (const tool of toolCalls) {
      const result = toEntry(tool);
      if (!result) continue;
      const list = map.get(result.filePath) || [];
      list.push(result.entry);
      map.set(result.filePath, list);
    }
    return Array.from(map.entries());
  }, [toolCalls]);

  if (!grouped.length) {
    return <div className="flex h-full items-center justify-center text-center text-t5">No diff yet.</div>;
  }

  return (
    <div className="flex flex-col gap-g6 p-p6 text-body text-t7">
      {grouped.map(([filePath, entries]) => {
        const totalAdds = entries.reduce((sum, entry) => sum + lineCounts(entry).adds, 0);
        const totalDels = entries.reduce((sum, entry) => sum + lineCounts(entry).dels, 0);
        return (
          <details key={filePath} open className="rounded-r5 border border-t3 bg-z0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-g4 border-b border-t3 px-p5 py-p4">
              <span title={filePath} className="min-w-0 flex-1 truncate text-body-medium text-t8">{shortPath(filePath)}</span>
              <span className="flex shrink-0 items-center gap-g3 text-footnote tabular-nums">
                {totalAdds ? <span className="text-extended-green">+{totalAdds}</span> : null}
                {totalDels ? <span className="text-extended-pink">-{totalDels}</span> : null}
                <span className="text-t5">· {entries.length} change{entries.length === 1 ? '' : 's'}</span>
              </span>
            </summary>
            <div className="flex flex-col gap-g3 px-p5 py-p4">
              {entries.map((entry, idx) => {
                const counts = lineCounts(entry);
                const isLatest = idx === entries.length - 1;
                return (
                  <details key={entry.toolId} open={isLatest} className="rounded-r5 bg-t1 px-p4 py-p3">
                    <summary className="flex cursor-pointer list-none items-center gap-g4">
                      <span className="min-w-0 flex-1 truncate text-footnote text-t6">{entryLabel(entry)}</span>
                      <span className="flex shrink-0 items-center gap-g3 text-footnote tabular-nums">
                        {counts.adds ? <span className="text-extended-green">+{counts.adds}</span> : null}
                        {counts.dels ? <span className="text-extended-pink">-{counts.dels}</span> : null}
                        <span className="text-t5">{entry.status === 'running' ? '运行中' : entry.status === 'error' ? '出错' : ''}</span>
                      </span>
                    </summary>
                    <div className="mt-g3">
                      <DiffBody entry={entry} />
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
