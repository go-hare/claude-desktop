import React from 'react';
import { CalendarDays, Folder, TableProperties } from 'lucide-react';

export type CoworkSuggestionItem = {
  id: string;
  icon: React.ReactNode;
  title: string;
  prompt: string;
};

export const COWORK_SUGGESTIONS: CoworkSuggestionItem[] = [
  {
    id: 'week',
    icon: <CalendarDays size={24} strokeWidth={1.55} />,
    title: '优化我的一周',
    prompt: `帮我优化这一周的安排。

先帮我梳理：
- 已有任务和日程
- 最重要的 3 件事
- 可能冲突或过载的时间段

然后给我一个可执行的一周计划。先展示方案，等我确认后再继续。`,
  },
  {
    id: 'screenshots',
    icon: <Folder size={24} strokeWidth={1.7} />,
    title: '整理我的截图',
    prompt: `帮我整理截图文件。

先扫描截图所在文件夹并汇总：
- 截图数量
- 时间范围
- 可能的主题分类

再给出整理方案，例如按项目、日期或用途分组。先让我确认方案。`,
  },
  {
    id: 'insights',
    icon: <TableProperties size={24} strokeWidth={1.55} />,
    title: '在文件中查找见解',
    prompt: `帮我从文件中查找有用见解。

先询问我要分析哪个文件或文件夹，然后总结：
- 关键主题
- 异常或值得注意的模式
- 可以采取的下一步

在执行前先说明你会查看哪些文件。`,
  },
];

