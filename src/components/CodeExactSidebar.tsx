import type { CSSProperties, ReactNode, RefObject } from 'react';
import { ChevronDown, Circle, Clock3, Plus, SlidersVertical } from 'lucide-react';
import claudeImg from '../assets/icons/claude.png';
import sidebarModeCoworkIcon from '../assets/figma-exports/sidebar-icons/cowork-icon.svg';
import sidebarModeCodeIcon from '../assets/figma-exports/sidebar-icons/code-icon.svg';
import figmaCustomizeIcon from '../assets/figma-exports/sidebar-icons/customize-icon.svg';
import { COWORK_TOP_MODES } from '../data/coworkSpec';
import PillNav from './PillNav';

type ChatItem = {
  id: string;
  title?: string;
  updated_at?: string;
  created_at?: string;
  code_cwd?: string | null;
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

export default function CodeExactSidebar({
  chats,
  locationPathname,
  onNewSession,
  onOpenChat,
  onOpenCowork,
  onOpenCustomize,
  onOpenScheduled,
  onToggleUserMenu,
  userButtonRef,
}: CodeExactSidebarProps) {
  const isCodeRoot = locationPathname === '/code' || locationPathname === '/code/';
  const recentCodeChats = chats.slice(0, 18);
  const topModeItems = [
    {
      key: 'cowork',
      label: COWORK_TOP_MODES[0].label,
      icon: sidebarModeCoworkIcon,
      iconWidth: 19,
      iconHeight: 18,
      labelMaxWidth: 58,
      iconOpacity: 0.58,
      activeIconOpacity: 0.58,
      onSelect: onOpenCowork,
    },
    {
      key: 'code',
      label: COWORK_TOP_MODES[1].label,
      icon: sidebarModeCodeIcon,
      iconWidth: 18,
      iconHeight: 18,
      labelMaxWidth: 40,
      iconOpacity: 1,
    },
  ] as const;

  return (
    <div
      className="flex h-full min-h-[666px] w-full flex-col overflow-hidden bg-[#fbfbfa] p-1"
      style={{ fontFamily: '"Anthropic Sans", "Figtree", sans-serif' }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-[#ece8e0] bg-[#fcfbf8]">
        <div className="mb-2 mt-[52px] px-[9px]">
          <PillNav
            activeKey="code"
            className="sidebar-mode-switch"
            indicatorColor="#ffffff"
            items={[...topModeItems]}
            onItemSelect={(item) => item.onSelect?.(item)}
            textColor="#5f5b56"
            activeTextColor="#373734"
          />
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
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-2 px-2" style={sectionLabelStyle}>
              最近使用
            </div>
            <div className="sidebar-scroll flex-1 overflow-y-auto pb-3 pr-1">
              {recentCodeChats.length > 0 ? (
                <div className="space-y-px">
                  {recentCodeChats.map((chat) => {
                    const isActive = locationPathname === `/code/${chat.id}`;
                    const meta = formatCompactTime(chat.updated_at || chat.created_at);

                    return (
                      <button
                        className={`flex min-h-8 w-full items-center gap-3 rounded-[6px] px-2 py-[6px] text-left transition-colors ${
                          isActive ? 'bg-claude-hover' : 'hover:bg-claude-hover'
                        }`}
                        key={chat.id}
                        onClick={() => onOpenChat(chat.id)}
                        type="button"
                      >
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[#9d968d]">
                          <Circle size={7} strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate ${
                              isActive ? 'text-claude-text' : 'text-claude-textSecondary'
                            }`}
                            style={{
                              fontFamily: '"Anthropic Sans", "Figtree", sans-serif',
                              fontSize: '13px',
                              fontWeight: 400,
                              letterSpacing: '-0.08px',
                              lineHeight: '18px',
                            }}
                          >
                            {chat.title || 'General coding session'}
                          </span>
                        </span>
                        {meta ? (
                          <span className="shrink-0 text-[12px] leading-[16px] tracking-[-0.05px] text-[#9d968d]">
                            {meta}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
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
