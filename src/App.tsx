import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HashRouter, Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Clock3,
  FileDiff,
  FileText,
  Folder,
  ListChecks,
  ListTodo,
  Menu,
  NotebookText,
  PanelRight,
  Terminal,
  Trash,
  Pencil,
  Star,
  BellRing,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { IconSidebarToggle } from './components/Icons';
import { updateConversation, deleteConversation, exportConversation, getUnreadAnnouncements, markAnnouncementRead, getSystemStatus, getConversation, isLocalBridgeApp } from './api';
import GitBashRequiredModal from './components/GitBashRequiredModal';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import SettingsPage from './components/SettingsPage';
import UpgradePlan from './components/UpgradePlan';
import DocumentPanel from './components/DocumentPanel';
import ArtifactsPanel from './components/ArtifactsPanel';
import DraggableDivider from './components/DraggableDivider';
import { DocumentInfo } from './components/DocumentCard';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminKeyPool from './components/admin/AdminKeyPool';
import AdminUsers from './components/admin/AdminUsers';
import AdminPlans from './components/admin/AdminPlans';
import AdminRedemption from './components/admin/AdminRedemption';
import AdminModels from './components/admin/AdminModels';
import AdminAnnouncements from './components/admin/AdminAnnouncements';
import CustomizePage from './components/CustomizePage';
import ProjectsPage from './components/ProjectsPage';
import CoworkPage from './components/CoworkPage';
import ScheduledPage from './components/ScheduledPage';
import CodePage from './components/CodePage';
import CodeSessionPage from './components/CodeSessionPage';
import {
  addCodeSessionUiListener,
  dispatchCodeSessionUiEvent,
  type CodeSidePane,
  type CodeTextSize,
  type CodeTranscriptMode,
} from './codeSessionUi';

const Tooltip = ({ children, text, shortcut }: { children: React.ReactNode; text: string; shortcut?: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-[200] pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap bg-[#2a2a2a] text-white dark:bg-[#e8e8e8] dark:text-[#1a1a1a] shadow-lg">
            <span>{text}</span>
            {shortcut && <span className="opacity-60 text-[11px]">{shortcut}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

const ChatHeader = ({
  title,
  showArtifacts,
  documentPanelDoc,
  onOpenArtifacts,
  hasArtifacts,
  onTitleRename
}: {
  title: string;
  showArtifacts: boolean;
  documentPanelDoc: any;
  onOpenArtifacts: () => void;
  hasArtifacts: boolean;
  onTitleRename?: (newTitle: string) => void;
}) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const startEditing = () => {
    setEditTitle(title || 'New Chat');
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteConversation(id);
      navigate('/');
      // Trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('conversationTitleUpdated'));
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
    setShowMenu(false);
  };

  const handleRenameSubmit = async () => {
    if (!id || !editTitle.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      await updateConversation(id, { title: editTitle });
      onTitleRename?.(editTitle);
      window.dispatchEvent(new CustomEvent('conversationTitleUpdated'));
    } catch (err) {
      console.error('Failed to rename chat:', err);
    } finally {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div
      className="relative flex items-center justify-between px-3 py-2 bg-claude-bg flex-shrink-0 h-[44px] border-b border-claude-border z-40"
    >
      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleKeyDown}
          autoFocus
          className="max-w-[60%] px-2 py-1 text-[14px] font-medium text-claude-text bg-claude-input border border-blue-500 rounded-md outline-none shadow-sm"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        />
      ) : (
        <div className="relative flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={startEditing}
            className="flex items-center px-2 py-1.5 hover:bg-claude-btn-hover rounded-md transition-colors text-[14px] font-medium text-claude-text max-w-[200px] truncate group"
          >
            {title || 'New Chat'}
          </button>

          <button
            ref={buttonRef}
            onClick={() => setShowMenu(!showMenu)}
            className={`p-1 hover:bg-claude-btn-hover rounded-md transition-colors text-claude-textSecondary hover:text-claude-text ${showMenu ? 'bg-claude-btn-hover text-claude-text' : ''}`}
          >
            <ChevronDown size={14} />
          </button>

          {showMenu && (
            <div
              ref={menuRef}
              className="absolute top-full left-0 mt-1 z-50 bg-claude-input border border-claude-border rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] py-1.5 flex flex-col w-[200px]"
            >
              <button className="flex items-center gap-3 px-3 py-2 hover:bg-claude-hover text-left w-full transition-colors group">
                <Star size={16} className="text-claude-textSecondary group-hover:text-claude-text" />
                <span className="text-[13px] text-claude-text">Star</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
                className="flex items-center gap-3 px-3 py-2 hover:bg-claude-hover text-left w-full transition-colors group"
              >
                <Pencil size={16} className="text-claude-textSecondary group-hover:text-claude-text" />
                <span className="text-[13px] text-claude-text">Rename</span>
              </button>
              <div className="h-[1px] bg-claude-border my-1 mx-3" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="flex items-center gap-3 px-3 py-2 hover:bg-claude-hover text-left w-full transition-colors group"
              >
                <Trash size={16} className="text-[#B9382C]" />
                <span className="text-[13px] text-[#B9382C]">Delete</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1">
        {hasArtifacts && (
          <button
            onClick={onOpenArtifacts}
            className={`w-8 h-8 flex items-center justify-center text-claude-textSecondary hover:bg-claude-btn-hover rounded-md transition-colors ${showArtifacts ? 'bg-claude-btn-hover text-claude-text' : ''}`}
            title="View Artifacts"
          >
            <FileText size={18} strokeWidth={1.5} />
          </button>
        )}
        <button
          className="px-2 h-8 flex items-center justify-center text-claude-textSecondary hover:text-claude-text transition-colors"
          title="Open Workspace Folder"
          onClick={async () => {
            if (!id) return;
            try {
              const res = await fetch(`http://127.0.0.1:30080/api/conversations/${id}`);
              if (!res.ok) return;
              const data = await res.json();
              if (data.workspace_path && (window as any).electronAPI?.openFolder) {
                (window as any).electronAPI.openFolder(data.workspace_path);
              }
            } catch (e) { console.error('Open folder failed:', e); }
          }}
        >
          <Folder size={17} strokeWidth={1.5} />
        </button>
        <button
          onClick={async () => {
            if (!id || isExporting) return;
            setIsExporting(true);
            try {
              await exportConversation(id);
            } catch (err) {
              console.error('导出失败', err);
              window.alert(err instanceof Error ? err.message : '导出失败');
            } finally {
              setIsExporting(false);
            }
          }}
          disabled={isExporting}
          className="px-3 py-1.5 text-[13px] font-medium text-claude-textSecondary hover:bg-claude-btn-hover rounded-md transition-colors border border-transparent hover:border-claude-border disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? '导出中…' : 'Export'}
        </button>
      </div>
      <div className="absolute top-full left-0 right-0 h-6 bg-gradient-to-b from-claude-bg to-transparent pointer-events-none z-30" />
    </div>
  );
};

type CodeHeaderState = {
  cwd: string | null;
  title: string;
  pinned: boolean;
};

type CodeInstalledEditor = {
  type: string;
  name: string;
  installed?: boolean;
  iconDataUrl?: string;
};

type ClaudeWebApi = {
  FileSystem?: {
    showInFolder?: (filePath: string) => Promise<void>;
  };
  LocalSessions?: {
    getInstalledEditors?: (cwd?: string | null) => Promise<CodeInstalledEditor[]>;
    openInEditor?: (
      targetPath: string,
      editorType: string,
      sshConfig?: unknown,
      line?: number,
    ) => Promise<boolean>;
  };
};

const getClaudeWebApi = (): ClaudeWebApi | undefined => (
  typeof window === 'undefined' ? undefined : (window as any)['claude.web']
);

type CodeTopbarMenuItem = {
  label: string;
  shortcut?: string;
  checked?: boolean;
  icon?: React.ReactNode;
  action: () => void;
};

type CodeTopbarSection = {
  items: CodeTopbarMenuItem[];
};

const CodeTopbarIconButton = React.forwardRef<HTMLButtonElement, {
  label: string;
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}>(({ label, active, children, onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    aria-expanded={active}
    title={label}
    onClick={onClick}
    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    className={`inline-flex h-[28px] min-w-[28px] items-center justify-center rounded-[7px] text-[#73726c] transition-colors hover:bg-[#f2f1ee] hover:text-[#2f2f2c] ${active ? 'bg-[#efeeeb] text-[#2f2f2c]' : ''}`}
  >
    {children}
  </button>
));
CodeTopbarIconButton.displayName = 'CodeTopbarIconButton';

const CodeTopbarMenu = ({
  anchorRef,
  open,
  width = 220,
  sections,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  width?: number;
  sections: CodeTopbarSection[];
  onClose: () => void;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
      const top = Math.max(8, Math.min(window.innerHeight - 8, rect.bottom + 6));
      setPosition({ left, top });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, open, width]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      const flatItems = sections.flatMap((section) => section.items);
      const item = flatItems.find((entry) => entry.shortcut?.toLowerCase() === event.key.toLowerCase());
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
      item.action();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [anchorRef, onClose, open, sections]);

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={menuRef}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: 'fixed',
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: `${width}px`,
        zIndex: 10000,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
      className="overflow-hidden rounded-[12px] border border-[#e5e1da] bg-white py-[8px] text-[14px] font-normal text-[#2f2f2c] shadow-[0_14px_38px_rgba(0,0,0,0.14)]"
    >
      {sections.map((section, sectionIndex) => (
        <React.Fragment key={sectionIndex}>
          {sectionIndex > 0 ? <div className="my-[6px] h-px bg-[#ece8e1]" /> : null}
          {section.items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                onClose();
                item.action();
              }}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="flex h-[38px] w-full items-center gap-[12px] px-[18px] text-left transition-colors hover:bg-[#f4f3f0]"
            >
              {item.icon ? <span className="flex w-[18px] shrink-0 justify-center text-[#6f6c66]">{item.icon}</span> : null}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.checked ? <Check size={16} strokeWidth={1.9} className="shrink-0 text-[#2f2f2c]" /> : null}
              {item.shortcut ? <span className="shrink-0 text-[#8a8781]">{item.shortcut}</span> : null}
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>,
    document.body,
  );
};

const CodeTranscriptMenu = ({
  anchorRef,
  open,
  transcriptMode,
  textSize,
  onTranscriptModeChange,
  onTextSizeChange,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  transcriptMode: CodeTranscriptMode;
  textSize: CodeTextSize;
  onTranscriptModeChange: (mode: CodeTranscriptMode) => void;
  onTextSizeChange: (size: CodeTextSize) => void;
  onClose: () => void;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const width = 286;
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
      const top = Math.max(8, Math.min(window.innerHeight - 8, rect.bottom + 8));
      setPosition({ left, top });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [anchorRef, onClose, open]);

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={menuRef}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: 'fixed',
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: `${width}px`,
        zIndex: 10000,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
      className="overflow-hidden rounded-[14px] border border-[#e7e2da] bg-white py-[8px] text-[13px] font-normal text-[#252522] shadow-[0_18px_48px_rgba(0,0,0,0.15)]"
    >
      <div className="flex min-h-[20px] items-center gap-[4px] px-[18px] py-[3px] text-[12px] text-[#77736d]">
        <span className="min-w-0 flex-1 truncate pr-[12px]">Transcript view</span>
        <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[4px] border border-[#ded9d2] bg-[#f7f6f3] px-[4px] text-[10px] text-[#77736d] shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
          <ChevronDown size={11} strokeWidth={1.8} className="rotate-180" />
        </span>
        <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[4px] border border-[#ded9d2] bg-[#f7f6f3] px-[4px] text-[10px] text-[#77736d] shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
          O
        </span>
      </div>
      <div>
        {transcriptModeItems.map((item) => (
          <button
            key={item.mode}
            type="button"
            onClick={() => {
              onTranscriptModeChange(item.mode);
              onClose();
            }}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex h-[32px] w-full items-center justify-between px-[18px] text-left text-[15px] leading-none transition-colors hover:bg-[#f4f3f0]"
          >
            <span>{item.label}</span>
            {transcriptMode === item.mode ? <Check size={16} strokeWidth={1.9} /> : null}
          </button>
        ))}
      </div>
      <div className="border-t border-[#ece8e1] px-[16px] pb-[4px] pt-[8px]">
        <div role="group" aria-label="Text size" className="grid grid-cols-3 gap-[4px]">
          {textSizeItems.map((item) => (
            <button
              key={item.size}
              type="button"
              aria-label={item.label}
              aria-pressed={textSize === item.size}
              onClick={() => onTextSizeChange(item.size)}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className={`relative isolate flex h-[28px] items-center justify-center rounded-[6px] border-0 text-[#2f2f2c] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.08)] transition-colors ${textSize === item.size ? 'bg-[#efeeeb]' : 'bg-white hover:bg-[#f6f5f2]'}`}
            >
              <span className={item.size === 's' ? 'text-[11px]' : item.size === 'm' ? 'text-[14px]' : 'text-[17px]'}>
                Aa
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

const transcriptModeItems: Array<{ mode: CodeTranscriptMode; label: string }> = [
  { mode: 'normal', label: 'Normal' },
  { mode: 'thinking', label: 'Thinking' },
  { mode: 'verbose', label: 'Verbose' },
  { mode: 'summary', label: 'Summary' },
];

const textSizeItems: Array<{ size: CodeTextSize; label: string }> = [
  { size: 's', label: 'Small text' },
  { size: 'm', label: 'Medium text' },
  { size: 'l', label: 'Large text' },
];

const CODE_TEXT_SIZE_STORAGE_KEY = 'epitaxy.chatTextSize';

function getInitialCodeTextSize(): CodeTextSize {
  if (typeof window === 'undefined') return 'm';
  const value = window.localStorage.getItem(CODE_TEXT_SIZE_STORAGE_KEY);
  return value === 's' || value === 'l' ? value : 'm';
}

const sidePaneItems: Array<{ pane: CodeSidePane; label: string; icon: React.ReactNode }> = [
  { pane: 'diff', label: 'Diff', icon: <FileDiff size={16} strokeWidth={1.7} /> },
  { pane: 'terminal', label: 'Terminal', icon: <Terminal size={16} strokeWidth={1.7} /> },
  { pane: 'tasks', label: 'Tasks', icon: <ListTodo size={16} strokeWidth={1.7} /> },
  { pane: 'plan', label: 'Plan', icon: <ListChecks size={16} strokeWidth={1.7} /> },
  { pane: 'transcript', label: 'Transcript', icon: <Clock3 size={16} strokeWidth={1.7} /> },
];

const CodeSessionTopActions = ({
  visible,
  titleBarHeight,
  transcriptMode,
  textSize,
  sidePane,
  onTranscriptModeChange,
  onTextSizeChange,
  onSidePaneToggle,
}: {
  visible: boolean;
  titleBarHeight: number;
  transcriptMode: CodeTranscriptMode;
  textSize: CodeTextSize;
  sidePane: CodeSidePane | null;
  onTranscriptModeChange: (mode: CodeTranscriptMode) => void;
  onTextSizeChange: (size: CodeTextSize) => void;
  onSidePaneToggle: (pane: CodeSidePane) => void;
}) => {
  const [openMenu, setOpenMenu] = useState<'transcript' | 'views' | null>(null);
  const transcriptButtonRef = useRef<HTMLButtonElement>(null);
  const viewsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!visible) setOpenMenu(null);
  }, [visible]);

  if (!visible) return null;

  const viewsSections: CodeTopbarSection[] = [
    {
      items: [
        ...sidePaneItems.map((item) => ({
          label: item.label,
          checked: sidePane === item.pane,
          icon: item.icon,
          action: () => onSidePaneToggle(item.pane),
        })),
      ],
    },
  ];

  return (
    <div
      className="absolute top-0 z-[2] flex items-center gap-[6px]"
      style={{
        height: `${titleBarHeight}px`,
        right: typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac') ? '18px' : '156px',
        WebkitAppRegion: 'no-drag',
        pointerEvents: 'auto',
      } as React.CSSProperties}
    >
      <CodeTopbarIconButton
        ref={transcriptButtonRef}
        label="Transcript view mode"
        active={openMenu === 'transcript'}
        onClick={() => setOpenMenu((current) => current === 'transcript' ? null : 'transcript')}
      >
        <NotebookText size={18} strokeWidth={1.8} />
      </CodeTopbarIconButton>
      <CodeTopbarIconButton
        ref={viewsButtonRef}
        label="Views"
        active={openMenu === 'views'}
        onClick={() => setOpenMenu((current) => current === 'views' ? null : 'views')}
      >
        <PanelRight size={19} strokeWidth={1.8} />
        <ChevronDown size={12} strokeWidth={1.8} className="ml-[1px]" />
      </CodeTopbarIconButton>
      <CodeTranscriptMenu
        anchorRef={transcriptButtonRef}
        open={openMenu === 'transcript'}
        transcriptMode={transcriptMode}
        textSize={textSize}
        onTranscriptModeChange={onTranscriptModeChange}
        onTextSizeChange={onTextSizeChange}
        onClose={() => setOpenMenu(null)}
      />
      <CodeTopbarMenu
        anchorRef={viewsButtonRef}
        open={openMenu === 'views'}
        width={230}
        sections={viewsSections}
        onClose={() => setOpenMenu(null)}
      />
    </div>
  );
};

const CodeTitleBreadcrumb = ({
  state,
  sidebarWidth,
  titleBarHeight,
  onOpenInEditor,
  onShowInFolder,
  onRename,
  onTogglePin,
  onArchive,
  onDelete,
}: {
  state: CodeHeaderState;
  sidebarWidth: number;
  titleBarHeight: number;
  onOpenInEditor: (editorType: string) => void;
  onShowInFolder: () => void;
  onRename: (title: string) => Promise<void> | void;
  onTogglePin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [openInSubmenu, setOpenInSubmenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [installedEditors, setInstalledEditors] = useState<CodeInstalledEditor[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuWidth = 280;
  const submenuWidth = 260;
  const noDragStyle = {
    WebkitAppRegion: 'no-drag',
    pointerEvents: 'auto',
  } as React.CSSProperties;
  const title = state.title && state.title !== 'New Conversation'
    ? state.title
    : 'General coding session';

  const refreshInstalledEditors = useCallback(async () => {
    const localSessions = getClaudeWebApi()?.LocalSessions;
    if (!localSessions?.getInstalledEditors) {
      setInstalledEditors([]);
      return;
    }
    try {
      const editors = await localSessions.getInstalledEditors(state.cwd);
      setInstalledEditors(Array.isArray(editors)
        ? editors
          .filter((editor) => editor?.installed && editor.type !== 'xcode')
          .sort((left, right) => left.name.localeCompare(right.name))
        : []);
    } catch (error) {
      console.error('Failed to load installed editors:', error);
      setInstalledEditors([]);
    }
  }, [state.cwd]);

  useEffect(() => {
    refreshInstalledEditors();
  }, [refreshInstalledEditors]);

  useEffect(() => {
    if (open) refreshInstalledEditors();
  }, [open, refreshInstalledEditors]);

  useEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  useEffect(() => {
    if (!open) return;
    const updateMenuPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
      const top = Math.max(8, Math.min(window.innerHeight - 8, rect.bottom + 6));
      setMenuPosition({ left, top });
    };
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  const runAction = useCallback((action: () => void) => {
    setOpen(false);
    setOpenInSubmenu(false);
    action();
  }, []);

  const openInItems = useMemo(() => {
    if (!state.cwd) return [];
    return [
      ...installedEditors
        .map((editor) => ({
          label: editor.name,
          action: () => onOpenInEditor(editor.type),
        })),
      {
        label: 'Finder',
        action: onShowInFolder,
      },
    ];
  }, [installedEditors, onOpenInEditor, onShowInFolder, state.cwd]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
      setOpenInSubmenu(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        setOpenInSubmenu(false);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      if (openInSubmenu) {
        const itemIndex = Number.parseInt(event.key, 10) - 1;
        const item = openInItems[itemIndex];
        if (item) {
          event.preventDefault();
          event.stopPropagation();
          runAction(item.action);
        }
        return;
      }
      const action = shortcutActions.get(event.key.toLowerCase());
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      action();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, openInSubmenu, openInItems, runAction]);

  const startRename = () => {
    setOpen(false);
    setOpenInSubmenu(false);
    setDraftTitle(title);
    setIsEditingTitle(true);
  };

  const submitRename = async () => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === title) {
      setIsEditingTitle(false);
      return;
    }

    try {
      await onRename(nextTitle);
      setIsEditingTitle(false);
    } catch (err) {
      console.error('Failed to rename code session:', err);
    }
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitRename();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsEditingTitle(false);
    }
  };

  const shortcutActions = new Map<string, () => void>([
    ['p', () => runAction(onTogglePin)],
    ['u', () => runAction(() => {})],
    ['r', startRename],
    ['f', () => runAction(() => {})],
    ['a', () => runAction(onArchive)],
    ['d', () => runAction(onDelete)],
  ]);

  const menuItems: Array<{
    label?: string;
    shortcut?: string;
    separator?: boolean;
    danger?: boolean;
    action?: () => void;
  }> = [
    { label: state.pinned ? 'Unpin' : 'Pin', shortcut: 'P', action: onTogglePin },
    { label: 'Mark as unread', shortcut: 'U', action: () => {} },
    { label: 'Rename', shortcut: 'R', action: startRename },
    { label: 'Fork', shortcut: 'F', action: () => {} },
    { separator: true },
    { label: 'Archive', shortcut: 'A', action: onArchive },
    { label: 'Delete', shortcut: 'D', danger: true, action: onDelete },
  ];

  const menu = open && menuPosition ? createPortal(
    <div
      ref={menuRef}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        ...noDragStyle,
        position: 'fixed',
        left: `${menuPosition.left}px`,
        top: `${menuPosition.top}px`,
        width: `${menuWidth}px`,
        zIndex: 10000,
      }}
      className="overflow-visible rounded-[12px] border border-[#e5e1da] bg-white py-[8px] text-[14px] font-normal text-[#2f2f2c] shadow-[0_14px_38px_rgba(0,0,0,0.14)]"
    >
      {openInItems.length > 0 ? (
        <>
          <button
            type="button"
            onMouseEnter={() => setOpenInSubmenu(true)}
            onFocus={() => setOpenInSubmenu(true)}
            onClick={(event) => {
              event.preventDefault();
              setOpenInSubmenu(true);
            }}
            style={noDragStyle}
            className="flex h-[38px] w-full items-center justify-between px-[20px] text-left transition-colors hover:bg-[#f4f3f0]"
          >
            <span>Open in</span>
            <span className="text-[#2f2f2c]">›</span>
          </button>
          <div className="my-[6px] h-px bg-[#ece8e1]" />
        </>
      ) : null}
      {menuItems.map((item, index) => (
        item.separator ? (
          <div key={`sep-${index}`} className="my-[6px] h-px bg-[#ece8e1]" />
        ) : (
          <button
            key={item.label || index}
            type="button"
            onMouseEnter={() => setOpenInSubmenu(false)}
            onFocus={() => setOpenInSubmenu(false)}
            onClick={() => {
              item.action && runAction(item.action);
            }}
            style={noDragStyle}
            className={`flex h-[38px] w-full items-center justify-between px-[20px] text-left transition-colors hover:bg-[#f4f3f0] ${item.danger ? 'text-[#ff3b30]' : 'text-[#2f2f2c]'}`}
          >
            <span>{item.label}</span>
            <span className="text-[#8a8781]">{item.shortcut}</span>
          </button>
        )
      ))}
      {openInSubmenu && openInItems.length > 0 ? (
        <div
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            ...noDragStyle,
            position: 'absolute',
            left: `${menuWidth - 4}px`,
            top: '0px',
            width: `${submenuWidth}px`,
          }}
          className="overflow-hidden rounded-[12px] border border-[#e5e1da] bg-white py-[8px] text-[14px] font-normal text-[#2f2f2c] shadow-[0_14px_38px_rgba(0,0,0,0.14)]"
        >
          {openInItems.map((item, index) => (
            <button
              key={`${item.label}-${index}`}
              type="button"
              onClick={() => runAction(item.action)}
              style={noDragStyle}
              className="flex h-[38px] w-full items-center justify-between px-[24px] text-left transition-colors hover:bg-[#f4f3f0]"
            >
              <span>{item.label}</span>
              <span className="text-[#8a8781]">{index < 9 ? index + 1 : ''}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    document.body,
  ) : null;

  return (
    <div
      className="absolute top-0 right-0 flex h-full items-center"
      style={{
        left: `${sidebarWidth}px`,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div
        className="relative flex min-w-0 items-center pl-[28px] text-[14px] font-medium leading-none text-[#2f2f2c]"
        style={{
          height: `${titleBarHeight}px`,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <div className="flex min-w-0 items-center gap-[7px]">
          <Folder size={15} strokeWidth={1.8} className="shrink-0 text-[#2f2f2c]" />
          <span className="shrink-0">base</span>
          <span className="shrink-0 text-[#6f6c66]">/</span>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={submitRename}
              onKeyDown={handleRenameKeyDown}
              style={noDragStyle}
              className="h-[28px] w-[260px] rounded-[7px] border border-[#d8d3cb] bg-white px-[8px] text-[14px] font-medium leading-none text-[#2f2f2c] outline-none shadow-[0_0_0_3px_rgba(70,130,180,0.12)]"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={startRename}
              style={noDragStyle}
              className="max-w-[260px] truncate rounded-[6px] px-[2px] text-left hover:bg-[#f0efec]"
              title={title}
            >
              {title}
            </button>
          )}
        </div>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-label="Session actions"
          onClick={() => {
            setOpen((value) => {
              const next = !value;
              if (!next) setOpenInSubmenu(false);
              return next;
            });
          }}
          style={noDragStyle}
          className={`ml-[4px] inline-flex h-[28px] w-[28px] items-center justify-center rounded-[8px] text-[#77746f] transition-colors ${open ? 'bg-[#efeeeb]' : 'hover:bg-[#f0efec]'}`}
        >
          <ChevronDown size={13} strokeWidth={1.8} />
        </button>
        {menu}
      </div>
    </div>
  );
};

const Layout = () => {
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<Array<{
    id: number;
    title: string;
    content: string;
    created_at: string;
    updated_at?: string;
  }>>([]);
  const [activeAnnouncementId, setActiveAnnouncementId] = useState<number | null>(null);
  const [isMarkingAnnouncementRead, setIsMarkingAnnouncementRead] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newChatKey, setNewChatKey] = useState(0);
  const [codeTranscriptMode, setCodeTranscriptMode] = useState<CodeTranscriptMode>('normal');
  const [codeTextSize, setCodeTextSize] = useState<CodeTextSize>(getInitialCodeTextSize);
  const [codeSidePane, setCodeSidePane] = useState<CodeSidePane | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('onboarding_done'));
  const [needsGitBash, setNeedsGitBash] = useState(false);

  // Check for git-bash on Windows (required by Claude Code SDK)
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const status = await getSystemStatus();
        if (cancelled) return;
        if (status.gitBash.required && !status.gitBash.found) {
          setNeedsGitBash(true);
        }
      } catch {
        // Bridge server not ready yet — retry shortly
        if (!cancelled) setTimeout(check, 1500);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  // Document panel state
  const [documentPanelDoc, setDocumentPanelDoc] = useState<DocumentInfo | null>(null);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [artifacts, setArtifacts] = useState<DocumentInfo[]>([]);
  const [documentPanelWidth, setDocumentPanelWidth] = useState(50); // percent of remaining space (1:1 default)
  const [isChatMode, setIsChatMode] = useState(false);
  const [currentChatTitle, setCurrentChatTitle] = useState('');
  const sidebarWasCollapsedRef = useRef(false);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Detect macOS for traffic light padding
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.getPlatform) {
      api.getPlatform().then((p: string) => setIsMac(p === 'darwin'));
    }
  }, []);

  // Title bar height adjusts inversely to zoom so it stays visually constant
  const [titleBarHeight, setTitleBarHeight] = useState(44);
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.onZoomChanged) {
      api.onZoomChanged((factor: number) => {
        setTitleBarHeight(Math.round(44 / factor));
      });
    }
  }, []);

  const location = useLocation();
  const navigate = useNavigate();
  const isCodeSection = location.pathname.startsWith('/code');
  const isCodeSessionRoute = /^\/code\/[^/]+/.test(location.pathname)
    && location.pathname !== '/code/scheduled'
    && location.pathname !== '/code/customize';
  const activeCodeConversationId = isCodeSessionRoute ? location.pathname.split('/')[2] : null;

  // Navigation history for back/forward buttons
  const [navHistory, setNavHistory] = useState<string[]>([location.pathname + location.search + location.hash]);
  const [navIndex, setNavIndex] = useState(0);
  const isNavAction = useRef(false);
  const [codeHeaderState, setCodeHeaderState] = useState<CodeHeaderState>({
    cwd: null,
    title: '',
    pinned: false,
  });

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    if (isNavAction.current) {
      isNavAction.current = false;
      return;
    }
    setNavHistory(prev => {
      const trimmed = prev.slice(0, navIndex + 1);
      if (trimmed[trimmed.length - 1] === fullPath) return trimmed;
      return [...trimmed, fullPath];
    });
    setNavIndex(prev => {
      const trimmed = navHistory.slice(0, prev + 1);
      if (trimmed[trimmed.length - 1] === fullPath) return prev;
      return trimmed.length;
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const redirectMap: Record<string, string> = {
      '/': '/task/new',
      '/new': '/task/new',
      '/chats': '/task/new',
      '/projects': '/cowork/projects',
      '/customize': '/cowork/customize',
      '/artifacts': '/task/new',
    };

    const exactTarget = redirectMap[location.pathname];
    if (exactTarget) {
      navigate(exactTarget, { replace: true });
      return;
    }

    if (location.pathname.startsWith('/chat/')) {
      navigate('/task/new', { replace: true });
    }
  }, [location.pathname, navigate]);

  const canGoBack = navIndex > 0;
  const canGoForward = navIndex < navHistory.length - 1;

  const handleNavBack = () => {
    if (!canGoBack) return;
    isNavAction.current = true;
    const newIndex = navIndex - 1;
    setNavIndex(newIndex);
    navigate(navHistory[newIndex]);
  };

  const handleNavForward = () => {
    if (!canGoForward) return;
    isNavAction.current = true;
    const newIndex = navIndex + 1;
    setNavIndex(newIndex);
    navigate(navHistory[newIndex]);
  };

  useEffect(() => {
    setShowSettings(false);
    setShowUpgrade(false);
    setDocumentPanelDoc(null);
    setShowArtifacts(false);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    if (!activeCodeConversationId) {
      setCodeHeaderState({ cwd: null, title: '', pinned: false });
      setCodeSidePane(null);
      return () => { cancelled = true; };
    }

    getConversation(activeCodeConversationId)
      .then((data) => {
        if (!cancelled) {
          setCodeHeaderState({
            cwd: data?.code_cwd || null,
            title: data?.title || '',
            pinned: !!data?.pinned,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setCodeHeaderState({ cwd: null, title: '', pinned: false });
      });

    return () => { cancelled = true; };
  }, [activeCodeConversationId, refreshTrigger]);

  useEffect(() => {
    if (!isCodeSessionRoute) setCodeSidePane(null);
  }, [isCodeSessionRoute]);

  // Listen for open-upgrade event from MainContent paywall
  useEffect(() => {
    const handler = () => { setShowUpgrade(true); setShowSettings(false); };
    window.addEventListener('open-upgrade', handler);
    return () => window.removeEventListener('open-upgrade', handler);
  }, []);

  // Collapse sidebar on Customize page (Removed per user request)
  useEffect(() => {
    // Intentionally empty: do not collapse left sidebar automatically
  }, [location.pathname]);

  const loadUnreadAnnouncements = useCallback(async () => {
    try {
      const data = await getUnreadAnnouncements();
      setUnreadAnnouncements(Array.isArray(data?.announcements) ? data.announcements : []);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    }
  }, []);

  useEffect(() => {
    loadUnreadAnnouncements();

    const intervalId = window.setInterval(() => {
      loadUnreadAnnouncements();
    }, 15000);

    const handleFocus = () => {
      loadUnreadAnnouncements();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadUnreadAnnouncements();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadUnreadAnnouncements]);

  useEffect(() => {
    if (unreadAnnouncements.length === 0) {
      if (activeAnnouncementId !== null) setActiveAnnouncementId(null);
      return;
    }

    if (activeAnnouncementId === null || !unreadAnnouncements.some(item => item.id === activeAnnouncementId)) {
      setActiveAnnouncementId(unreadAnnouncements[0].id);
    }
  }, [unreadAnnouncements, activeAnnouncementId]);

  const activeAnnouncement = unreadAnnouncements.find(item => item.id === activeAnnouncementId) || null;

  const handleAnnouncementRead = useCallback(async () => {
    if (!activeAnnouncement || isMarkingAnnouncementRead) return;

    setIsMarkingAnnouncementRead(true);
    try {
      await markAnnouncementRead(activeAnnouncement.id);
      setUnreadAnnouncements(prev => prev.filter(item => item.id !== activeAnnouncement.id));
    } catch (err: any) {
      alert(err?.message || '公告已读失败，请稍后重试');
    } finally {
      setIsMarkingAnnouncementRead(false);
    }
  }, [activeAnnouncement, isMarkingAnnouncementRead]);

  const refreshSidebar = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCodeTitleOpenInEditor = useCallback(async (editorType: string) => {
    const folder = codeHeaderState.cwd;
    const localSessions = getClaudeWebApi()?.LocalSessions;
    if (!folder || !localSessions?.openInEditor) return;
    await localSessions.openInEditor(folder, editorType, undefined, undefined);
  }, [codeHeaderState.cwd]);

  const handleCodeTitleShowInFolder = useCallback(async () => {
    const folder = codeHeaderState.cwd;
    if (!folder) return;
    const fileSystem = getClaudeWebApi()?.FileSystem;
    if (fileSystem?.showInFolder) {
      await fileSystem.showInFolder(folder).catch(() => {});
    }
  }, [codeHeaderState.cwd]);

  const handleCodeTranscriptModeChange = useCallback((mode: CodeTranscriptMode) => {
    setCodeTranscriptMode(mode);
    dispatchCodeSessionUiEvent({ type: 'setTranscriptMode', mode });
  }, []);

  const handleCodeTextSizeChange = useCallback((size: CodeTextSize) => {
    window.localStorage.setItem(CODE_TEXT_SIZE_STORAGE_KEY, size);
    setCodeTextSize(size);
    dispatchCodeSessionUiEvent({ type: 'setTextSize', size });
  }, []);

  const handleCodeSidePaneToggle = useCallback((pane: CodeSidePane) => {
    const next = codeSidePane === pane ? null : pane;
    setCodeSidePane(next);
    dispatchCodeSessionUiEvent(next ? { type: 'toggleSidePane', pane: next } : { type: 'closeSidePane' });
  }, [codeSidePane]);

  useEffect(() => addCodeSessionUiListener((event) => {
    if (event.type === 'closeSidePane') setCodeSidePane(null);
    if (event.type === 'toggleSidePane') setCodeSidePane(event.pane);
    if (event.type === 'setTranscriptMode') setCodeTranscriptMode(event.mode);
    if (event.type === 'setTextSize') {
      window.localStorage.setItem(CODE_TEXT_SIZE_STORAGE_KEY, event.size);
      setCodeTextSize(event.size);
    }
  }), []);

  const handleCodeTitleRename = useCallback(async (title: string) => {
    if (!activeCodeConversationId) return;

    try {
      await updateConversation(activeCodeConversationId, { title });
      setCodeHeaderState((prev) => ({ ...prev, title }));
      refreshSidebar();
      window.dispatchEvent(new CustomEvent('conversationTitleUpdated'));
    } catch (err) {
      console.error('Failed to rename code session:', err);
    }
  }, [activeCodeConversationId]);

  const handleCodeTitleTogglePin = useCallback(() => {
    setCodeHeaderState((prev) => ({ ...prev, pinned: !prev.pinned }));
  }, []);

  const handleCodeTitleArchive = useCallback(() => {
    // Conversation archive is not persisted by the current local bridge yet.
    // Keep the official menu surface visible without changing storage semantics.
  }, []);

  const handleCodeTitleDelete = useCallback(async () => {
    if (!activeCodeConversationId) return;
    try {
      await deleteConversation(activeCodeConversationId);
      refreshSidebar();
      navigate('/code');
    } catch (err) {
      console.error('Failed to delete code session:', err);
    }
  }, [activeCodeConversationId, navigate]);

  const handleNewChat = () => {
    setNewChatKey(prev => prev + 1);
    setRefreshTrigger(prev => prev + 1);
    setShowSettings(false);
    setShowUpgrade(false);
    setDocumentPanelDoc(null);
    setShowArtifacts(false);
  };

  const handleOpenDocument = useCallback((doc: DocumentInfo) => {
    if (!documentPanelDoc && !showArtifacts) {
      sidebarWasCollapsedRef.current = isSidebarCollapsed;
    }
    setShowArtifacts(false);
    setIsSidebarCollapsed(true);
    setDocumentPanelDoc(doc);
  }, [isSidebarCollapsed, documentPanelDoc, showArtifacts]);

  const handleCloseDocument = useCallback(() => {
    setDocumentPanelDoc(null);
    if (!showArtifacts) {
      setIsSidebarCollapsed(sidebarWasCollapsedRef.current);
    }
  }, [showArtifacts]);

  const handleArtifactsUpdate = useCallback((docs: DocumentInfo[]) => {
    setArtifacts(docs);
  }, []);

  const handleOpenArtifacts = useCallback(() => {
    if (showArtifacts) {
      setShowArtifacts(false);
      // Restore sidebar state if it was collapsed by us?
      // For now, simple toggle close.
      if (!documentPanelDoc) {
        setIsSidebarCollapsed(sidebarWasCollapsedRef.current);
      }
      return;
    }

    if (!documentPanelDoc) {
      sidebarWasCollapsedRef.current = isSidebarCollapsed;
    }
    setIsSidebarCollapsed(true);
    setShowArtifacts(true);
    setDocumentPanelDoc(null);
  }, [isSidebarCollapsed, documentPanelDoc, showArtifacts]);

  const handleCloseArtifacts = useCallback(() => {
    setShowArtifacts(false);
    setIsSidebarCollapsed(sidebarWasCollapsedRef.current);
  }, []);

  const handleChatModeChange = useCallback((isChat: boolean) => {
    setIsChatMode(isChat);
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    setCurrentChatTitle(title);
  }, []);

  // Layout Tuner State
  const [tunerConfig, setTunerConfig] = useState({
    sidebarWidth: 288, // tuned value
    recentsMt: 24,
    profilePy: 10,
    profilePx: 12,
    mainContentWidth: 773, // tuned value
    mainContentMt: -100,
    inputRadius: 24,
    welcomeSize: 46,
    welcomeMb: 34,

    recentsFontSize: 14,
    recentsItemPy: 7,
    recentsPl: 6,
    userAvatarSize: 36,
    userNameSize: 15,
    headerPy: 0,

    // Toggle Button (Independent Position)
    toggleSize: 28,
    toggleAbsRight: 10,
    toggleAbsTop: 11,
    toggleAbsLeft: 8, // Collapsed State Left Position
  });
  const effectiveSidebarWidth = isSidebarCollapsed ? 46 : isCodeSection ? 302 : (tunerConfig.sidebarWidth || 280);

  // Git-bash required (Windows): block app until installed
  if (needsGitBash) {
    return <GitBashRequiredModal onResolved={() => setNeedsGitBash(false)} />;
  }

  // Onboarding: show on first launch
  if (showOnboarding) {
    return <Onboarding onComplete={() => {
      setShowOnboarding(false);
    }} />;
  }

  return (
    <>
      <div className="relative flex w-full h-screen overflow-hidden bg-claude-bg font-sans antialiased">
        {/* Custom Solid Title Bar (Unified Full Width) */}
        <div
          className="absolute top-0 left-0 w-full z-50 flex items-center select-none pointer-events-none bg-claude-bg border-b border-claude-border transition-all duration-300"
          style={{ WebkitAppRegion: 'drag', height: `${titleBarHeight}px` } as React.CSSProperties}
        >
          {/* Left Controls inside Title Bar — extra padding on Mac for traffic lights */}
          <div
            className="h-full flex items-center pr-2 gap-0.5"
            style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag', paddingLeft: isMac ? '78px' : '4px' } as React.CSSProperties}
          >
            <Tooltip text="Menu">
              <button
                onClick={() => { }}
                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-md text-claude-textSecondary hover:text-claude-text transition-colors"
              >
                <Menu size={18} className="opacity-80" />
              </button>
            </Tooltip>
            <Tooltip text={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-md text-claude-textSecondary hover:text-claude-text transition-colors"
              >
                <IconSidebarToggle size={26} className="dark:invert transition-[filter] duration-200" />
              </button>
            </Tooltip>
            {canGoBack ? (
              <Tooltip text="Back">
                <button
                  onClick={handleNavBack}
                  className="p-1.5 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: '#73726C' }}
                >
                  <ArrowLeft size={16} strokeWidth={1.5} />
                </button>
              </Tooltip>
            ) : (
              <span className="p-1.5" style={{ color: '#B7B5B0' }}>
                <ArrowLeft size={16} strokeWidth={1.5} />
              </span>
            )}
            {canGoForward ? (
              <Tooltip text="Forward">
                <button
                  onClick={handleNavForward}
                  className="p-1.5 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: '#73726C' }}
                >
                  <ArrowRight size={16} strokeWidth={1.5} />
                </button>
              </Tooltip>
            ) : (
              <span className="p-1.5" style={{ color: '#B7B5B0' }}>
                <ArrowRight size={16} strokeWidth={1.5} />
              </span>
            )}
          </div>

          {/* Mode tabs moved to sidebar */}
          {isCodeSessionRoute && !showSettings && !showUpgrade ? (
            <>
              <CodeTitleBreadcrumb
                state={codeHeaderState}
                onArchive={handleCodeTitleArchive}
                onDelete={handleCodeTitleDelete}
                onOpenInEditor={handleCodeTitleOpenInEditor}
                onShowInFolder={handleCodeTitleShowInFolder}
                onRename={handleCodeTitleRename}
                onTogglePin={handleCodeTitleTogglePin}
                sidebarWidth={effectiveSidebarWidth}
                titleBarHeight={titleBarHeight}
              />
              <CodeSessionTopActions
                visible
                titleBarHeight={titleBarHeight}
                transcriptMode={codeTranscriptMode}
                textSize={codeTextSize}
                sidePane={codeSidePane}
                onTranscriptModeChange={handleCodeTranscriptModeChange}
                onTextSizeChange={handleCodeTextSizeChange}
                onSidePaneToggle={handleCodeSidePaneToggle}
              />
            </>
          ) : null}
        </div>

        <Sidebar
          isCollapsed={isSidebarCollapsed}
          toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          refreshTrigger={refreshTrigger}
          onOpenSettings={() => { setShowSettings(true); setShowUpgrade(false); }}
          onOpenUpgrade={() => { setShowUpgrade(true); setShowSettings(false); }}
          onCloseOverlays={() => { setShowSettings(false); setShowUpgrade(false); }}
          tunerConfig={tunerConfig}
          setTunerConfig={setTunerConfig}
        />

        {/* Unified Content Wrapper - takes remaining space after sidebar */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative" style={{ paddingTop: `${titleBarHeight}px` }}>
          {/* Header - moved to allow conditional placement (Full Width Mode) */}
          {isChatMode && (showArtifacts && !documentPanelDoc) && !showSettings && !showUpgrade && (
            <ChatHeader
              title={currentChatTitle}
              showArtifacts={showArtifacts}
              documentPanelDoc={documentPanelDoc}
              onOpenArtifacts={handleOpenArtifacts}
              hasArtifacts={artifacts.length > 0}
              onTitleRename={handleTitleChange}
            />
          )}

          <div className="flex-1 flex overflow-hidden relative" ref={contentContainerRef}>

            {/* Main Content Area - takes remaining width after panel */}
            <div className="flex-1 flex flex-col h-full min-w-0">
              {/* Header - Only render here if NOT in Artifacts-only mode */}
              {isChatMode && (!showArtifacts || documentPanelDoc) && !showSettings && !showUpgrade && !location.pathname.startsWith('/cowork') && !location.pathname.startsWith('/code') && !location.pathname.startsWith('/task/') && location.pathname !== '/task' && location.pathname !== '/scheduled' && (
                <ChatHeader
                  title={currentChatTitle}
                  showArtifacts={showArtifacts}
                  documentPanelDoc={documentPanelDoc}
                  onOpenArtifacts={handleOpenArtifacts}
                  hasArtifacts={artifacts.length > 0}
                  onTitleRename={handleTitleChange}
                />
              )}

              {showSettings ? (
                <SettingsPage onClose={() => setShowSettings(false)} />
              ) : showUpgrade ? (
                <UpgradePlan onClose={() => setShowUpgrade(false)} />
              ) : location.pathname === '/task/new' || location.pathname === '/cowork' ? (
                <CoworkPage />
              ) : location.pathname === '/cowork/projects' ? (
                <ProjectsPage />
              ) : location.pathname === '/cowork/customize' ? (
                <CustomizePage onCreateWithClaude={() => {
                  sessionStorage.setItem('prefill_input', '让我们一起使用你的 skill-creator skill 来创建一个 skill 吧。请先问我这个 skill 应该做什么。');
                  navigate('/task/new');
                }} />
              ) : location.pathname === '/cowork/scheduled' ? (
                <ScheduledPage onNewTask={() => navigate('/task/new')} />
              ) : location.pathname === '/scheduled' ? (
                <ScheduledPage onNewTask={() => navigate('/task/new')} />
              ) : location.pathname === '/code/scheduled' ? (
                <ScheduledPage onNewTask={() => navigate('/code')} />
              ) : location.pathname === '/code/customize' ? (
                <CustomizePage onCreateWithClaude={() => {
                  sessionStorage.setItem('prefill_input', '让我们一起使用你的 skill-creator skill 来创建一个 skill 吧。请先问我这个 skill 应该做什么。');
                  navigate('/code');
                }} />
              ) : location.pathname === '/code' || location.pathname === '/code/' ? (
                <CodePage />
              ) : location.pathname.startsWith('/code/') ? (
                <CodeSessionPage onConversationUpdated={refreshSidebar} />
              ) : (
                <MainContent
                  onNewChat={refreshSidebar}
                  resetKey={newChatKey}
                  tunerConfig={tunerConfig}
                  onOpenDocument={handleOpenDocument}
                  onArtifactsUpdate={handleArtifactsUpdate}
                  onOpenArtifacts={handleOpenArtifacts}
                  onTitleChange={handleTitleChange}
                  onChatModeChange={handleChatModeChange}
                />
              )}
            </div>

            {/* Animated Document Panel Container */}
            <div
              className={`h-full bg-claude-bg transition-all duration-300 ease-out flex z-20 relative ${(documentPanelDoc || showArtifacts) ? 'border-l border-claude-border' : ''}`}
              style={{
                width: documentPanelDoc ? `${documentPanelWidth}%` : showArtifacts ? '360px' : '0px',
                opacity: (documentPanelDoc || showArtifacts) ? 1 : 0,
                overflow: 'hidden'
              }}
            >
              {documentPanelDoc && (
                <div className="absolute left-0 top-0 bottom-0 h-full z-50">
                  <DraggableDivider onResize={setDocumentPanelWidth} containerRef={contentContainerRef} />
                </div>
              )}
              <div className={`w-full h-full flex relative min-w-0 overflow-hidden`}>
                {(documentPanelDoc || showArtifacts) && (
                  <>
                    {documentPanelDoc ? (
                      <DocumentPanel document={documentPanelDoc} onClose={handleCloseDocument} />
                    ) : (
                      <ArtifactsPanel
                        documents={artifacts}
                        onClose={handleCloseArtifacts}
                        onOpenDocument={handleOpenDocument}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
      {activeAnnouncement && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#1F1F1F] shadow-2xl border border-black/5 dark:border-white/10">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-white/10">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 flex items-center justify-center shrink-0">
                <BellRing size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[18px] font-semibold text-gray-900 dark:text-white break-words">{activeAnnouncement.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  系统公告 · {activeAnnouncement.created_at?.slice(0, 16).replace('T', ' ') || ''}
                </p>
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words text-[15px] leading-7 text-gray-700 dark:text-gray-200">
                {activeAnnouncement.content}
              </div>
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                点击右下角“已读”后，后续将不再重复弹出这条公告。
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-white/10">
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {unreadAnnouncements.length > 1 ? `还有 ${unreadAnnouncements.length - 1} 条未读公告` : '暂无其他未读公告'}
              </div>
              <button
                onClick={handleAnnouncementRead}
                disabled={isMarkingAnnouncementRead}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMarkingAnnouncementRead ? '处理中...' : '已读'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="keys" element={<AdminKeyPool />} />
          <Route path="models" element={<AdminModels />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="redemption" element={<AdminRedemption />} />
        </Route>
        <Route path="/" element={<Navigate to="/task/new" replace />} />
        <Route path="/chats" element={<Navigate to="/task/new" replace />} />
        <Route path="/customize" element={<Navigate to="/cowork/customize" replace />} />
        <Route path="/projects" element={<Navigate to="/cowork/projects" replace />} />
        <Route path="/artifacts" element={<Navigate to="/task/new" replace />} />
        <Route path="/new" element={<Navigate to="/task/new" replace />} />
        <Route path="/task/new" element={<Layout />} />
        <Route path="/cowork" element={<Layout />} />
        <Route path="/cowork/projects" element={<Layout />} />
        <Route path="/cowork/customize" element={<Layout />} />
        <Route path="/cowork/scheduled" element={<Layout />} />
        <Route path="/scheduled" element={<Layout />} />
        <Route path="/code" element={<Layout />} />
        <Route path="/code/:id" element={<Layout />} />
        <Route path="/code/scheduled" element={<Layout />} />
        <Route path="/code/customize" element={<Layout />} />
        <Route path="/chat/:id" element={<Navigate to="/task/new" replace />} />
        <Route path="*" element={<Navigate to="/task/new" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
