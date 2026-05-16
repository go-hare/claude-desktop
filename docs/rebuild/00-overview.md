# 00 · 总览：重建 Claude Desktop 的可行性

> 写作日期：2026-05-16  
> 上游参照：[Claude-Deepseek.app](~/Downloads/Claude%20code%20汉化mac桌面版/Claude-Deepseek.app)（官方 mac 版本 1.6608.2）  
> 引擎参照：[claude-code-1](/Users/apple/work-py/hare-code/claude-code-1)（Claude Code 完整源码）

---

## 一句话结论

**可以重建 100% 等价功能的、可读、可维护的代码，但「跟官方源码字节级一致」做不到。**

---

## 三种"重建"粒度

| 粒度 | 定义 | 可行性 | 工程量 |
|---|---|---|---|
| **A · 字节级还原** | 还原同样的文件名、目录结构、变量名、注释 | ❌ 不可能 | — |
| **B · 语义级反编译** | 功能 100% 一样，结构/逻辑等价，符号名重命名后能读 | ⚠️ 极困难但可行 | 15-25 人月（人工）或 3-5 人月（LLM 辅助） |
| **C · 行为级重建** ⭐ | 基于解出的资源作为契约，重写干净 TS | ✅ 可行 | 2-4 人月（单人） |

本项目选 **C 方案**。

---

## 为什么 A 不可能

官方主进程 bundle 是 esbuild 产物，经过：

1. TypeScript → JavaScript（类型删除）
2. 多文件 → 单文件 bundle（import 关系丢失）
3. Tree shaking（未使用代码删除）
4. Minify（`userPreferences` → `e1` / `A` / `t2`）
5. Property mangling（部分对象属性也被改名）
6. Constant folding（编译期分支消除）

bundle 头部直接能看到 mangler 痕迹：

```js
var Kat=Object.create;var raA=Object.defineProperty;var qat=Object.getOwnPropertyDescriptor;
```

而且**没有 sourcemap**：

```bash
$ grep -c "sourceMappingURL" .tmp/official-app/.vite/build/index.js
1   ← 唯一一处是字符串常量，不是真实 sourcemap 引用
```

所以原始文件名、行号、类名都丢失了，**A 在物理上不可恢复**。

---

## 为什么不选 B

虽然代码逻辑结构完整保留、字符串常量未混淆（这是 B 的可行基础），但：

- 主进程 `.vite/build/index.js`：12 MB / 6515 行
- ion-dist 主 SPA 合并 bundle：约 30 MB（650 个 zst + 627 个 js）
- 手工反编译速度 ≈ 500 行/工程师·天（对 minified 代码）
- 展开倍数约 10x：**总计 15-25 人月**

LLM 辅助能压缩到 3-5 人月，但质量参差、关键路径还是要人工 review。

**性价比远不如 C 方案。**

---

## C 方案的输入材料

你已经拥有：

1. **完整的 ion-dist SPA**（1395 个文件）  
   → 直接当成"前端契约"使用，不用重建前端
   
2. **原生绑定 `.node` 二进制**：  
   - `@ant/claude-native.node`（3.7 MB，跨平台 NAPI 绑定）  
   - `@ant/claude-swift.node`（35 MB，macOS Swift 桥接）  
   → 直接拷贝重用
   
3. **584 个 IPC 命名 method 列表**  
   从 bundle 里 grep 出来的 `$eipc_message$_<UUID>_$_<namespace>_$_<class>_$_<method>` 字符串  
   → 相当于现成的 API 文档（见 [03-ipc-protocol.md](./03-ipc-protocol.md)）
   
4. **[claude-code-1](/Users/apple/work-py/hare-code/claude-code-1)**  
   完整的 Claude Code 源码，作为引擎层
   
5. **`@anthropic-ai/claude-agent-sdk`**  
   公开 SDK，文档齐全，是主进程 ↔ Claude Code 之间的协议

---

## C 方案要重写的范围

```
新项目主进程（约 10000-15000 行可读 TS）
├── 入口加载器                       ~500 行
├── app:// 协议处理                  ~200 行
├── 窗口管理 (BrowserWindow)         ~800 行
├── IPC 桥架（584 个 method）       ~6000 行  ← 主要工作量
│   ├── claude.web::*                优先实现 ~50 个核心 method
│   ├── claude.settings::*
│   ├── claude.skills::*
│   └── 其他可选
├── ClaudeCode 引擎适配器            ~1000 行（包装 SDK）
├── 自动更新                         ~500 行
├── 协议处理 (deeplink)              ~300 行
└── 工具函数、配置等                 ~1000 行
```

**单人 2-4 人月**，代码 100% 可读、可调试、可维护。

---

## 关键工程风险

| 风险 | 严重度 | 缓解措施 |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk` 协议变更 | 中 | SDK 是公开包，跟着升级即可 |
| ion-dist 调用 `window.electronAPI` 之外的私有 API | 高 | 阶段 1 反编译 ion-dist 的 IPC 客户端（约 100 KB），看清楚契约 |
| `@ant/claude-native.node` ABI 跟 Electron 版本绑定 | 中 | 锁死 Electron 41.5.0 |
| `@ant/claude-swift.node` 用了私有 macOS API | 低 | 已编译好，运行时不影响；Apple 公证可能拦 |
| 自动更新走 ant-private endpoint | 中 | 用 `electron-updater` + 自己的 endpoint 替代 |
| OAuth 流程依赖 claude.ai 后端 | 高 | 这部分必须真走 claude.ai；或改成自己的鉴权后端 |

---

## 文档导航

- [01 · app.asar 解包报告](./01-asar-unpack.md) — 拆开看里面有什么
- [02 · 官方架构 + ion-dist + app:// 协议](./02-architecture.md) — 主进程 / 渲染进程 / 引擎三者怎么连
- [03 · IPC 协议观察](./03-ipc-protocol.md) — 584 个 IPC method 分类
- [04 · 内部依赖处理策略](./04-internal-deps.md) — `@ant/*` 闭源包怎么办
- [05 · 重建路线图](./05-roadmap.md) — 阶段 0 / 1 / 2 / 3 的具体步骤

---

## 下一步

按阶段 0 开工。先做：

1. ✅ 写文档（本目录）
2. ⏭ 验证 `claude-code-1` 能不能被当作 `@anthropic-ai/claude-agent-sdk` 后端 spawn
3. ⏭ 搭新项目骨架 `app/`
4. ⏭ 把 ion-dist 跟 .node 二进制拷过去
5. ⏭ 实现最小 IPC 让 SPA 起来
