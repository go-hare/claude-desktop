import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import starSparkleImg from '../assets/figma-exports/cowork-icons/star-sparkle.png';
import { createConversation, deleteConversation, getCodeStats, getConversations, updateConversation } from '../api';
import CodeActionCenter, { type CodeConversationSummary } from './code/CodeActionCenter';
import CodeComposer from './code/CodeComposer';
import type { CodeEnvironmentKind } from './code/CodeEnvironmentSelector';
import { effortFromModel, getLocalCodeModels, toCodeModelString, type CodeEffort } from './code/CodeModelEffortSelector';
import type { CodePermissionMode } from './code/CodePermissionModeSelector';
import type { RawCodeStats } from './code/CodeStatsCard';

const READ_SESSIONS_KEY = 'code_action_center_read_sessions';
const PERMISSION_MODE_KEY = 'code_default_permission_mode';
const ENVIRONMENT_KEY = 'code_default_environment';

const PERMISSION_MODES: ReadonlySet<CodePermissionMode> = new Set([
  'default',
  'acceptEdits',
  'bypassPermissions',
  'plan',
]);

function getDefaultPermissionMode(): CodePermissionMode {
  if (typeof window === 'undefined') return 'default';
  const saved = localStorage.getItem(PERMISSION_MODE_KEY) as CodePermissionMode | null;
  // 'auto' was a legacy mode that no longer ships in the SDK menu — migrate it
  // back to the closest non-destructive default so users don't get stuck on a
  // mode the UI can't represent.
  if (saved === ('auto' as CodePermissionMode)) {
    localStorage.setItem(PERMISSION_MODE_KEY, 'acceptEdits');
    return 'acceptEdits';
  }
  return saved && PERMISSION_MODES.has(saved) ? saved : 'default';
}

function getDefaultEnvironment(): CodeEnvironmentKind {
  if (typeof window === 'undefined') return 'local';
  const saved = localStorage.getItem(ENVIRONMENT_KEY);
  return saved === 'local' ? 'local' : 'local';
}

function getDefaultCodeModel() {
  if (typeof window === 'undefined') return 'claude-sonnet-4-6';
  const saved = localStorage.getItem('default_model');
  if (saved) return saved;
  try {
    const models = JSON.parse(localStorage.getItem('chat_models') || '[]');
    if (Array.isArray(models) && models[0]?.id) return models[0].id;
  } catch {}
  return 'claude-sonnet-4-6';
}

function sessionTimestampMs(session: CodeConversationSummary) {
  const timestamp = Date.parse(session.updated_at || session.created_at || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function CodeGreeting() {
  return (
    <header className="epitaxy-chat-column epitaxy-chat-size flex flex-row items-center gap-[calc(var(--g3)+2px)] pt-[12px] pb-[24px]">
      <img
        src={starSparkleImg}
        alt=""
        aria-hidden="true"
        className="size-[22px] shrink-0 translate-y-px"
      />
      <h1 className="m-0 text-title text-t9 font-medium leading-[var(--leading-title)]">接下来做什么？</h1>
    </header>
  );
}

export default function CodePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<RawCodeStats | null>(null);
  const [, setStatsLoading] = useState(true);
  const [codeSessions, setCodeSessions] = useState<CodeConversationSummary[]>([]);
  const [readSessionTimes, setReadSessionTimes] = useState<Map<string, number>>(() => {
    if (typeof window === 'undefined') return new Map();
    try {
      const saved = JSON.parse(localStorage.getItem(READ_SESSIONS_KEY) || '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return new Map();
      return new Map(
        Object.entries(saved)
          .filter(([id, timestamp]) => typeof id === 'string' && typeof timestamp === 'number')
          .map(([id, timestamp]) => [id, timestamp as number])
      );
    } catch {
      return new Map();
    }
  });
  const [inputText, setInputText] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('code_selected_folder');
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [model, setModel] = useState(getDefaultCodeModel);
  const [effort, setEffort] = useState<CodeEffort>(() => effortFromModel(getDefaultCodeModel(), localStorage.getItem('code_default_effort')));
  const [modelOptions] = useState(getLocalCodeModels);
  const [permissionMode, setPermissionMode] = useState<CodePermissionMode>(getDefaultPermissionMode);
  const [environment, setEnvironment] = useState<CodeEnvironmentKind>(getDefaultEnvironment);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    Promise.allSettled([getCodeStats('all'), getConversations()])
      .then((data) => {
        if (cancelled) return;
        const [statsResult, conversationsResult] = data;
        if (statsResult.status === 'fulfilled' && statsResult.value && typeof statsResult.value === 'object') {
          setStats(statsResult.value as RawCodeStats);
        }
        if (conversationsResult.status === 'fulfilled' && Array.isArray(conversationsResult.value)) {
          const live = conversationsResult.value.filter((conversation: any) => conversation?.code_cwd);
          setCodeSessions(
            live.map((conversation: any) => ({
                id: conversation.id,
                title: conversation.title,
                code_cwd: conversation.code_cwd,
                created_at: conversation.created_at,
                updated_at: conversation.updated_at,
                isArchived: conversation.isArchived,
                is_archived: conversation.is_archived,
                isStarred: conversation.isStarred,
                is_starred: conversation.is_starred,
                isUnread: conversation.isUnread,
                is_unread: conversation.is_unread,
                sessionStatus: conversation.sessionStatus,
                session_status: conversation.session_status,
                postTurnSummary: conversation.postTurnSummary,
                external_metadata: conversation.external_metadata,
                _originalSession: conversation._originalSession,
              }))
          );
          // Sweep stale code-draft:* entries left over from deleted conversations.
          try {
            const liveIds = new Set(live.map((c: any) => c.id));
            const stale: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('code-draft:')) {
                const convId = key.slice('code-draft:'.length);
                if (!liveIds.has(convId)) stale.push(key);
              }
            }
            for (const key of stale) localStorage.removeItem(key);
          } catch {}
        }
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const markAllRead = () => {
    const next = new Map(codeSessions.map((session) => [session.id, sessionTimestampMs(session)]));
    setReadSessionTimes(next);
    localStorage.setItem(READ_SESSIONS_KEY, JSON.stringify(Object.fromEntries(next)));
  };

  const toggleStar = (id: string, next: boolean) => {
    setCodeSessions((current) => current.map((session) => session.id === id ? { ...session, is_starred: next ? 1 : 0, isStarred: next } : session));
    updateConversation(id, { is_starred: !!next }).catch(() => {
      setCodeSessions((current) => current.map((session) => session.id === id ? { ...session, is_starred: !next ? 1 : 0, isStarred: !next } : session));
    });
  };

  const toggleArchive = (id: string, next: boolean) => {
    setCodeSessions((current) => current.map((session) => session.id === id ? { ...session, is_archived: next ? 1 : 0, isArchived: next } : session));
    updateConversation(id, { is_archived: !!next }).catch(() => {
      setCodeSessions((current) => current.map((session) => session.id === id ? { ...session, is_archived: !next ? 1 : 0, isArchived: !next } : session));
    });
  };

  const renameSession = (id: string, title: string) => {
    const previous = codeSessions.find((session) => session.id === id);
    setCodeSessions((current) => current.map((session) => session.id === id ? { ...session, title } : session));
    updateConversation(id, { title }).catch(() => {
      setCodeSessions((current) => current.map((session) => session.id === id ? { ...session, title: previous?.title } : session));
    });
  };

  const removeSession = (id: string) => {
    const previous = codeSessions;
    setCodeSessions((current) => current.filter((session) => session.id !== id));
    try { localStorage.removeItem(`code-draft:${id}`); } catch {}
    deleteConversation(id).catch(() => {
      setCodeSessions(previous);
    });
  };

  const openCodeSession = (id: string) => {
    const session = codeSessions.find((item) => item.id === id);
    setReadSessionTimes((current) => {
      const next = new Map(current);
      next.set(id, session ? sessionTimestampMs(session) : Date.now());
      localStorage.setItem(READ_SESSIONS_KEY, JSON.stringify(Object.fromEntries(next)));
      return next;
    });
    navigate(`/code/${id}`);
  };

  const chooseFolder = async () => {
    const api = (window as any).electronAPI;
    if (!api?.selectDirectory) {
      setComposerError('当前环境不支持选择文件夹。');
      return;
    }
    const folder = await api.selectDirectory();
    if (!folder) return;
    setSelectedFolder(folder);
    localStorage.setItem('code_selected_folder', folder);
    setComposerError(null);
  };

  const submitPrompt = async () => {
    const prompt = inputText.trim();
    if (!prompt || isSubmitting) return;
    if (environment !== 'local') {
      setComposerError(
        environment === 'ssh' ? 'SSH configuration is unavailable.'
          : environment === 'bridge' ? 'Bridge environment unavailable.'
            : 'Remote environments are not configured.'
      );
      return;
    }
    if (!selectedFolder) {
      setComposerError('Select a folder first.');
      return;
    }

    setIsSubmitting(true);
    setComposerError(null);
    try {
      const conversation = await createConversation(undefined, toCodeModelString(model, effort), {
        code_cwd: selectedFolder,
        research_mode: false,
        code_effort: effort,
        code_permission_mode: permissionMode,
      });
      if (!conversation?.id) throw new Error('Invalid conversation response');
      setReadSessionTimes((current) => {
        const next = new Map(current);
        next.set(conversation.id, sessionTimestampMs(conversation));
        localStorage.setItem(READ_SESSIONS_KEY, JSON.stringify(Object.fromEntries(next)));
        return next;
      });
      window.dispatchEvent(new CustomEvent('conversationTitleUpdated'));
      navigate(`/code/${conversation.id}`, {
        replace: true,
        state: { initialMessage: prompt, model: toCodeModelString(model, effort), effort, permissionMode },
      });
    } catch (error: any) {
      setComposerError(error?.message || '创建 Code 会话失败。');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="epitaxy-root epitaxy-code-page select-none h-full w-full flex flex-col">
      <div className="h-full min-w-0 flex flex-col">
        <div className="epitaxy-code-scroll flex-1 min-h-0 relative isolate overflow-y-auto">
          <div className="flex flex-col">
            <CodeGreeting />
            <CodeActionCenter
              readSessionTimes={readSessionTimes}
              sessions={codeSessions}
              stats={stats}
              onMarkAllRead={markAllRead}
              onOpenSession={openCodeSession}
              onToggleStar={toggleStar}
              onToggleArchive={toggleArchive}
              onRename={renameSession}
              onDelete={removeSession}
            />
          </div>
        </div>

        <div className="epitaxy-code-composer-region epitaxy-chat-column epitaxy-chat-size relative shrink-0 flex flex-col gap-g5 [contain:layout] pb-[14px]">
          <CodeComposer
            error={composerError}
            inputText={inputText}
            isSubmitting={isSubmitting}
            effort={effort}
            environment={environment}
            modelLabel={model}
            modelOptions={modelOptions}
            permissionMode={permissionMode}
            selectedFolder={selectedFolder}
            onModelEffortChange={({ model: nextModel, effort: nextEffort }) => {
              setModel(nextModel);
              setEffort(nextEffort);
              localStorage.setItem('default_model', nextModel);
              localStorage.setItem('code_default_effort', nextEffort);
            }}
            onEnvironmentChange={(next) => {
              setEnvironment(next);
              localStorage.setItem(ENVIRONMENT_KEY, next);
              if (next === 'local') setComposerError(null);
            }}
            onPermissionModeChange={(next) => {
              setPermissionMode(next);
              localStorage.setItem(PERMISSION_MODE_KEY, next);
            }}
            onChooseFolder={chooseFolder}
            onInputChange={(value) => {
              setInputText(value);
              if (composerError) setComposerError(null);
            }}
            onSubmit={submitPrompt}
          />
        </div>
      </div>
    </main>
  );
}
