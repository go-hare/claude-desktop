import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import starSparkleImg from '../assets/figma-exports/cowork-icons/star-sparkle.png';
import { createConversation, getCodeStats, getConversations } from '../api';
import CodeActionCenter, { type CodeConversationSummary } from './code/CodeActionCenter';
import CodeComposer from './code/CodeComposer';
import type { RawCodeStats } from './code/CodeStatsCard';

const READ_SESSIONS_KEY = 'code_action_center_read_sessions';

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
  const [model] = useState(getDefaultCodeModel);

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
          setCodeSessions(
            conversationsResult.value
              .filter((conversation: any) => conversation?.code_cwd)
              .map((conversation: any) => ({
                id: conversation.id,
                title: conversation.title,
                code_cwd: conversation.code_cwd,
                created_at: conversation.created_at,
                updated_at: conversation.updated_at,
              }))
          );
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
    if (!selectedFolder) {
      setComposerError('Select a folder first.');
      return;
    }

    setIsSubmitting(true);
    setComposerError(null);
    try {
      const conversation = await createConversation(undefined, model, { code_cwd: selectedFolder });
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
        state: { initialMessage: prompt, model },
      });
    } catch (error: any) {
      setComposerError(error?.message || '创建 Code 会话失败。');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="epitaxy-root epitaxy-code-page select-none h-full w-full flex flex-col">
      <div className="h-full min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 relative isolate overflow-y-auto">
          <div className="flex flex-col">
            <CodeGreeting />
            <CodeActionCenter
              readSessionTimes={readSessionTimes}
              sessions={codeSessions}
              stats={stats}
              onMarkAllRead={markAllRead}
              onOpenSession={openCodeSession}
            />
          </div>
        </div>

        <div className="epitaxy-chat-column epitaxy-chat-size relative shrink-0 flex flex-col gap-g5 [contain:layout] pb-[14px]">
          <CodeComposer
            error={composerError}
            inputText={inputText}
            isSubmitting={isSubmitting}
            modelLabel={model}
            selectedFolder={selectedFolder}
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
