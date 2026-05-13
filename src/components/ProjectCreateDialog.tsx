import React from 'react';
import { ChevronRight, Folder, Plus, X } from 'lucide-react';

type ProjectCreateChooserProps = {
  onClose: () => void;
  onCreateNewFolder: () => void;
  onUseExistingFolder: () => void;
};

type ProjectCreateFormProps = {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  title: string;
  projectName: string;
  projectDescription: string;
  projectNameError: string | null;
  onProjectNameChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
};

export function ProjectCreateChooser({
  onClose,
  onCreateNewFolder,
  onUseExistingFolder,
}: ProjectCreateChooserProps) {
  return (
    <div className="w-[448px] max-w-[calc(100vw-2rem)] rounded-2xl border border-claude-border bg-claude-bg shadow-xl">
      <div className="flex items-start justify-between px-6 pb-3 pt-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-[22px] font-semibold text-claude-text">创建一个新项目</h2>
          <p className="max-w-[360px] text-[14px] leading-[26px] text-claude-textSecondary">
            一个专门用于持续工作的地方，随着时间的推移，环境会逐渐建立起来。文件和说明保留在计算机上的文件夹中。
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-claude-textSecondary transition-colors hover:bg-claude-hover hover:text-claude-text"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-6 pb-6">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onCreateNewFolder}
            className="group flex items-center gap-3 rounded-xl border border-claude-border bg-white px-4 py-3.5 text-left transition-colors hover:border-[#d9d4cc] hover:bg-[#fcfbf8] dark:bg-claude-input"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-claude-border bg-[#f7f5f1] text-[#7d776e]">
              <Plus size={20} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-medium text-claude-text">新建文件夹</div>
              <div className="text-[13px] text-claude-textSecondary">
                设置一个包含说明和文件的新文件夹。
              </div>
            </div>
            <ChevronRight size={16} className="flex-shrink-0 text-claude-textSecondary transition-colors group-hover:text-claude-text" />
          </button>

          <button
            type="button"
            onClick={onUseExistingFolder}
            className="group flex items-center gap-3 rounded-xl border border-claude-border bg-white px-4 py-3.5 text-left transition-colors hover:border-[#d9d4cc] hover:bg-[#fcfbf8] dark:bg-claude-input"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-claude-border bg-[#f7f5f1] text-[#7d776e]">
              <Folder size={19} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-medium text-claude-text">使用现有文件夹</div>
              <div className="text-[13px] text-claude-textSecondary">
                给 Claude 一个你已经工作过的文件夹。
              </div>
            </div>
            <ChevronRight size={16} className="flex-shrink-0 text-claude-textSecondary transition-colors group-hover:text-claude-text" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectCreateNewFolderForm({
  onSubmit,
  onCancel,
  title,
  projectName,
  projectDescription,
  projectNameError,
  onProjectNameChange,
  onProjectDescriptionChange,
}: ProjectCreateFormProps) {
  return (
    <div className="w-[648px] max-w-[calc(100vw-2rem)] rounded-2xl border border-claude-border bg-claude-bg shadow-xl">
      <div className="px-6 pb-4 pt-5">
        <h3 className="text-[22px] font-[Spectral] text-claude-text" style={{ fontWeight: 600 }}>
          {title}
        </h3>
      </div>
      <form className="grid grid-cols-1 gap-4 px-6 pb-6" onSubmit={onSubmit}>
        <div>
          <label className="mb-2 block text-[15px] font-medium text-claude-textSecondary">
            What are you working on?
          </label>
          <input
            type="text"
            name="name"
            className={`w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-claude-text outline-none transition-colors placeholder:text-gray-400 dark:bg-claude-input dark:placeholder-gray-500 ${
              projectNameError
                ? 'border-[#b9382c]/70 focus:border-[#b9382c]'
                : 'border-gray-200 focus:border-[#387ee0] dark:border-claude-border'
            }`}
            placeholder="Name your project"
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            autoFocus
            data-1p-ignore
          />
          {projectNameError && (
            <div className="mt-1 text-right text-xs font-medium text-[#b9382c]">
              {projectNameError}
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-[15px] font-medium text-claude-textSecondary">
            What are you trying to achieve?
          </label>
          <textarea
            name="description"
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-claude-text outline-none transition-colors placeholder:text-gray-400 focus:border-[#387ee0] dark:border-claude-border dark:bg-claude-input dark:placeholder-gray-500"
            placeholder="Describe your project, goals, subject, etc..."
            rows={3}
            value={projectDescription}
            onChange={(event) => onProjectDescriptionChange(event.target.value)}
          />
        </div>

        <div className="mt-2 flex justify-end">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-[15px] font-medium text-claude-text transition-colors hover:bg-gray-50 dark:border-claude-border dark:bg-claude-bg dark:hover:bg-claude-hover"
            >
              返回
            </button>
            <button
              type="submit"
              className="rounded-lg bg-black px-4 py-2.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-black"
            >
              创建项目
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
