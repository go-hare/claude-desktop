# Code Official Features Migration

## 目标

以官方 Claude Desktop Code 页为唯一对照来源，迁移功能与交互。当前项目里的 `CodePage.tsx` 只能作为承载壳使用，不再作为功能设计来源。

## 官方依据

官方运行包路径：

- `C:\Program Files\WindowsApps\Claude_1.4758.0.0_x64__pzs8sxrjxfjjc\app\resources\ion-dist\assets\v1\c11959232-DvyLDI18.js`
- `C:\Program Files\WindowsApps\Claude_1.4758.0.0_x64__pzs8sxrjxfjjc\app\resources\ion-dist\assets\v1\cb4f243f3-BGHKAFZa.css`
- `C:\Program Files\WindowsApps\Claude_1.4758.0.0_x64__pzs8sxrjxfjjc\app\resources\ion-dist\assets\v1\cc13f8cc7-DSuYDLVL.js`

已确认的官方入口与组件：

- `EpitaxyFramePage`：Code 页总入口，官方打包函数名为 `cC`
- `EpitaxyChatPanel`：会话工作区，官方打包函数名为 `xj`
- `EpitaxyActionCenter`：首页 stats / sessions / pull requests 区域，官方打包函数名为 `$x`
- `EpitaxyComposer`：底部输入框，官方打包函数名为 `ub`
- `EpitaxyDraftClawd`：底部 Clawd 动画，官方打包函数名为 `gj`
- `ClawdLaptopInner`：官方 Lottie 动画，官方包为 `cc13f8cc7-DSuYDLVL.js`
- `EpitaxySecondPane`：第二 pane 入口，官方导出在 `fC`

已确认的官方样式轨道：

```css
.epitaxy-root .epitaxy-chat-size {
  max-width: 120ch;
  margin-inline: auto;
  padding-inline: clamp(32px, 6%, 96px);
}
```

官方首页标题轨道：

```text
epitaxy-chat-column epitaxy-chat-size
pt-[12px] pb-[24px]
```

官方 stats 区域：

```text
epitaxy-chat-column epitaxy-chat-size py-[24px]
```

官方 Action Center 区域：

```text
epitaxy-chat-column epitaxy-chat-size
pt-[24px] pb-[56px] flex flex-col gap-[40px]
```

## 官方 Code 执行模型

官方 Desktop Code 的 `Local` session 是本机运行模型，不是前端直接请求远端业务 server 跑 Code。

端到端边界：

1. Renderer 只调用本机 Desktop API / Electron bridge
2. Bridge 创建或复用本机 Claude Code runtime session
3. Local session 的 cwd 是用户选择的本地目录
4. 本机 runtime / engine 负责 tools、permission、resume、stream 与 abort
5. 模型推理由 runtime 携带 provider 配置请求 Anthropic / 兼容 provider API

官方依据：

- 官方文档：`Local` session runs on your machine；Desktop uses the same underlying engine as Claude Code CLI
- 官方对照包：`.tmp-official-app/electron/main.cjs` 通过 `createHeadlessChatSession({ cwd, sessionId, provider, includePartialMessages })` 创建 headless session，并在 `/api/chat` 中调用 `session.stream(prompt)`
- 官方 SDK bundle：`HeadlessChatSessionImpl.stream()` 会设置 provider env、获取 commands/tools、调用 `ask({ cwd, tools, mutableMessages, userSpecifiedModel, ... })`

当前项目对应关系：

- `/api/chat` 是本机 bridge endpoint，不是远端 chat server
- `electron/bridge-server.cjs` 当前通过 `spawnPersistentEngine()` 启动本机 Claude Code engine subprocess，并用 `conv.code_cwd || conv.workspace_path` 作为 cwd
- Electron app 按官方结构拆两类数据目录：Desktop `userData` 使用 `~/Library/Application Support/Claude/`，Code runtime/config 使用 `~/Library/Application Support/Claude-3p/`
- 每个本机 Code engine subprocess 都继承 `CLAUDE_CONFIG_DIR=~/Library/Application Support/Claude-3p`，并把 `--add-dir` 指向同一 Code 数据目录，而不是用户全局 `~/.claude`
- provider / `ANTHROPIC_BASE_URL` 只决定本机 engine 往哪里发模型推理请求；不改变 Code session 由本机 engine 执行的边界
- `code_cwd` conversation 强制关闭 `research_mode`，避免 Code session 绕过本机 engine 进入普通 research orchestrator
- `/code/:id` 只允许带 `code_cwd` 的本机 Code conversation 继续发送；普通 conversation 进入该 route 时会提示先启动 local session

## 官方功能分层

### 1. Landing / Action Center

官方首页不是空白输入框，而是状态中心。

功能：

- 显示标题 `接下来做什么？`
- 显示 Code stats 卡片
- 当存在需要注意的会话时显示 `Sessions`
- 当存在 PR 相关事项时显示 `Pull requests`
- 支持 `Mark all read`
- 支持 `Show less` / `Show {count} more`
- 点击 session 进入对应 Code 会话
- 点击 PR 进入对应 session 并打开 `diff` pane

官方文本来源：

- `Sessions`
- `Pull requests`
- `Mark all read`
- `Show less`
- `Show {count} more`

当前项目状态：

- `/code` 首页已改为官方 Epitaxy 轨道结构
- stats 已接入真实 bridge API，并按官方 `vh/xh/jh/Rh` 的 overview / models / range 结构渲染
- Clawd 已从错误 GIF 改为官方 `Clawd-Laptop` Lottie 数据
- Action Center 已按官方 `$x/Hx` 分支接入真实 Code sessions：仅展示带 `code_cwd` 的 conversation，支持 `Mark all read` / `Show less` / `Show {count} more` / 点击进入 `/code/:id`
- 尚无官方 PR attention 数据结构

迁移建议：

1. 保留 stats all-clear 分支
2. 使用真实 `code_cwd` conversation 展示 Sessions 分支
3. 再接 PR attention
4. 最后把 read/unread 状态从 localStorage 升级为后端持久字段

### 2. 启动 Code 会话

官方 composer 不只是 textarea，它负责选择运行环境并启动 session。

功能：

- `Local`
- `SSH`
- `Remote`
- `Bridge`
- 选择文件夹
- 选择 repo / remote environment
- 选择 model
- 选择 effort
- 选择 permission / mode
- 输入 prompt
- Enter 提交
- Escape / Stop 停止
- 创建 draft session
- session 启动后跳转到 `/code/:sessionId`

官方阻塞提示：

- `Select a folder first.`
- `SSH configuration is unavailable.`
- `Bridge environment unavailable.`
- `Bridge is offline.`
- `Bridge is at capacity ({active} of {max} sessions).`
- `Select a repo first.`

当前项目状态：

- 已有 `createConversation`
- 已有 `sendMessage`
- 已有 workspace 目录
- 已有 engine subprocess 流式接口
- 当前 `/code` composer 可选择本地目录、创建 Code conversation 并跳转 `/code/:id`
- composer 视觉结构已收回官方 `epitaxy-prompt` / `epitaxy-prompt-input` / `EpitaxyDraftClawd`

第一优先级接入：

1. `Local`
2. 选择文件夹
3. 输入 prompt
4. 创建 conversation
5. 调用 `sendMessage`
6. 跳转 / 进入会话态

暂缓：

- SSH
- Remote
- Bridge
- self-hosted pool
- monorepo environment

### 3. 会话内聊天工作区

官方进入 session 后由 `EpitaxyChatPanel` 负责工作台。

功能：

- 加载 session meta
- 加载 transcript
- 流式响应
- 发送消息
- 停止响应
- reconnect / sync tail
- 标题同步
- cwd 解析
- fork at message
- rewind
- attach as context
- 图片读取
- 文件 mention
- queued message
- background task notification
- session not found / shared session handling

当前项目状态：

- 常规 Chat 页已有不少会话能力
- Code 页已使用独立 `CodeSessionPage`，不再落回通用 Chat 工作区
- `CodeSessionPage` 已能加载 transcript、发送后续消息、渲染 assistant/tool/thinking、显示 title/cwd/running 状态
- `CodeSessionPage` 已接入 active stream reconnect、generation status polling、stop generation 与完成后 transcript/title refresh
- Electron bridge 已补齐 `/api/conversations/:id/generation-status` 与 `/api/conversations/:id/stop-generation`，供 Code session route 恢复与停止生成使用

建议路线：

1. 先用现有 conversation / message 数据打通最小会话
2. 复用现有消息渲染与流式处理
3. 再补 Code 特有的 pane / cwd / file open 行为

### 4. Shell Command

官方 composer 支持 `! command`。

官方行为：

- 只有 local session 可用
- 没有 session 时提示 `Start a local session first to run shell commands`
- remote session 提示 `Shell commands are only available in local sessions`
- runner 不可用时提示 `Shell command runner unavailable`
- 执行后把输入、stdout、stderr 包进消息：

```xml
<bash-input>...</bash-input>
<bash-stdout>...</bash-stdout>
<bash-stderr>...</bash-stderr>
```

当前项目状态：

- bridge-server 已有 engine subprocess 能力
- 是否已有独立 `runBashCommand` 前端 API 需要再确认

迁移建议：

1. 先不接 `! command`
2. 会话收发稳定后，新增 local shell API
3. 前端按官方提示与 XML 消息格式处理

### 5. Side Panes

官方 side panes 是 Code 页核心差异，不属于首页第一阶段。

官方 pane 类型：

- `preview`
- `diff`
- `browser`
- `terminal`
- `side chat`
- `file`
- `subagent`
- `session`
- `runs`
- `tasks`

官方快捷键：

- `togglePreview`: `cmd+shift+p` / `cmd+alt+p`
- `toggleDiff`: `cmd+shift+d` / `ctrl+shift+d`
- `toggleTerminal`: `ctrl+\``
- `toggleBrowser`: `cmd+shift+f`
- `closePane`: `cmd+\`
- `toggleSideChat`: `cmd+;`
- `cycleTranscriptMode`: `ctrl+o`
- `openModeMenu`: `cmd+shift+m` / `cmd+alt+m`
- `openModelMenu`: `cmd+shift+i`
- `openEffortMenu`: `cmd+shift+e`
- `toggleSelectionMode`: `cmd+shift+s`

当前项目状态：

- 尚无官方 tiled pane layout
- 尚无 preview server 管理
- 尚无 diff pane 与 PR 绑定
- 尚无 terminal pane

迁移建议：

1. 会话功能稳定后再做 pane shell
2. 先接 `file`
3. 再接 `terminal`
4. 再接 `preview`
5. 最后接 `diff` / `browser` / `side chat`

### 6. File / Preview

官方打开文件逻辑：

- local session 使用 `pickSessionFile`
- draft 且已选 cwd 使用 `pickFileAtCwd`
- 图片文件用 image lightbox
- `.html/.svg/.pdf/.mp4/.webm/.m4v/.mov/.ogv` 优先走 preview
- `.cast` 可进入 terminal 播放
- 其他文件走 file pane

当前项目状态：

- 需要确认 bridge 是否已有对应文件选择 API
- 需要确认现有 Artifacts / file viewer 是否可复用

迁移建议：

1. 先接文件选择
2. 再接 file pane
3. 再接 html preview

## 当前项目已有能力对照

已存在：

- `src/api.ts`
  - `getConversations`
  - `createConversation`
  - `sendMessage`
  - `compactConversation`
  - stream reconnect
  - `getCodeStats`
- `electron/bridge-server.cjs`
  - conversation CRUD
  - engine subprocess
  - stream-json 转前端事件
  - workspace 管理
  - `/api/code/stats`
- `engine/stats-helper.ts`
  - 调用 `engine/src/utils/stats.ts` 获取真实 Code stats
- `src/components/CodePage.tsx`
  - 官方 Epitaxy 首页轨道
  - 官方 greeting / action center / composer 分区
- `src/components/code/`
  - `CodeComposer`
  - `CodeActionCenter`
  - `CodeStatsCard`
  - stats 子组件
- `src/components/CodeDraftClawd.tsx`
  - 官方 Clawd Lottie 包装组件
- `src/components/CodeSessionPage.tsx`
  - Code session route 的轻量工作区
  - transcript 加载、继续发送、stream reconnect、stop、title/cwd 状态

缺失：

- 官方 PR attention 数据
- 后端持久化 session read/unread 状态
- Code session fork / rewind / attach context
- Code session 图片读取 / 文件 mention / queued message
- background task notification 的官方式展示
- side pane layout
- preview server 管理
- terminal pane
- diff pane
- browser pane
- side chat

## 建议迁移顺序

### Phase 1：让 Code composer 真能启动本地会话

目标：

- 使用当前底层 conversation / engine 能力，让 `/code` 从静态页变成可启动 Code 会话的入口。

范围：

- `src/components/CodePage.tsx`
- `src/api.ts`
- 必要时小改 `electron/bridge-server.cjs`

验收：

- 选择本地文件夹
- 输入 prompt
- Enter 或发送按钮提交
- 创建 conversation
- engine 开始流式响应
- 页面进入会话态或跳转到对应会话
- 失败时显示官方风格错误提示

### Phase 2：接 Code session view

目标：

- 进入 session 后展示官方式工作区，而不是只停留在首页。

范围：

- 新建或复用 session view 组件
- 复用现有 message renderer
- 接 stream / reconnect / stop

验收：

- 能打开已有 Code session
- 能继续对话
- 流式、停止、恢复正常

### Phase 3：补 Action Center

目标：

- 首页出现官方 `Sessions` 区域。

范围：

- 从 conversation 数据提取 unread 近似状态
- 先不接 PR

验收：

- 有待处理会话时显示列表
- 点击进入 session
- 支持 show more / show less
- 支持 mark all read

当前状态：

- 已完成真实 `code_cwd` conversation 的 Sessions 分支
- 已完成 `Mark all read`
- 已完成 `Show less` / `Show {count} more`
- 已完成点击 session 跳转 `/code/:id`
- read/unread 目前使用 localStorage 记录 session 更新时间水位；后端尚未持久化
- pinned / blocked / review 需要官方 session 状态源，当前不伪造

### Phase 4：补文件与 terminal

目标：

- 接官方 Code 工作流最关键的本地能力。

范围：

- file picker
- file pane
- `! command`
- terminal pane shell

验收：

- 能从会话打开文件
- 能运行本地 shell command
- 输出以官方结构进入 transcript

### Phase 5：补 preview / diff / PR / browser / side chat

目标：

- 补齐官方高级 pane。

范围：

- preview server
- diff pane
- PR attention
- browser pane
- side chat pane

验收：

- preview 可打开 html / server
- PR 能打开 diff pane
- 快捷键与官方一致

## 不能再走的错误路线

- 不再用 fake stats 伪造官方数据
- 不再把 `getConversations()` 的普通聊天数据硬算成 Code stats
- 不再只改 padding / color 来声称“迁移官方”
- 不再把官方 pane 功能简化成静态按钮
- 不再在没有 bridge / runtime 验证时声称页面已完整接通

## 当前落地状态

### Phase 1：已接入最小闭环

已完成：

- `/code` composer 从静态 UI 改为真实输入状态
- 支持 Electron `selectDirectory` 选择本地文件夹
- 新建 conversation 时传入 `code_cwd`
- 后端保存 `code_cwd`，但不把它当作可删除 workspace
- persistent engine 和 `/compact` 优先使用 `code_cwd` 作为运行目录
- 新增 `/code/:id` 路由
- `/code/:id` 使用独立 `CodeSessionPage`，不再走通用 `MainContent`
- 从 `/code` 提交 prompt 后会创建 conversation，并带 `initialMessage` 进入 `/code/:id`
- `/code` 首页已迁移官方 Epitaxy visible shell：`Ox` greeting、`$x` stats action center、`ub` composer、`gj` draft Clawd
- 官方 `Clawd-Laptop` Lottie 已抽取为 `src/assets/code/clawd-laptop.json`

验证：

- `npm run build` 已通过
- `node --check electron\bridge-server.cjs` 已通过
- 构建仍有既有警告：`MainContent.tsx` duplicate key、clipboard 动静态导入、chunk size
- 真实 `createConversation -> sendMessage` API 链路需要在 Electron bridge 运行时继续端到端验证

### 后续建议

下一步做 Phase 2：

```text
Code session view -> 官方 Code 工作区外观 -> stop/reconnect/title/cwd 状态收口
```

Phase 1 已经让 Code 页从“官方外观页”进入“官方工作流入口”的最小形态；后面要继续把会话区从通用 Chat 外观收成官方 Code 工作台。

### Phase 2：已接入 session view 基础闭环

已完成：

- `/code/:id` 使用独立 `CodeSessionPage`
- 会话页加载 conversation meta、cwd 与 transcript
- 会话页继续发送消息并处理 text / thinking / tool events
- 会话页进入时可通过 active stream reconnect 接回正在生成的响应
- reconnect 不可用时可通过 generation-status snapshot polling 恢复运行态
- stop generation 调用 Electron bridge 并持久化已有 partial assistant 输出
- 完成或停止后刷新 transcript 与标题

验证：

- `node --check electron/bridge-server.cjs` 已通过
- `npm run build` 已通过
- 构建仍有既有警告：`MainContent.tsx` duplicate key、clipboard 动静态导入、chunk size
- 真实 Electron 端到端 smoke 仍需启动 app 后验证：打开 `/code/:id`、发送、刷新重连、停止生成

下一步：

```text
Code side pane shell -> file pane / terminal -> preview / diff / browser
```

### Phase 3：已接入 Code 模型 / Effort 选择

已完成：

- Code landing composer 和 Code session composer 使用同一个模型 / Effort popover
- UI 对齐官方菜单结构：模型区、Effort 区、快捷键提示与当前项勾选
- Code conversation 新建和更新都会持久化 `code_effort`
- `code_cwd` conversation 继续强制 `research_mode=false`
- Electron bridge 启动本机 Claude Code engine 时把 `code_effort` 转为 `--effort <low|medium|high|max>`
- engine pool 复用条件纳入 `effort`，切换 Effort 后会重启本机会话子进程而不是复用旧参数

验证：

- `node --check electron/bridge-server.cjs` 已通过
- `git diff --check` 已通过
- `npm run build` 已通过
- Electron 本机客户端已确认 Code session 底部 selector 可打开，并显示 `Sonnet 4.6 · Medium` 与 `Low / Medium / High / Max`
