import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ExternalLink,
  Monitor,
  MousePointer2,
  Shuffle,
  Search,
  Shield,
  X,
} from 'lucide-react';
import {
  getThirdPartyInferenceConfig,
  getUserProfile,
  saveThirdPartyInferenceConfig,
  updateUserProfile
} from '../api';
import type {
  GatewayAuthScheme,
  ThirdPartyInferenceConfig,
} from '../api';

export const SETTINGS_TABS = [
  'connection',
  'sandbox',
  'telemetry',
  'limits',
  'plugins',
  'egress',
  'general',
  'privacy',
  'capabilities',
  'connectors',
  'claude-code',
  'cowork',
  'desktop',
  'desktop-extensions',
  'desktop-developer',
] as const;

export type SettingsTab = typeof SETTINGS_TABS[number];

interface SettingsPageProps {
  onClose: () => void;
  initialTab?: SettingsTab;
}

const WORK_OPTIONS = [
  'Product Management',
  'Engineering',
  'Human Resources',
  'Finance',
  'Marketing',
  'Sales',
  'Operations',
  'Data Science',
  'Design',
  'Legal',
  'Other',
];

const CHAT_FONT_OPTIONS = [
  { value: 'default', label: 'Anthropic Serif', userFont: '--font-sans-serif', claudeFont: '--font-serif' },
  { value: 'sans', label: 'Anthropic Sans', userFont: '--font-ui', claudeFont: '--font-ui' },
  { value: 'system', label: 'System', userFont: '--font-system', claudeFont: '--font-system' },
  { value: 'dyslexia', label: 'Dyslexic friendly', userFont: '--font-dyslexia', claudeFont: '--font-dyslexia' },
];

const navGroups: Array<{ title?: string; items: Array<{ id: SettingsTab; label: string; badge?: string }> }> = [
  {
    items: [
      { id: 'connection', label: 'Connection' },
      { id: 'sandbox', label: 'Sandbox & workspace' },
      { id: 'connectors', label: 'Connectors & extensions' },
      { id: 'telemetry', label: 'Telemetry & updates' },
      { id: 'limits', label: 'Usage limits' },
      { id: 'plugins', label: 'Plugins & skills' },
      { id: 'egress', label: 'Egress Requirements' },
    ],
  },
  {
    title: 'Claude',
    items: [
      { id: 'general', label: '一般' },
      { id: 'privacy', label: '隐私' },
      { id: 'capabilities', label: '技能' },
      { id: 'claude-code', label: 'Claude Code' },
      { id: 'cowork', label: 'Cowork' },
    ],
  },
  {
    title: '桌面应用',
    items: [
      { id: 'desktop', label: '一般' },
      { id: 'desktop-extensions', label: '扩展' },
      { id: 'desktop-developer', label: '开发者' },
    ],
  },
];

const defaultInferenceConfig: ThirdPartyInferenceConfig = {
  inferenceProvider: 'gateway',
  inferenceGatewayBaseUrl: '',
  inferenceGatewayApiKey: '',
  inferenceGatewayAuthScheme: 'bearer',
  inferenceGatewayHeaders: {},
  inferenceGatewayHeadersText: '',
  inferenceModels: [],
};

function parseHeadersText(text?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value) headers[key] = value;
  }
  return headers;
}

function formatHeadersText(headers?: Record<string, string>): string {
  return Object.entries(headers || {}).map(([key, value]) => `${key}: ${value}`).join('\n');
}

function inferenceConfigForJson(config: ThirdPartyInferenceConfig) {
  const headers = parseHeadersText(config.inferenceGatewayHeadersText);
  const next: Record<string, unknown> = {
    inferenceProvider: config.inferenceProvider,
    inferenceGatewayBaseUrl: config.inferenceGatewayBaseUrl,
    inferenceGatewayApiKey: config.inferenceGatewayApiKey ? '••••••••' : '',
    inferenceGatewayAuthScheme: config.inferenceGatewayAuthScheme,
  };
  if (Object.keys(headers).length > 0) next.inferenceGatewayHeaders = headers;
  if (config.inferenceModels?.length) next.inferenceModels = config.inferenceModels;
  return next;
}

function modelName(model: NonNullable<ThirdPartyInferenceConfig['inferenceModels']>[number]) {
  return typeof model === 'string' ? model : String(model?.name || '');
}

function modelSupports1m(model: NonNullable<ThirdPartyInferenceConfig['inferenceModels']>[number]) {
  return typeof model === 'string' ? /\[1m\]$/i.test(model) : !!model?.supports1m;
}

function normalizeInferenceModels(models: ThirdPartyInferenceConfig['inferenceModels']) {
  return (models || [])
    .map((model) => {
      const rawName = modelName(model).trim();
      if (!rawName) return null;
      const suffixMatch = rawName.match(/^(.+?)\[1m\]$/i);
      const name = suffixMatch ? suffixMatch[1].trim() : rawName;
      return { name, supports1m: suffixMatch ? true : modelSupports1m(model) };
    })
    .filter(Boolean) as Array<{ name: string; supports1m: boolean }>;
}

function formatInferenceModelsText(models: ThirdPartyInferenceConfig['inferenceModels']) {
  return normalizeInferenceModels(models)
    .map(model => `${model.name}${model.supports1m ? ' [1m]' : ''}`)
    .join('\n');
}

function parseInferenceModelsText(text: string) {
  return normalizeInferenceModels(
    text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean),
  );
}

const flagDefaults: Record<string, boolean> = {
  responseCompletions: true,
  dispatchMessages: false,
  modelTraining: false,
  privacyMemory: true,
  artifacts: true,
  aiArtifacts: false,
  inlineVisualizations: true,
  toolAccessWhenNeeded: true,
  csvSuggestions: true,
  driveCataloging: false,
  classifySessionStates: false,
  bypassPermissions: false,
  autoPermissions: false,
  dockAttention: true,
  systemTray: true,
  keepAwake: false,
  previewEnabled: true,
  previewPersistSession: false,
  createPullRequests: false,
  createDraftPullRequests: true,
  codeNotifications: false,
  codePermissionRequests: false,
  securityScanEmails: false,
  coworkMemory: true,
  launchAtLogin: false,
  extensionAutoUpdates: true,
  useBuiltInNode: true,
};

function readSettingsFlags() {
  try {
    return JSON.parse(localStorage.getItem('settings_flags') || '{}');
  } catch {
    return {};
  }
}

function normalizeChatFont(value: string | null | undefined) {
  return value === 'dyslexic' ? 'dyslexia' : value || 'default';
}

function normalizeTheme(value: string | null | undefined) {
  return value === 'system' ? 'auto' : value || 'auto';
}

function getStoredChatFont() {
  if (typeof window === 'undefined') return 'default';
  return normalizeChatFont(
    localStorage.getItem('customStyles:chatFont') ||
    localStorage.getItem('chat_font') ||
    'default'
  );
}

const SettingsPage = ({ onClose, initialTab = 'connection' }: SettingsPageProps) => {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [profile, setProfile] = useState<any>(null);
  const [avatar, setAvatar] = useState(0);
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workFunction, setWorkFunction] = useState('');
  const [instructions, setInstructions] = useState('');
  const [theme, setTheme] = useState(normalizeTheme(localStorage.getItem('theme')));
  const [chatFont, setChatFont] = useState(getStoredChatFont);
  const [branchPrefix, setBranchPrefix] = useState(localStorage.getItem('cc_branch_prefix') || 'claude');
  const [worktreeLocation, setWorktreeLocation] = useState(localStorage.getItem('cc_worktree_location') || 'default');
  const [coworkGlobalInstructions, setCoworkGlobalInstructions] = useState(localStorage.getItem('cowork_global_instructions') || '');
  const [editingCoworkInstructions, setEditingCoworkInstructions] = useState(false);
  const [showExtensionAdvanced, setShowExtensionAdvanced] = useState(false);
  const [inferenceConfig, setInferenceConfig] = useState<ThirdPartyInferenceConfig>(defaultInferenceConfig);
  const [inferenceModelsText, setInferenceModelsText] = useState('');
  const [inferenceConfigPath, setInferenceConfigPath] = useState('');
  const [inferenceLoading, setInferenceLoading] = useState(false);
  const [inferenceSaving, setInferenceSaving] = useState(false);
  const [inferenceStatus, setInferenceStatus] = useState('');
  const [showInferenceKey, setShowInferenceKey] = useState(false);
  const [showInferenceJson, setShowInferenceJson] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>(() => ({
    ...flagDefaults,
    ...readSettingsFlags(),
  }));

  const isSelfHosted = localStorage.getItem('user_mode') === 'selfhosted';
  const initials = (fullName || displayName || profile?.nickname || 'U').trim().charAt(0).toUpperCase();
  const settingsMode = theme === 'dark'
    || (theme === 'auto'
      && typeof window !== 'undefined'
      && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ? 'dark'
    : 'light';

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const p = isSelfHosted
          ? { ...JSON.parse(localStorage.getItem('user') || '{}'), ...JSON.parse(localStorage.getItem('user_profile') || '{}') }
          : await getUserProfile().then((data: any) => data?.user || data);
        setProfile(p);
        setAvatar(Number(p?.avatar || 0));
        setFullName(p?.full_name || p?.nickname || '');
        setDisplayName(p?.display_name || p?.nickname || '');
        setWorkFunction(p?.work_function || '');
        setInstructions(p?.personal_preferences || p?.conversation_preferences || '');
        setTheme(normalizeTheme(p?.theme || localStorage.getItem('theme')));
        setChatFont(normalizeChatFont(p?.chat_font || getStoredChatFont()));
      } catch {
        // Settings must remain usable when the local bridge is offline.
      }
    };

    loadProfile();
  }, [isSelfHosted]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let mounted = true;
    setInferenceLoading(true);
    getThirdPartyInferenceConfig()
      .then((data) => {
        if (!mounted) return;
        const inferenceModels = normalizeInferenceModels(data.config.inferenceModels);
        setInferenceConfig({
          ...defaultInferenceConfig,
          ...data.config,
          inferenceModels,
          inferenceGatewayHeadersText: data.config.inferenceGatewayHeadersText || formatHeadersText(data.config.inferenceGatewayHeaders),
        });
        setInferenceModelsText(formatInferenceModelsText(inferenceModels));
        setInferenceConfigPath(data.configPath);
      })
      .catch((error) => {
        if (mounted) setInferenceStatus(error.message || '配置加载失败');
      })
      .finally(() => {
        if (mounted) setInferenceLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const saveProfile = async (overrides: Partial<{
    avatar: number;
    full_name: string;
    display_name: string;
    work_function: string;
    personal_preferences: string;
    conversation_preferences: string;
    theme: string;
    chat_font: string;
  }> = {}) => {
    const payload = {
      full_name: overrides.full_name ?? fullName,
      display_name: overrides.display_name ?? displayName,
      work_function: overrides.work_function ?? workFunction,
      personal_preferences: overrides.personal_preferences ?? instructions,
      conversation_preferences: overrides.conversation_preferences ?? instructions,
      theme: overrides.theme ?? theme,
      chat_font: overrides.chat_font ?? chatFont,
      avatar: overrides.avatar ?? avatar,
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
    window.dispatchEvent(new CustomEvent('settingsFlagsUpdated', { detail: next }));
  };

  const applyTheme = (value: string) => {
    const next = normalizeTheme(value);
    setTheme(next);
    localStorage.setItem('theme', next);
    const root = document.documentElement;
    const dark = next === 'dark' || (next === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-mode', dark ? 'dark' : 'light');
    root.classList.toggle('dark', dark);
    saveProfile({ theme: next }).catch(() => {});
  };

  const applyChatFont = (value: string) => {
    const next = normalizeChatFont(value);
    const option = CHAT_FONT_OPTIONS.find(item => item.value === next) || CHAT_FONT_OPTIONS[0];
    setChatFont(next);
    localStorage.setItem('customStyles:chatFont', next);
    localStorage.setItem('chat_font', next);
    document.documentElement.style.setProperty('--font-user-message', `var(${option.userFont})`);
    document.documentElement.style.setProperty('--font-claude-response', `var(${option.claudeFont})`);
    document.documentElement.setAttribute('data-chat-font', next);
    saveProfile({ chat_font: next }).catch(() => {});
  };

  const updateInferenceConfig = (patch: Partial<ThirdPartyInferenceConfig>) => {
    setInferenceConfig(current => ({ ...current, ...patch }));
    setInferenceStatus('');
  };

  const applyThirdPartyInference = async () => {
    setInferenceSaving(true);
    setInferenceStatus('');
    try {
      const headers = parseHeadersText(inferenceConfig.inferenceGatewayHeadersText);
      const inferenceModels = parseInferenceModelsText(inferenceModelsText);
      const data = await saveThirdPartyInferenceConfig({
        ...inferenceConfig,
        inferenceGatewayHeaders: headers,
        inferenceModels,
      });
      const normalizedModels = normalizeInferenceModels(data.config.inferenceModels);
      setInferenceConfig({
        ...defaultInferenceConfig,
        ...data.config,
        inferenceModels: normalizedModels,
        inferenceGatewayHeadersText: data.config.inferenceGatewayHeadersText || formatHeadersText(data.config.inferenceGatewayHeaders),
      });
      setInferenceModelsText(formatInferenceModelsText(normalizedModels));
      setInferenceConfigPath(data.configPath);
      setInferenceStatus('已应用到本机 Claude-3p 配置。');
    } catch (error: any) {
      setInferenceStatus(error?.message || '保存失败');
    } finally {
      setInferenceSaving(false);
    }
  };

  const renderCurrentPage = () => {
    switch (tab) {
      case 'connection': return renderConnection();
      case 'sandbox': return renderPlaceholderSection('Sandbox & workspace', '控制 Claude Desktop 可以访问的工作区和沙箱行为。');
      case 'telemetry': return renderPlaceholderSection('Telemetry & updates', 'Prompts, completions, and your data are never sent to Anthropic — telemetry covers crash and usage signals only.');
      case 'limits': return renderPlaceholderSection('Usage limits', '查看并配置第三方推理的使用限制。');
      case 'plugins': return renderPlaceholderSection('Plugins & skills', '管理插件、技能和组织挂载目录。');
      case 'egress': return renderPlaceholderSection('Egress Requirements', '根据当前配置列出网络防火墙需要允许的主机。');
      case 'general': return renderGeneral();
      case 'privacy': return renderPrivacy();
      case 'capabilities': return renderCapabilities();
      case 'connectors': return renderConnectors();
      case 'claude-code': return renderClaudeCode();
      case 'cowork': return renderCowork();
      case 'desktop': return renderDesktop();
      case 'desktop-extensions': return renderExtensions();
      case 'desktop-developer': return renderDeveloper();
    }
  };
  const headerTitle = tab === 'connection' ? 'Configure third-party inference' : 'Settings';

  return (
    <div
      data-color-version="v2"
      data-theme="claude"
      data-mode={settingsMode}
      className="epitaxy-root fixed inset-0 z-[100] flex h-screen w-screen flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--z0)',
        color: 'var(--t9)',
      } as React.CSSProperties}
    >
      <div
        className="absolute inset-x-0 top-0 z-10 flex h-[50px] items-center gap-3 border-b border-t3 bg-z0 px-4"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="text-sm font-semibold text-t9">{headerTitle}</div>
        <div className="flex-1" />
        <button
          type="button"
          aria-label="Close settings"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md text-t6 hover:bg-t2 hover:text-t9"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex h-full min-h-0 w-full pt-[50px]">
        <aside className="flex w-[200px] shrink-0 flex-col gap-0.5 overflow-auto border-r border-t3 px-2 py-3.5">
          <div className="px-2 pb-1.5">
            <div className="flex h-8 items-center gap-2 rounded-md border border-t3 bg-z0 px-2.5 text-t6">
              <Search size={12} />
              <span className="text-xs">Search settings</span>
            </div>
          </div>
          <div className="space-y-3">
            {navGroups.map((group, groupIndex) => (
              <div key={group.title || groupIndex}>
                {group.title && <div className="px-2 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-t6">{group.title}</div>}
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id);
                        setShowExtensionAdvanced(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs outline-none transition-colors ${
                        tab === item.id ? 'bg-t2 font-medium text-t9' : 'font-normal text-t9 hover:bg-t2'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge && <span className="rounded-md bg-t2 px-1.5 py-0.5 text-[10px] text-t6">{item.badge}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="px-7 py-6">
            {renderCurrentPage()}
          </div>
        </main>
      </div>
    </div>
  );

  function renderConnection() {
    const providers: Array<{ value: ThirdPartyInferenceConfig['inferenceProvider']; name: string; detail: string }> = [
      { value: 'gateway', name: 'Gateway', detail: 'Anthropic-compatible' },
      { value: 'bedrock', name: 'Bedrock', detail: 'AWS' },
      { value: 'vertex', name: 'Vertex', detail: 'Google Cloud' },
      { value: 'foundry', name: 'Foundry', detail: 'Azure AI' },
    ];
    const canApply = inferenceConfig.inferenceProvider === 'gateway'
      && inferenceConfig.inferenceGatewayBaseUrl.trim()
      && inferenceConfig.inferenceGatewayApiKey.trim();

    return (
      <main className="flex max-w-[900px] flex-col gap-7 pb-10">
        <header>
          <h2 className="text-[24px] font-semibold leading-8">Connection</h2>
          <p className="mt-2 text-[15px] leading-6 text-claude-textSecondary">
            Choose where Claude Desktop sends inference requests.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          {providers.map(provider => {
            const selected = inferenceConfig.inferenceProvider === provider.value;
            return (
              <button
                key={provider.value}
                type="button"
                onClick={() => updateInferenceConfig({ inferenceProvider: provider.value })}
                className={`flex h-[88px] items-center gap-4 rounded-xl border bg-white px-5 text-left transition ${
                  selected ? 'border-[#2b7de9] shadow-[0_0_0_1px_#2b7de9]' : 'border-[#d9d4ca] hover:bg-[#fbfaf7]'
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-[#2b7de9]' : 'border-[#b6b2aa]'}`}>
                  {selected && <span className="h-2 w-2 rounded-full bg-[#2b7de9]" />}
                </span>
                <span>
                  <span className="block text-[18px] font-semibold">{provider.name}</span>
                  <span className="block text-[14px] text-claude-textSecondary">{provider.detail}</span>
                </span>
              </button>
            );
          })}
        </div>

        {inferenceConfig.inferenceProvider !== 'gateway' && (
          <Callout
            message="当前本地 Claude Code 子进程只接入 Gateway。Bedrock、Vertex、Foundry 需要后续按官方字段继续接。"
            buttonLabel="切回 Gateway"
            onClick={() => updateInferenceConfig({ inferenceProvider: 'gateway' })}
          />
        )}

        <Section title="GATEWAY CREDENTIALS">
          <div className="grid grid-cols-[320px_1fr] gap-x-8 gap-y-5">
            <FieldLabel
              title="Gateway base URL"
              required
              description="Full URL of the inference gateway endpoint."
            />
            <TextInput
              wide
              value={inferenceConfig.inferenceGatewayBaseUrl}
              onChange={value => updateInferenceConfig({ inferenceGatewayBaseUrl: value })}
              placeholder="https://llm-gateway.example.com"
            />

            <FieldLabel title="Gateway API key" required />
            <div className="relative">
              <input
                value={inferenceConfig.inferenceGatewayApiKey}
                onChange={event => updateInferenceConfig({ inferenceGatewayApiKey: event.target.value })}
                type={showInferenceKey ? 'text' : 'password'}
                className="h-11 w-full rounded-xl border border-[#d9d4ca] bg-white px-4 pr-11 text-[14px] outline-none focus:border-[#c7c1b6]"
              />
              <button
                type="button"
                aria-label={showInferenceKey ? '隐藏 API key' : '显示 API key'}
                onClick={() => setShowInferenceKey(value => !value)}
                className="absolute right-2 top-1.5 flex h-8 w-8 items-center justify-center rounded-md text-claude-textSecondary hover:bg-[#f2efea]"
              >
                {showInferenceKey ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <FieldLabel
              title="Gateway auth scheme"
              description="Bearer sends Authorization: Bearer. x-api-key is for Anthropic API directly."
            />
            <Select
              fullWidth
              value={inferenceConfig.inferenceGatewayAuthScheme}
              onChange={value => updateInferenceConfig({ inferenceGatewayAuthScheme: value as GatewayAuthScheme })}
              options={[
                { value: 'bearer', label: 'bearer' },
                { value: 'x-api-key', label: 'x-api-key' },
              ]}
            />

            <FieldLabel
              title="Gateway extra headers"
              description="One header per line, formatted as Name: value."
            />
            <textarea
              value={inferenceConfig.inferenceGatewayHeadersText || ''}
              onChange={event => updateInferenceConfig({ inferenceGatewayHeadersText: event.target.value })}
              className="min-h-[84px] w-full rounded-xl border border-[#d9d4ca] bg-white px-4 py-3 font-mono text-[13px] outline-none focus:border-[#c7c1b6]"
              placeholder="X-Header-Name: value"
              spellCheck={false}
            />

            <FieldLabel
              title="Inference models"
              description="One model per line. Add [1m] after a model name to mark 1M-context support."
            />
            <textarea
              value={inferenceModelsText}
              onChange={event => {
                const value = event.target.value;
                setInferenceModelsText(value);
                updateInferenceConfig({ inferenceModels: parseInferenceModelsText(value) });
              }}
              className="min-h-[92px] w-full rounded-xl border border-[#d9d4ca] bg-white px-4 py-3 font-mono text-[13px] outline-none focus:border-[#c7c1b6]"
              placeholder={'claude-sonnet-4-6\nclaude-opus-4-5 [1m]'}
              spellCheck={false}
            />
          </div>
          {inferenceConfigPath && (
            <div className="pt-2 text-[12px] text-claude-textSecondary">
              写入：<span className="font-mono">{inferenceConfigPath}</span>
            </div>
          )}
        </Section>

        {showInferenceJson && (
          <pre className="max-h-[280px] overflow-auto rounded-xl border border-[#d9d4ca] bg-white p-4 font-mono text-[12px] leading-5">
            {JSON.stringify(inferenceConfigForJson(inferenceConfig), null, 2)}
          </pre>
        )}

        <div className="sticky bottom-0 -mx-10 mt-4 flex h-[58px] items-center gap-2 border-t border-[#ddd8cf] bg-[#f9f7f3]/95 px-10 backdrop-blur">
          <SettingsButton onClick={() => setShowInferenceJson(value => !value)}>
            {showInferenceJson ? 'Form view' : '{ } View as JSON'}
          </SettingsButton>
          <div className="flex-1" />
          {inferenceStatus && (
            <span className={`max-w-[360px] truncate text-[13px] ${inferenceStatus.includes('失败') || inferenceStatus.includes('Failed') ? 'text-red-600' : 'text-claude-textSecondary'}`}>
              {inferenceStatus}
            </span>
          )}
          <button
            type="button"
            disabled={!canApply || inferenceLoading || inferenceSaving}
            onClick={applyThirdPartyInference}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#111] px-4 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#111]"
          >
            {inferenceSaving ? 'Applying...' : 'Apply locally'}
          </button>
        </div>
      </main>
    );
  }

  function renderPlaceholderSection(title: string, description: string) {
    return (
      <main className="flex max-w-[900px] flex-col gap-6">
        <header>
          <h2 className="text-[24px] font-semibold leading-8">{title}</h2>
          <p className="mt-2 max-w-[720px] text-[15px] leading-6 text-claude-textSecondary">{description}</p>
        </header>
        <div className="rounded-xl border border-[#d9d4ca] bg-white p-5 text-[14px] text-claude-textSecondary">
          该分区已按官方结构预留，当前先实现 Connection 对本地 Claude Code 子进程生效。
        </div>
      </main>
    );
  }

  function renderGeneral() {
    const randomizeAvatar = () => {
      const next = Math.floor(Math.random() * 72) + 1;
      setAvatar(next);
      saveProfile({ avatar: next });
    };

    const clearAvatar = () => {
      setAvatar(0);
      saveProfile({ avatar: 0 });
    };

    return (
      <main className="max-w-[720px]">
        <SettingsGroup title="Profile">
          <SettingsRow
            label="Avatar"
            control={
              <AvatarControl
                avatar={avatar}
                initials={initials}
                onRandomize={randomizeAvatar}
                onClear={clearAvatar}
              />
            }
          />
          <SettingsRow
            label="Full name"
            control={
              <CompactTextInput
                ariaLabel="Full name"
                value={fullName}
                onChange={setFullName}
                onSave={(value) => saveProfile({ full_name: value })}
              />
            }
          />
          <SettingsRow
            label="What should Claude call you?"
            control={
              <CompactTextInput
                ariaLabel="Display name"
                value={displayName}
                onChange={setDisplayName}
                onSave={(value) => saveProfile({ display_name: value })}
              />
            }
          />
          <SettingsRow
            label="What best describes your work?"
            control={
              <CompactSelect
                value={workFunction}
                placeholder="Select work function"
                onChange={(value) => {
                  setWorkFunction(value);
                  saveProfile({ work_function: value });
                }}
                options={WORK_OPTIONS.map(value => ({ value, label: value }))}
              />
            }
          />
          <div className="flex flex-col gap-2 py-3">
            <label htmlFor="conversation-preferences" className="text-sm text-t9">Instructions for Claude</label>
            <div className="text-xs leading-normal text-t6">
              Claude will reference this in chats and Cowork, provided it complies with Anthropic's usage guidelines.
            </div>
            <textarea
              id="conversation-preferences"
              value={instructions}
              onChange={event => setInstructions(event.target.value)}
              onBlur={() => saveProfile({
                personal_preferences: instructions,
                conversation_preferences: instructions,
              })}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  setInstructions(profile?.conversation_preferences || profile?.personal_preferences || '');
                  event.currentTarget.blur();
                }
              }}
              rows={3}
              className="min-h-[5.5rem] max-h-40 resize-y rounded-md border border-t3 bg-z0 px-3 py-2 text-sm leading-5 text-t9 outline-none transition-colors placeholder:text-t6 focus:border-[var(--accent)]"
              placeholder="e.g. explain concepts as directly as possible"
            />
          </div>
        </SettingsGroup>

        <SettingsGroup title="Preferences">
          <SettingsRow
            label="Appearance"
            control={
              <SegmentedIconControl
                value={theme}
                options={[
                  { value: 'auto', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
                onChange={applyTheme}
              />
            }
          />
          <SettingsRow
            label="Chat font"
            control={
              <CompactSelect
                value={chatFont}
                onChange={applyChatFont}
                options={CHAT_FONT_OPTIONS.map(({ value, label }) => ({ value, label }))}
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup title="Notifications">
          <ToggleRow compact label="Response completions" description="Get notified when Claude has finished a response. Useful for long-running tasks." flagKey="responseCompletions" />
          <ToggleRow compact label="Code notifications" description="Claude can choose to notify you about important updates from a Code session." flagKey="codeNotifications" />
          <ToggleRow compact label="Code permission requests" description="Get a push notification when Claude needs your approval to run a command in a Code session." flagKey="codePermissionRequests" />
          <ToggleRow compact label="Security scan emails" description="Get an email when a Claude Code security scan finishes." flagKey="securityScanEmails" />
          <ToggleRow compact label="Dispatch messages" description="Get a push notification on your phone when Claude messages you in Dispatch." flagKey="dispatchMessages" />
        </SettingsGroup>
      </main>
    );
  }

  function renderPrivacy() {
    const openPrivacyCenter = () => {
      const url = 'https://privacy.anthropic.com/';
      const api = (window as any).electronAPI;
      if (api?.openExternal) {
        api.openExternal(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    const openPrivacyPolicy = () => {
      const url = 'https://www.anthropic.com/legal/privacy';
      const api = (window as any).electronAPI;
      if (api?.openExternal) {
        api.openExternal(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    return (
      <main className="flex max-w-[964px] flex-col gap-7">
        <header className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d8d2c8] bg-[#f2efea] shadow-sm">
            <Shield size={24} strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold leading-6">隐私</h2>
            <p className="mt-1 max-w-[680px] text-[14px] leading-6 text-claude-textSecondary">
              Anthropic 相信透明的数据实践。你可以在这里了解 Claude 如何处理你的数据，并管理相关偏好。
            </p>
          </div>
        </header>

        <Section title="数据和隐私">
          <ToggleRow
            label="允许用于改进模型"
            description="允许使用你的聊天和编码会话来训练和改进 Anthropic AI 模型。你可以随时在隐私设置中更改此设置。"
            flagKey="modelTraining"
          />
          <ToggleRow
            label="记忆"
            description="让 Claude 记住你的聊天和 Cowork 会话中的信息。"
            flagKey="privacyMemory"
          />
          <Row
            label="你的隐私选择"
            description="查看并管理与 Claude 数据使用相关的隐私选择。"
            control={<SettingsButton onClick={openPrivacyCenter}>隐私中心</SettingsButton>}
          />
        </Section>

        <Section title="了解更多">
          <Row
            label="隐私政策"
            description="了解你在使用 Anthropic 产品时信息如何受到保护。"
            control={<SettingsButton onClick={openPrivacyPolicy}>查看政策</SettingsButton>}
          />
          <PrivacyInfoBlock
            title="我们如何保护你的数据"
            items={[
              '默认情况下，Anthropic 不会使用你的对话来训练我们的生成模型。',
              'Anthropic 不会将你的数据出售给第三方。',
              'Anthropic 会根据要求及时删除你的数据，但安全违规行为或你通过反馈分享的对话除外。',
            ]}
          />
        </Section>
      </main>
    );
  }

  function renderCapabilities() {
    return (
      <main className="flex max-w-[964px] flex-col gap-7 pb-10">
        <Section title="视觉效果">
          <ToggleRow label="生成内容" description="要求 Claude 生成代码片段、文本文档或网站设计等内容时，Claude 将创建一个 Artifact，并显示在对话旁边的专用窗口中。" flagKey="artifacts" />
          <ToggleRow label="AI 驱动的 Artifacts" description="创建在 Artifact 内使用 Claude 的应用、原型和交互式文档。首先说“我们来构建一个 AI 应用……”即可使用 Claude API 的强大能力。" flagKey="aiArtifacts" />
          <ToggleRow label="内联可视化" description="允许 Claude 直接在对话中生成交互式可视化、图表和图表。" flagKey="inlineVisualizations" />
        </Section>

        <Section title="工具访问">
          <Row
            label="工具访问模式"
            description="控制连接器工具在新对话中的加载方式。"
            control={
              <SegmentedControl
                value={flags.toolAccessWhenNeeded ? 'on' : 'off'}
                options={[
                  { value: 'on', label: '需要时加载工具', description: '由于未预先加载工具，因此聊天变得不那么紧凑。' },
                  { value: 'off', label: '工具已加载', description: '聊天更加频繁，因为工具始终存在。' },
                ]}
                onChange={value => setFlag('toolAccessWhenNeeded', value === 'on')}
              />
            }
          />
        </Section>

        <Section title="一般">
          <ToggleRow label="CSV 聊天建议" description="当你将 CSV 上传到对话时，Claude 会建议回复。" flagKey="csvSuggestions" />
          <ToggleRow label="Google 云端硬盘编目" description="允许 Claude 存储并编目你的 Google Drive 数据，以获得更准确的搜索结果。" flagKey="driveCataloging" />
        </Section>

        <Section title="技能">
          <Callout
            message="技能已移至自定义。前往新的自定义页面来管理你的技能和连接器。"
            buttonLabel="前往自定义"
            onClick={() => { window.location.hash = '#/customize/skills'; }}
          />
        </Section>
      </main>
    );
  }

  function renderConnectors() {
    return (
      <main className="flex max-w-[964px] flex-col gap-7 pb-10">
        <Callout
          message="连接器已移至“自定义”。前往新的自定义页面来管理你的技能和连接器。"
          buttonLabel="前往自定义"
          onClick={() => { window.location.hash = '#/customize/connectors'; }}
        />

        <Section title="连接器">
          <div className="flex min-h-[180px] items-center justify-center text-[14px] text-claude-textSecondary">
            你的组织尚未启用任何连接器
          </div>
        </Section>
      </main>
    );
  }

  function renderClaudeCode() {
    return (
      <main className="flex max-w-[964px] flex-col gap-7">
        <Section title="通用设置">
          <ToggleRow label="分类会话状态" description="允许 Claude 自动将会话分类为受阻、可供审核或已完成。分类会计入你的计划用量，并适用于新会话。" flagKey="classifySessionStates" />
        </Section>

        <Section title="Claude Code 桌面设置">
          <ToggleRow label="允许绕过权限模式" description="绕过所有权限检查，让 Claude 不间断地工作。这对于修复 lint 错误或生成样板代码等工作流程非常有效。让 Claude 运行任意命令是有风险的，可能会导致数据丢失、系统损坏或数据泄露（例如，通过提示注入攻击）。" flagKey="bypassPermissions" />
          <ToggleRow label="允许自动权限模式" description="自动模式让 Claude 在编码会话期间处理权限决策，因此开发人员可以运行更长的任务，而不会被 Claude 请求手动批准的中断。自动模式还包括针对提示注入的额外保护措施。" flagKey="autoPermissions" />
          <ToggleRow label="需要注意时提醒我" description="当 Claude 需要你的注意且应用未聚焦时，让 Dock 图标跳动或闪烁任务栏。" flagKey="dockAttention" />
          <ToggleRow label="Code notifications" description="Claude can choose to notify you about important updates from a Code session." flagKey="codeNotifications" />
          <ToggleRow label="Code permission requests" description="Get a push notification when Claude needs your approval to run a command in a Code session." flagKey="codePermissionRequests" />
          <ToggleRow label="Security scan emails" description="Get an email when a Claude Code security scan finishes." flagKey="securityScanEmails" />
          <Row label="工作树位置" description="在哪里存储隔离编码会话的 git 工作树" control={<Select value={worktreeLocation} onChange={v => { setWorktreeLocation(v); localStorage.setItem('cc_worktree_location', v); }} options={[{ value: 'default', label: '项目内（.claude/worktrees）' }, { value: 'custom', label: '自定义...' }]} />} />
          <Row label="分支前缀" description="添加到每个工作树分支名称开头的前缀" control={<TextInput value={branchPrefix} onChange={v => { setBranchPrefix(v); localStorage.setItem('cc_branch_prefix', v); }} />} />
          <ToggleRow label="预览" description="Claude 可以启动开发服务器，打开实时预览，并通过屏幕截图、快照和 DOM 检查来验证代码更改。" flagKey="previewEnabled" />
          <ToggleRow label="保留预览会话" description="保存 cookie、本地存储和登录会话以供开发服务器预览。数据按工作区存储，并在应用重新启动时保留。关闭此功能会清除所有保存的会话数据。" flagKey="previewPersistSession" />
        </Section>

        <Section title="Claude Code on the Web">
          <ToggleRow label="自动创建拉取请求" description="当 Claude 将更改推送到分支时，它会自动打开拉取请求，而无需先询问。" flagKey="createPullRequests" />
          {flags.createPullRequests && <ToggleRow label="创建为草稿" description="将自动创建的拉取请求作为草稿打开，而不是准备进行审核。" flagKey="createDraftPullRequests" />}
        </Section>

        <Section title="插件">
          <Row
            label="插件"
            description="管理 Claude Code plugins、agents、hooks 和 connectors。"
            control={<SettingsButton onClick={() => {}}>管理</SettingsButton>}
          />
        </Section>
      </main>
    );
  }

  function renderCowork() {
    const saveCoworkInstructions = () => {
      localStorage.setItem('cowork_global_instructions', coworkGlobalInstructions);
      setEditingCoworkInstructions(false);
    };

    return (
      <main className="flex max-w-[964px] flex-col gap-7">
        <h2 className="text-[18px] font-semibold leading-6">Cowork</h2>

        {editingCoworkInstructions ? (
          <section className="flex flex-col gap-3">
            <p className="max-w-[760px] text-[14px] leading-6 text-claude-textSecondary">
              此处的说明适用于所有 Cowork 会话。使用它来表示 Claude 应该始终了解的偏好、惯例或背景。
            </p>
            <textarea
              value={coworkGlobalInstructions}
              onChange={event => setCoworkGlobalInstructions(event.target.value)}
              aria-label="全局指令"
              className="h-64 w-full resize-y rounded-lg border border-[#d9d4ca] bg-white p-3 font-mono text-[14px] leading-6 text-claude-text outline-none focus:ring-2 focus:ring-[#d6c5ff] dark:border-white/10 dark:bg-white/5"
              placeholder="添加 Claude 在所有 Cowork 会话中遵循的说明..."
              spellCheck={false}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCoworkGlobalInstructions(localStorage.getItem('cowork_global_instructions') || '');
                  setEditingCoworkInstructions(false);
                }}
                className="h-9 rounded-lg border border-[#cfc8bd] px-4 text-[14px] font-medium text-claude-text hover:bg-[#f5f2ec] dark:border-white/15"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveCoworkInstructions}
                className="h-9 rounded-lg bg-[#111] px-4 text-[14px] font-medium text-white hover:bg-[#2c2c2c] dark:bg-white dark:text-[#111]"
              >
                保存
              </button>
            </div>
          </section>
        ) : (
          <section className="flex items-start justify-between gap-8">
            <div>
              <div className="text-[14px] font-semibold leading-5">全局指令</div>
              <p className="mt-2 max-w-[780px] text-[14px] leading-6 text-claude-textSecondary">
                此处的说明适用于所有 Cowork 会话。使用它来表示 Claude 应该始终了解的偏好、惯例或背景。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingCoworkInstructions(true)}
              className="mt-1 h-9 min-w-[80px] shrink-0 rounded-lg border border-[#cfc8bd] px-5 text-[14px] font-medium text-claude-text hover:bg-[#f5f2ec] dark:border-white/15"
            >
              编辑
            </button>
          </section>
        )}

        <section className="flex flex-col gap-5">
          <h3 className="text-[18px] font-semibold leading-6">记忆</h3>
          <div className="flex items-start justify-between gap-8">
            <div>
              <div className="text-[14px] font-semibold leading-5">在会话中使用记忆</div>
              <p className="mt-2 max-w-[780px] text-[14px] leading-6 text-claude-textSecondary">
                Claude 将在 Cowork 会话期间阅读并更新这些记忆。
              </p>
            </div>
            <div className="shrink-0 pt-1">
              <Toggle checked={!!flags.coworkMemory} onChange={value => setFlag('coworkMemory', value)} />
            </div>
          </div>
          <p className="max-w-[900px] text-[14px] leading-6 text-claude-textSecondary">
            Claude 会保存它在 Cowork 会话期间了解的有关你和你的工作的信息。这些文件存储在该设备上。
          </p>
          <p className="max-w-[900px] text-[14px] leading-6 text-claude-textSecondary">
            还没有记忆。当你们一起工作时，Claude 将在此处添加条目。
          </p>
        </section>
      </main>
    );
  }

  function renderDesktop() {
    return (
      <main className="flex max-w-[964px] flex-col gap-7">
        <Section title="常规桌面设置">
          <ToggleRow label="启动时运行" description="登录计算机时自动启动 Claude" flagKey="launchAtLogin" />
          <Row
            label="快速访问快捷方式"
            description="从桌面上的任何位置向 Claude 发送消息"
            control={
              <Select
                value="alt-space"
                onChange={() => {}}
                options={[{ value: 'alt-space', label: 'Alt + Space' }, { value: 'custom', label: '自定义...' }]}
              />
            }
          />
          <Row
            label="语音快捷方式"
            description="从桌面上的任何位置与 Claude 交谈"
            control={
              <Select
                value="capslock"
                onChange={() => {}}
                options={[{ value: 'capslock', label: 'Caps Lock' }, { value: 'custom', label: '自定义...' }]}
              />
            }
          />
          <ToggleRow label="系统托盘" description="让 Claude 在系统托盘中运行" flagKey="systemTray" />
          <ToggleRow label="保持计算机处于唤醒状态" description="防止你的计算机在 Claude 打开时处于空闲睡眠状态，以便计划的任务可以运行。你的显示器仍然可以关闭。合上笔记本电脑的盖子仍会使其进入睡眠状态。" flagKey="keepAwake" />
        </Section>
      </main>
    );
  }

  function renderExtensions() {
    if (showExtensionAdvanced) {
      return (
        <main className="flex max-w-[964px] flex-col gap-7">
          <button
            type="button"
            onClick={() => setShowExtensionAdvanced(false)}
            className="inline-flex w-fit items-center gap-1 text-[14px] text-claude-textSecondary hover:text-claude-text"
          >
            <ArrowLeft size={15} />
            所有扩展
          </button>

          <Section title="扩展设置">
            <ToggleRow label="启用扩展自动更新" description="当新版本可用时自动更新扩展。如果禁用，你将需要手动更新扩展。" flagKey="extensionAutoUpdates" />
            <ToggleRow label="使用内置 Node.js 进行 MCP" description="如果启用，Claude 将永远不会使用系统 Node.js 来扩展 MCP 服务器。当系统的 Node.js 丢失或过时时，这种情况会自动发生。" flagKey="useBuiltInNode" />
            <Row
              label="检测到的工具"
              description="Node.js：未找到"
              control={<span className="text-[14px] text-claude-textSecondary">Python：未找到</span>}
            />
          </Section>

          <Section title="扩展开发者">
            <Callout
              message="这些工具仅供扩展开发人员使用。不正确地使用它们可能会导致扩展出现故障或损害你的系统安全。"
              buttonLabel="安装扩展"
              onClick={() => {}}
            />
            <div className="flex flex-wrap gap-3">
              <SettingsButton onClick={() => {}}>安装解压扩展</SettingsButton>
              <SettingsButton onClick={() => {}}>打开扩展文件夹</SettingsButton>
              <SettingsButton onClick={() => {}}>打开扩展设置文件夹</SettingsButton>
            </div>
          </Section>
        </main>
      );
    }

    return (
      <main className="flex max-w-[964px] flex-col gap-7">
        <Section title="扩展">
          <div className="flex items-start justify-between gap-8">
            <p className="max-w-[640px] text-[14px] leading-6 text-claude-textSecondary">
              允许 Claude 直接与计算机上的应用、数据和工具交互。
            </p>
            <SettingsButton onClick={() => { window.location.hash = '#/customize/connectors'; }}>
              浏览扩展
            </SettingsButton>
          </div>

          <div className="flex min-h-[170px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[#d9d4ca] text-center">
            <div>
              <div className="text-[14px] font-medium">未找到扩展名</div>
              <div className="mt-1 text-[13px] text-claude-textSecondary">目录中没有可用的扩展名</div>
            </div>
            <SettingsButton onClick={() => setShowExtensionAdvanced(true)}>高级设置</SettingsButton>
          </div>

          <p className="text-[13px] text-claude-textSecondary">将.MCPB或.DXT文件拖至此处进行安装</p>
        </Section>
      </main>
    );
  }

  function renderDeveloper() {
    const openDeveloperDocs = () => {
      const url = 'https://modelcontextprotocol.io/quickstart';
      const api = (window as any).electronAPI;
      if (api?.openExternal) {
        api.openExternal(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    const revealConfig = async () => {
      const api = (window as any).electronAPI;
      if (api?.revealConfig) {
        await api.revealConfig();
        return;
      }
      alert('当前运行环境没有暴露配置文件打开能力。');
    };

    return (
      <div className="flex h-[calc(100vh-108px)] min-h-[520px] flex-col">
        <header>
          <h2 className="text-[18px] font-semibold leading-6">本地 MCP 服务器</h2>
          <p className="mt-2 text-[14px] leading-5 text-claude-textSecondary">
            添加和管理你正在使用的 MCP 服务器。
          </p>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
          <div className="relative mb-6 h-16 w-16 text-[#2f2d2a] dark:text-[#e7e2d9]">
            <Monitor size={56} strokeWidth={1.6} className="absolute left-1 top-2" />
            <MousePointer2 size={28} strokeWidth={1.8} className="absolute left-5 top-3 rotate-[-12deg] fill-[#f9f7f3] dark:fill-[#1a1917]" />
          </div>
          <p className="mb-5 text-[16px] text-claude-text">未添加服务器</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={revealConfig}
              className="h-9 rounded-lg bg-[#111] px-4 text-[14px] font-medium text-white hover:bg-[#2c2c2c] dark:bg-white dark:text-[#111]"
            >
              编辑配置
            </button>
            <button
              type="button"
              onClick={openDeveloperDocs}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#cfc8bd] bg-white px-4 text-[14px] font-medium text-claude-text hover:bg-[#f5f2ec] dark:border-white/15 dark:bg-white/5"
            >
              开发者文档
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  function ToggleRow({ label, description, flagKey, compact }: { label: string; description?: string; flagKey: string; compact?: boolean }) {
    return <Row compact={compact} label={label} description={description} control={<Toggle checked={!!flags[flagKey]} onChange={value => setFlag(flagKey, value)} />} />;
  }

  function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section className="mb-8 rounded-xl border border-t3 bg-z0 p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-t9">{title}</h2>
        <div className="divide-y divide-t3">{children}</div>
      </section>
    );
  }

  function Section({ title, children, prominent: _prominent }: { title: string; children: React.ReactNode; prominent?: boolean }) {
    return (
      <section className="rounded-xl border border-t3 bg-z0 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-t9">{title}</h3>
        <div className="space-y-4">{children}</div>
      </section>
    );
  }

  function Row({ label, description, control, compact }: { label: string; description?: string; control: React.ReactNode; compact?: boolean }) {
    return (
      <SettingsRow
        label={label}
        description={description}
        compact={compact}
        control={control}
      />
    );
  }

  function SettingsRow({ label, description, control, compact }: { label: string; description?: string; control: React.ReactNode; compact?: boolean }) {
    return (
      <div className={`flex items-start justify-between gap-10 ${compact ? 'py-3' : 'py-3'}`}>
        <div className="min-w-0">
          <div className="text-sm text-t9">{label}</div>
          {description && <div className="mt-1 max-w-[430px] text-xs leading-normal text-t6">{description}</div>}
        </div>
        <div className="shrink-0">{control}</div>
      </div>
    );
  }

  function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
    return (
      <button type="button" onClick={() => onChange(!checked)} className={`relative h-5 w-9 rounded-full border transition-colors ${checked ? 'border-[#3b82f6] bg-[#3b82f6]' : 'border-[#d7d2c8] bg-[#ece8df]'}`}>
        <span className={`absolute top-[1px] h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-200 ${checked ? 'left-[18px]' : 'left-[1px]'}`} />
      </button>
    );
  }
};

const TextInput = ({
  value,
  onChange,
  onBlur,
  placeholder,
  wide
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  wide?: boolean;
}) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    onBlur={onBlur}
    placeholder={placeholder}
    className={`h-11 rounded-xl border border-[#d9d4ca] bg-white px-4 text-[14px] outline-none focus:border-[#c7c1b6] ${wide ? 'w-full' : 'w-56'}`}
  />
);

const FieldLabel = ({ title, description, required }: { title: string; description?: string; required?: boolean }) => (
  <div>
    <div className="text-[15px] font-semibold">
      {title} {required && <span className="text-[12px] font-normal text-claude-textSecondary">Required</span>}
    </div>
    {description && <div className="mt-2 max-w-[280px] text-[13px] leading-5 text-claude-textSecondary">{description}</div>}
  </div>
);

const Select = ({
  value,
  onChange,
  options,
  fullWidth
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  fullWidth?: boolean;
}) => (
  <select value={value} onChange={e => onChange(e.target.value)} className={`h-11 rounded-xl border border-[#d9d4ca] bg-white px-4 text-[14px] outline-none focus:border-[#c7c1b6] ${fullWidth ? 'w-full' : 'w-56'}`}>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>
);

const AvatarControl = ({
  avatar,
  initials,
  onRandomize,
  onClear,
}: {
  avatar: number;
  initials: string;
  onRandomize: () => void;
  onClear: () => void;
}) => (
  <div className="group/avatar relative w-fit">
    <button
      type="button"
      aria-label="Randomize avatar"
      onClick={onRandomize}
      className="relative block size-10 overflow-hidden rounded-full bg-t9 text-z0 outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
    >
      <span className="flex size-10 items-center justify-center text-sm font-medium transition duration-150 group-hover/avatar:scale-110 group-hover/avatar:opacity-40 group-hover/avatar:blur-[3px]">
        {avatar ? avatar : initials}
      </span>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/avatar:opacity-100">
        <Shuffle size={16} />
      </span>
    </button>
    {avatar !== 0 && (
      <button
        type="button"
        aria-label="Clear avatar"
        onClick={onClear}
        className="absolute -left-1.5 -top-1.5 flex size-[18px] items-center justify-center rounded-full border border-t3 bg-z0 text-t6 opacity-0 shadow-sm transition-opacity hover:bg-t2 hover:text-t9 group-hover/avatar:opacity-100"
      >
        <X size={12} />
      </button>
    )}
  </div>
);

const CompactTextInput = ({
  value,
  onChange,
  onSave,
  ariaLabel,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  ariaLabel: string;
  required?: boolean;
}) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const next = draft.trim();
    if (required && !next) {
      setDraft(value);
      return;
    }
    if (next === value.trim()) return;
    onChange(next);
    onSave(next);
  };

  return (
    <input
      value={draft}
      aria-label={ariaLabel}
      onChange={event => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      className="h-8 w-56 rounded-md border border-transparent bg-transparent px-2 text-sm text-t9 outline-none transition-colors hover:bg-t2 focus:border-t3 focus:bg-z0"
    />
  );
};

const CompactSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Select',
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) => (
  <select
    value={value}
    aria-label={placeholder}
    onChange={event => onChange(event.currentTarget.value)}
    className="h-8 w-56 rounded-md border border-transparent bg-transparent px-2 text-sm text-t9 outline-none transition-colors hover:bg-t2 focus:border-t3 focus:bg-z0"
  >
    <option value="">{placeholder}</option>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>
);

const SegmentedIconControl = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) => (
  <div className="inline-flex h-8 rounded-md bg-t2 p-0.5">
    {options.map(option => (
      <button
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
        className={`min-w-16 rounded px-2 text-xs transition-colors ${
          value === option.value ? 'bg-z0 text-t9 shadow-sm' : 'text-t6 hover:text-t9'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const SettingsButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-9 shrink-0 rounded-lg border border-[#cfc8bd] bg-[#fdfcf9] px-4 text-[14px] font-medium text-claude-text shadow-sm hover:bg-[#f5f2ec] dark:border-white/15 dark:bg-white/5"
  >
    {children}
  </button>
);

const PrivacyInfoBlock = ({ title, items }: { title: string; items: string[] }) => (
  <div>
    <div className="mb-2 text-[14px] font-medium leading-5">{title}</div>
    <ul className="list-disc space-y-1 pl-6 text-[14px] leading-6 text-claude-textSecondary">
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  </div>
);

const Callout = ({ message, buttonLabel, onClick }: { message: string; buttonLabel: string; onClick: () => void }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-[#e0d7c8] bg-[#fff8e7] px-4 py-3 text-[14px] leading-5 shadow-sm dark:border-white/10 dark:bg-white/5">
    <span className="text-claude-textSecondary">{message}</span>
    <button
      type="button"
      onClick={onClick}
      className="h-9 shrink-0 rounded-lg border border-[#cfc8bd] bg-white px-4 text-[14px] font-medium text-claude-text hover:bg-[#f5f2ec] dark:border-white/15 dark:bg-white/5"
    >
      {buttonLabel}
    </button>
  </div>
);

const SegmentedControl = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string; description: string }>;
  onChange: (value: string) => void;
}) => (
  <div className="w-[280px] rounded-xl border border-[#d9d4ca] bg-white p-1">
    {options.map(option => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`block w-full rounded-lg px-3 py-2 text-left transition ${value === option.value ? 'bg-[#f2efea]' : 'hover:bg-[#f7f4ee]'}`}
      >
        <div className="text-[13px] font-medium">{option.label}</div>
        <div className="mt-1 text-[12px] leading-4 text-claude-textSecondary">{option.description}</div>
      </button>
    ))}
  </div>
);

export default SettingsPage;
