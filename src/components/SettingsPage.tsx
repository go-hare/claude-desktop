import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ExternalLink,
  Monitor,
  MousePointer2,
  Search,
  Shield,
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

interface SettingsPageProps {
  onClose: () => void;
}

type Tab =
  | 'connection'
  | 'sandbox'
  | 'telemetry'
  | 'limits'
  | 'plugins'
  | 'egress'
  | 'general'
  | 'privacy'
  | 'capabilities'
  | 'connectors'
  | 'claude-code'
  | 'cowork'
  | 'desktop'
  | 'desktop-extensions'
  | 'desktop-developer';

const WORK_OPTIONS = [
  '', '软件工程', '产品管理', '数据科学', '市场营销', '设计', '研究', '教育', '金融', '法律', '医疗健康', '其他',
];

const navGroups: Array<{ title?: string; items: Array<{ id: Tab; label: string; badge?: string }> }> = [
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
  return next;
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

const SettingsPage = ({ onClose }: SettingsPageProps) => {
  const [tab, setTab] = useState<Tab>('connection');
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workFunction, setWorkFunction] = useState('');
  const [instructions, setInstructions] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'auto');
  const [chatFont, setChatFont] = useState(localStorage.getItem('chat_font') || 'default');
  const [branchPrefix, setBranchPrefix] = useState(localStorage.getItem('cc_branch_prefix') || 'claude');
  const [worktreeLocation, setWorktreeLocation] = useState(localStorage.getItem('cc_worktree_location') || 'default');
  const [coworkGlobalInstructions, setCoworkGlobalInstructions] = useState(localStorage.getItem('cowork_global_instructions') || '');
  const [editingCoworkInstructions, setEditingCoworkInstructions] = useState(false);
  const [showExtensionAdvanced, setShowExtensionAdvanced] = useState(false);
  const [inferenceConfig, setInferenceConfig] = useState<ThirdPartyInferenceConfig>(defaultInferenceConfig);
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
  }, [isSelfHosted]);

  useEffect(() => {
    let mounted = true;
    setInferenceLoading(true);
    getThirdPartyInferenceConfig()
      .then((data) => {
        if (!mounted) return;
        setInferenceConfig({
          ...defaultInferenceConfig,
          ...data.config,
          inferenceGatewayHeadersText: data.config.inferenceGatewayHeadersText || formatHeadersText(data.config.inferenceGatewayHeaders),
        });
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

  const updateInferenceConfig = (patch: Partial<ThirdPartyInferenceConfig>) => {
    setInferenceConfig(current => ({ ...current, ...patch }));
    setInferenceStatus('');
  };

  const applyThirdPartyInference = async () => {
    setInferenceSaving(true);
    setInferenceStatus('');
    try {
      const headers = parseHeadersText(inferenceConfig.inferenceGatewayHeadersText);
      const data = await saveThirdPartyInferenceConfig({
        ...inferenceConfig,
        inferenceGatewayHeaders: headers,
      });
      setInferenceConfig({
        ...defaultInferenceConfig,
        ...data.config,
        inferenceGatewayHeadersText: data.config.inferenceGatewayHeadersText || formatHeadersText(data.config.inferenceGatewayHeaders),
      });
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

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-screen flex-col overflow-hidden bg-[#f9f7f3] text-claude-text dark:bg-[#1a1917]">
      <div
        className="absolute inset-x-0 top-0 z-10 flex h-12 items-center gap-3 border-b border-[#ddd8cf] bg-[#f9f7f3] pl-24 pr-4 dark:border-white/10 dark:bg-[#1a1917]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <button
          type="button"
          aria-label="返回设置"
          onClick={onClose}
          className="flex h-8 items-center gap-2 rounded-md px-2 text-[14px] text-claude-textSecondary hover:bg-[#f2efea] hover:text-claude-text dark:hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <ArrowLeft size={16} />
          <span>设置</span>
        </button>
        <div className="text-[15px] font-semibold text-claude-text">Configure third-party inference</div>
      </div>

      <div className="mx-auto flex h-full w-full max-w-[1080px] min-w-0 pt-12">
        <aside className="w-[224px] shrink-0 border-r border-[#e5e1d8] pr-1 pt-8 dark:border-white/10">
          <div className="px-3 pb-4">
            <div className="flex h-11 items-center gap-2 rounded-lg border border-[#d8d2c8] bg-white px-3 text-claude-textSecondary shadow-sm dark:border-white/10 dark:bg-white/5">
              <Search size={17} />
              <span className="text-[14px]">Search settings</span>
            </div>
          </div>
          <div className="space-y-7">
            {navGroups.map((group, groupIndex) => (
              <div key={group.title || groupIndex}>
                {group.title && <div className="px-3 pb-3 text-[14px] text-claude-textSecondary">{group.title}</div>}
                <div className="space-y-1">
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id);
                        setShowExtensionAdvanced(false);
                      }}
                      className={`flex h-9 w-[220px] items-center rounded-lg px-3 text-left text-[15px] outline-none transition-colors focus-visible:bg-[#f2efea] ${
                        tab === item.id ? 'bg-[#f2efea] text-claude-text' : 'text-claude-text hover:bg-[#f7f4ee]'
                      }`}
                    >
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
          <div className="max-w-[980px] px-10 pb-32 pt-8">
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
    return (
      <div className="space-y-12">
        <Section title="个人资料" prominent>
          <div className="space-y-7">
            <div className="grid grid-cols-[1fr_360px] gap-5">
              <div>
                <div className="mb-2 text-[15px] font-medium">全名</div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8d2c8] bg-[#2f2f2f] text-[16px] font-medium text-white">
                    {initials}
                  </div>
                  <TextInput wide value={fullName} onChange={setFullName} onBlur={saveProfile} placeholder="例如阿尔伯特·爱因斯坦" />
                </div>
              </div>
              <div>
                <div className="mb-2 text-[15px] font-medium">Claude 应该怎么称呼你？ <span className="text-[#b9382c]">*</span></div>
                <TextInput wide value={displayName} onChange={setDisplayName} onBlur={saveProfile} placeholder="例如阿尔伯特·艾尔" />
              </div>
            </div>

            <div>
              <div className="mb-2 text-[15px] font-medium">以下哪项最能描述你的工作？</div>
              <Select fullWidth value={workFunction} onChange={v => { setWorkFunction(v); setTimeout(saveProfile, 0); }} options={WORK_OPTIONS.map(v => ({ value: v, label: v || '选择你的工作职能' }))} />
            </div>

            <div>
              <div className="mb-2 text-[15px] font-medium">Claude 回复时应考虑哪些个人偏好？</div>
              <div className="mb-3 text-[13px] text-claude-textSecondary">你的偏好将适用于 Anthropic 指南内的所有对话。</div>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} onBlur={saveProfile} rows={4} className="w-full rounded-xl border border-[#d9d4ca] bg-white px-4 py-3 text-[14px] outline-none focus:border-[#c7c1b6]" placeholder="例如解释简明扼要" />
            </div>
          </div>
        </Section>

        <Section title="通知" prominent>
          <ToggleRow compact label="响应完成" description="当 Claude 完成回复时收到通知。对于工具调用和研究等长时间运行的任务最有用。" flagKey="responseCompletions" />
          <ToggleRow compact label="Dispatch 消息" description="当 Claude 在 Dispatch 中向你发送消息时，在手机上收到推送通知。" flagKey="dispatchMessages" />
        </Section>

        <Section title="外观" prominent>
          <div className="space-y-8">
            <div>
              <div className="mb-4 text-[15px] font-medium">外观模式</div>
              <ThemeCards value={theme} onChange={applyTheme} />
            </div>

            <div>
              <div className="mb-2 text-[15px] font-medium">背景动画</div>
              <div className="flex gap-4">
                <AnimationCard label="已启用" />
                <AnimationCard active label="自动" />
                <AnimationCard label="已禁用" />
              </div>
            </div>

            <div>
              <div className="mb-2 text-[15px] font-medium">聊天字体</div>
              <ChatFontCards value={chatFont} onChange={applyChatFont} />
            </div>
          </div>
        </Section>

      </div>
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

  function Section({ title, children, prominent: _prominent }: { title: string; children: React.ReactNode; prominent?: boolean }) {
    return (
      <section className="border-b border-[#ddd8cf] pb-8 last:border-0 dark:border-white/10">
        <h3 className="mb-6 text-[18px] font-semibold">{title}</h3>
        <div className="space-y-4">{children}</div>
      </section>
    );
  }

  function Row({ label, description, control, compact }: { label: string; description?: string; control: React.ReactNode; compact?: boolean }) {
    return (
      <div className={`flex items-start justify-between gap-10 ${compact ? 'py-0' : 'py-1'}`}>
        <div className="min-w-0">
          <div className="text-[15px] font-medium">{label}</div>
          {description && <div className="mt-2 max-w-[640px] text-[13px] leading-6 text-claude-textSecondary">{description}</div>}
        </div>
        <div className={`shrink-0 ${compact ? 'pt-2' : 'pt-0.5'}`}>{control}</div>
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

const ThemeCards = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <div className="flex gap-4">
    {[
      { value: 'light', label: '浅色模式', classes: 'bg-[#f5f3ee]' },
      { value: 'auto', label: '汽车', classes: 'bg-[#3d3c39]' },
      { value: 'dark', label: '深色模式', classes: 'bg-[#4a4844]' },
    ].map(card => (
      <button key={card.value} type="button" onClick={() => onChange(card.value)} className="flex flex-col items-center gap-3">
        <div className={`h-[96px] w-[126px] rounded-xl border ${value === card.value ? 'border-[#4f8df6] shadow-[0_0_0_1px_#4f8df6]' : 'border-[#d9d4ca]'} ${card.classes} p-3`}>
          <div className="flex h-full flex-col justify-between">
            <div className="flex justify-end">
              <div className={`h-3 w-10 rounded-full ${card.value === 'light' ? 'bg-white/80' : 'bg-black/45'}`} />
            </div>
            <div className="space-y-2">
              <div className={`h-2 w-12 rounded-full ${card.value === 'light' ? 'bg-[#d7d2c8]' : 'bg-white/25'}`} />
              <div className={`h-2 w-16 rounded-full ${card.value === 'light' ? 'bg-[#d7d2c8]' : 'bg-white/25'}`} />
            </div>
            <div className={`h-7 rounded-xl ${card.value === 'light' ? 'bg-white' : 'bg-white/15'} flex items-center justify-end px-2`}>
              <div className="h-2.5 w-2.5 rounded-full bg-[#d97757]" />
            </div>
          </div>
        </div>
        <span className="text-[14px] text-claude-textSecondary">{card.label}</span>
      </button>
    ))}
  </div>
);

const ChatFontCards = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <div className="flex gap-4">
    {[
      { value: 'default', label: '默认聊天字体', sample: 'Aa', className: 'font-serif' },
      { value: 'sans', label: 'Sans聊天字体', sample: 'Aa', className: 'font-sans' },
      { value: 'system', label: '系统聊天字体', sample: 'Aa', className: 'font-sans' },
      { value: 'dyslexic', label: '适合诵读困难的聊天字体', sample: 'Aa', className: 'tracking-wide' },
    ].map(card => (
      <button key={card.value} type="button" onClick={() => onChange(card.value)} className="flex w-32 flex-col items-center gap-2">
        <div className={`flex aspect-[4/3] w-full items-center justify-center rounded-xl border bg-white text-[28px] shadow-sm transition ${value === card.value ? 'border-[#4f8df6] shadow-[0_0_0_1px_#4f8df6]' : 'border-[#d9d4ca] hover:border-[#c7c1b6]'} ${card.className}`}>
          {card.sample}
        </div>
        <span className="text-center text-[13px] leading-5 text-claude-textSecondary">{card.label}</span>
      </button>
    ))}
  </div>
);

const AnimationCard = ({ label, active }: { label: string; active?: boolean }) => (
  <button type="button" className={`flex flex-col items-center gap-2`}>
    <div className={`h-[64px] w-[126px] rounded-xl border ${active ? 'border-[#4f8df6] shadow-[0_0_0_1px_#4f8df6]' : 'border-[#d9d4ca]'} bg-white`} />
    <span className="text-[14px] text-claude-textSecondary">{label}</span>
  </button>
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
