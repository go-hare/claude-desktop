import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Chrome,
  Code2,
  CreditCard,
  FileText,
  Monitor,
  Package,
  Puzzle,
  Settings2,
  Shield,
  Sparkles,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { getUserProfile, getUserUsage, updateUserProfile } from '../api';
import ProviderSettings from './ProviderSettings';

interface SettingsPageProps {
  onClose: () => void;
}

type Tab =
  | 'general'
  | 'privacy'
  | 'members'
  | 'billing'
  | 'usage'
  | 'system-prompt'
  | 'capabilities'
  | 'connectors'
  | 'claude-code'
  | 'cowork'
  | 'browser-extension'
  | 'desktop'
  | 'desktop-extensions'
  | 'desktop-developer';

const WORK_OPTIONS = [
  '', '软件工程', '产品管理', '数据科学', '市场营销', '设计', '研究', '教育', '金融', '法律', '医疗健康', '其他',
];

const CHAT_FONTS = [
  { value: 'default', label: 'Anthropic Serif' },
  { value: 'sans', label: 'Anthropic Sans' },
  { value: 'system', label: '跟随系统' },
  { value: 'dyslexic', label: 'Dyslexic friendly' },
];

const navGroups: Array<{ title?: string; items: Array<{ id: Tab; label: string; icon: React.ReactNode; badge?: string }> }> = [
  {
    items: [
      { id: 'general', label: 'General', icon: <Settings2 size={18} /> },
      { id: 'privacy', label: 'Privacy', icon: <Shield size={18} /> },
      { id: 'members', label: 'Members', icon: <Users size={18} /> },
      { id: 'billing', label: 'Billing', icon: <CreditCard size={18} /> },
      { id: 'usage', label: 'Usage', icon: <BarChart3 size={18} /> },
      { id: 'system-prompt', label: 'System prompt', icon: <FileText size={18} /> },
      { id: 'capabilities', label: 'Capabilities', icon: <Wrench size={18} /> },
      { id: 'connectors', label: 'Connectors', icon: <Puzzle size={18} /> },
      { id: 'claude-code', label: 'Claude Code', icon: <Code2 size={18} /> },
      { id: 'cowork', label: 'Cowork', icon: <Bot size={18} /> },
      { id: 'browser-extension', label: 'Claude in Chrome', icon: <Chrome size={18} />, badge: 'Beta' },
    ],
  },
  {
    title: 'Desktop app',
    items: [
      { id: 'desktop', label: 'General', icon: <Monitor size={18} /> },
      { id: 'desktop-extensions', label: 'Extensions', icon: <Package size={18} /> },
      { id: 'desktop-developer', label: 'Developer', icon: <Sparkles size={18} /> },
    ],
  },
];

const flagDefaults: Record<string, boolean> = {
  responseCompletions: true,
  codeNotifications: false,
  codePermissionRequests: false,
  securityScanEmails: false,
  dispatchMessages: false,
  artifacts: true,
  webSearch: true,
  codeExecution: true,
  extendedThinking: true,
  bypassPermissions: false,
  dockAttention: true,
  previewEnabled: true,
  previewPersistSession: false,
  coworkMemory: true,
  coworkDispatch: false,
  chromeEnabled: false,
  launchAtLogin: false,
  developerTools: false,
};

function readSettingsFlags() {
  try {
    return JSON.parse(localStorage.getItem('settings_flags') || '{}');
  } catch {
    return {};
  }
}

const SettingsPage = ({ onClose }: SettingsPageProps) => {
  const [tab, setTab] = useState<Tab>('general');
  const [profile, setProfile] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workFunction, setWorkFunction] = useState('');
  const [instructions, setInstructions] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'auto');
  const [chatFont, setChatFont] = useState(localStorage.getItem('chat_font') || 'default');
  const [voice, setVoice] = useState(localStorage.getItem('voice_preference') || 'none');
  const [systemPrompt, setSystemPrompt] = useState(localStorage.getItem('custom_system_prompt') || '');
  const [branchPrefix, setBranchPrefix] = useState(localStorage.getItem('cc_branch_prefix') || 'claude');
  const [worktreeLocation, setWorktreeLocation] = useState(localStorage.getItem('cc_worktree_location') || 'default');
  const [flags, setFlags] = useState<Record<string, boolean>>(() => ({
    ...flagDefaults,
    ...readSettingsFlags(),
  }));

  const isSelfHosted = localStorage.getItem('user_mode') === 'selfhosted';
  const initials = (fullName || profile?.nickname || 'U').trim().charAt(0).toUpperCase();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const p = isSelfHosted
          ? { ...JSON.parse(localStorage.getItem('user') || '{}'), ...JSON.parse(localStorage.getItem('user_profile') || '{}') }
          : await getUserProfile().then((data: any) => data?.user || data);
        setProfile(p);
        setFullName(p?.full_name || p?.nickname || '');
        setDisplayName(p?.display_name || p?.nickname || '');
        setWorkFunction(p?.work_function || '');
        setInstructions(p?.personal_preferences || p?.conversation_preferences || '');
        setTheme(p?.theme || localStorage.getItem('theme') || 'auto');
        setChatFont(p?.chat_font || localStorage.getItem('chat_font') || 'default');
      } catch {
        // Settings must remain usable when the local bridge is offline.
      }
    };

    loadProfile();
    getUserUsage().then(setUsage).catch(() => {});
  }, [isSelfHosted]);

  const pageTitle = useMemo(() => {
    for (const group of navGroups) {
      const item = group.items.find(i => i.id === tab);
      if (item) return item.label;
    }
    return 'Settings';
  }, [tab]);

  const saveProfile = async () => {
    const payload = {
      full_name: fullName,
      display_name: displayName,
      work_function: workFunction,
      personal_preferences: instructions,
      conversation_preferences: instructions,
      theme,
      chat_font: chatFont,
    };

    if (isSelfHosted) {
      localStorage.setItem('user_profile', JSON.stringify(payload));
      setProfile(payload);
    } else {
      await updateUserProfile(payload).catch(() => {});
    }
    window.dispatchEvent(new Event('userProfileUpdated'));
  };

  const setFlag = (key: string, value: boolean) => {
    const next = { ...flags, [key]: value };
    setFlags(next);
    localStorage.setItem('settings_flags', JSON.stringify(next));
  };

  const applyTheme = (value: string) => {
    setTheme(value);
    localStorage.setItem('theme', value);
    const root = document.documentElement;
    const dark = value === 'dark' || (value === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.classList.toggle('dark', dark);
    updateUserProfile({ theme: value }).catch(() => {});
  };

  const applyChatFont = (value: string) => {
    setChatFont(value);
    localStorage.setItem('chat_font', value);
    document.documentElement.setAttribute('data-chat-font', value);
    updateUserProfile({ chat_font: value }).catch(() => {});
  };

  const renderCurrentPage = () => {
    switch (tab) {
      case 'general': return renderGeneral();
      case 'privacy': return renderSimplePage('Privacy', [
        ['Data privacy controls', 'Manage how Claude can use account data and feature history.', 'privacyControls'],
        ['Memory', 'Allow Claude to reference saved preferences and context.', 'coworkMemory'],
      ]);
      case 'members': return renderMembers();
      case 'billing': return renderBilling();
      case 'usage': return renderUsage();
      case 'system-prompt': return renderSystemPrompt();
      case 'capabilities': return renderSimplePage('Capabilities', [
        ['Artifacts', 'Allow Claude to create interactive documents and previews.', 'artifacts'],
        ['Web search', 'Let Claude search the web when current information is useful.', 'webSearch'],
        ['Code execution and file creation', 'Claude can execute code and create or edit files when the task needs it.', 'codeExecution'],
        ['Extended thinking', 'Allow supported models to spend more time reasoning.', 'extendedThinking'],
      ]);
      case 'connectors': return renderConnectors();
      case 'claude-code': return renderClaudeCode();
      case 'cowork': return renderCowork();
      case 'browser-extension': return renderSimplePage('Claude in Chrome settings', [
        ['Enable Claude in Chrome', 'Allow Claude to help with browser pages when the extension is connected.', 'chromeEnabled'],
      ]);
      case 'desktop': return renderDesktop();
      case 'desktop-extensions': return renderExtensions();
      case 'desktop-developer': return renderDeveloper();
    }
  };

  return (
    <div className="relative flex h-full flex-1 overflow-hidden bg-claude-bg text-claude-text">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute right-8 top-6 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-claude-textSecondary hover:bg-claude-hover hover:text-claude-text"
      >
        <X size={18} />
      </button>

      <aside className="w-[260px] shrink-0 border-r border-claude-border/70 px-4 pt-14">
        <h2 className="px-3 pb-5 text-[22px] font-semibold tracking-[-0.01em]">Settings</h2>
        <div className="space-y-6">
          {navGroups.map((group, groupIndex) => (
            <div key={group.title || groupIndex}>
              {group.title && <div className="px-3 pb-2 text-[12px] font-medium text-claude-textSecondary">{group.title}</div>}
              <div className="space-y-1">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${
                      tab === item.id ? 'bg-claude-btn-hover text-claude-text' : 'text-claude-textSecondary hover:bg-claude-hover hover:text-claude-text'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center">{item.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge && <span className="rounded-md bg-claude-hover px-1.5 py-0.5 text-[11px]">{item.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="max-w-[860px] px-12 pb-32 pt-14">
          <h1 className="mb-8 text-[24px] font-semibold tracking-[-0.01em]">{pageTitle}</h1>
          {renderCurrentPage()}
        </div>
      </main>
    </div>
  );

  function renderGeneral() {
    return (
      <div className="space-y-10">
        <Section title="Profile">
          <Row label="Avatar" control={<div className="flex h-10 w-10 items-center justify-center rounded-full bg-claude-avatar text-[16px] font-medium text-claude-avatarText">{initials}</div>} />
          <Row label="Full name" control={<TextInput value={fullName} onChange={setFullName} onBlur={saveProfile} />} />
          <Row label="What should Claude call you?" control={<TextInput value={displayName} onChange={setDisplayName} onBlur={saveProfile} />} />
          <Row label="What best describes your work?" control={<Select value={workFunction} onChange={v => { setWorkFunction(v); setTimeout(saveProfile, 0); }} options={WORK_OPTIONS.map(v => ({ value: v, label: v || '选择' }))} />} />
          <Row
            label="Instructions for Claude"
            description="Claude 会在聊天和协作中参考这些内容，前提是它们符合 Anthropic 的使用准则。"
            control={<textarea value={instructions} onChange={e => setInstructions(e.target.value)} onBlur={saveProfile} rows={4} className="w-[440px] rounded-lg border border-claude-border bg-claude-input px-3 py-2.5 text-[14px] outline-none focus:border-[#387ee0]" placeholder="例如：解释尽量简洁直接" />}
          />
        </Section>

        <Section title="Preferences">
          <Row label="Appearance" control={<Segmented value={theme} options={['auto', 'light', 'dark']} labels={['Auto', 'Light', 'Dark']} onChange={applyTheme} />} />
          <Row label="Chat font" control={<Select value={chatFont} onChange={applyChatFont} options={CHAT_FONTS} />} />
          <Row label="Voice" control={<Select value={voice} onChange={v => { setVoice(v); localStorage.setItem('voice_preference', v); }} options={[{ value: 'none', label: 'Default' }, { value: 'warm', label: 'Warm' }, { value: 'bright', label: 'Bright' }]} />} />
        </Section>

        <Section title="Notifications">
          <ToggleRow label="Response completions" description="Get notified when Claude has finished a response. Useful for long-running tasks." flagKey="responseCompletions" />
          <ToggleRow label="Code notifications" description="Claude can choose to notify you about important updates from a Code session." flagKey="codeNotifications" />
          <ToggleRow label="Code permission requests" description="Get a push notification when Claude needs your approval to run a command in a Code session." flagKey="codePermissionRequests" />
          <ToggleRow label="Security scan emails" description="Get an email when a Claude Code security scan finishes." flagKey="securityScanEmails" />
          <ToggleRow label="Dispatch messages" description="Get a push notification on your phone when Claude messages you in Dispatch." flagKey="dispatchMessages" />
        </Section>
      </div>
    );
  }

  function renderSimplePage(title: string, rows: Array<[string, string, string]>) {
    return <Section title={title}>{rows.map(([label, description, key]) => <ToggleRow key={key} label={label} description={description} flagKey={key} />)}</Section>;
  }

  function renderConnectors() {
    return (
      <div className="space-y-6">
        <p className="max-w-[620px] text-[14px] leading-6 text-claude-textSecondary">Connect apps, services, and model providers so Claude can use more context.</p>
        <div className="overflow-hidden rounded-xl border border-claude-border bg-claude-bg">
          <ProviderSettings />
        </div>
      </div>
    );
  }

  function renderClaudeCode() {
    return (
      <Section title="Local sessions">
        <ToggleRow label="Allow bypass permissions mode" description="Bypass all permission checks and let Claude work uninterrupted. Use carefully." flagKey="bypassPermissions" />
        <ToggleRow label="Draw attention on notifications" description="Bounce the dock icon or flash the taskbar when Claude needs your attention and the app is not focused." flagKey="dockAttention" />
        <Row label="Worktree location" description="Where to store git worktrees for isolated coding sessions." control={<Select value={worktreeLocation} onChange={v => { setWorktreeLocation(v); localStorage.setItem('cc_worktree_location', v); }} options={[{ value: 'default', label: 'Inside project (.claude/worktrees)' }, { value: 'custom', label: 'Custom...' }]} />} />
        <Row label="Branch prefix" description="Prefix added to the beginning of every worktree branch name." control={<TextInput value={branchPrefix} onChange={v => { setBranchPrefix(v); localStorage.setItem('cc_branch_prefix', v); }} />} />
        <ToggleRow label="Preview" description="Claude can start dev servers, open a live preview, and verify code changes." flagKey="previewEnabled" />
        <ToggleRow label="Persist Preview sessions" description="Save cookies, local storage, and login sessions for dev server previews." flagKey="previewPersistSession" />
      </Section>
    );
  }

  function renderCowork() {
    return (
      <Section title="Cowork">
        <ToggleRow label="Use memory in sessions" description="Claude will read and update memories during Cowork sessions." flagKey="coworkMemory" />
        <ToggleRow label="Remote dispatch" description="Let Claude work on tasks from your phone using this computer." flagKey="coworkDispatch" />
        <Row label="Global instructions" control={<textarea rows={4} className="w-[440px] rounded-lg border border-claude-border bg-claude-input px-3 py-2.5 text-[14px] outline-none focus:border-[#387ee0]" placeholder="Add instructions for Claude to follow in all Cowork sessions..." />} />
      </Section>
    );
  }

  function renderDesktop() {
    return (
      <div className="space-y-10">
        <Section title="General">
          <ToggleRow label="Launch at login" description="Open Claude automatically when you sign in to this computer." flagKey="launchAtLogin" />
          <ToggleRow label="Persist preview sessions" description="Save cookies, local storage, and login sessions for dev server previews." flagKey="previewPersistSession" />
        </Section>
        <Section title="About">
          <Row label="Version" control={<span className="font-mono text-[14px]">v{__APP_VERSION__}</span>} />
        </Section>
      </div>
    );
  }

  function renderMembers() {
    return <Section title="Members"><EmptyState title="No team members in this local workspace." body="This desktop build does not have an organization member backend connected." /></Section>;
  }

  function renderBilling() {
    const mode = localStorage.getItem('user_mode') === 'selfhosted' ? 'Self-hosted' : 'Clawparrot';
    return <Section title="Billing"><Row label="Current mode" control={<span className="text-[14px]">{mode}</span>} /><EmptyState title="Billing is managed outside this local app." body="Use the connected account or provider portal for plan changes." /></Section>;
  }

  function renderUsage() {
    const quota = usage?.quota;
    return (
      <Section title="Usage">
        {quota ? <Row label="Monthly / total" control={<span className="text-[14px]">{quota.total.used} / {quota.total.limit}</span>} /> : <EmptyState title="No usage data available." body="Usage appears here when the connected backend exposes quota data." />}
      </Section>
    );
  }

  function renderSystemPrompt() {
    return (
      <Section title="System prompt">
        <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} onBlur={() => localStorage.setItem('custom_system_prompt', systemPrompt)} rows={10} className="w-full rounded-xl border border-claude-border bg-claude-input p-4 text-[14px] outline-none focus:border-[#387ee0]" placeholder="The following is a conversation between a human and an AI assistant..." />
      </Section>
    );
  }

  function renderExtensions() {
    return <Section title="Extensions"><EmptyState title="No extensions installed." body="Desktop extensions will appear here when this build exposes an extension registry." /></Section>;
  }

  function renderDeveloper() {
    return <Section title="Developer"><ToggleRow label="Developer tools" description="Show additional logs and debugging entry points in the desktop app." flagKey="developerTools" /></Section>;
  }

  function ToggleRow({ label, description, flagKey }: { label: string; description?: string; flagKey: string }) {
    return <Row label={label} description={description} control={<Toggle checked={!!flags[flagKey]} onChange={value => setFlag(flagKey, value)} />} />;
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section className="space-y-1 border-b border-claude-border pb-8 last:border-0">
        <h3 className="mb-4 text-[18px] font-semibold">{title}</h3>
        <div className="space-y-1">{children}</div>
      </section>
    );
  }

  function Row({ label, description, control }: { label: string; description?: string; control: React.ReactNode }) {
    return (
      <div className="flex min-h-[52px] items-center justify-between gap-8 py-2">
        <div className="min-w-0">
          <div className="text-[14px] font-medium">{label}</div>
          {description && <div className="mt-1 max-w-[520px] text-[13px] leading-5 text-claude-textSecondary">{description}</div>}
        </div>
        <div className="shrink-0">{control}</div>
      </div>
    );
  }

  function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
    return (
      <button type="button" onClick={() => onChange(!checked)} className={`relative h-6 w-10 rounded-full transition-colors ${checked ? 'bg-[#387ee0]' : 'bg-claude-border'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-1'}`} />
      </button>
    );
  }
};

const TextInput = ({ value, onChange, onBlur }: { value: string; onChange: (value: string) => void; onBlur?: () => void }) => (
  <input value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} className="h-9 w-56 rounded-lg border border-claude-border bg-claude-input px-3 text-[14px] outline-none focus:border-[#387ee0]" />
);

const Select = ({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className="h-9 w-56 rounded-lg border border-transparent bg-transparent px-3 text-[14px] outline-none hover:bg-claude-hover focus:border-[#387ee0]">
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>
);

const Segmented = ({ value, options, labels, onChange }: { value: string; options: string[]; labels: string[]; onChange: (value: string) => void }) => (
  <div className="inline-flex rounded-lg border border-claude-border bg-claude-input p-1">
    {options.map((option, index) => (
      <button key={option} type="button" onClick={() => onChange(option)} className={`rounded-md px-3 py-1.5 text-[13px] ${value === option ? 'bg-claude-bg text-claude-text shadow-sm' : 'text-claude-textSecondary hover:text-claude-text'}`}>
        {labels[index]}
      </button>
    ))}
  </div>
);

const EmptyState = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-xl border border-dashed border-claude-border p-6">
    <div className="text-[14px] font-medium">{title}</div>
    <div className="mt-1 text-[13px] leading-5 text-claude-textSecondary">{body}</div>
  </div>
);

export default SettingsPage;
