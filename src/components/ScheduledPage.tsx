import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import emptyStateIcon from '../assets/figma-exports/scheduled-page/empty-state-icon.svg';
import filterIcon from '../assets/figma-exports/scheduled-page/filter-icon.svg';
import infoIcon from '../assets/figma-exports/scheduled-page/info-icon.svg';
import keepAwakeIcon from '../assets/figma-exports/scheduled-page/keep-awake-icon.svg';
import keepAwakeToggleIcon from '../assets/figma-exports/scheduled-page/keep-awake-toggle.svg';
import searchIcon from '../assets/figma-exports/scheduled-page/search-icon.svg';

interface ScheduledPageProps {
  onNewTask: () => void;
}

const CODE_ROUTINES_KEY = 'code_scheduled_routines';

type ScheduledRoutine = {
  id: string;
  title: string;
  prompt: string;
  schedule: string;
  template?: string;
  createdAt: string;
};

type CcdScheduledTaskApi = {
  getAllScheduledTasks?: () => Promise<unknown[]>;
  createScheduledTask?: (payload: {
    name: string;
    prompt: string;
    description: string;
    schedule?: string;
    cronExpression?: string;
    cwd?: string;
  }) => Promise<unknown>;
};

function readCodeRoutines(): ScheduledRoutine[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CODE_ROUTINES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ccdScheduledTasksApi(): CcdScheduledTaskApi | null {
  if (typeof window === 'undefined') return null;
  return ((window as any)['claude.web']?.CCDScheduledTasks || null) as CcdScheduledTaskApi | null;
}

function taskToRoutine(task: any): ScheduledRoutine {
  const id = String(task?.id || task?.taskId || task?.scheduledTaskId || `routine-${Date.now()}`);
  const title = String(task?.title || task?.name || 'Untitled routine');
  const prompt = String(task?.prompt || task?.description || '');
  const schedule = String(task?.schedule || task?.cronExpression || task?.cron_expression || 'Every weekday at 9:00 AM');
  return {
    id,
    title,
    prompt,
    schedule,
    template: task?.template,
    createdAt: String(task?.createdAt || task?.created_at || new Date().toISOString()),
  };
}

function scheduleToCronExpression(value: string) {
  const match = value.trim().match(/^Every weekday at (\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return undefined;
  const rawHour = Number(match[1]);
  const minute = Number(match[2] || '0');
  if (!Number.isInteger(rawHour) || !Number.isInteger(minute) || rawHour < 1 || rawHour > 12 || minute < 0 || minute > 59) {
    return undefined;
  }
  const period = match[3].toUpperCase();
  const hour = period === 'PM' && rawHour !== 12
    ? rawHour + 12
    : period === 'AM' && rawHour === 12
      ? 0
      : rawHour;
  return `${minute} ${hour} * * 1-5`;
}

async function loadCodeRoutines(): Promise<ScheduledRoutine[]> {
  const api = ccdScheduledTasksApi();
  if (api?.getAllScheduledTasks) {
    try {
      const tasks = await api.getAllScheduledTasks();
      if (Array.isArray(tasks)) return tasks.map(taskToRoutine);
    } catch {
      // Fall back to the browser preview store below.
    }
  }
  return readCodeRoutines();
}

async function createCodeRoutine(routine: ScheduledRoutine): Promise<ScheduledRoutine[]> {
  const api = ccdScheduledTasksApi();
  if (api?.createScheduledTask) {
    try {
      await api.createScheduledTask({
        name: routine.title,
        prompt: routine.prompt,
        description: routine.prompt,
        schedule: routine.schedule,
        cronExpression: scheduleToCronExpression(routine.schedule),
      });
      const tasks = await loadCodeRoutines();
      window.dispatchEvent(new CustomEvent('codeScheduledRoutinesUpdated', { detail: { routines: tasks } }));
      return tasks;
    } catch {
      // Fall back to localStorage so Vite/browser preview remains usable.
    }
  }
  const routines = [routine, ...readCodeRoutines()];
  window.localStorage.setItem(CODE_ROUTINES_KEY, JSON.stringify(routines));
  window.dispatchEvent(new CustomEvent('codeScheduledRoutinesUpdated', { detail: { routines } }));
  return routines;
}

function routineDefaults(template: string | null) {
  if (template === 'pr-review-digest') {
    return {
      title: 'Daily PR digest',
      prompt: 'Review open pull requests in this repository and summarize what changed, what needs attention, and suggested next steps.',
      schedule: 'Every weekday at 9:00 AM',
    };
  }
  return {
    title: '',
    prompt: '',
    schedule: 'Every weekday at 9:00 AM',
  };
}

const ScheduledPage: React.FC<ScheduledPageProps> = ({ onNewTask }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isCodeRoute = location.pathname.startsWith('/code/scheduled');
  const isNewRoute = location.pathname === '/code/scheduled/new';
  const template = new URLSearchParams(location.search).get('template');
  const defaults = useMemo(() => routineDefaults(template), [template]);
  const [title, setTitle] = useState(defaults.title);
  const [prompt, setPrompt] = useState(defaults.prompt);
  const [schedule, setSchedule] = useState(defaults.schedule);
  const [routines, setRoutines] = useState<ScheduledRoutine[]>(() => (
    isCodeRoute ? readCodeRoutines() : []
  ));
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);

  useEffect(() => {
    if (!isNewRoute) return;
    setTitle(defaults.title);
    setPrompt(defaults.prompt);
    setSchedule(defaults.schedule);
  }, [defaults, isNewRoute]);

  useEffect(() => {
    if (!isCodeRoute) {
      setRoutines([]);
      return;
    }

    let cancelled = false;
    const refreshRoutines = () => {
      loadCodeRoutines().then((next) => {
        if (!cancelled) setRoutines(next);
      });
    };
    refreshRoutines();
    window.addEventListener('codeScheduledRoutinesUpdated', refreshRoutines);
    window.addEventListener('storage', refreshRoutines);
    return () => {
      cancelled = true;
      window.removeEventListener('codeScheduledRoutinesUpdated', refreshRoutines);
      window.removeEventListener('storage', refreshRoutines);
    };
  }, [isCodeRoute]);

  const handleSearch = () => {
    window.dispatchEvent(new CustomEvent('openSidebarSearch'));
  };

  const handleCreateRoutine = async () => {
    if (!title.trim() || !prompt.trim() || isSavingRoutine) return;
    const next: ScheduledRoutine = {
      id: `routine-${Date.now()}`,
      title: title.trim(),
      prompt: prompt.trim(),
      schedule: schedule.trim() || defaults.schedule,
      template: template || undefined,
      createdAt: new Date().toISOString(),
    };
    setIsSavingRoutine(true);
    try {
      const routines = await createCodeRoutine(next);
      setRoutines(routines);
      navigate('/code/scheduled', { replace: true });
    } finally {
      setIsSavingRoutine(false);
    }
  };

  if (isNewRoute) {
    return (
      <div className="scheduled-page flex-1 h-full overflow-y-auto">
        <div className="scheduled-shell scheduled-form-shell">
          <div className="scheduled-header">
            <div className="scheduled-heading">
              <h1 className="scheduled-title">New routine</h1>
              <p className="scheduled-subtitle">
                Set up a recurring Claude Code task for this workspace.
              </p>
            </div>
          </div>

          <div className="scheduled-form-card">
            <label className="scheduled-form-field">
              <span>Name</span>
              <input
                value={title}
                onChange={event => setTitle(event.currentTarget.value)}
                placeholder="Daily PR digest"
              />
            </label>
            <label className="scheduled-form-field">
              <span>Instructions</span>
              <textarea
                value={prompt}
                onChange={event => setPrompt(event.currentTarget.value)}
                rows={6}
                placeholder="Describe what Claude should do each time this routine runs."
              />
            </label>
            <label className="scheduled-form-field">
              <span>Schedule</span>
              <input
                value={schedule}
                onChange={event => setSchedule(event.currentTarget.value)}
                placeholder="Every weekday at 9:00 AM"
              />
            </label>

            <div className="scheduled-form-actions">
              <button
                type="button"
                className="scheduled-secondary-button"
                onClick={() => navigate('/code/scheduled')}
              >
                Cancel
              </button>
              <button
                type="button"
                className="scheduled-new-task-button"
                disabled={!title.trim() || !prompt.trim() || isSavingRoutine}
                onClick={handleCreateRoutine}
              >
                {isSavingRoutine ? 'Creating...' : 'Create routine'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scheduled-page flex-1 h-full overflow-y-auto">
      <div className="scheduled-shell">
        <div className="scheduled-header">
          <div className="scheduled-heading">
            <h1 className="scheduled-title">Scheduled tasks</h1>
            <p className="scheduled-subtitle">
              Run tasks on a schedule or whenever you need them. Type /schedule in any existing
              task to set one up.
            </p>
          </div>

          <div className="scheduled-toolbar" aria-label="Scheduled task controls">
            <button
              type="button"
              className="scheduled-icon-button"
              aria-label="Filter scheduled tasks"
            >
              <img src={filterIcon} alt="" width={19} height={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="scheduled-icon-button"
              aria-label="Search scheduled tasks"
              onClick={handleSearch}
            >
              <img src={searchIcon} alt="" width={23} height={23} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="scheduled-new-task-button"
              onClick={isCodeRoute ? () => navigate('/code/scheduled/new') : onNewTask}
            >
              New task
            </button>
          </div>
        </div>

        <div className="scheduled-notice-card">
          <div className="scheduled-notice-copy">
            <img src={infoIcon} alt="" width={22} height={21} aria-hidden="true" />
            <span>Scheduled tasks only run while your computer is awake.</span>
          </div>

          <div className="scheduled-notice-actions">
            <img src={keepAwakeIcon} alt="" width={23} height={23} aria-hidden="true" />
            <span>Keep awake</span>
            <img src={keepAwakeToggleIcon} alt="" width={41} height={25} aria-hidden="true" />
          </div>
        </div>

        {routines.length > 0 ? (
          <div className="scheduled-routine-list">
            {routines.map(routine => (
              <article key={routine.id} className="scheduled-routine-card">
                <div>
                  <h2>{routine.title}</h2>
                  <p>{routine.prompt}</p>
                </div>
                <span>{routine.schedule}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="scheduled-empty-state">
            <img
              src={emptyStateIcon}
              alt=""
              width={102}
              height={117}
              className="scheduled-empty-icon"
              aria-hidden="true"
            />
            <p className="scheduled-empty-copy">No scheduled tasks yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduledPage;
