import { useEffect, useState } from 'react';
import { CornerDownLeft, ExternalLink, Folder, GitBranch, Square as SquareIcon } from 'lucide-react';
import CodeDraftClawd from '../CodeDraftClawd';
import type { CodeEnvironmentKind } from './CodeEnvironmentSelector';
import CodeModelEffortSelector, { type CodeEffort, type CodeModelOption } from './CodeModelEffortSelector';
import CodePermissionModeSelector, { type CodePermissionMode } from './CodePermissionModeSelector';
import { getGitInfo, type GitInfo } from '../../api';

type CodeComposerProps = {
  error: string | null;
  effort: CodeEffort;
  environment: CodeEnvironmentKind;
  inputText: string;
  isSubmitting: boolean;
  modelLabel: string;
  modelOptions: CodeModelOption[];
  permissionMode: CodePermissionMode;
  selectedFolder: string | null;
  onChooseFolder: () => void;
  onEnvironmentChange: (next: CodeEnvironmentKind) => void;
  onInputChange: (value: string) => void;
  onModelEffortChange: (next: { model: string; effort: CodeEffort }) => void;
  onPermissionModeChange: (next: CodePermissionMode) => void;
  onSubmit: () => void;
};

function folderLabel(folder: string | null) {
  if (!folder) return '选择文件夹';
  return folder.split(/[\\/]/).filter(Boolean).pop() || folder;
}

function ContextChips({
  environment,
  selectedFolder,
  onChooseFolder,
}: {
  environment: CodeEnvironmentKind;
  selectedFolder: string | null;
  onChooseFolder: () => void;
}) {
  const [git, setGit] = useState<GitInfo>({ isRepo: false });

  useEffect(() => {
    let cancelled = false;
    if (!selectedFolder) { setGit({ isRepo: false }); return; }
    getGitInfo(selectedFolder)
      .then((info) => { if (!cancelled) setGit(info); })
      .catch(() => { if (!cancelled) setGit({ isRepo: false }); });
    return () => { cancelled = true; };
  }, [selectedFolder]);

  const openInExplorer = () => {
    if (!selectedFolder) return;
    const api = (window as any).electronAPI;
    if (api?.openFolder) api.openFolder(selectedFolder);
  };

  const envLabel = environment === 'local' ? '本地' : environment === 'ssh' ? 'SSH' : environment === 'bridge' ? 'Bridge' : '本地';

  return (
    <div className="flex items-center gap-g3 text-footnote text-t6">
      <Chip>
        <SquareIcon size={12} strokeWidth={1.7} />
        <span>{envLabel}</span>
      </Chip>
      <button
        type="button"
        onClick={onChooseFolder}
        className="inline-flex h-[22px] items-center gap-g2 rounded-r5 border border-t3 bg-z0 px-p3 text-footnote text-t7 hover:bg-t2"
        title={selectedFolder || '选择文件夹'}
      >
        <Folder size={12} strokeWidth={1.7} />
        <span className="max-w-[160px] truncate">{folderLabel(selectedFolder)}</span>
      </button>
      {git.isRepo && git.branch ? (
        <Chip>
          <GitBranch size={12} strokeWidth={1.7} />
          <span className="max-w-[120px] truncate">{git.branch}</span>
          {git.dirty ? <span className="ml-[2px] inline-block h-[5px] w-[5px] rounded-full bg-extended-yellow" title="工作树有未提交改动" /> : null}
        </Chip>
      ) : null}
      {git.isRepo ? (
        <Chip>
          <SquareIcon size={11} strokeWidth={1.7} />
          <span>工作树</span>
        </Chip>
      ) : null}
      {selectedFolder ? (
        <button
          type="button"
          onClick={openInExplorer}
          className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-r5 border border-t3 bg-z0 text-t6 hover:bg-t2 hover:text-t8"
          aria-label="在资源管理器中打开"
          title="在资源管理器中打开"
        >
          <ExternalLink size={12} strokeWidth={1.7} />
        </button>
      ) : null}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[22px] items-center gap-g2 rounded-r5 border border-t3 bg-z0 px-p3 text-footnote text-t7">
      {children}
    </span>
  );
}

export default function CodeComposer({
  error,
  effort,
  environment,
  inputText,
  isSubmitting,
  modelLabel,
  modelOptions,
  permissionMode,
  selectedFolder,
  onChooseFolder,
  onEnvironmentChange,
  onInputChange,
  onModelEffortChange,
  onPermissionModeChange,
  onSubmit,
}: CodeComposerProps) {
  return (
    <div className="relative shrink-0 flex flex-col gap-g5 [contain:layout]">
      <CodeDraftClawd />
      <ContextChips
        environment={environment}
        selectedFolder={selectedFolder}
        onChooseFolder={onChooseFolder}
      />

      <div className="epitaxy-prompt effect-prompt-blur relative isolate rounded-r7 bg-[var(--surface-prompt-blur)] transition-shadow duration-300 focus-within:bg-[var(--surface-prompt-focus-hover)] focus-within:effect-prompt-focus">
        <div className="relative flex w-full">
          <div className="epitaxy-prompt-input flex-1 min-w-0 text-heading text-t9">
            <textarea
              value={inputText}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                onSubmit();
              }}
              placeholder="描述任务或提出问题"
              className="epitaxy-code-textarea"
              rows={1}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex self-end p-p7 pl-p3">
            <button
              type="button"
              aria-label="发送"
              onClick={onSubmit}
              disabled={isSubmitting || !inputText.trim()}
              className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t6 transition-colors hover:bg-t2 hover:text-t8 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <CornerDownLeft size={16} strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full flex items-center gap-g5 py-[4px]">
        <div className="flex min-w-0 items-center gap-g4">
          <CodePermissionModeSelector
            disabled={isSubmitting}
            value={permissionMode}
            onChange={onPermissionModeChange}
          />
        </div>
        <div className="ml-auto flex items-center gap-g4 text-body text-t6">
          <CodeModelEffortSelector
            disabled={isSubmitting}
            model={modelLabel}
            effort={effort}
            models={modelOptions}
            onChange={onModelEffortChange}
          />
        </div>
      </div>
      {error ? <div className="text-footnote text-extended-pink select-text">{error}</div> : null}
    </div>
  );
}
