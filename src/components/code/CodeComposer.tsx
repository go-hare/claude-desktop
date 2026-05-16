import { CornerDownLeft, Folder, Laptop, Plus } from 'lucide-react';
import CodeDraftClawd from '../CodeDraftClawd';
import CodeModelEffortSelector, { type CodeEffort, type CodeModelOption } from './CodeModelEffortSelector';

type CodeComposerProps = {
  error: string | null;
  effort: CodeEffort;
  inputText: string;
  isSubmitting: boolean;
  modelLabel: string;
  modelOptions: CodeModelOption[];
  selectedFolder: string | null;
  onChooseFolder: () => void;
  onInputChange: (value: string) => void;
  onModelEffortChange: (next: { model: string; effort: CodeEffort }) => void;
  onSubmit: () => void;
};

function folderLabel(folder: string | null) {
  if (!folder) return '选择文件夹...';
  return folder.split(/[\\/]/).filter(Boolean).pop() || folder;
}

export default function CodeComposer({
  error,
  effort,
  inputText,
  isSubmitting,
  modelLabel,
  modelOptions,
  selectedFolder,
  onChooseFolder,
  onInputChange,
  onModelEffortChange,
  onSubmit,
}: CodeComposerProps) {
  return (
    <div className="relative shrink-0 flex flex-col gap-g5 [contain:layout]">
      <CodeDraftClawd />
      <div className="mb-[2px] flex items-center gap-g3">
        <button
          type="button"
          className="inline-flex h-[24px] items-center gap-g3 rounded-r5 px-p3 text-body text-t7 hover:bg-t2"
        >
          <Laptop size={14} strokeWidth={1.7} />
          本地
        </button>
        <button
          type="button"
          onClick={onChooseFolder}
          className="inline-flex h-[24px] max-w-[240px] items-center gap-g3 rounded-r5 px-p3 text-body text-t7 hover:bg-t2"
          title={selectedFolder || undefined}
        >
          <Folder size={14} strokeWidth={1.7} />
          <span className="truncate">{folderLabel(selectedFolder)}</span>
        </button>
      </div>

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
        <div className="flex min-w-0 items-center gap-g5">
          <button type="button" className="rounded-r5 px-p3 py-p2 text-body text-t6 hover:bg-t2">
            接受编辑
          </button>
          <button
            type="button"
            className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-r5 text-t7 hover:bg-t2"
            aria-label="添加"
          >
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-g4 text-body text-t6">
          <CodeModelEffortSelector
            disabled={isSubmitting}
            model={modelLabel}
            effort={effort}
            models={modelOptions}
            onChange={onModelEffortChange}
          />
          <span className="h-[10px] w-[10px] rounded-full border border-t3 bg-z0" />
        </div>
      </div>
      {error ? <div className="text-footnote text-extended-pink select-text">{error}</div> : null}
    </div>
  );
}
