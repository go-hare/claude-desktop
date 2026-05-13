export const COWORK_REFERENCE_CHUNKS = {
  placement: 'c1b9de416-C9ZgPkde.js',
  sidebar: 'ca0135bc5-Cab670j1.js',
  suggestions: 'index-BELzQL5P.js',
  remoteTasks: 'c5da08b62-CJhbL6NF.js',
  taskPanel: 'c705e2e19-CdkFb_TH.js',
} as const;

export const COWORK_TOP_MODES = [
  { key: 'cowork', label: 'Cowork' },
  { key: 'code', label: 'Code' },
] as const;

export const COWORK_NAV = {
  newTask: '新任务',
  projects: '项目',
  scheduled: '定时任务',
  customize: '自定义',
  pinned: '已固定',
  dragToPin: '拖动以固定',
  recents: '最近',
  emptyRecents: '最近任务会显示在这里。',
} as const;

export const COWORK_LANDING = {
  title: '先把清单上的一件事做完',
  safetyLink: '了解如何安全使用 Cowork。',
  placeholder: '今天我能为你提供什么帮助吗?',
  projectWorkspace: '项目工作区',
  model: 'gpt-5.2',
  suggestionGroup: '选择一个任务，任何任务',
  customizeWithPlugins: '使用插件自定义',
} as const;

export const COWORK_TASK_COPY = {
  runningStatus: 'Working on it...',
  showMore: 'Show more',
  queue: 'Queue',
  messagePlaceholder: 'Write a message...',
  progress: '进度',
  progressHint: 'See task progress for longer tasks.',
  workingFolder: '工作文件夹',
  context: '上下文',
  contextHint: 'Track tools and referenced files used in this task.',
  disclaimer: 'Claude 是 AI，可能会出错。请务必再次核对回复内容。',
} as const;

export const COWORK_REMOTE_TASKS = {
  emptyTitle: 'All clear',
  emptySubtitle: 'Nothing in your backlog. Create a new task to get started.',
  pathSuffix: '/tasks',
  rootClassName: 'remote-agents-root epitaxy-chat-column epitaxy-chat-size',
  hideComposer: true,
} as const;

export const COWORK_SUGGESTION_MESSAGES = {
  groupId: 'Z5t:cowork-suggestions',
  initialName: {
    id: 'OnaQpdV9zK',
    defaultMessage: 'Pick a task, any task',
    zh: '选择一个任务，任何任务',
  },
  items: [
    {
      id: 'optimize-week',
      labelMessageId: 'ov1AuKcjep',
      promptMessageId: '/Vj7RXZdgy',
      defaultLabel: 'Optimize my week',
      zhLabel: '优化我的一周',
      prompt: `帮我规划并优化这一周。我已经打开了 Google Calendar，方便你查看和编辑。

首先，请查看我的日历并展示一份摘要：
- 会议总数
- 最忙的日期
- 哪些地方有 2 小时以上的空档

在提出调整前，请先询问我：
- 这一周我想完成什么
- 我需要多少专注时间，以及用于什么事情
- 日历里没有体现的截止日期或承诺
- 哪些类型的会议可以拒绝或缩短
- 我想保护的个人安排或边界

然后展示你建议的 3-5 个最重要调整，并解释原因：
- 要添加的专注时间块
- 要拒绝或重新安排的会议
- 要解决的时间冲突

从影响最大的调整开始。每次变更都先等我批准，再逐项直接修改我的日历。`,
    },
    {
      id: 'organize-screenshots',
      labelMessageId: 'R9OYtL0hxN',
      promptMessageId: 'gf8CwL7i2S',
      defaultLabel: 'Organize my screenshots',
      zhLabel: '整理我的截图',
      prompt: `帮我整理桌面上最近的截图。

首先，扫描我的桌面，统计那里有多少截图或图片，并展示：
- 总数量
- 时间范围，从最早到最新

然后，只关注最近 14 天的截图。对每张截图：
- 识别它显示的内容
- 建议一个描述性文件名
- 建议它应该放在哪个文件夹里，或者是否可以删除

把相似截图归为一组。在做任何改动前，先向我展示整理计划。

我批准后，先只整理 10 个文件作为预览。如果还有超过 10 个文件，继续处理剩余文件前先和我确认。`,
    },
    {
      id: 'find-file-insights',
      labelMessageId: 'JDTaxC6dOy',
      promptMessageId: 'ngR3ofl7vO',
      defaultLabel: 'Find insights in files',
      zhLabel: '在文件中查找见解',
      prompt: `帮我在这些文件中寻找模式和见解：[我的语音备忘录 / 会议转录 / 文档 / 日记条目 / 指定文件夹]。这些文件比较杂乱、没有结构，我想知道里面正在浮现哪些主题。

首先，扫描文件夹并展示一份摘要：
- 文件总数
- 时间范围，从最早到最新
- 内容类型

在分析前，请先询问我：
- 我希望发现什么，例如反复出现的主题、矛盾、思路变化、行动项或其他内容
- 是否应该优先分析某些文件或时间段
- 最终分析用什么格式对我最有帮助

如果超过 20 个文件，先只分析最近的 10 个文件。

展示你找到的 3-5 个最重要模式，每个模式给出 2-3 个具体例子。等我确认方向正确后，再分析剩余文件。`,
    },
  ],
} as const;
