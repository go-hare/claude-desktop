# 07 · Sidebar 协作/代码 toggle 不渲染调研

> 这一项调研花了一整轮对话来回。最终结论：所有 feature flag 都设对了，
> SPA 内部 hook 链上某层永远不 settle，导致 toggle 永久不渲染。靠 byte-level
> patch SPA chunk 绕开。本文记录症状、误区、根因、修法。

---

## 症状

- 进 `/epitaxy` 路由，sidebar 渲染 `新会话 / 自定义 / More`
- 但官方 sidebar 顶部那条 **"协作 / 代码" toggle 不出**
- DOM 里 `.df-pills` 和 `[role="group"][aria-label="Mode"]` 都不存在
- React fiber 链 `Vrs / E6 / Brs / BUe / qn / ...` 都在，结构完整

## 走过的弯路

每一步都自信"应该好了"，结果 toggle 还是不出。

### 误区 1: ENTRY_URL 用 `/claude-code-desktop`

理由：HK("/claude-code-desktop") → "code"，其它 Code 路径 (`/epitaxy`,
`/code`) → "epitaxy"。

打脸：扒官方 main process 看到 `loadAll()` 也是 `pathname = "/epitaxy"`。
URL 不是问题。

### 误区 2: `desktopTopBar = supported`

理由：以为这个 flag 一开 toggle 就会跟着出。

打脸：这个 flag **打开反而让 toggle 隐藏**——SPA 假定 host 自己画了原生
top bar，就不在 sidebar 上画 toggle 了。改回 `unsupported` 才对。

### 误区 3: 只研究 zas → qas → Xje 老链路

老 chunk 里 `Xje` 是 toggle 组件，`p.length<=1?null` 是 gate。`p` 来自
`Zje()`，键名 `["task", "code"]`。

打脸：`zas` 路径是 dead code。这版 ion-dist 用的是新的 **FrameSidebar
架构**（`cbc59a8af` chunk）。toggle 在 `Ws` 组件里，键名是
`["cowork", "code"]`，Q 函数是 `nMe()`。

### 误区 4: 加齐 5 个 chillingSloth + ccdPlugins + cowork/yukon/yukonGems flags

`window.desktopBootFeatures` 和 `getSupportedFeatures()` IPC 全部对齐 14 项，
status 全 supported。Growthbook 加齐 djb2-hashed `yukon_silver` /
`chilling_sloth_clocks` / `cowork_default_landing_enabled` 等。

打脸：仍不渲染。`bootstrap` payload 加 `org_growthbook` / `growthbook` 字段，
统统不工作。

### 误区 5: `statsigOrgUuid: undefined` 防止无限 refetch

这个改动**真有用**——但只解决了启动期的 refetch loop，跟 toggle 无关。

---

## 根因（终于找到）

`Ws` toggle 的渲染链：

```
Ws → p = useMemo([...]) → o = Q() = nMe() → if c push "cowork", if r push "code"
                                    │
                              c = jd() && _Y().featureGateEnabled && _Y().status === "supported"
                                    │
                              _Y() = useContext(CY) ?? vY (default loading-ish)
                                    │
                              wY provider:
                                if (Zb()) return yY  // ← 永远命中这里
                                ...
                                    │
                              Zb() = hc().isLoading || Yb()
                              Yb() = !useContext(U)  // U.createContext(true) → !true = false
                              hc().isLoading        // ← 这个永远 true
```

`hc()` 是 `CurrentAccountProvider` context，`isLoading` 取决于 React Query
读 bootstrap 数据的 status。我们的 `/edge-api/bootstrap` 同步返回 JSON，
按理 query 应该立刻 settled。但实际上 _Y() 永远拿不到 settled 值。

可能跟 React Query 的 `refetch` / `staleTime` 行为或 zustand store 在
`considerEnabledForNonUI` 计算上的副作用有关。挖到 8 层 hook 仍没找到为啥
不 settle，决定停止。

---

## 解法：byte-level patch

不再追状态链，直接改 SPA bundle 的字节。

`appProtocol.ts` serve `index-BELzQL5P.js` 前先做字符串替换：

```ts
// 在 nMe() 里
原: c=e&&!!a.featureGateEnabled&&"supported"===a.status,
改: c=e||!!a.featureGateEnabled||"supported"===a.status,
```

- 两个 `&&` 改成 `||`，长度一样（51 字节），不破 source-map / chunk hash
- `e = jd()` 在我们环境恒 true（userAgent 有 `Claude/1.0.0` + `claudeAppBindings` 已注入）
- 短路命中 → c=true → cowork 强制入 modes → toggle 渲染

实现：`PATCHES_BY_FILENAME` 表 + `readMaybePatched()` 读文件 + 字符串替换 + 缓存。
新增 `find/replace/reason` 字段，长度不一致直接跳过并 warn。

启动时 terminal 会刷一行：
```
[rebuild:patch] applied index-BELzQL5P.js — force nMe() to push "cowork" into modes array (sidebar toggle gate)
```

---

## 教训

1. **SPA bundle 的状态链不要全靠扒**。3 层之内还能跟，超过 5 层就放弃，直接 patch
2. **defaultMessage / 字符串字面量 grep 是定位组件最快的办法**。fiber 探针对 hook state 抓取效果不好
3. **多个相似组件并存时（zas vs FrameSidebar），必须先确认实际渲染走哪条**。`document.querySelector` 看 className 直接判断（`dframe-sidebar` = FrameSidebar）
4. **官方 main process 是 ground truth**：`loadAll()` 函数、`pw()` 函数都告诉了我们正确答案。早点扒 official `.vite/build/index.js` 能省一半时间
5. **`window.desktopBootFeatures` ≠ IPC `getSupportedFeatures()`**。前者是 preload 同步注入（QK 直接读），后者是 SPA 异步 fetch 后 setState。两边 shape 必须**完全一致**，否则 IPC resolve 时会"降级"覆盖 preload 的值
6. **byte patch 是合法的最后手段**——同长度替换不破 chunk 完整性，工程量极小，比追 8 层 hook 更划算

---

## 后续

phase 0.4 接 SDK 后回头看：如果 `hc().isLoading` 那条链真能 settle，可以把
patch 拆掉。否则保留——副作用就是 cowork 模式始终可点，但 cowork 服务没实现,
点进去会是空 UI（不会崩，因为 `Be / Ns` 等 cowork 子组件本身有 null guard）。

patch 表也可以扩展：未来发现别的 hook 链卡死，直接加 entry 就行，不用每次重走
8 层调研。

---

## 更新（patch 已撤回）

byte patch 让 toggle 出来后，副作用比预期更明显——点"协作"会落到完全空白的
Cowork 主面板。Cowork 是 Anthropic 的云端任务编排产品，需要一整套
`CCDScheduledTasks` / `CoworkSpaces` / `CoworkArtifacts` IPC + 云端 dispatch
backend，phase 0 明确跳过（见 [04-internal-deps.md](./04-internal-deps.md)）。

让用户能点到 dead UI 比"没 toggle"更糟，所以**撤掉 patch**：`PATCHES_BY_FILENAME`
变回空 map，`nMe()` 自然返回 `["code"]`，`Ws` 返回 null，整个 toggle 消失，
sidebar 单 mode Code。

代码保留 patch 框架（`readMaybePatched` + `Patch` 类型 + `PATCHES_BY_FILENAME`），
未来 cowork backend 真接入时把 entry 加回去就能复活 toggle。本文上面的调研
（5 个误区、根因、字节 patch 思路）也保留——以后碰到类似 hook 链卡死问题，
还是这套方法。

