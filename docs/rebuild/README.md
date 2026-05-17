# Claude Desktop 重建文档

> 把官方 [Claude-Deepseek.app](~/Downloads/Claude%20code%20汉化mac桌面版/Claude-Deepseek.app) 拆开看清楚后，写下来的可读 TS 重建方案。

---

## 阅读顺序

| # | 文档 | 一句话 |
|---|---|---|
| 00 | [总览 + 可行性结论](./00-overview.md) | **先看这个**——能不能重建？要花多久？为什么不能字节级还原？ |
| 01 | [app.asar 解包报告](./01-asar-unpack.md) | 拆开 66 MB 的 asar，里面有什么 |
| 02 | [官方架构解析](./02-architecture.md) | 主进程 / 渲染进程 / 引擎三层是怎么连的（app:// 协议是怎么回事） |
| 03 | [IPC 协议观察](./03-ipc-protocol.md) | 584 个 IPC method 怎么分类，哪些是核心 |
| 04 | [内部依赖处理策略](./04-internal-deps.md) | 16 个 `@ant/*` 闭源包怎么办（拷二进制 vs claude-code-1 源码 vs stub） |
| 05 | [重建路线图](./05-roadmap.md) | 阶段 0 / 1 / 2 / 3 的具体任务和时间表 |
| 06 | [决策记录](./06-decisions.md) | 关键取舍点的决定 + 备选 + 触发改变的条件 |
| 07 | [Sidebar toggle 调研](./07-sidebar-toggle-investigation.md) | 为什么 `协作/代码` toggle 不渲染——8 层 hook 链 + byte patch 解法 |

附带文件：

- [`ipc-methods.txt`](./ipc-methods.txt) — 完整的 584 个 IPC method 清单（机器可读）

---

## 一图流总结

```
是否可能重建？
├─ A 字节级还原官方源码 ────── ❌ 不可能（esbuild minify，无 sourcemap）
├─ B 语义级反编译可读 TS ───── ⚠️ 15-25 人月（或 LLM 辅助 3-5 人月）
└─ C 行为级重建（推荐） ────── ✅ 单人 2-4 人月

C 方案的关键复用：
├─ 前端 SPA：ion-dist 直接拷过来用（黑盒，1395 个文件 / 155 MB）
├─ 原生绑定：@ant/claude-native.node, @ant/claude-swift.node 拷二进制
├─ 引擎层：claude-code-1 + @anthropic-ai/claude-agent-sdk
└─ 主进程：从 0 写干净 TS（约 10000-15000 行）

需要实现的：584 个 IPC method（先做核心 50 个）
跳过的功能：ClaudeVM、Buddy 蓝牙、Office、屏幕共享、Imagine、Cowork win32-service
```

---

## 下一步动作

→ 见 [05 · 重建路线图](./05-roadmap.md) 的"立即可做的下一步"。
