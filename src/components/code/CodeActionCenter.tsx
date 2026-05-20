import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ChevronRight, Search, Star } from 'lucide-react';
import CodeStatsCard, { CodeStatsSkeleton, type RawCodeStats } from './CodeStatsCard';

export type CodeConversationSummary = {
  id: string;
  title?: string;
  code_cwd?: string | null;
  created_at?: string;
  updated_at?: string;
  isArchived?: boolean;
  is_archived?: boolean | number;
  isStarred?: boolean;
  is_starred?: boolean | number;
  isUnread?: boolean;
  is_unread?: boolean | number;
  sessionStatus?: string;
  session_status?: string;
  postTurnSummary?: {
    status_category?: string | null;
    status_detail?: string | null;
    recent_action?: string | null;
  } | null;
  external_metadata?: {
    pending_action?: unknown;
  } | null;
  _originalSession?: {
    external_metadata?: {
      pending_action?: unknown;
    } | null;
  } | null;
};

type AttentionKind = 'blocked' | 'review' | 'unread';

type AttentionSession = {
  session: CodeConversationSummary;
  kind: AttentionKind;
};

type CodeActionCenterProps = {
  readSessionTimes: ReadonlyMap<string, number>;
  sessions: CodeConversationSummary[];
  stats: RawCodeStats | null;
  onMarkAllRead: () => void;
  onOpenSession: (id: string) => void;
  onToggleStar: (id: string, next: boolean) => void;
  onToggleArchive: (id: string, next: boolean) => void;
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

function flag(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function hasPendingAction(session: CodeConversationSummary) {
  return Boolean(
    session.external_metadata?.pending_action ||
    session._originalSession?.external_metadata?.pending_action
  );
}

function attentionKindForSession(
  session: CodeConversationSummary,
  readSessionTimes: ReadonlyMap<string, number>,
): AttentionKind | null {
  if (flag(session.isArchived) || flag(session.is_archived)) return null;
  if (flag(session.isStarred) || flag(session.is_starred)) return null;

  const status = session.sessionStatus || session.session_status;
  const category = session.postTurnSummary?.status_category || '';
  if (status === 'requires_action' || hasPendingAction(session) || ['blocked', 'needsAttention', 'requires_action'].includes(category)) {
    return 'blocked';
  }
  if (['review', 'readyToMerge', 'ready_for_review'].includes(category)) {
    return 'review';
  }
  if (flag(session.isUnread) || flag(session.is_unread)) {
    return sessionTimestampMs(session) > (readSessionTimes.get(session.id) || 0) ? 'unread' : null;
  }

  return null;
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
  kind,
  onOpen,
  onToggleStar,
  onToggleArchive,
}: {
  session: CodeConversationSummary;
  kind: AttentionKind | null;
  onOpen: (id: string) => void;
  onToggleStar: (id: string, next: boolean) => void;
  onToggleArchive: (id: string, next: boolean) => void;
}) {
  const title = session.title || 'Untitled session';
  const cwd = folderName(session.code_cwd);
  const timestamp = formatCompactTime(session.updated_at || session.created_at);
  const starred = flag(session.isStarred) || flag(session.is_starred);
  const archived = flag(session.isArchived) || flag(session.is_archived);

  const statusLabel = kind === 'blocked' ? 'Needs input' : kind === 'review' ? 'Ready for review' : kind === 'unread' ? 'Unread' : '';
  const statusColor = kind === 'blocked' ? 'text-extended-yellow' : kind === 'review' || kind === 'unread' ? 'text-[var(--dot-ready)]' : 'text-t6';
  const dotColor = kind === 'blocked' ? 'bg-extended-yellow' : kind === 'review' || kind === 'unread' ? 'bg-[var(--dot-ready)]' : 'bg-t4';

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
              <span className={`size-[5px] rounded-full ${dotColor}`} />
            </span>
            {statusLabel ? (
              <span className={`text-footnote ${statusColor}`}>{statusLabel}</span>
            ) : null}
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
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-g3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onToggleStar(session.id, !starred)}
          aria-label={starred ? '取消收藏' : '收藏'}
          aria-pressed={starred}
          title={starred ? '取消收藏' : '收藏'}
          className={'inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 transition-colors hover:bg-t3 ' + (starred ? 'text-extended-yellow opacity-100' : 'text-t6')}
        >
          <Star size={14} strokeWidth={1.7} fill={starred ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          onClick={() => onToggleArchive(session.id, !archived)}
          aria-label={archived ? '取消归档' : '归档'}
          title={archived ? '取消归档' : '归档'}
          className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t6 hover:bg-t3 hover:text-t8"
        >
          {archived ? <ArchiveRestore size={14} strokeWidth={1.7} /> : <Archive size={14} strokeWidth={1.7} />}
        </button>
      </span>
      <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" className="text-t6 group-hover:text-t7 shrink-0" />
    </li>
  );
}

export default function CodeActionCenter({
  readSessionTimes,
  sessions,
  stats,
  onMarkAllRead,
  onOpenSession,
  onToggleStar,
  onToggleArchive,
}: CodeActionCenterProps) {
  const [expanded, setExpanded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');
  const trimmed = query.trim().toLowerCase();

  const filteredSessions = useMemo(() => {
    if (!trimmed) return sessions;
    return sessions.filter((session) => {
      const title = (session.title || '').toLowerCase();
      const cwd = (session.code_cwd || '').toLowerCase();
      return title.includes(trimmed) || cwd.includes(trimmed);
    });
  }, [sessions, trimmed]);

  const archivedSessions = useMemo(
    () => filteredSessions.filter((session) => flag(session.isArchived) || flag(session.is_archived)),
    [filteredSessions],
  );

  const liveSessions = useMemo(
    () => filteredSessions.filter((session) => !(flag(session.isArchived) || flag(session.is_archived))),
    [filteredSessions],
  );

  const starredSessions = useMemo(
    () => liveSessions.filter((session) => flag(session.isStarred) || flag(session.is_starred)),
    [liveSessions],
  );

  const attentionSessions = useMemo(
    () => liveSessions.flatMap<AttentionSession>((session) => {
      const kind = attentionKindForSession(session, readSessionTimes);
      return kind ? [{ session, kind }] : [];
    }),
    [readSessionTimes, liveSessions],
  );

  const otherSessions = useMemo(() => {
    const starredIds = new Set(starredSessions.map((session) => session.id));
    const attentionIds = new Set(attentionSessions.map(({ session }) => session.id));
    return liveSessions.filter((session) => !starredIds.has(session.id) && !attentionIds.has(session.id));
  }, [liveSessions, starredSessions, attentionSessions]);

  const noContent = filteredSessions.length === 0 && !trimmed;
  if (noContent) return <CodeStatsBranch stats={stats} />;

  const visibleAttention = expanded ? attentionSessions : attentionSessions.slice(0, COLLAPSED_LIMIT);
  const hiddenAttention = attentionSessions.length - visibleAttention.length;

  return (
    <div className="min-h-full flex flex-col">
      <div className="epitaxy-chat-column epitaxy-chat-size pt-[24px] pb-[56px] flex flex-col gap-[40px]">
        {stats ? <CodeStatsCard stats={stats} /> : <CodeStatsSkeleton />}
        <div className="relative">
          <Search size={14} strokeWidth={1.7} aria-hidden="true" className="pointer-events-none absolute left-p4 top-1/2 -translate-y-1/2 text-t5" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索会话或路径..."
            aria-label="Search sessions"
            className="h-[32px] w-full rounded-r5 border border-t3 bg-z0 pl-[28px] pr-p4 text-body text-t8 placeholder:text-t5 focus:border-t5 focus:outline-none"
          />
        </div>

        {trimmed && filteredSessions.length === 0 ? (
          <p className="text-footnote text-t5">未找到匹配的会话。</p>
        ) : null}

        {attentionSessions.length > 0 ? (
          <section className="flex flex-col gap-g6">
            <header className="flex items-center gap-g3">
              <h2 className="text-body text-t8">Attention</h2>
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
                  {expanded ? 'Show less' : `Show ${hiddenAttention} more`}
                </button>
              ) : null}
            </header>
            <ul role="list" className="flex flex-col gap-g3">
              {visibleAttention.map(({ session, kind }) => (
                <CodeSessionRow key={session.id} session={session} kind={kind} onOpen={onOpenSession} onToggleStar={onToggleStar} onToggleArchive={onToggleArchive} />
              ))}
            </ul>
          </section>
        ) : null}

        {starredSessions.length > 0 ? (
          <section className="flex flex-col gap-g6">
            <header className="flex items-center gap-g3">
              <h2 className="text-body text-t8">Starred</h2>
            </header>
            <ul role="list" className="flex flex-col gap-g3">
              {starredSessions.map((session) => (
                <CodeSessionRow key={session.id} session={session} kind={null} onOpen={onOpenSession} onToggleStar={onToggleStar} onToggleArchive={onToggleArchive} />
              ))}
            </ul>
          </section>
        ) : null}

        {otherSessions.length > 0 ? (
          <section className="flex flex-col gap-g6">
            <header className="flex items-center gap-g3">
              <h2 className="text-body text-t8">All sessions</h2>
            </header>
            <ul role="list" className="flex flex-col gap-g3">
              {otherSessions.map((session) => (
                <CodeSessionRow key={session.id} session={session} kind={null} onOpen={onOpenSession} onToggleStar={onToggleStar} onToggleArchive={onToggleArchive} />
              ))}
            </ul>
          </section>
        ) : null}

        {archivedSessions.length > 0 ? (
          <section className="flex flex-col gap-g6">
            <header className="flex items-center gap-g3">
              <h2 className="text-body text-t8">Archived</h2>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setShowArchived((value) => !value)}
                aria-expanded={showArchived}
                className="inline-flex h-small items-center rounded-small px-p5 text-footnote text-t6 hover:bg-t2"
              >
                {showArchived ? 'Hide' : `Show ${archivedSessions.length}`}
              </button>
            </header>
            {showArchived ? (
              <ul role="list" className="flex flex-col gap-g3">
                {archivedSessions.map((session) => (
                  <CodeSessionRow key={session.id} session={session} kind={null} onOpen={onOpenSession} onToggleStar={onToggleStar} onToggleArchive={onToggleArchive} />
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
