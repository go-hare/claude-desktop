import type { CSSProperties, ReactNode, RefObject } from 'react';
import { ChevronDown, Clock3, Plus, SlidersVertical } from 'lucide-react';
import claudeImg from '../assets/icons/claude.png';
import sidebarModeCoworkIcon from '../assets/figma-exports/sidebar-icons/cowork-icon.svg';
import sidebarModeCodeIcon from '../assets/figma-exports/sidebar-icons/code-icon.svg';
import figmaCustomizeIcon from '../assets/figma-exports/sidebar-icons/customize-icon.svg';

type ChatItem = {
  id: string;
  title?: string;
  updated_at?: string;
  created_at?: string;
};

interface CodeExactSidebarProps {
  chats: ChatItem[];
  locationPathname: string;
  onNewSession: () => void;
  onOpenChat: (id: string) => void;
  onOpenCowork: () => void;
  onOpenCustomize: () => void;
  onOpenScheduled: () => void;
  onOpenProjects: () => void;
  onOpenArtifacts: () => void;
  onToggleUserMenu: () => void;
  userButtonRef: RefObject<HTMLButtonElement | null>;
}

const itemLabelStyle: CSSProperties = {
  fontFamily: '"Anthropic Sans", "Figtree", sans-serif',
  fontSize: '14px',
  fontWeight: 400,
  lineHeight: '20px',
  letterSpacing: '-0.1504px',
};

const sectionLabelStyle: CSSProperties = {
  fontFamily: '"Anthropic Sans", "Figtree", sans-serif',
  fontSize: '13px',
  fontWeight: 500,
  lineHeight: '18px',
  letterSpacing: '-0.08px',
  color: 'var(--text-claude-secondary)',
};

function SidebarRow({
  active = false,
  disabled = false,
  icon,
  label,
  onClick,
  trailing,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-8 w-full items-center gap-3 rounded-[6px] px-2 py-[6px] text-left transition-colors ${
        active ? 'bg-[#f1efea]' : 'hover:bg-[#f5f3ef]'
      } ${disabled ? 'cursor-default opacity-80' : ''}`}
    >
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[#5f5b56]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[#2f2d2a]" style={itemLabelStyle}>
        {label}
      </span>
      {trailing ? <span className="flex-shrink-0 text-[#8d877f]">{trailing}</span> : null}
    </button>
  );
}

export default function CodeExactSidebar({
  chats: _chats,
  locationPathname,
  onNewSession,
  onOpenCowork,
  onOpenCustomize,
  onOpenScheduled,
  onToggleUserMenu,
  userButtonRef,
}: CodeExactSidebarProps) {
  const isCodeRoot = locationPathname === '/code' || locationPathname === '/code/';

  return (
    <div
      className="flex h-full min-h-[666px] w-full flex-col overflow-hidden bg-[#fbfbfa] p-1"
      style={{ fontFamily: '"Anthropic Sans", "Figtree", sans-serif' }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-[#ece8e0] bg-[#fcfbf8]">
        <div className="mb-2 mt-[52px] px-[9px]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="切换到 Cowork"
              onClick={onOpenCowork}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#7c756d] transition-colors hover:bg-[#f5f3ef]"
            >
              <img alt="" src={sidebarModeCoworkIcon} className="h-[15px] w-[15px] opacity-[0.58]" />
            </button>
            <div className="inline-flex h-8 items-center gap-2 rounded-[10px] bg-[#f1efea] px-3 text-[#2f2d2a]">
              <img alt="" src={sidebarModeCodeIcon} className="h-[15px] w-[15px]" />
              <span style={itemLabelStyle}>Code</span>
            </div>
          </div>
        </div>

        <div className="px-[9px] pt-[2px]">
          <nav className="space-y-px">
            <SidebarRow
              active={isCodeRoot}
              icon={<Plus size={16} strokeWidth={1.9} />}
              label="新会话"
              onClick={onNewSession}
              trailing={<span className="text-[12px]">⌘N</span>}
            />
            <SidebarRow
              icon={<Clock3 size={15} strokeWidth={1.8} />}
              label="计划任务"
              onClick={onOpenScheduled}
            />
            <SidebarRow
              icon={<img alt="" src={figmaCustomizeIcon} className="h-[14px] w-[14px] opacity-80" />}
              label="自定义"
              onClick={onOpenCustomize}
            />
            <SidebarRow
              icon={<ChevronDown size={15} strokeWidth={1.8} />}
              label="更多"
              onClick={() => {}}
            />
          </nav>
        </div>

        <div className="min-h-0 flex-1 px-[9px] pt-[18px]">
          <div className="mb-2 px-2" style={sectionLabelStyle}>
            最近使用
          </div>
          <div className="sidebar-scroll h-full overflow-y-auto pb-3 pr-1">
            <div className="h-8" />
          </div>
        </div>

        <div className="mt-auto px-[12px] py-[10px]">
          <button
            type="button"
            ref={userButtonRef}
            onClick={onToggleUserMenu}
            className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 transition-colors hover:bg-[#f5f3ef]"
          >
            <img alt="" src={claudeImg} className="h-7 w-7 flex-shrink-0 object-contain" />
            <span className="min-w-0 flex-1 truncate text-left text-[15px] font-medium leading-tight tracking-[-0.08px] text-[#2f2d2a]">
              Cowork 3P | Gateway
            </span>
            <span className="text-[#d5d0c9]">
              <SlidersVertical size={14} strokeWidth={1.8} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
