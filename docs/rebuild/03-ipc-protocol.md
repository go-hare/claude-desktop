# 03 · IPC 协议观察：584 个 method 怎么分布

> **目的**：把官方 bundle 里所有 IPC method 摸清楚，作为重建主进程时的 API 契约。  
> **完整清单**：[ipc-methods.txt](./ipc-methods.txt)（584 行）

---

## 协议命名规则

每个 IPC method 在主进程 bundle 里都以字符串字面量形式出现：

```
$eipc_message$_<sessionUUID>_$_<namespace>_$_<class>_$_<method>
```

例：

```
$eipc_message$_ea5fa1fd-aa4e-4f73-a689-0f14f3e8be79_$_claude.web_$_LocalSessions_$_getAll
```

- `$eipc_message$` 是固定前缀
- `<sessionUUID>` 是这个 app build 的固定 UUID（每次发布版本会变；当前是 `ea5fa1fd-aa4e-4f73-a689-0f14f3e8be79`）
- `<namespace>` 用点号分层，如 `claude.web`、`claude.settings`、`claude.internal.ui`
- `<class>` 是一个 service 类名
- `<method>` 是方法名

这套协议是由 `@ant/ipc-codegen` 在编译时**自动生成**的（package.json 里能看到这个 devDependency）。前端 SPA 里也有对应的代理对象，调 `service.method(...)` 实际上会发送一个 `$eipc_message$_...` 消息。

---

## 10 个 namespace 总览

| Namespace | Class 数 | Method 总数 | 用途 |
|---|---|---|---|
| **claude.web** | 39 | **456** | 前端 ↔ 主进程主桥，**绝大部分功能在这** |
| **claude.settings** | 10 | 64 | 设置、偏好、启动项、MCP server、扩展、PATH |
| **claude.internal.ui** | 3 | 14 | 子窗口（About/Title bar/Quick）内部通信 |
| **claude.buddy** | 2 | 18 | "Buddy" 蓝牙设备配对（手机伴侣？） |
| **claude.skills** | 1 | 1 | Skills 系统（多数 Skills 操作在 LocalAgentModeSessions） |
| **claude.coworkArtifact** | 1 | 5 | Cowork 任务 artifact 桥 |
| **claude.officeAddin** | 1 | 10 | Office 插件文件操作 |
| **claude.hybrid** | 1 | 3 | i18n 同步 |
| **claude.simulator** | 1 | 6 | 模拟器 |
| **claude.internal.findInPage** | 1 | 3 | Cmd+F |
| **合计** | **60** | **584** | |

---

## claude.web 下的 39 个 class（前端主桥）

按 method 数量降序：

| Class | Method 数 | 一句话职责 |
|---|---|---|
| **LocalSessions** | 126 | 本地 Claude Code 会话的完整生命周期：创建、消息、git、PR、SSH、agent、effort、permission、stats…（核心中的核心） |
| **LocalAgentModeSessions** | 69 | Agent mode 会话：草稿、bridge、trusted folder、MCP server、本地 skill、计划任务、transcript… |
| **Launch** | 30 | 应用启动期间的状态（onboarding、welcome、首次运行等） |
| **CoworkSpaces** | 21 | Cowork 空间（项目）管理 |
| **CoworkArtifacts** | 19 | Cowork 中生成的 artifact |
| **FileSystem** | 17 | 文件系统（浏览、读、写、缩略图、应用关联、Google Drive 导出） |
| **CustomPlugins** | 17 | 用户自定义插件 |
| **ClaudeVM** | 17 | Anthropic VM 客户端（云端隔离环境） |
| **LocalPlugins** | 16 | 本地插件 |
| **FramebufferPreview** | 11 | Framebuffer 预览（屏幕共享） |
| **CoworkScheduledTasks** | 9 | Cowork 计划任务 |
| **CoworkRadar** | 8 | Cowork 雷达（团队动态） |
| **CCDScheduledTasks** | 8 | CCD 计划任务（claude-code-on-device?） |
| **WindowState** | 7 | 窗口状态（全屏、缩放、可见性） |
| **Resources** | 7 | 应用资源访问 |
| **CoworkMemory** | 7 | Cowork 记忆 |
| **ComputerUseTcc** | 7 | Computer Use 的 TCC 权限（macOS） |
| **WindowControl** | 6 | 窗口控制（关闭、聚焦、resize、主题、隐身） |
| **AutoUpdater** | 6 | 自动更新 |
| **DesktopNotifications** | 5 | 桌面通知 |
| **CoworkFilePreview** | 5 | Cowork 文件预览 |
| **BrowserNavigation** | 5 | 浏览器导航 |
| **OrbitDeploys** | 4 | Orbit 部署 |
| **FindInPageProvider** | 4 | Cmd+F provider |
| **ClaudeCode** | 4 | Claude Code 状态查询（注意：实际会话操作在 LocalSessions） |
| **GrandPrix** | 3 | 未知，可能是某个内部实验 |
| **ChromeExtension** | 3 | Chrome 扩展集成 |
| **AgentModeFeedback** | 3 | Agent mode 反馈 |
| **QuickEntry** | 2 | Quick 窗口入口 |
| **OpenDocuments** | 2 | 打开文档 |
| **NestDev** | 2 | 未知 |
| **MenuEvents** | 2 | 菜单事件 |
| **LocalSessionEnvironment** | 2 | 本地会话环境变量 |
| **BuddyRemoteFeed** | 2 | Buddy 远程 feed |
| **Toast** | 1 | Toast 通知（`showToast`） |
| **Navigation** | 1 | 应用内导航（`navigate`） |
| **DeepLink** | 1 | Deep link 处理（`handleDeepLink`） |
| **Auth** | 1 | OAuth（`doAuthInBrowser`） |
| **Account** | 1 | 账号信息（`setAccountDetails`） |

---

## 几个关键 class 的完整 method 清单

### claude.web::ClaudeCode (4 个)

```
checkGitAvailable
getStatus
prepare
resolveLocalSettings
```

**注意**：这个类**很小**！它只是查询 Claude Code 的可用性状态。**真正的会话操作不在这里，在 `LocalSessions` 和 `LocalAgentModeSessions`**。

### claude.web::Auth (1 个)

```
doAuthInBrowser  ← 打开外部浏览器走 OAuth
```

OAuth 流程：

1. SPA 调 `Auth.doAuthInBrowser(redirectUri, codeVerifier)`
2. 主进程用 `shell.openExternal()` 打开 `https://claude.ai/desktop/callback?...`
3. 用户在浏览器登录授权
4. 浏览器 redirect 到 `claude://...`（deep link）
5. 系统打开本地 Claude app，触发 `DeepLink.handleDeepLink`
6. 主进程交换 access_token，缓存到 electron-store

### claude.web::LocalSessions (126 个，最重要)

按功能分组（**我手工归类**）：

**会话生命周期** (10+)

```
getAll, getSession, archive, delete, clearSession, forkSession
restoreFromBackup, getAvailableEditors, getInstalledEditors
```

**消息收发** (15+)

```
sendMessage, cancelQueuedMessage, getTranscript, getTranscriptForExport
exportTranscriptAsMarkdown, regenerateLastResponse, retryFailedSend
```

**Git / PR** (20+)

```
checkGitAvailable, getGitInfo, getGitDiff, getGitDiffStats, getGitCommits
getCommitDiff, getDiffFileContent
commitAllChanges, discardWorkingTree, commitWipForBranchSwitch
getLocalBranches, ensureBranchPushed, switchBranch
createLocalPr, generateLocalPrContent, getPrDetails, getPrChecks
disableAutoMerge, enableAutoMerge
checkGhAvailable, getGhIssue
```

**Stats / Effort / Permission** (10+)

```
getCodeStats, getContextUsage
getDefaultEffort, getEffort, setEffort
getDefaultPermissionMode, getPermissionMode, setPermissionMode
getPlanForSession
```

**Agent / 子会话** (10+)

```
createAgent, getAgents
```

**SSH** (5+)

```
ensureSSHConnected, checkRemoteTrust, checkTrust, addTrustedFolder
```

**目录 / 项目** (5+)

```
addDirectories, getDetectedProjects, isFolderTrusted
```

**…还有大约 40 个其他 method**（详见 [ipc-methods.txt](./ipc-methods.txt) 第 200-330 行）

### claude.web::FileSystem (17 个)

```
browseFiles, browseFolder, browseFolders
exportLocalFileToGoogleDrive
getLocalFileThumbnail
getSystemPath
listDirectory, listFilesInFolder
openLocalFile
promoteScratchpadFile
readLocalFile
savePastedFile
showInFolder
whichApplication
writeFileDownload, writeFileDownloadAndOpen
writeLocalFile
```

### claude.web::WindowControl (6 个) + WindowState (7 个)

```
WindowControl: captureScreenshot, close, focus, resize, setIncognitoMode, setThemeMode
WindowState:   cuDockStateChanged, fullscreenChanged, getFullscreen, 
               getVisibility, getZoomFactor, visibilityChanged, zoomFactorChanged
```

### claude.skills::Skills (1 个) + claude.web::LocalAgentModeSessions 里的 skill 相关

```
Skills:
  previewSkillFile

LocalAgentModeSessions:
  getLocalSkillFiles, listLocalSkills, deleteLocalSkill, ...
```

Skills 系统的多数操作在 `LocalAgentModeSessions` 而不是 `Skills`。

### claude.settings::* (64 个)

按 class 分布：

```
Extensions    30  ← 大头，扩展管理
MCP           10  ← MCP server 配置
AppConfig      4
AppPreferences 3
AppFeatures    1  ← feature flag (getSupportedFeatures)
DesktopInfo    2
FilePickers    2
Startup        4
SupportBundle  2  ← 支持包（崩溃报告/诊断）
WakeScheduler  2
GlobalShortcut 3
```

---

## "核心 50 个" 优先实现清单

阶段 0 + 阶段 1 要实现的最小 IPC 子集，按重建路线图：

```
=== 启动 / 窗口 ===
claude.internal.ui::MainWindowTitleBar.* (7个全部)
claude.web::WindowControl.close
claude.web::WindowControl.focus
claude.web::WindowControl.setThemeMode
claude.web::WindowState.getFullscreen
claude.web::WindowState.getVisibility
claude.web::WindowState.getZoomFactor
claude.web::Launch.* (优先 ~10 个)

=== 国际化 ===
claude.hybrid::DesktopIntl.getInitialLocale
claude.hybrid::DesktopIntl.localeChanged
claude.hybrid::DesktopIntl.requestLocaleChange

=== 偏好 / 配置 ===
claude.settings::AppPreferences.getPreferences
claude.settings::AppPreferences.preferencesChanged
claude.settings::AppPreferences.setPreference
claude.settings::AppFeatures.getSupportedFeatures
claude.settings::AppConfig.* (4个全部)
claude.settings::DesktopInfo.* (2个全部)

=== 账号 / 鉴权 ===
claude.web::Auth.doAuthInBrowser
claude.web::Account.setAccountDetails
claude.web::DeepLink.handleDeepLink

=== 文件系统 ===
claude.web::FileSystem.browseFolder
claude.web::FileSystem.browseFiles
claude.web::FileSystem.readLocalFile
claude.web::FileSystem.writeLocalFile
claude.web::FileSystem.showInFolder

=== Claude Code 引擎入口 ===
claude.web::ClaudeCode.checkGitAvailable
claude.web::ClaudeCode.getStatus
claude.web::ClaudeCode.prepare
claude.web::ClaudeCode.resolveLocalSettings

=== 本地会话（核心子集，从 126 里挑） ===
claude.web::LocalSessions.getAll
claude.web::LocalSessions.getSession
claude.web::LocalSessions.delete
claude.web::LocalSessions.archive
claude.web::LocalSessions.sendMessage          ← 这个名字可能不准，需要再确认
claude.web::LocalSessions.getTranscript
claude.web::LocalSessions.getContextUsage
claude.web::LocalSessions.getCodeStats
claude.web::LocalSessions.getDefaultEffort
claude.web::LocalSessions.getEffort
claude.web::LocalSessions.getDefaultPermissionMode
claude.web::LocalSessions.getPermissionMode
claude.web::LocalSessions.checkGitAvailable
claude.web::LocalSessions.getGitInfo
claude.web::LocalSessions.getInstalledEditors
claude.web::LocalSessions.getDetectedProjects
claude.web::LocalSessions.addDirectories
claude.web::LocalSessions.isFolderTrusted
claude.web::LocalSessions.addTrustedFolder

=== Skills ===
claude.skills::Skills.previewSkillFile
claude.web::LocalAgentModeSessions.listLocalSkills
claude.web::LocalAgentModeSessions.getLocalSkillFiles

=== 自动更新 ===
claude.web::AutoUpdater.* (6个全部)

=== 通知 / Toast ===
claude.web::Toast.showToast
claude.web::DesktopNotifications.* (5个全部)
claude.web::MenuEvents.* (2个全部)
claude.web::Navigation.navigate
claude.web::BrowserNavigation.* (5个全部)
```

合计约 60-80 个 method。**实现完这些，SPA 的"登录 + 列对话 + 发消息收消息 + 看 stats"主路径就跑通了。**

剩余 500 多个 method 按优先级分批补：

- Cowork 全家桶（任务、空间、artifact、记忆、雷达） → 阶段 2
- Buddy 蓝牙 → 跳过或最后实现
- ClaudeVM → 跳过（这是 Anthropic 云端 VM，非本地）
- Computer Use → 阶段 2
- 子窗口（About/Quick/FindInPage）→ 阶段 2

---

## 怎么知道每个 method 的参数 / 返回值类型？

bundle 里没有 TypeScript 类型，但**有 zod schema**：

主进程对每个 IPC method 的请求和返回都跑了 zod 校验，bundle 里能 grep 到大量 `z.object({...}).strict()` 这种代码。

**下一步要做的**：写一个小脚本扫一遍 bundle，把每个 IPC method **附近**的 zod schema 提取出来，反推参数 / 返回值类型。

```
$eipc_message$_..._claude.web_$_LocalSessions_$_getAll
↓
附近会有：
z.object({ ... }).strict().parse(args)   ← 参数 schema
z.array(z.object({ ... })).parse(result) ← 返回值 schema
```

工作量：1-2 天，可以输出一份"584 个 method 的 TypeScript 类型定义"。

---

## ion-dist 怎么调这些 IPC？

前端 SPA 里也有对应的 RPC 客户端代码（约 100 KB），具体形式（推测）：

```js
window.claude.web.LocalSessions.getAll()        // Promise<Session[]>
window.claude.web.LocalSessions.sendMessage(...) // Promise<void> + 监听流式事件
window.claude.web.WindowControl.close()
```

或者用 EventEmitter 模式订阅事件：

```js
window.claude.web.LocalSessions.onTranscriptUpdate((evt) => { ... })
```

具体细节需要阶段 0 之前扫一下 ion-dist 的某个 chunk（找 `$eipc_message$` 出现位置）。

---

## 完整列表

完整的 584 个 method 在 [`ipc-methods.txt`](./ipc-methods.txt)，每行格式：

```
<namespace>::<class>.<method>
```

例：

```
claude.web::LocalSessions.getAll
claude.web::LocalSessions.sendMessage
claude.settings::MCP.addServer
```

---

## 下一步

→ [04 · 内部依赖处理策略](./04-internal-deps.md)
