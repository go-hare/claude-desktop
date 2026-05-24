import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Archive,
  ArchiveRestore,
  Bell,
  Bot,
  ChevronRight,
  ClipboardList,
  Folder,
  GitPullRequest,
  Pencil,
  PlayCircle,
  Plug,
  Star,
  Terminal,
  Trash2,
} from 'lucide-react';
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
  taskSummary?: string | null;
  timestamp?: string;
  type?: string;
  repoInfo?: {
    owner?: string | null;
    name?: string | null;
  } | null;
  postTurnSummary?: {
    status_category?: string | null;
    status_detail?: string | null;
    recent_action?: string | null;
  } | null;
  external_metadata?: {
    pending_action?: unknown;
  } | null;
  _originalSession?: {
    worker_status?: string | null;
    external_metadata?: {
      pending_action?: unknown;
    } | null;
  } | null;
};

type AttentionKind = 'blocked' | 'review' | 'unread';

type AttentionSession = {
  session: CodeConversationSummary;
  kind: AttentionKind | null;
};

type CodeActionCenterProps = {
  readSessionTimes: ReadonlyMap<string, number>;
  sessions: CodeConversationSummary[];
  stats: RawCodeStats | null;
  statsLoading: boolean;
  selectedFolder: string | null;
  notificationsEnabled: boolean;
  onMarkAllRead: () => void;
  onOpenSession: (id: string) => void;
  onToggleStar: (id: string, next: boolean) => void;
  onToggleArchive: (id: string, next: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onChooseFolder: () => void;
  onChecklistPrompt: (prompt: string, options?: { permissionMode?: 'plan' }) => void;
  onOpenCodeSettings: () => void;
  onRequestNotifications: () => void;
  onOpenScheduled: () => void;
};

const COLLAPSED_LIMIT = 5;
const CHECKLIST_MAX_VISIBLE = 3;
const CHECKLIST_CLICKED_ITEMS_KEY = 'ccd-checklist-clicked-items';
const CHECKLIST_PAGE_INDEX_KEY = 'ccd-checklist-page-index';
const CHECKLIST_SHUFFLE_SEED_KEY = 'ccd-checklist-shuffle-seed';
const CHECKLIST_INITIAL_COMPLETION_KEY = 'ccd-checklist-initial-completion';
const CHECKLIST_DISMISSED_KEY = 'ccd-checklist-dismissed';
const CODE_ROUTINES_KEY = 'code_scheduled_routines';

const CHECKLIST_PROMPTS = {
  firstPrompt: "Help me get something working today. If this is a code project, walk me through what it does. If it's empty or not a project, give me 3 small, fun interactive ideas — one productivity tool, one creative toy, one game — and let's build one in a new subfolder.",
  firstPr: "I want to ship my first PR with you. First, check if GitHub is connected — if not, walk me through connecting it. Then find a small, safe improvement in this folder (a typo fix, a README tweak, a missing test) and open a PR for it.",
  addClaudeMd: "I want you to learn this codebase. Run /init — it scans the repo and writes a CLAUDE.md with the project's structure, conventions, and key commands. Show me the draft before saving it.",
  planMode: "I want to refactor the largest file in this folder into smaller modules. Before touching anything, write a plan: which file, how you would split it, what could break. Wait for my go-ahead.",
  addMcp: "Help me connect a tool you can use — run /mcp to set up an MCP server.",
};

type ChecklistItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  complete?: boolean;
  onClick: () => void;
};

type ChecklistPage = {
  title: string;
  items: ChecklistItem[];
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableShuffle<T>(items: T[], seed: string) {
  const keyed = items.map((item, index) => ({
    item,
    index,
    key: hashString(`${seed}:${index}`),
  }));
  keyed.sort((left, right) => left.key - right.key || left.index - right.index);
  return keyed.map(({ item }) => item);
}

function getChecklistShuffleSeed() {
  if (typeof window === 'undefined') return 'default';
  try {
    const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('gateway_user') || '{}');
    const id = user?.uuid || user?.id || user?.email;
    if (id) return String(id);
  } catch {}
  let seed = localStorage.getItem(CHECKLIST_SHUFFLE_SEED_KEY);
  if (!seed) {
    seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CHECKLIST_SHUFFLE_SEED_KEY, seed);
  }
  return seed;
}

function hasCodeRoutine() {
  if (typeof window === 'undefined') return false;
  try {
    const routines = JSON.parse(localStorage.getItem(CODE_ROUTINES_KEY) || '[]');
    return Array.isArray(routines) && routines.length > 0;
  } catch {
    return false;
  }
}

function hasRoutinePayload(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

async function loadHasCodeRoutine() {
  if (typeof window === 'undefined') return false;
  const api = (window as any)['claude.web']?.CCDScheduledTasks;
  if (api?.getAllScheduledTasks) {
    try {
      const routines = await api.getAllScheduledTasks();
      return hasRoutinePayload(routines);
    } catch {
      // Fall through to the browser-preview localStorage cache.
    }
  }
  return hasCodeRoutine();
}

function readChecklistInitialCompletion() {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(CHECKLIST_INITIAL_COMPLETION_KEY);
  if (saved === null) return null;
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

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

function repoLabel(session: CodeConversationSummary) {
  const repo = session.repoInfo;
  if (repo?.owner && repo?.name) return `${repo.owner}/${repo.name}`;
  if (repo?.name) return repo.name;
  return folderName(session.code_cwd);
}

function sessionTimestampMs(session: CodeConversationSummary) {
  const timestamp = Date.parse(session.timestamp || session.updated_at || session.created_at || '');
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

function sessionSummaryText(session: CodeConversationSummary) {
  const status = session.sessionStatus || session.session_status;
  const workerStatus = session._originalSession?.worker_status;
  const summary = session.postTurnSummary;
  if ((status === 'pending' || (status === 'running' && workerStatus !== 'idle')) && session.taskSummary) {
    return session.taskSummary;
  }
  return summary?.status_detail || summary?.recent_action || '';
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
    if (status === 'running' || status === 'pending') return null;
    return sessionTimestampMs(session) > (readSessionTimes.get(session.id) || 0) ? 'unread' : null;
  }

  return null;
}

function compareAttentionKind(a: AttentionKind | null, b: AttentionKind | null) {
  const weight = (kind: AttentionKind | null) => {
    if (kind === 'blocked') return 0;
    if (kind === 'review') return 1;
    if (kind === 'unread') return 2;
    return 3;
  };
  return weight(a) - weight(b);
}

function CodeSessionRow({
  session,
  kind,
  onOpen,
  onToggleStar,
  onToggleArchive,
  onRename,
  onDelete,
}: {
  session: CodeConversationSummary;
  kind: AttentionKind | null;
  onOpen: (id: string) => void;
  onToggleStar: (id: string, next: boolean) => void;
  onToggleArchive: (id: string, next: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const title = session.title || 'Untitled session';
  const repo = repoLabel(session);
  const timestamp = formatCompactTime(session.timestamp || session.updated_at || session.created_at);
  const starred = flag(session.isStarred) || flag(session.is_starred);
  const archived = flag(session.isArchived) || flag(session.is_archived);
  const summaryText = sessionSummaryText(session);

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
            {summaryText ? (
              <span className="min-w-0 shrink-[9999] text-body text-t6 truncate">{summaryText}</span>
            ) : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-g5">
          {repo ? <span className="max-w-[180px] truncate text-footnote text-t6">{repo}</span> : null}
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
        <button
          type="button"
          onClick={() => {
            const next = window.prompt('重命名会话', title);
            if (next === null) return;
            const trimmed = next.trim();
            if (!trimmed || trimmed === title) return;
            onRename(session.id, trimmed);
          }}
          aria-label="重命名"
          title="重命名"
          className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t6 hover:bg-t3 hover:text-t8"
        >
          <Pencil size={14} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`删除会话 "${title}"？此操作不可撤销。`)) return;
            onDelete(session.id);
          }}
          aria-label="删除"
          title="删除"
          className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t6 hover:bg-t3 hover:text-extended-pink"
        >
          <Trash2 size={14} strokeWidth={1.7} />
        </button>
      </span>
      <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" className="text-t6 group-hover:text-t7 shrink-0" />
    </li>
  );
}

function ChecklistRow({ item, complete }: { item: ChecklistItem; complete: boolean }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={item.onClick}
      className="group flex min-h-[52px] w-full items-center gap-g5 rounded-r6 px-p5 py-p4 text-left transition-colors hover:bg-t2"
    >
      <span
        aria-hidden="true"
        className={'flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-r5 border ' + (
          complete ? 'border-[var(--dot-ready)] bg-[var(--dot-ready)] text-z0' : 'border-t3 bg-z0 text-t7'
        )}
      >
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-g1">
        <span className="truncate text-body text-t9">{item.title}</span>
        <span className="truncate text-footnote text-t6">{item.subtitle}</span>
      </span>
      <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-t5 group-hover:text-t7" />
    </button>
  );
}

function ChecklistPanel({
  page,
  completion,
  pageState,
  onAdvance,
  onDismiss,
}: {
  page: ChecklistPage;
  completion: Record<string, boolean>;
  pageState: 'active' | 'interstitial' | 'allComplete';
  onAdvance: () => void;
  onDismiss: () => void;
}) {
  if (pageState !== 'active') {
    return (
      <section className="flex flex-col gap-g5">
        <div className="flex min-h-[84px] items-center gap-g4 rounded-r7 bg-t1 p-p6">
          <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-r5 bg-[var(--dot-ready)] text-z0">
            <ChevronRight size={16} strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1 text-body text-t8">You're set up</span>
          {pageState === 'interstitial' ? (
            <button type="button" onClick={onAdvance} className="rounded-r5 px-p3 py-p2 text-body text-t8 hover:bg-t2">
              Keep going
            </button>
          ) : (
            <button type="button" onClick={onDismiss} className="rounded-r5 px-p3 py-p2 text-body text-t8 hover:bg-t2">
              Dismiss
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-g5">
      <h2 className="text-body text-t8">{page.title}</h2>
      <div className="flex flex-col gap-g2 rounded-r7 bg-t1 p-p3">
        {page.items.map((item) => (
          <ChecklistRow key={item.id} item={item} complete={completion[item.id] === true} />
        ))}
      </div>
    </section>
  );
}

export default function CodeActionCenter({
  readSessionTimes,
  sessions,
  stats,
  statsLoading,
  selectedFolder,
  notificationsEnabled,
  onMarkAllRead,
  onOpenSession,
  onToggleStar,
  onToggleArchive,
  onRename,
  onDelete,
  onChooseFolder,
  onChecklistPrompt,
  onOpenCodeSettings,
  onRequestNotifications,
  onOpenScheduled,
}: CodeActionCenterProps) {
  const [expanded, setExpanded] = useState(false);
  const [checklistPageIndex, setChecklistPageIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const saved = Number(localStorage.getItem(CHECKLIST_PAGE_INDEX_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : 0;
  });
  const [clickedChecklistItems, setClickedChecklistItems] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(CHECKLIST_CLICKED_ITEMS_KEY) || '{}');
    } catch {
      return {};
    }
  });
  const [checklistShuffleSeed] = useState(getChecklistShuffleSeed);
  const [codeRoutineCreated, setCodeRoutineCreated] = useState(hasCodeRoutine);
  const [initiallyCompleteChecklistItems, setInitiallyCompleteChecklistItems] = useState<string[] | null>(readChecklistInitialCompletion);
  const [checklistDismissed, setChecklistDismissed] = useState(() => (
    typeof window !== 'undefined' && localStorage.getItem(CHECKLIST_DISMISSED_KEY) === 'true'
  ));

  useEffect(() => {
    let cancelled = false;
    const refresh = (event?: Event) => {
      const routines = (event as CustomEvent<{ routines?: unknown }> | undefined)?.detail?.routines;
      if (routines !== undefined) {
        setCodeRoutineCreated(hasRoutinePayload(routines));
        return;
      }
      loadHasCodeRoutine().then((created) => {
        if (!cancelled) setCodeRoutineCreated(created);
      });
    };
    refresh();
    window.addEventListener('codeScheduledRoutinesUpdated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('codeScheduledRoutinesUpdated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const liveSessions = useMemo(
    () => sessions.filter((session) => !(flag(session.isArchived) || flag(session.is_archived))),
    [sessions],
  );

  const attentionSessions = useMemo(
    () => liveSessions.map<AttentionSession>((session) => ({
      session,
      kind: attentionKindForSession(session, readSessionTimes),
    })),
    [readSessionTimes, liveSessions],
  );

  const sessionRows = useMemo<AttentionSession[]>(
    () => {
      return [...attentionSessions].sort((a, b) => {
        const priority = compareAttentionKind(a.kind, b.kind);
        if (priority !== 0) return priority;
        return sessionTimestampMs(b.session) - sessionTimestampMs(a.session);
      });
    },
    [attentionSessions],
  );

  const visibleSessionRows = expanded ? sessionRows : sessionRows.slice(0, COLLAPSED_LIMIT);
  const hiddenSessionRows = Math.max(0, sessionRows.length - visibleSessionRows.length);
  const hasClearableUnreads = sessionRows.some(({ kind, session }) => (
    kind === 'unread' && sessionTimestampMs(session) > (readSessionTimes.get(session.id) || 0)
  ));
  const hasAnySession = sessions.length > 0;
  const markChecklistClicked = useCallback((id: string, action: () => void) => {
    setClickedChecklistItems((current) => {
      const next = { ...current, [id]: true };
      localStorage.setItem(CHECKLIST_CLICKED_ITEMS_KEY, JSON.stringify(next));
      return next;
    });
    action();
  }, []);

  const getStartedItems = useMemo<ChecklistItem[]>(() => [
    {
      id: 'set_folder',
      title: 'Pick a folder where Claude can work',
      subtitle: 'Choose where Claude will read and write files',
      icon: Folder,
      complete: Boolean(selectedFolder),
      onClick: onChooseFolder,
    },
    {
      id: 'first_prompt',
      title: 'Ask Claude about your code',
      subtitle: 'Open a folder and ask what it does',
      icon: PlayCircle,
      complete: hasAnySession,
      onClick: () => markChecklistClicked('first_prompt', () => onChecklistPrompt(CHECKLIST_PROMPTS.firstPrompt)),
    },
    {
      id: 'first_pr',
      title: 'Ship your first PR',
      subtitle: 'Ask Claude to find a fix and open a pull request',
      icon: GitPullRequest,
      onClick: () => markChecklistClicked('first_pr', () => onChecklistPrompt(CHECKLIST_PROMPTS.firstPr)),
    },
  ], [hasAnySession, markChecklistClicked, onChecklistPrompt, onChooseFolder, selectedFolder]);
  const goFurtherItems = useMemo<ChecklistItem[]>(() => [
    {
      id: 'add_claude_md',
      title: 'Teach Claude your project',
      subtitle: "Add a CLAUDE.md so Claude learns your project's conventions",
      icon: Bot,
      onClick: () => markChecklistClicked('add_claude_md', () => onChecklistPrompt(CHECKLIST_PROMPTS.addClaudeMd)),
    },
    {
      id: 'setup_routine',
      title: 'Set up a routine',
      subtitle: 'Get a daily PR digest, dependency check, or briefing',
      icon: ClipboardList,
      complete: codeRoutineCreated,
      onClick: () => markChecklistClicked('setup_routine', onOpenScheduled),
    },
    {
      id: 'plan_mode',
      title: 'Use Plan mode for complex changes',
      subtitle: 'Get a detailed plan before any edits',
      icon: PlayCircle,
      onClick: () => markChecklistClicked('plan_mode', () => onChecklistPrompt(CHECKLIST_PROMPTS.planMode, { permissionMode: 'plan' })),
    },
    {
      id: 'enable_notifications',
      title: 'Turn on notifications',
      subtitle: 'Get a ping when long-running tasks finish',
      icon: Bell,
      complete: notificationsEnabled,
      onClick: onRequestNotifications,
    },
    {
      id: 'install_cli',
      title: 'Install Claude Code in your terminal or IDE',
      subtitle: 'Use Claude from where you already work',
      icon: Terminal,
      onClick: () => markChecklistClicked('install_cli', onOpenCodeSettings),
    },
    {
      id: 'add_mcp',
      title: 'Add an MCP server',
      subtitle: 'Connect a tool with /mcp',
      icon: Plug,
      onClick: () => markChecklistClicked('add_mcp', () => onChecklistPrompt(CHECKLIST_PROMPTS.addMcp)),
    },
  ], [codeRoutineCreated, markChecklistClicked, notificationsEnabled, onChecklistPrompt, onOpenCodeSettings, onOpenScheduled, onRequestNotifications]);
  const shuffledGoFurtherItems = useMemo(
    () => stableShuffle(goFurtherItems, checklistShuffleSeed),
    [checklistShuffleSeed, goFurtherItems],
  );
  const checklistPages = useMemo<ChecklistPage[]>(() => [
    { title: 'Get started with Claude Code', items: getStartedItems },
    { title: 'Go further with Claude Code', items: shuffledGoFurtherItems },
  ], [getStartedItems, shuffledGoFurtherItems]);
  const allChecklistItems = useMemo(
    () => checklistPages.flatMap(page => page.items),
    [checklistPages],
  );

  useEffect(() => {
    if (initiallyCompleteChecklistItems !== null) return;
    const completed = allChecklistItems
      .filter(item => item.complete === true)
      .map(item => item.id);
    setInitiallyCompleteChecklistItems(completed);
    localStorage.setItem(CHECKLIST_INITIAL_COMPLETION_KEY, JSON.stringify(completed));
  }, [allChecklistItems, initiallyCompleteChecklistItems]);

  const initiallyCompleteSet = useMemo(
    () => new Set(initiallyCompleteChecklistItems || []),
    [initiallyCompleteChecklistItems],
  );
  const safeChecklistPageIndex = Math.min(checklistPageIndex, checklistPages.length - 1);
  const checklistPage = checklistPages[safeChecklistPageIndex];
  const displayChecklistItems = useMemo(() => {
    const pending = checklistPage.items.filter(item => !initiallyCompleteSet.has(item.id));
    const alreadyComplete = checklistPage.items.filter(item => initiallyCompleteSet.has(item.id));
    return [...pending, ...alreadyComplete].slice(0, CHECKLIST_MAX_VISIBLE);
  }, [checklistPage.items, initiallyCompleteSet]);
  const checklistCompletion = Object.fromEntries(
    displayChecklistItems.map(item => [
      item.id,
      item.complete === true || (item.complete === undefined && clickedChecklistItems[item.id] === true),
    ])
  );
  const pageComplete = displayChecklistItems.length > 0 && displayChecklistItems.every(item => checklistCompletion[item.id]);
  const checklistPageState = pageComplete
    ? safeChecklistPageIndex === checklistPages.length - 1 ? 'allComplete' : 'interstitial'
    : 'active';

  const dismissChecklist = () => {
    setChecklistDismissed(true);
    localStorage.setItem(CHECKLIST_DISMISSED_KEY, 'true');
  };

  return (
    <div className="min-h-full flex flex-col">
      <div className="epitaxy-chat-column epitaxy-chat-size pt-[24px] pb-[56px] flex flex-col gap-[40px]">
        {!checklistDismissed ? (
          <ChecklistPanel
            page={{ ...checklistPage, items: displayChecklistItems }}
            completion={checklistCompletion}
            pageState={checklistPageState}
            onAdvance={() => setChecklistPageIndex((value) => {
              const next = Math.min(value + 1, checklistPages.length - 1);
              localStorage.setItem(CHECKLIST_PAGE_INDEX_KEY, String(next));
              return next;
            })}
            onDismiss={dismissChecklist}
          />
        ) : null}
        {stats ? <CodeStatsCard stats={stats} /> : statsLoading ? <CodeStatsSkeleton /> : null}
        {sessionRows.length > 0 ? (
          <section className="flex flex-col gap-g6">
            <header className="flex items-center gap-g3">
              <h2 className="text-body text-t8">Sessions</h2>
              <span className="flex-1" />
              {hasClearableUnreads ? (
                <button type="button" onClick={onMarkAllRead} className="rounded-r5 px-p3 py-p2 text-footnote text-t6 hover:bg-t2 hover:text-t8">
                  Mark all read
                </button>
              ) : null}
              {sessionRows.length > COLLAPSED_LIMIT ? (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  aria-expanded={expanded}
                  className="rounded-r5 px-p3 py-p2 text-footnote text-t6 hover:bg-t2 hover:text-t8"
                >
                  {expanded ? 'Show less' : `Show ${hiddenSessionRows} more`}
                </button>
              ) : null}
            </header>
            <ul role="list" className="flex flex-col gap-g3">
              {visibleSessionRows.map(({ session, kind }) => (
                <CodeSessionRow
                  key={session.id}
                  session={session}
                  kind={kind}
                  onOpen={onOpenSession}
                  onToggleStar={onToggleStar}
                  onToggleArchive={onToggleArchive}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
