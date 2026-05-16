# 06 · 决策记录

> 这里记录在做"重建"决策时的取舍，便于以后回看为什么这么做。  
> 每条决策包括：**日期 / 决定 / 备选 / 为什么这么选 / 触发改变的条件**。

---

## D1 · `@ant/*` 包的处置

**日期**：2026-05-16  
**决定**：

- 第一类（**物理 .node 二进制**，2 个）：**直接拷官方编译产物**
  - `@ant/claude-native` (3.7 MB Rust NAPI 二进制)
  - `@ant/claude-swift` (35 MB Swift NAPI 二进制，macOS only)

- 第二类（**被 esbuild inline 的 14 个**）：
  - **核心几个用 [claude-code-1](/Users/apple/work-py/hare-code/claude-code-1) 源码替代**：
    - `@ant/claude-ssh` → `claude-code-1/src/ssh/`
    - `@ant/computer-use-mcp` → `claude-code-1/packages/@ant/computer-use-mcp/`
    - `@ant/claude-for-chrome-mcp` → `claude-code-1/packages/@ant/claude-for-chrome-mcp/`
  - **其它跳过**（IPC 调用 stub 返回 `NOT_AVAILABLE`）：
    - `@ant/imagine-server`（生图）
    - `@ant/claude-screen-app`（屏幕共享）
    - `@ant/cowork-win32-service`（Windows Cowork 服务）
    - `@ant/disclaimer`（用户协议显示）
    - `@ant/dxt-registry`（DXT 注册表）
    - `@ant/rfb-client`（RFB/VNC 客户端，给 ClaudeVM 用）
    - `@ant/chrome-native-host`（如 claude-code-1 的 mcp-chrome-bridge 不等价就跳过）
    - `@ant/claude-swift-ant`（用途不明）
    - `@ant/conway-client`（内部协议）
    - `@ant/utils`（自己实现需要的工具函数）
    - `@ant/ipc-codegen`（自己写简化版）

**备选**：

- **A**：从 12 MB bundle 里反编译抠出来。否决：minified 难读，工程量不可控
- **B 全量**：所有 14 个都用 claude-code-1 替代或自己写。否决：边角功能（imagine / disclaimer / rfb 等）不值得花时间
- **D 全量跳过**：核心 SSH / MCP 也跳过。否决：会失去 SSH 远程 / MCP 工具调用能力，违背重建初衷

**为什么这么选**：

- 二进制 `.node` 拷过来零成本（你已确认）
- 核心 SSH/MCP 用 claude-code-1 既保持了功能又有可读源码
- 边角功能（生图、屏幕共享、Win32 Cowork 等）用户基本用不到，stub 后前端会优雅降级

**触发改变的条件**：

- 二进制 `.node` 在 Linux/Win 上跑不起来 → 改成策略 B 用纯 JS 替代
- 用户反馈强烈需要某个跳过的功能 → 单独把那个包从 D 升级到 B
- claude-code-1 的接口跟官方 inline 版本不兼容 → 写 adapter 或直接抠 bundle

---

## D2 · Claude Code 引擎 CLI 来源

**日期**：2026-05-16  
**决定**：**用 `@anthropic-ai/claude-agent-sdk` 自带的 `claude` 二进制**。

不构建 [claude-code-1](/Users/apple/work-py/hare-code/claude-code-1) 作为引擎层。

具体做法：

```bash
npm install @anthropic-ai/claude-agent-sdk
# SDK 会自动通过 optionalDependencies 安装平台对应的 CLI 包：
# - @anthropic-ai/claude-agent-sdk-darwin-arm64/claude
# - @anthropic-ai/claude-agent-sdk-darwin-x64/claude
# - @anthropic-ai/claude-agent-sdk-linux-x64/claude
# - @anthropic-ai/claude-agent-sdk-win32-x64/claude.exe
```

主进程通过 SDK 调用：

```ts
import { createHeadlessChatSession } from '@anthropic-ai/claude-agent-sdk'

const session = createHeadlessChatSession({
  cwd,
  provider: { baseUrl, apiKey, model },
  // pathToClaudeCodeExecutable 留空 → SDK 自动找平台对应的二进制
})
```

**备选**：

- **构建 claude-code-1**：自己 `bun run build` 出 `dist/cli-node.js` / `dist/cli-bun.js`，然后 `pathToClaudeCodeExecutable: '/path/to/claude-code-1/dist/cli-node.js'`
- **两个都准备**：配置开关切换

**为什么这么选**：

- npm install 完事，零额外构建步骤
- 跟着 SDK 升级，不用维护 fork
- 阶段 0 验证最快（这步要失败的话 C 方案要重评，所以越简单越好）
- claude-code-1 里那些"额外功能"（增强 SSH / Computer Use / MCP）通过 `@ant/*` 包注入，跟引擎二进制本身关系不大

**触发改变的条件**：

- 官方 CLI 缺失我们要的功能 → 切换到 claude-code-1（替换 `pathToClaudeCodeExecutable` 即可，主进程代码不动）
- Linux ARM / 其它特殊平台 SDK 没分发二进制 → 用 claude-code-1 build 自己的
- SDK 协议大变 / 不稳定 → 锁死 SDK 版本或切到 claude-code-1

---

## D3 · 阶段 0.1 验证步骤

**日期**：2026-05-16  
**决定**：阶段 0.1（[05-roadmap.md](./05-roadmap.md)）按 D2 的决策简化为：

```bash
mkdir -p /tmp/sdk-test && cd /tmp/sdk-test
npm init -y
npm install @anthropic-ai/claude-agent-sdk

cat > test.mjs <<'EOF'
import { createHeadlessChatSession } from '@anthropic-ai/claude-agent-sdk'

const session = createHeadlessChatSession({
  cwd: process.cwd(),
  provider: {
    baseUrl: 'https://api.anthropic.com',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  },
  // 不指定 pathToClaudeCodeExecutable, SDK 自动找
})

for await (const msg of session.stream('list files in this directory')) {
  console.log(JSON.stringify(msg))
}
EOF

ANTHROPIC_API_KEY=sk-... node test.mjs
```

**验收**：能看到 stream-json 事件输出。

不再需要 `bun install && bun run build claude-code-1`。

---

## 还未决策的事

待后续阶段再定：

- [ ] **D4 OAuth 怎么走**：真接 claude.ai（需要 Anthropic 允许我们的 redirect URI，几乎不可能）vs 自己的鉴权后端 vs 跳过 OAuth 让用户手填 API key
- [ ] **D5 数据持久化**：electron-store JSON vs SQLite vs 文件系统
- [ ] **D6 自动更新 endpoint**：自己搭 vs GitHub Releases vs 不实现
- [ ] **D7 Sentry 上报**：装 vs 不装（隐私 + 自己的 endpoint）
- [ ] **D8 多语言**：复用 ion-dist 的 47 种 vs 只保留中英 vs 简化为单语
- [ ] **D9 仓库结构**：当前仓库新开 `app/` 子目录 vs 全新仓库 vs 覆盖现有 `src/`+`electron/`
  - 此前已经定过 = "当前仓库新开 `app/` 子目录"，但触发条件可能让它变化

每个决策点开始处理时再写补充。
