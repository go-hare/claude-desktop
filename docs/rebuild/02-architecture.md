# 02 · 官方架构：主进程 / 渲染进程 / 引擎三层是怎么连的

> 关键问题：**真正的 UI 在哪？主进程怎么跑引擎？前后端怎么通信？**

---

## 顶层架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                   Electron 主进程（Node.js）                      │
│                                                                  │
│   .vite/build/index.pre.js (loader, 759 KB)                     │
│            │                                                     │
│            ▼ require                                             │
│   .vite/build/index.js (主 bundle, 12 MB)                       │
│      ├─ 启动时注册自定义协议: app://                              │
│      │       → 指向 Resources/ion-dist/ 目录                     │
│      ├─ 创建 BrowserWindow                                       │
│      │       → win.loadURL("app://localhost/")                  │
│      ├─ 暴露 584 个 IPC method（claude.web::*, claude.settings::*…）│
│      └─ 拉起子进程跑引擎                                          │
│              │                                                   │
│              ▼ child_process.spawn                              │
│   @anthropic-ai/claude-agent-sdk → claude CLI 二进制             │
│              │                                                   │
│              ▼ stream-json over stdin/stdout                    │
│   Claude Code 引擎（claude-code-1 编译产物）                     │
│      ├─ 调上游 API (api.anthropic.com)                          │
│      ├─ 跑工具 (Read/Write/Edit/Bash/Glob/Grep/…)                │
│      └─ 跑 SSH / Computer Use / MCP                              │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │ IPC over Electron preload bridge
                            │ ($eipc_message$_<uuid>_$_<ns>_$_<class>_$_<method>)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Electron 渲染进程（BrowserWindow，Chromium）        │
│                                                                  │
│   .vite/renderer/main_window/index.html                         │
│      ↑ 这只是壳！里面写：                                         │
│      "this is the html for app title bar and error UI.          │
│       everything else gets loaded from claude.ai"                │
│                                                                  │
│   BrowserWindow 实际加载: app://localhost/                       │
│      → 主进程协议处理器返回 Resources/ion-dist/index.html        │
│      → SPA 启动                                                  │
│                                                                  │
│   Resources/ion-dist/ (155 MB)                                  │
│      ├─ index.html                                              │
│      ├─ assets/v1/*.js (627 个 chunk, React + claude.ai UI)     │
│      ├─ assets/v1/*.zst (650 个 zstd 压缩 chunk)                │
│      ├─ assets/v1/*.css, woff2, gif, png …                      │
│      └─ i18n/ (47 种语言)                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三个关键技术点

### 1. `app://` 自定义协议 — ion-dist 怎么被 serve

主进程 bundle 里能找到这行（位置约 11_886_711 字节）：

```js
const e = Ii();
const A = e.orgUuidOverride();
...
try {
  prr(tA.join(Hot(), "ion-dist"), t ?? void 0)
} catch (l) {
  S.error("Failed to install app:// protocol handler: %o", { error: l })
}
```

- `Hot()` 是获取 app resources 根目录的函数（约等于 `app.getAppPath()` 或 `process.resourcesPath`）
- `prr(...)` 是协议注册函数，把 `path.join(resourcesRoot, "ion-dist")` 注册成 `app://` 协议的根

也就是说：

```
浏览器请求 app://localhost/index.html
        ↓
主进程协议处理器：
        ↓
返回文件 Resources/ion-dist/index.html
```

为什么用自定义协议而不是 `file://`？因为：

- `file://` 在现代 Chromium 里有大量安全限制（CORS、Service Worker 等）
- `app://` 可以注册为 `standard` + `secure` + `supportsFetchAPI`，行为跟 `https://` 接近，CSP 一样工作
- claude.ai 网页版的代码可以**几乎不改**就部署成桌面 SPA

### 2. 渲染进程的"壳" HTML 和真正的 SPA 是分开的

`.vite/renderer/main_window/index.html` 只包含：

- 窗口 title bar（macOS 红绿灯 / Windows 控制按钮）
- 错误降级 UI（断网、加载失败时显示）
- 几个内置字体

它**不是 SPA**。它的核心代码（`main-D5jT4tJA.js`）只有 ~290 KB，主要是 React 拦截 + IPC 客户端代码。

真正的 SPA（React + claude.ai 全部界面）在 ion-dist，由 `app://` 协议提供。

实际渲染时是两个层：

```
BrowserWindow
├─ titleBar overlay (来自 renderer/main_window，常驻顶部)
└─ <webview> 或 BrowserView，加载 app://localhost/ (ion-dist)
```

具体怎么叠放，主进程里有 `WebContentsView` 相关代码（`mainView.js` 176 KB 就是这部分）。

### 3. 主进程 → Claude Code 引擎用的是 `@anthropic-ai/claude-agent-sdk`

主 bundle 里能直接找到这段异常字符串：

```js
throw Error(
  `Native CLI binary for ${process.platform}-${process.arch} not found. ` +
  `Reinstall @anthropic-ai/claude-agent-sdk without --omit=optional, ` +
  `or set options.pathToClaudeCodeExecutable.`
)
```

这说明：

- 主进程使用了 `@anthropic-ai/claude-agent-sdk` 这个公开 npm 包
- SDK 内部按平台 + arch 在 `node_modules/@anthropic-ai/claude-agent-sdk-{platform}-{arch}/claude` 找 CLI 二进制
- 也可以通过 `options.pathToClaudeCodeExecutable` 显式指定

SDK 工作原理（参考公开文档）：

```
const session = createHeadlessChatSession({
  cwd: workspacePath,
  sessionId: '...',
  provider: { baseUrl, apiKey, model },
  includePartialMessages: true,
  onPermissionRequest: (req) => { ... }
})

for await (const message of session.stream(prompt)) {
  // 处理流式消息
}
```

底层：

```
主进程 spawn:
  claude --output-format stream-json --input-format stream-json --verbose -p
       ↑ Claude Code 二进制（claude-code-1 构建产物）

stdin/stdout 双向 stream-json
  → user message in
  ← stream_event / content_block_delta / tool_use / result out
```

---

## 启动序列（推断，从字符串和函数签名）

```
1. Electron 启动 → 加载 main 字段 .vite/build/index.pre.js
2. index.pre.js 装好 Sentry / 模块 hook → require .vite/build/index.js
3. app.whenReady():
   a) 读取持久化配置（electron-store）
   b) 注册 app:// 协议 → 指向 Resources/ion-dist
   c) 初始化 @ant/claude-native (Rust NAPI, 跨平台原生功能)
   d) macOS: 初始化 @ant/claude-swift (通知 / 热键 / VM 等)
   e) 准备 OAuth 状态
   f) 创建 BrowserWindow
        - loadURL("app://localhost/")
        - 内嵌 WebContentsView
        - 注入 preload (titleBar/IPC 客户端)
   g) 等待 SPA 加载完成，IPC 开始通信
4. 用户登录后:
   a) SPA 调 IPC: claude.web::Auth.login
   b) 主进程开始 OAuth 流程, 弹外部浏览器到 claude.ai
   c) OAuth callback (claude.ai/desktop/callback) 回到主进程
   d) token 存到 electron-store
5. 用户创建对话:
   a) SPA 调 IPC: claude.web::ClaudeCode.createSession
   b) 主进程通过 @anthropic-ai/claude-agent-sdk 创建 session
   c) 主进程 spawn claude CLI 子进程
6. 用户发消息:
   a) SPA 调 IPC: claude.web::ClaudeCode.sendMessage
   b) 主进程把消息写到子进程 stdin (stream-json)
   c) 子进程通过 stdout 回 stream events
   d) 主进程通过 IPC 推回 SPA: claude.web::ClaudeCode.onStreamEvent
```

---

## 主进程内部的几个独立 chunk

`.vite/build/` 下还有几个文件是**主进程自己 spawn 的 worker / 子进程**：

| 文件 | 触发时机 | 干什么 |
|---|---|---|
| `mcp-runtime/directMcpHost.js` | 用户启用 MCP server 时 | 在子进程里跑 MCP 服务器宿主 |
| `mcp-runtime/nodeHost.js` | 同上 | MCP 的 node 桥 |
| `shell-path-worker/shellPathWorker.js` | 主进程启动时 | 读取用户 shell 的 PATH（macOS 需要 spawn 一个 login shell 才能拿到正确 PATH） |
| `transcript-search-worker/transcriptSearchWorker.js` | SPA 触发会话搜索 | worker 线程跑全文搜索 |
| `buddy.js`（窗口） | "Buddy" 蓝牙设备配对 | 独立窗口 |
| `coworkArtifact.js`（窗口） | Cowork artifact 预览 | 独立窗口 |
| `findInPage.js`（窗口） | Cmd+F 触发 | 独立小窗口 |

---

## 文件加载顺序（运行时）

按 grep 出来的 require 顺序还原（不完整）：

```
1. .vite/build/index.pre.js
   ├─ 模块 hook 安装
   ├─ Sentry 初始化
   └─ require('./index.js')

2. .vite/build/index.js (12 MB)
   ├─ require('@ant/claude-native')        ✅ asar 内
   ├─ require('@ant/claude-swift')         ✅ asar 内 (macOS only)
   ├─ require('electron')
   ├─ require('node:*')
   ├─ require('ws')                        ✅ asar 内
   └─ ... 其它内置工具

3. 运行时 spawn:
   ├─ {appResources}/claude-cli-binary    ⬅ Claude Code 二进制
   ├─ .vite/build/mcp-runtime/directMcpHost.js (按需)
   ├─ .vite/build/shell-path-worker/shellPathWorker.js (启动时)
   └─ ...

4. BrowserWindow 加载:
   └─ app://localhost/index.html
       → Resources/ion-dist/index.html
       → 加载所有 SPA chunk
```

---

## 一些关键边界

- **OAuth 必须真走 claude.ai**：`https://claude.ai/desktop/callback` 是硬编码的 redirect URI，client_id `89355bc3-cbfd-4382-905b-976645cad410` 也是硬编码的。我们重建时**这部分要么真接 claude.ai（需要 Anthropic 允许我们的 redirect URI，几乎不可能）要么换成自己的鉴权后端**。
- **ion-dist 是 https://claude.ai SPA 的桌面打包版**：里面的代码大部分跟网页版一样，**任何依赖 claude.ai 后端的功能（账号、对话历史、共享等）都需要真的能登录到 claude.ai**。
- **本地功能（Claude Code 引擎 / Skills / 本地文件操作）才是真正可重建的部分**：这些不依赖 claude.ai 后端，主进程 IPC 自己实现。

---

## 重建意味着什么

把上面的架构图作为蓝图，**新项目主进程要实现**：

1. ✅ `app://` 协议注册（指向我们自己的 ion-dist 或重建的 SPA）
2. ✅ BrowserWindow 管理 + title bar overlay
3. ✅ 584 个 IPC method（按 namespace 分批实现，先核心 50 个）
4. ✅ `@anthropic-ai/claude-agent-sdk` 包装（连到 claude-code-1 构建出的二进制）
5. ✅ OAuth 流程（这里要决策：真接 claude.ai vs 自己的鉴权）
6. ✅ 持久化（electron-store）
7. ✅ 自动更新（用 electron-updater）
8. ⏭ 各种 worker (shell-path / transcript-search 等)
9. ⏭ 几个独立窗口 (about / find-in-page / quick / buddy / cowork-artifact)

---

## 下一步

→ [03 · IPC 协议观察](./03-ipc-protocol.md)
