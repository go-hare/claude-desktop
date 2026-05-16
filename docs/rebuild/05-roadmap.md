# 05 · 重建路线图

> 把 [00 总览](./00-overview.md) 里的 C 方案落到具体阶段、具体任务。

---

## 阶段概览

```
阶段 0: 黑盒拼装          ─── 1-2 周    ─── 让 SPA 起来
阶段 1: IPC 桥架补全      ─── 1-2 月    ─── 核心功能可用
阶段 2: 替换 @ant 二进制   ─── 1 月      ─── 支持 Linux / 摆脱二进制
阶段 3: 替换 ion-dist      ─── 3-6 月    ─── 完全自主前端（可推迟无限期）
```

---

## 阶段 0：黑盒拼装（让 SPA 起来）

### 目标

- 在新项目壳里能加载 ion-dist
- 看到完整官方 UI
- 能登录（OAuth 走 claude.ai）
- 能创建对话、发消息、收消息

### 任务清单

#### 0.1 验证引擎可用（先做这个）

**目的**：先确认 `claude-code-1` 能被 `@anthropic-ai/claude-agent-sdk` 调用，因为这是后面所有路径的前提。

```bash
# 1. 构建 claude-code-1
cd /Users/apple/work-py/hare-code/claude-code-1
bun install
bun run build

# 2. 验证产物
ls dist/
# 期待看到 cli-node.js, cli-bun.js, core.js

# 3. 装 SDK
cd /tmp/sdk-test
mkdir -p . && cd .
npm init -y
npm install @anthropic-ai/claude-agent-sdk

# 4. 写最小测试程序
cat > test.mjs <<'EOF'
import { createHeadlessChatSession } from '@anthropic-ai/claude-agent-sdk'
const session = createHeadlessChatSession({
  cwd: process.cwd(),
  provider: {
    baseUrl: 'https://api.anthropic.com',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  },
  pathToClaudeCodeExecutable: '/Users/apple/work-py/hare-code/claude-code-1/dist/cli-node.js',
})
for await (const msg of session.stream('list files in this directory')) {
  console.log(JSON.stringify(msg))
}
EOF
ANTHROPIC_API_KEY=sk-... node test.mjs
```

**验收**：能看到 stream-json 事件输出。

#### 0.2 创建新项目骨架

```
app/
├── package.json
├── electron-vite.config.ts
├── tsconfig.json
├── src/
│   ├── main/
│   │   ├── index.pre.ts          ← 加载器（最简版，没 Sentry）
│   │   ├── index.ts              ← 主进程
│   │   ├── protocol/
│   │   │   └── appProtocol.ts    ← 注册 app:// 协议
│   │   ├── windows/
│   │   │   └── mainWindow.ts     ← 创建主窗口
│   │   ├── ipc/
│   │   │   ├── bridge.ts         ← IPC 桥架核心（消息分发 + zod 校验）
│   │   │   └── stubs.ts          ← 默认返回 NOT_AVAILABLE 的 stub
│   │   └── engine/
│   │       └── claudeCodeAdapter.ts  ← 包装 @anthropic-ai/claude-agent-sdk
│   ├── preload/
│   │   └── index.ts              ← 暴露 IPC client 给 ion-dist
│   └── renderer/                 ← Electron 窗口壳（titleBar + 错误 UI）
│       └── main_window/
│           ├── index.html
│           └── main.tsx
├── vendor/
│   └── @ant/
│       ├── claude-native/        ← 从 .tmp/official-app/node_modules/@ant 拷
│       └── claude-swift/
├── ion-dist/                     ← 从 Claude-Deepseek.app/Contents/Resources 拷
└── packages/
    ├── ipc-codegen/              ← 自己写的简化版
    └── ant-utils/                ← 工具
```

#### 0.3 实现核心 IPC（约 10 个 method）

只实现让 SPA 能起来 + 最小可用对话的 method：

```
=== 启动期必备 ===
claude.settings::AppFeatures.getSupportedFeatures   ← 让 SPA 知道哪些功能可用（返回 stub）
claude.settings::AppConfig.*                         ← 4 个
claude.settings::DesktopInfo.*                       ← 2 个
claude.settings::AppPreferences.getPreferences
claude.settings::AppPreferences.setPreference
claude.hybrid::DesktopIntl.getInitialLocale          ← i18n

=== 窗口 ===
claude.internal.ui::MainWindowTitleBar.*             ← 7 个
claude.web::WindowControl.close
claude.web::WindowState.getFullscreen
claude.web::WindowState.getVisibility

=== Toast / 通知（最简） ===
claude.web::Toast.showToast
claude.web::DesktopNotifications.show

=== 鉴权（先简化版：手填 API key） ===
claude.web::Account.setAccountDetails                ← 内存存
```

**注意**：先**不**实现 `claude.web::Auth.doAuthInBrowser`。OAuth 暂时跳过，让用户手填 API key 进入（在主窗口加个简单设置）。

#### 0.4 实现 ClaudeCode 引擎入口

只实现：

```
claude.web::ClaudeCode.getStatus            返回 { ready: true }
claude.web::ClaudeCode.prepare              一次性预热
claude.web::ClaudeCode.checkGitAvailable    检查系统 git
claude.web::ClaudeCode.resolveLocalSettings 返回工作目录、模型等
```

#### 0.5 实现最小本地会话（从 LocalSessions 126 个里挑 10 个）

```
claude.web::LocalSessions.getAll              ← 列对话
claude.web::LocalSessions.getSession          ← 拿对话详情
claude.web::LocalSessions.archive             ← 归档
claude.web::LocalSessions.delete              ← 删除
claude.web::LocalSessions.sendMessage         ← 发消息（实际 method 名待确认）
claude.web::LocalSessions.getTranscript       ← 拿历史
claude.web::LocalSessions.getCodeStats        ← stats
claude.web::LocalSessions.addDirectories      ← 选工作目录
claude.web::LocalSessions.getDetectedProjects ← 列检测到的项目
claude.web::LocalSessions.checkGitAvailable
```

**存储**：先用 `electron-store`（JSON 文件）。后期再考虑 SQLite。

#### 0.6 验证

**验收标准**：

- 能 `npm run dev` 起来一个 Electron 窗口
- 看到官方完整 UI（来自 ion-dist）
- 能配置 API key（最简表单）
- 能选一个工作目录，新建一个会话
- 发一条消息（"ls" 或类似），看到 Claude 返回的内容
- 流式输出能正常显示

---

## 阶段 1：IPC 桥架补全（核心功能可用）

### 目标

- 实现 200-300 个 IPC method，覆盖 95% 的 SPA 路径
- OAuth 流程跑通（接 claude.ai）
- Git / PR / Diff 功能可用
- Skills 系统可用
- 自动更新可用

### 任务清单

#### 1.1 写一个 IPC schema 提取脚本

扫主进程 bundle，找每个 `$eipc_message$_..._<class>_$_<method>` 字符串**附近**的 zod schema，反推每个 method 的参数 / 返回值类型。

输出：`docs/rebuild/ipc-types.d.ts`（584 个 method 的 TypeScript 类型定义）

工作量：1-2 天

#### 1.2 补全 claude.web::LocalSessions（126 个）

按功能分组逐步实现：

- 消息收发（10 个）
- Git / PR（25 个）
- Stats / Effort / Permission（15 个）
- Agent 子会话（10 个）
- SSH（5 个）
- 其它（60 个）

#### 1.3 实现 LocalAgentModeSessions（69 个）

Agent mode 会话，包括草稿、bridge、trusted folder、MCP 等。

#### 1.4 OAuth 流程

实现：

- `claude.web::Auth.doAuthInBrowser`
- `claude.web::DeepLink.handleDeepLink`
- `claude.web::Account.setAccountDetails`（持久化）

注册 `claude://` deep link 协议。

**决策点**：是真接 claude.ai（需要 Anthropic 允许我们的 redirect URI——几乎不可能），还是搭自己的鉴权后端？

#### 1.5 自动更新

实现 `claude.web::AutoUpdater.*`（6 个），用 `electron-updater`，发布到自己的 endpoint。

#### 1.6 Skills 系统

实现 `claude.skills::Skills.previewSkillFile` 以及 `LocalAgentModeSessions` 里的 skill 子集。

复用 `~/.claude/skills/` 目录约定。

#### 1.7 FileSystem（17 个）

文件系统操作，对应 ion-dist 里的"附件"、"上传文件"、"导出 PDF"等 UI。

#### 1.8 设置页（AppFeatures / Extensions / MCP / Startup / SupportBundle / etc.）

设置页能正确显示和保存。

#### 验收

- 能完整登录（OAuth 或自鉴权后端）
- Code 页所有功能都能跑（Git / PR / Diff / Stats / Skills）
- 设置页能配置 MCP server、扩展、快捷键
- 自动更新能检测到新版本

---

## 阶段 2：替换 @ant 二进制（可选）

### 目标

- 不依赖 `@ant/claude-native.node` 和 `@ant/claude-swift.node`
- 支持 Linux

### 任务清单

#### 2.1 分析 @ant/claude-native 实际提供的 API

把它 require 进 Node REPL，看 `module.exports` 的方法签名。可能的功能：

- 系统信息（CPU/内存/磁盘）
- 文件系统增强（监听 / 高速读写）
- 加密
- 平台特定路径

#### 2.2 用纯 JS / 公开 npm 包替代

- 系统信息：`systeminformation` / `os-utils`
- 文件监听：`chokidar`
- 加密：`crypto`（node 内置）

#### 2.3 macOS Swift 桥架的替代

`@ant/claude-swift` 提供：

- `quickAccess`：macOS 快速访问
- `notifications`：通知（用 Electron 内置 `Notification` 替代）
- `desktop`：桌面状态
- `vm`：虚拟机控制（这是 ClaudeVM 用的，跳过）
- `midnightOwl`：未知
- `hotkey`：全局热键（用 Electron `globalShortcut` 替代）
- `permissionFixer`：macOS 权限修复
- `wakeScheduler`：唤醒调度（用 cron-like 库替代）
- `updater`：更新（用 electron-updater 替代）
- `computerUse`：Computer Use 后端（用 claude-code-1 的 computer-use-input/swift 替代）

大部分可以用 Electron 内置 + 公开 npm 包替代，**只有少数 macOS 特有功能会有差异**。

### 验收

- Linux 上能跑
- macOS 上功能等价（90%+）

---

## 阶段 3：替换 ion-dist（可选，可无限期推迟）

### 目标

- 用我们自己的 React 代码替换 ion-dist
- 完全拥有前端代码（汉化、定制、风格调整）

### 任务清单

**这是最重的活，估计 3-6 人月**，但有几个好处：

1. 不依赖 Anthropic 的 SPA 更新（避免协议变更）
2. 可以定制 UI（汉化、主题、布局）
3. 可以裁剪（去掉用不到的 Cowork 之类）

#### 3.1 提取 ion-dist 的 IPC 客户端

ion-dist 里约 100 KB 的代码负责调 IPC。先反编译这部分，搞清楚前端怎么调用主进程的 584 个 method。

#### 3.2 提取 ion-dist 的 React 组件树

用 React DevTools + 静态分析，把组件树打出来。这是个手工活，但有现成的 [react-tree-walker](https://github.com/ctrlplusb/react-tree-walker) 等工具帮忙。

#### 3.3 按路由逐个重写

ion-dist 的路由结构（推断）：

- `/` 首页
- `/chat/:id`
- `/code` 代码页
- `/code/:id`
- `/projects`
- `/projects/:id`
- `/settings`
- `/settings/*`
- `/cowork/*`

每次重写一个路由（保持 IPC 接口不变），用 React 18 + Tailwind 重写。

#### 3.4 灰度切换

新旧前端共存，路由级别灰度。

### 验收

- 所有功能等价
- 性能不下降
- 代码完全自己的

---

## 时间表（单人）

| 阶段 | 工作量 | 截止 |
|---|---|---|
| 写文档（本目录） | 0.5 天 | 今天 |
| 阶段 0.1 验证引擎 | 1 天 | +1 天 |
| 阶段 0.2-0.4 项目骨架 + 协议 + 基础 IPC | 3-5 天 | +1 周 |
| 阶段 0.5 最小会话 | 2-3 天 | +2 周 |
| **阶段 0 完成** | — | **+2 周** |
| 阶段 1.1 类型提取 | 1-2 天 | +2.5 周 |
| 阶段 1.2 LocalSessions 补全 | 2 周 | +4.5 周 |
| 阶段 1.3 LocalAgentModeSessions | 1.5 周 | +6 周 |
| 阶段 1.4 OAuth | 1 周 | +7 周 |
| 阶段 1.5-1.8 其它 | 2 周 | +9 周 |
| **阶段 1 完成** | — | **+2 月** |
| 阶段 2 替换二进制 | 1 月 | +3 月 |
| 阶段 3 替换 SPA | 3-6 月 | +6-9 月 |

---

## 立即可做的下一步

按"先简单后复杂"：

1. **写文档完成**（你正在看的这个）
2. **构建 claude-code-1** 验证它能编译 → 验证 SDK 能调它（阶段 0.1）
3. **创建 `app/` 目录**，最小 `package.json` + `electron-vite.config.ts`（阶段 0.2 起步）
4. **从 .tmp/official-app/ 拷贝 vendor 资源**（阶段 0.2 续）
5. **写第一个 IPC handler**：`claude.settings::AppFeatures.getSupportedFeatures` 返回 `{}`，跑通 IPC 链路

---

## 验收 / 退出标准

每个阶段都有明确的"能演示什么"：

- **阶段 0 演示**：发一条消息给 Claude，看到回复（30 秒视频）
- **阶段 1 演示**：从 0 开始：登录 → 选项目 → 发"修个 bug" → Claude 改文件 → 创建 PR（5 分钟视频）
- **阶段 2 演示**：在 Linux 上重复阶段 1 演示
- **阶段 3 演示**：自己改一个 React 组件，立即反映到 UI 上

---

## 风险登记

| 风险 | 缓解 |
|---|---|
| ion-dist SPA 内部调了我们没实现的 IPC method 导致白屏 | 全局 catch + UI fallback 提示，逐步补全 |
| @anthropic-ai/claude-agent-sdk 大版本更新打破协议 | 锁版本，主动跟进 |
| claude.ai OAuth 必须用官方 redirect URI | 阶段 1 决策时再处理 |
| `.node` 二进制公证失败 | macOS 上跟自己 app 一起公证；准备好 fallback（跳过 swift_addon 的功能） |
| 工程量大 / 拖延 | 严格按阶段验收；每阶段 ≤ 2 月 |
