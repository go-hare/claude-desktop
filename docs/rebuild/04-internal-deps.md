# 04 · 内部依赖处理策略：`@ant/*` 闭源包怎么办

> **核心问题**：官方 `package.json` 列了 16 个 `@ant/*` 内部包和几个 `@anthropic-ai/*` 包，npm 公开仓库一个都没有。重建时怎么办？

---

## 16 个 `@ant/*` 包分类

### 实际打包到 asar 里的（2 个）

| 包名 | 内容 | 大小 | 处置 |
|---|---|---|---|
| `@ant/claude-native` | Rust NAPI 绑定 (`.node` 二进制) | 3.7 MB | **直接拷过来用** |
| `@ant/claude-swift` | Swift NAPI 绑定 (`.node` 二进制，macOS 专用) | 35 MB | **直接拷过来用** |

这两个被打到 `asar/node_modules/@ant/`，是真实存在的 npm 包形态。`require('@ant/claude-native')` 会真的去 require 它们。

### 被 esbuild bundle 进 index.js 的（14 个）

```
@ant/chrome-native-host
@ant/claude-for-chrome-mcp     ← claude-code-1 已有
@ant/claude-screen-app
@ant/claude-ssh                ← claude-code-1 已有 (src/ssh)
@ant/claude-swift-ant
@ant/computer-use-mcp          ← claude-code-1 已有
@ant/cowork-win32-service
@ant/disclaimer
@ant/dxt-registry
@ant/imagine-server
@ant/ipc-codegen               ← 编译时工具，运行时不需要
@ant/rfb-client
@ant/utils
```

这些**被 esbuild 编译时就 inline 进了 12 MB 主 bundle**，没有作为独立包存在于 asar/node_modules 下。重建时如果我们也用 esbuild bundle，就需要这些包的源码。

---

## `claude-code-1` 里有什么？

实际查 `/Users/apple/work-py/hare-code/claude-code-1/packages/`：

```
packages/@ant/
├── claude-for-chrome-mcp     ✅
├── computer-use-input
├── computer-use-mcp           ✅
├── computer-use-swift
├── ink
└── model-provider

packages/@anthropic-ai/
└── (没找到)

packages/
├── acp-link
├── agent-tools
├── audio-capture-napi
├── builtin-tools
├── color-diff-napi
├── image-processor-napi
├── mcp-chrome-bridge
├── mcp-client
├── modifiers-napi
├── remote-control-server
├── url-handler-napi
└── weixin

src/ssh/                      ✅ 跟 @ant/claude-ssh 等价
```

匹配情况：

| 官方 `@ant/*` 包 | claude-code-1 里 | 状态 |
|---|---|---|
| `@ant/claude-native` | (无源码) | **直接用 .node 二进制** |
| `@ant/claude-swift` | `packages/@ant/computer-use-swift` 部分 | 主要功能用二进制；computer use 部分有源码 |
| `@ant/claude-ssh` | `src/ssh/` | ✅ 用 claude-code-1 实现 |
| `@ant/computer-use-mcp` | `packages/@ant/computer-use-mcp` | ✅ 用 claude-code-1 实现 |
| `@ant/claude-for-chrome-mcp` | `packages/@ant/claude-for-chrome-mcp` | ✅ 用 claude-code-1 实现 |
| `@ant/imagine-server` | (无) | ❌ 跳过（生图功能） |
| `@ant/claude-screen-app` | (无) | ❌ 跳过（屏幕共享） |
| `@ant/claude-swift-ant` | (无) | ❌ 跳过（未知用途） |
| `@ant/cowork-win32-service` | (无) | ❌ 跳过（Win 专用 Cowork 服务） |
| `@ant/chrome-native-host` | `packages/mcp-chrome-bridge` 可能等价 | ⚠️ 需对比 |
| `@ant/disclaimer` | (无) | ❌ 跳过（用户协议显示） |
| `@ant/dxt-registry` | (无) | ❌ 跳过（DXT 注册表） |
| `@ant/rfb-client` | (无) | ❌ 跳过（RFB/VNC 客户端） |
| `@ant/utils` | (无源码同名) | ⚠️ 自己实现工具函数 |
| `@ant/ipc-codegen` | (无) | ⚠️ 编译时工具，自己写一个简化版 |

---

## `@anthropic-ai/*` 包

```
@anthropic-ai/claude-agent-sdk        0.2.128       ⚠️ 公开包，npm 上有
@anthropic-ai/claude-agent-sdk-future 0.2.128-dev   ⚠️ 公开包，npm 上有 dev 版
@anthropic-ai/sdk                     ^0.70.0       ✅ 公开包
@anthropic-ai/conway-client           0.2.0-dev     ❌ 内部
@anthropic-ai/electron-devtools-mcp   workspace:*   ❌ 内部
@anthropic-ai/mcpb                    2.1.2         ✅ 公开包
```

公开的可以直接 `npm install`。`conway-client` 和 `electron-devtools-mcp` 是 Anthropic 内部 monorepo 里的 workspace 包。

| 包 | 用途 | 处置 |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk` | **核心**：跟 Claude Code CLI 通信的 SDK | npm 装 |
| `@anthropic-ai/sdk` | Anthropic API HTTP client | npm 装 |
| `@anthropic-ai/mcpb` | MCP build 工具 | npm 装 |
| `@anthropic-ai/conway-client` | Conway 协议（未知，可能是内部协议） | 跳过或 stub |
| `@anthropic-ai/electron-devtools-mcp` | Electron devtools 集成 | 跳过 |

---

## 处置策略

### 策略 A：直接复用官方编译产物（推荐用于二进制原生包）

适用：`@ant/claude-native`、`@ant/claude-swift`

操作：

```bash
mkdir -p app/vendor/@ant/
cp -r .tmp/official-app/node_modules/@ant/claude-native app/vendor/@ant/
cp -r .tmp/official-app/node_modules/@ant/claude-swift  app/vendor/@ant/
```

新项目 `package.json`：

```json
{
  "dependencies": {
    "@ant/claude-native": "file:vendor/@ant/claude-native",
    "@ant/claude-swift":  "file:vendor/@ant/claude-swift"
  }
}
```

**注意事项**：

1. ABI 兼容：`.node` 文件跟 Node/Electron 的 ABI 版本绑定。官方用的是 Electron 41.5.0（Node v22.x），重建项目锁死同版本。
2. 跨平台：`@ant/claude-swift` macOS only，Windows/Linux 上 require 会抛错（它的 index.js 已经判断了 `process.platform !== 'darwin'`）。Windows 重建可以**整个跳过**这个包。
3. 公证：macOS 上 `.node` 文件跟主 app 一起公证就行。
4. 升级路径：官方更新 .node 时手动同步。

### 策略 B：用 claude-code-1 源码实现

适用：`@ant/claude-ssh`、`@ant/computer-use-mcp`、`@ant/claude-for-chrome-mcp`

操作：

新项目作为 monorepo，用 yarn/pnpm workspaces，把 claude-code-1 里的 packages 链接进来。

```json
{
  "workspaces": [
    "packages/*",
    "vendor/@ant/*"
  ]
}
```

或者更简单：直接 `import` claude-code-1 的源码（用 path alias）。

### 策略 C：自己实现简化版

适用：`@ant/utils`、`@ant/ipc-codegen`

`@ant/utils` 估计是常用工具函数集合，遇到具体调用再实现对应的。

`@ant/ipc-codegen` 是编译时生成 IPC 桥架代码的工具：

```ts
// 输入 (TypeScript interface)
@IpcService('claude.web.LocalSessions')
class LocalSessions {
  @IpcMethod()
  async getAll(): Promise<Session[]> { ... }
}

// 输出（自动生成）
const RPC_KEY = '$eipc_message$_<UUID>_$_claude.web_$_LocalSessions_$_getAll'
ipcMain.handle(RPC_KEY, async (e, ...args) => { ... })
// 前端
window.claude.web.LocalSessions.getAll = (...args) => ipcRenderer.invoke(RPC_KEY, ...args)
```

我们重建时自己写一份简化版（用装饰器 + zod 即可），不需要拿官方 codegen。

### 策略 D：跳过（不实现这个功能）

适用：`@ant/imagine-server`、`@ant/claude-screen-app`、`@ant/cowork-win32-service`、`@ant/disclaimer`、`@ant/dxt-registry`、`@ant/rfb-client`、`@ant/conway-client`、`@ant/electron-devtools-mcp`

这些是边角功能：

- `imagine-server`：内嵌生图服务，跳过
- `claude-screen-app`：屏幕共享，跳过
- `cowork-win32-service`：Cowork 在 Windows 上的服务，先跳过
- `disclaimer`：用户协议显示组件，简单的 React 组件自己写
- `dxt-registry`：DXT 注册表（未知具体用途）
- `rfb-client`：RFB/VNC 协议客户端，可能给 ClaudeVM 用
- `conway-client`：Conway 协议（内部）
- `electron-devtools-mcp`：Electron devtools 上下文，开发用

涉及的 IPC method 直接 stub 返回错误：

```ts
// 主进程 IPC handler
async ['claude.web::ClaudeVM.connect'](opts) {
  throw new IpcError('NOT_AVAILABLE', 'ClaudeVM is not supported in this build')
}
```

前端 SPA 收到错误会自动隐藏对应 UI（claude.ai 的代码已经按 feature flag 设计，缺失的 feature 会优雅降级）。

---

## 完整 vendoring 方案

新项目目录结构：

```
app/
├── package.json                       依赖：electron, vite, react, @anthropic-ai/*
├── src/
│   └── main/
│       └── ipc/
│           ├── claude.web/
│           ├── claude.settings/
│           └── ...                    IPC handler 实现
├── packages/
│   ├── ipc-codegen/                  (策略 C) 自己写的简化版
│   └── ant-utils/                    (策略 C) 工具函数
├── vendor/
│   └── @ant/
│       ├── claude-native/            (策略 A) 二进制
│       └── claude-swift/             (策略 A) 二进制 (macOS only)
└── ion-dist/                         直接拷官方 SPA
```

引擎层（外部依赖）：

```
外部:
└── /Users/apple/work-py/hare-code/claude-code-1/    (策略 B) 通过 path 引用
    ├── packages/@ant/computer-use-mcp/
    ├── packages/@ant/claude-for-chrome-mcp/
    └── src/ssh/
```

或者把 claude-code-1 整个搬进来作为 git submodule。

---

## 风险评估

| 项 | 风险 | 缓解 |
|---|---|---|
| `.node` 跟 Electron ABI 不兼容 | 高 | 锁死 Electron 41.5.0；CI 上跑 ABI smoke test |
| `claude-swift.node` 用了私有 macOS API | 中 | 已经编译好，运行时没影响；但 Apple 公证拒签风险 |
| `claude-code-1` API 变更 | 中 | 通过明确的 import 边界（一个 adapter 文件）隔离 |
| 缺失 `@ant/imagine-server` 等导致前端崩 | 中 | feature flag stub 返回 false；测试时关注前端的 fallback |
| 后续官方升级时同步成本 | 低 | 我们的目标不是跟官方实时同步，是稳定的"能跑的"版本 |

---

## 跳过的功能清单（明确告诉用户什么用不了）

按上面策略 D 跳过的会导致前端这些功能不可用：

- ❌ ClaudeVM（云端 VM 隔离会话）
- ❌ Computer Use 屏幕录制 / 实时观察（部分需要 swift_addon 的 RFB 通道）
- ❌ Buddy 蓝牙伴侣设备配对
- ❌ Office 插件
- ❌ 屏幕共享（screen-app）
- ❌ DXT 注册表相关功能
- ❌ Imagine Server 生图
- ❌ Conway 协议相关功能
- ⚠️ Cowork 团队功能（部分依赖云端，部分依赖 win32-service）

**保留的核心功能**：

- ✅ Claude Code 引擎（本地编程会话）
- ✅ Skills 系统
- ✅ 本地文件操作
- ✅ Git / PR 集成
- ✅ SSH 远程
- ✅ MCP 服务器
- ✅ 自动更新
- ✅ 全局快捷键、通知、PATH 探测
- ✅ 多窗口（主窗口、关于、查找）

---

## 下一步

→ [05 · 重建路线图](./05-roadmap.md)
