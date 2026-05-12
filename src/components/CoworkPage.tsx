import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  CornerDownRight,
  FileText,
  Folder,
  PanelRight,
  Plus,
  Square,
  TriangleAlert,
} from 'lucide-react';
import starSparkleImg from '../assets/figma-exports/cowork-icons/star-sparkle.png';
import { COWORK_SUGGESTIONS } from '../data/coworkSuggestions';

const DEFAULT_TASK_PROMPT = COWORK_SUGGESTIONS[0].prompt;

const CoworkPage: React.FC = () => {
  const [draft, setDraft] = useState('');
  const [queuedDraft, setQueuedDraft] = useState('');
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queueRef = useRef<HTMLTextAreaElement>(null);
  const isRunning = Boolean(activePrompt);

  useEffect(() => {
    if (isRunning) {
      queueRef.current?.focus();
      return;
    }
    textareaRef.current?.focus();
  }, [isRunning]);

  const startTask = (prompt: string) => {
    const value = prompt.trim();
    if (!value) return;
    setActivePrompt(value);
    setDraft('');
  };

  const submitTask = () => startTask(draft);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      submitTask();
    }
  };

  const taskPreview = useMemo(() => {
    if (!activePrompt) return '';
    const maxChars = 390;
    return activePrompt.length > maxChars ? `${activePrompt.slice(0, maxChars).trimEnd()}` : activePrompt;
  }, [activePrompt]);

  if (isRunning) {
    return (
      <div className="cowork-run-page flex-1 h-full overflow-hidden">
        <header className="cowork-run-header">
          <button type="button" className="cowork-run-title">
            新任务
            <ChevronDown size={18} strokeWidth={1.8} />
          </button>
          <button type="button" className="cowork-run-panel-toggle" aria-label="Toggle task panel">
            <PanelRight size={21} strokeWidth={1.8} />
          </button>
        </header>

        <main className="cowork-run-main">
          <section className="cowork-run-thread">
            <article className="cowork-run-message-card">
              <p>{taskPreview}</p>
              {activePrompt && activePrompt.length > taskPreview.length ? (
                <button type="button" className="cowork-run-show-more">Show more</button>
              ) : null}
              <button type="button" className="cowork-run-copy" aria-label="Copy task prompt">
                <Copy size={18} strokeWidth={1.7} />
              </button>
            </article>

            <div className="cowork-run-status">
              <img src={starSparkleImg} alt="" aria-hidden="true" />
              <span>Working on it...</span>
            </div>
          </section>

          <aside className="cowork-run-panel">
            <section className="cowork-run-side-card cowork-run-side-card-progress">
              <button type="button" className="cowork-run-side-title">
                <span>进度</span>
                <ChevronDown size={18} strokeWidth={1.7} />
              </button>
              <div className="cowork-run-progress-dots" aria-hidden="true">
                <span className="is-complete" />
                <span className="is-complete" />
                <span />
              </div>
              <p>See task progress for longer tasks.</p>
            </section>

            <button type="button" className="cowork-run-folder-card">
              <span>工作文件夹</span>
              <ChevronRight size={20} strokeWidth={1.7} />
            </button>

            <section className="cowork-run-side-card cowork-run-side-card-context">
              <button type="button" className="cowork-run-side-title">
                <span>上下文</span>
                <ChevronDown size={18} strokeWidth={1.7} />
              </button>
              <div className="cowork-run-context-illustration" aria-hidden="true">
                <FileText size={32} strokeWidth={1.4} />
                <FileText size={32} strokeWidth={1.4} />
                <span><Plus size={18} strokeWidth={1.8} /></span>
              </div>
              <p>Track tools and referenced files used in this task.</p>
            </section>
          </aside>
        </main>

        <section className="cowork-run-composer-wrap">
          <div className="cowork-run-composer">
            <textarea
              ref={queueRef}
              value={queuedDraft}
              onChange={(event) => setQueuedDraft(event.target.value)}
              placeholder="Write a message..."
              rows={1}
              className="cowork-run-textarea"
            />
            <div className="cowork-run-composer-actions">
              <button type="button" className="cowork-run-plus" aria-label="Add attachment">
                <Plus size={24} strokeWidth={1.8} />
              </button>
              <div className="cowork-run-composer-right">
                <button type="button" className="cowork-run-model">
                  Legacy Model
                  <ChevronDown size={16} strokeWidth={1.6} />
                </button>
                <button type="button" className="cowork-run-stop" aria-label="Stop task">
                  <Square size={15} strokeWidth={1.8} />
                </button>
                <button type="button" className="cowork-run-queue" disabled={!queuedDraft.trim()}>
                  <CornerDownRight size={18} strokeWidth={1.9} />
                  Queue
                </button>
              </div>
            </div>
          </div>
          <p className="cowork-run-disclaimer">Claude 是 AI，可能会出错。请务必再次核对回复内容。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="cowork-task-page flex-1 h-full overflow-y-auto">
      <div className="cowork-task-shell">
        <section className="cowork-task-hero">
          <div className="cowork-task-heading-row">
            <img
              src={starSparkleImg}
              alt=""
              aria-hidden="true"
              className="cowork-task-star"
              width={28}
              height={28}
            />
            <h1 className="cowork-task-title">来把待办清掉吧</h1>
          </div>
          <button type="button" className="cowork-task-subtitle">
            了解如何安全使用协作.
          </button>
        </section>

        <section className="cowork-task-composer-card">
          <div className="cowork-task-composer-main">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="今天我可以帮你做什么?"
              rows={1}
              className="cowork-task-textarea"
            />

            <div className="cowork-task-composer-actions">
              <button
                type="button"
                className="cowork-task-plus"
                aria-label="Add attachment"
              >
                <Plus size={24} strokeWidth={1.8} />
              </button>

              <button
                type="button"
                className="cowork-task-send"
                aria-label="Start task"
                disabled={!draft.trim()}
                onClick={submitTask}
              >
                <ArrowUp size={24} strokeWidth={2.1} />
              </button>
            </div>
          </div>

          <div className="cowork-task-composer-footer">
            <div className="cowork-task-project-pill">
              <Folder size={20} strokeWidth={1.8} />
              <span>在项目中工作</span>
            </div>
            <button type="button" className="cowork-task-model-pill">
              Legacy Model
            </button>
          </div>
        </section>

        <section className="cowork-task-running">
          <div className="cowork-task-running-header">
            <span>进行中</span>
            <button type="button" className="cowork-task-clear">
              清除进行中
            </button>
          </div>

          <div className="cowork-task-current">
            <div className="cowork-task-current-meta">
              <TriangleAlert size={16} strokeWidth={1.9} color="#c98017" />
              <div className="cowork-task-current-copy">
                <div className="cowork-task-current-title">Local task</div>
                <div className="cowork-task-current-time">22小时前</div>
              </div>
            </div>
          </div>
        </section>

        <section className="cowork-task-suggestions">
          <div className="cowork-task-suggestions-label">Tidy up and get organized</div>
          <div className="cowork-task-suggestion-list">
            {COWORK_SUGGESTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cowork-task-suggestion"
                onClick={() => startTask(item.prompt)}
              >
                <span className="cowork-task-suggestion-icon">{item.icon}</span>
                <span className="cowork-task-suggestion-title">{item.title}</span>
              </button>
            ))}
            <button
              type="button"
              className="cowork-task-custom-link"
              onClick={() => startTask(DEFAULT_TASK_PROMPT)}
            >
              用插件自定义
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CoworkPage;
