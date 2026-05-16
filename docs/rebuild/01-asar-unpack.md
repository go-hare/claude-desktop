# 01 · app.asar 解包报告

> 输入：`Claude-Deepseek.app/Contents/Resources/app.asar`（66 MB）  
> 输出：`.tmp/official-app/`（解包后约 66 MB，1397 个文件）  
> 工具：`npx asar extract`

---

## 顶层目录

```
.tmp/official-app/
├── package.json                        @ant/desktop, productName "Claude", v1.6608.2
├── .vite/
│   ├── build/                          ← Electron 主进程 + worker
│   └── renderer/                       ← Electron BrowserWindow 用的小壳 HTML
└── node_modules/
    ├── @ant/claude-native/             ← 原生 Rust NAPI 绑定
    ├── @ant/claude-swift/              ← macOS Swift 桥接
    ├── ws/                             ← WebSocket
    └── node-pty/                       ← 原生 PTY
```

---

## .vite/build/ — 主进程 + worker

| 文件 | 大小 | 行数 | 作用 |
|---|---|---|---|
| `index.pre.js` | 759 KB | 66 | **package.json `main` 指向的入口加载器** |
| `index.js` | **12 MB** | 6515 | **主进程主 bundle**（所有逻辑都在这） |
| `mainWindow.js` | 158 KB | — | 主窗口创建逻辑（独立 chunk） |
| `mainView.js` | 176 KB | — | WebContentsView 嵌入 ion-dist 的逻辑 |
| `aboutWindow.js` | 139 KB | — | 关于窗口 |
| `quickWindow.js` | 139 KB | — | Spotlight 风格快速窗口 |
| `findInPage.js` | 137 KB | — | Cmd+F 查找栏 |
| `buddy.js` | 58 KB | — | "Buddy" 蓝牙设备配对 |
| `coworkArtifact.js` | 2.5 KB | — | Cowork artifact 渲染 |
| `computerUseTeach.js` | 1 KB | — | Computer Use 教学浮层 |
| `mcp-runtime/directMcpHost.js` | 571 KB | — | MCP 子进程宿主 |
| `mcp-runtime/nodeHost.js` | 4 KB | — | MCP node 桥 |
| `shell-path-worker/shellPathWorker.js` | 10 KB | — | 读取 shell PATH 的 worker |
| `transcript-search-worker/transcriptSearchWorker.js` | 3 KB | — | 会话搜索 worker |
| `window-shared.css` | 4.8 KB | — | 共享样式 |

**主进程是单文件巨型 bundle（12 MB）**，由 esbuild 打包，无 sourcemap。

---

## .vite/renderer/ — Electron 壳 HTML

```
.vite/renderer/
├── main_window/        ← 主窗口（只是壳）
├── about_window/
├── buddy_window/
├── find_in_page/
└── quick_window/
```

**关键发现**：`main_window/index.html` 顶部注释写得很清楚：

> ```html
> <!-- this is the html for app title bar and error UI.
>      everything else gets loaded from claude.ai -->
> ```

也就是说，**主窗口的 HTML 只包含 title bar 和错误 UI**。**真正的应用界面是从 `ion-dist/` 加载的**。

每个 `renderer/*/assets/` 都包含 4 个字体文件（Anthropic Sans / Serif 各 Roman/Italic），主入口 JS 一个，大小 250-300 KB。

---

## node_modules/ — asar 里打包的依赖

| 包 | 大小 | 类型 | 说明 |
|---|---|---|---|
| `@ant/claude-native/claude-native-binding.node` | 3.7 MB | NAPI 二进制 | Rust 写的原生扩展，跨平台 |
| `@ant/claude-swift/build/Release/swift_addon.node` | 35 MB | NAPI 二进制 | macOS Swift 桥（quickAccess / notifications / desktop / vm / hotkey / 等） |
| `@ant/claude-swift/build/Release/computer_use.node` | 906 KB | NAPI 二进制 | Computer Use 的 macOS Swift 实现 |
| `ws/` | — | 纯 JS | WebSocket 库 |
| `node-pty/` | — | 原生 + JS | 终端模拟 |

**主进程实际 require 的外部包**（剔除 node 内置和相对路径后）：

```
@ant/claude-native
@ant/claude-swift
ws
ajv-formats/dist/...
ajv/dist/...
electron
node-pty (在 node_modules 但未在 require 列表里看到，可能动态 require)
```

只有 2 个 `@ant/*` 是真正的外部 require，**其它所有 `@ant/*` 和 `@anthropic-ai/*` 都被 esbuild bundle 进 `index.js`**，没有作为独立包存在。

---

## Resources/ion-dist/ — 真正的前端 SPA（不在 asar 里）

不在 asar 内，单独放在 `Claude-Deepseek.app/Contents/Resources/ion-dist/`，约 155 MB。

```
ion-dist/
├── index.html              4.1 KB
├── index.html.zst          1.7 KB  ← 压缩版
├── robots.txt              390 B
├── favicon.ico             15 KB
├── assets/
│   └── v1/                 1395 个文件
│       ├── *.js            627 个
│       ├── *.zst           650 个  ← 压缩 JS
│       ├── *.css           21 个
│       ├── *.woff2         31 个
│       ├── *.ttf           21 个
│       ├── *.woff          20 个
│       ├── *.gif           16 个
│       ├── *.png           6 个
│       ├── *.svg           2 个
│       └── *.wasm          1 个
├── audio/
├── i18n/                   47 种语言 (.lproj)
└── images/                 14 个分类目录
```

`index.html` 加载的核心 chunk：

```html
<script>"/assets/v1/index-BELzQL5P.js"</script>
<script>"/assets/v1/vendor-CmVPl-QA.js"</script>
<script>"/assets/v1/c5f4e1303-CSqThUeQ.js"</script>
<script>"/assets/v1/c43c5949a-vQe16vbD.js"</script>
<script>"/assets/v1/c93fb40ec-C-L_NkHO.js"</script>
<script>"/assets/v1/c6d6815ff-DT1s-eQn.js"</script>
<script>"/assets/v1/tree-sitter-BFuuT2ac.js"</script>

<link rel="stylesheet" href="/assets/v1/c5f4e1303-2SC4Q2zq.css">
<link rel="stylesheet" href="/assets/v1/c43c5949a-CBkXKfji.css">
<link rel="stylesheet" href="/assets/v1/c6a992d55-CgNGFRYw.css">
```

ion-dist 是**官方 claude.ai 完整 SPA 的桌面发布版**，使用 React + Vite 构建。

---

## package.json 关键字段

```json
{
  "name": "@ant/desktop",
  "productName": "Claude",
  "version": "1.6608.2",
  "author": "Anthropic PBC",
  "main": ".vite/build/index.pre.js",
  "engines": { "node": ">=22.0.0" }
}
```

**主要依赖**（剔除 dev-only 工具）：

```
@ant/claude-native           内部 NAPI 绑定
@ant/claude-swift            内部 Swift 桥（macOS）
@ant/computer-use-mcp        内部 Computer Use MCP
@ant/claude-for-chrome-mcp   内部 Chrome MCP
@ant/imagine-server          内部
@ant/claude-ssh              内部 SSH
@ant/claude-screen-app       内部 屏幕共享
@ant/claude-swift-ant        内部
@ant/cowork-win32-service    内部（Windows）
@ant/chrome-native-host      内部
@ant/disclaimer              内部
@ant/dxt-registry            内部
@ant/ipc-codegen             内部 IPC 代码生成（关键!）
@ant/rfb-client              内部
@ant/utils                   内部

@anthropic-ai/claude-agent-sdk        0.2.128       ⭐ 引擎入口
@anthropic-ai/claude-agent-sdk-future 0.2.128-dev   beta
@anthropic-ai/conway-client           0.2.0-dev
@anthropic-ai/electron-devtools-mcp   workspace:*
@anthropic-ai/mcpb                    2.1.2
@anthropic-ai/sdk                     ^0.70.0       ⭐ 直连 Anthropic API

@modelcontextprotocol/sdk             1.28.0        MCP 协议
electron                              41.5.0
react                                 ^18.3.1
react-dom                             ^18.3.1
react-intl                            ^6.7.2
typescript                            ~6.0.2
vite                                  6.4.1

ws                                    ^8.18.0
node-pty                              1.1.0-beta34  (optional)
ssh2                                  ^1.16.0
sharp                                 0.34.3
electron-store                        ^8.2.0
electron-window-state                 ^5.0.3
zod                                   ^3.25.64

@sentry/electron                      ^7.4.0       ⭐ 错误上报
```

---

## 一些有趣的边角发现

### 1. 启动加载器先于主 bundle

`index.pre.js`（759 KB）是真正被 Electron `main` 字段加载的入口，它里面做了**模块系统补丁**（`require-in-the-middle` 之类），然后再 `require()` 主 `index.js`。这是为了让 Sentry 等监控库能 hook 后续所有 require。

### 2. Bundle 里的 OAuth 端点

```
https://claude.ai/desktop/callback              ← OAuth redirect URI
https://claude.com/cai/oauth/authorize          ← 授权端点
https://api.anthropic.com/api/oauth/claude_cli/create_api_key
```

OAuth client_id 也是硬编码的：`89355bc3-cbfd-4382-905b-976645cad410`。

### 3. Sentry release id

```js
t.SENTRY_RELEASE = { id: "ebf1a166e82541b54229aa620d117c60923a939a" }
```

可以用这个去 Sentry 反查 release（如果有权限）。

### 4. 数据库

主进程 require 列表里没有 sqlite，**会话存储很可能在主进程内存 + 文件 JSON**，或者交给 `@anthropic-ai/claude-agent-sdk` 处理。

### 5. 字体

主进程 bundle **内嵌**了 4 个字体（Anthropic Sans/Serif × Roman/Italic），给主窗口的 title bar 用。  
ion-dist 又另外打包了 31 个 woff2 + 21 个 ttf + 20 个 woff，给 SPA 用。  
**字体被打了两次**。

---

## 下一步

→ [02 · 官方架构 + ion-dist + app:// 协议](./02-architecture.md)
