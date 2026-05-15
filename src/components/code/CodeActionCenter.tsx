import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import CodeStatsCard, { CodeStatsSkeleton, type RawCodeStats } from './CodeStatsCard';

export type CodeConversationSummary = {
  id: string;
  title?: string;
  code_cwd?: string | null;
  created_at?: string;
  updated_at?: string;
};

type CodeActionCenterProps = {
  readSessionTimes: ReadonlyMap<string, number>;
  sessions: CodeConversationSummary[];
  stats: RawCodeStats | null;
  onMarkAllRead: () => void;
  onOpenSession: (id: string) => void;
};

const COLLAPSED_LIMIT = 5;

function formatCompactTime(value?: string) {
  if (!value) return '';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '';

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));
    return minutes <= 1 ? 'now' : `${minutes}m`;
  }
  if (diffMs < day) return `${Math.round(diffMs / hour)}h`;
  return `${Math.round(diffMs / day)}d`;
}

function folderName(path?: string | null) {
  if (!path) return '';
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function sessionTimestampMs(session: CodeConversationSummary) {
  const timestamp = Date.parse(session.updated_at || session.created_at || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function CodeStatsBranch({ stats }: { stats: RawCodeStats | null }) {
  return (
    <div className="flex flex-col">
      <div className="epitaxy-chat-column epitaxy-chat-size py-[24px]">
        {stats ? <CodeStatsCard stats={stats} /> : <CodeStatsSkeleton />}
      </div>
    </div>
  );
}

function CodeSessionRow({
  session,
  onOpen,
}: {
  session: CodeConversationSummary;
  onOpen: (id: string) => void;
}) {
  const title = session.title || 'Untitled session';
  const cwd = folderName(session.code_cwd);
  const timestamp = formatCompactTime(session.updated_at || session.created_at);

  return (
    <li className="group flex items-center gap-g6 px-p4 py-p6 rounded-r6 bg-t1 hover:bg-t2 focus-within:bg-t2 transition-colors">
      <button
        type="button"
        onClick={() => onOpen(session.id)}
        aria-label={`Open session ${title}`}
        className="flex flex-1 min-w-0 items-center justify-between gap-g6 text-left outline-none hide-focus-ring ring-focus rounded-r3"
      >
        <span className="flex min-w-0 flex-1 items-center gap-g6">
          <span className="flex shrink-0 items-center">
            <span className="inline-flex w-[16px] items-center justify-center">
              <span className="size-[5px] rounded-full bg-[var(--dot-ready)]" />
            </span>
            <span className="text-footnote text-[var(--dot-ready)]">Unread</span>
          </span>
          <span className="flex min-w-0 flex-1 items-baseline gap-g4">
            <span className="min-w-0 text-body text-t9 truncate">{title}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-g5">
          {cwd ? <span className="max-w-[180px] truncate text-footnote text-t6">{cwd}</span> : null}
          {timestamp ? (
            <span className="-mr-[4px] min-w-[20px] text-center text-footnote text-t6 tabular-nums">
              {timestamp}
            </span>
          ) : null}
          <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" className="text-t6 group-hover:text-t7" />
        </span>
      </button>
    </li>
  );
}

export default function CodeActionCenter({
  readSessionTimes,
  sessions,
  stats,
  onMarkAllRead,
  onOpenSession,
}: CodeActionCenterProps) {
  const [expanded, setExpanded] = useState(false);
  const attentionSessions = useMemo(
    () => sessions.filter((session) => sessionTimestampMs(session) > (readSessionTimes.get(session.id) || 0)),
    [readSessionTimes, sessions],
  );

  if (attentionSessions.length === 0) return <CodeStatsBranch stats={stats} />;

  const visibleSessions = expanded ? attentionSessions : attentionSessions.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = attentionSessions.length - visibleSessions.length;

  return (
    <div className="min-h-full flex flex-col">
      <div className="epitaxy-chat-column epitaxy-chat-size pt-[24px] pb-[56px] flex flex-col gap-[40px]">
        <section className="flex flex-col gap-g6">
          <header className="flex items-center gap-g3">
            <h2 className="text-body text-t8">Sessions</h2>
            <span className="flex-1" />
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex h-small items-center rounded-small px-p5 text-footnote text-t6 hover:bg-t2"
            >
              Mark all read
            </button>
            {attentionSessions.length > COLLAPSED_LIMIT ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                className="inline-flex h-small items-center rounded-small px-p5 text-footnote text-t6 hover:bg-t2"
              >
                {expanded ? 'Show less' : `Show ${hiddenCount} more`}
              </button>
            ) : null}
          </header>
          <ul role="list" className="flex flex-col gap-g3">
            {visibleSessions.map((session) => (
              <CodeSessionRow key={session.id} session={session} onOpen={onOpenSession} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
