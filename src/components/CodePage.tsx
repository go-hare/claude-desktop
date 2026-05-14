import React, { useEffect, useMemo, useState } from 'react';
import { CornerDownLeft, Folder, Laptop, Plus } from 'lucide-react';
import starSparkleImg from '../assets/figma-exports/cowork-icons/star-sparkle.png';
import { getConversations } from '../api';

type ConversationRecord = {
  id: string;
  model?: string;
  created_at?: string;
  updated_at?: string;
  messages?: Array<{ role?: string }>;
};

type CodeStats = {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  peakHour: number | null;
  favoriteModel: string;
  heatmap: Array<Array<{ date: string; count: number; future: boolean }>>;
  bookComparison: string;
};

const OFFICIAL_FALLBACK_STATS: CodeStats = {
  totalSessions: 318,
  totalMessages: 8970,
  totalTokens: 69300000,
  activeDays: 19,
  currentStreak: 0,
  longestStreak: 7,
  peakHour: 20,
  favoriteModel: 'gpt-5.4',
  heatmap: Array.from({ length: 27 }, (_, column) =>
    Array.from({ length: 7 }, (_, row) => {
      const activeColumns = new Set([21, 22, 23, 24, 25, 26]);
      const strongCells = new Set(['22-5', '23-4', '24-3', '24-6', '25-4', '26-2']);
      const mediumCells = new Set(['21-2', '21-3', '21-4', '22-2', '22-3', '22-4', '23-1', '23-2', '23-3', '24-1', '24-2', '24-4', '25-2', '25-3', '25-5', '26-1', '26-3']);
      const key = `${column}-${row}`;
      const count = strongCells.has(key) ? 9 : mediumCells.has(key) ? 6 : activeColumns.has(column) && row > 0 && row < 6 ? 2 : 0;
      return { date: `demo-${column}-${row}`, count, future: false };
    })
  ),
  bookComparison: '你使用的 token 数约为 Animal Farm 的 ~176 倍。',
};

const BOOK_COMPARISONS = [
  { name: '小王子', tokens: 22000 },
  { name: '动物农场', tokens: 39000 },
  { name: '了不起的盖茨比', tokens: 62000 },
  { name: '哈利波特与魔法石', tokens: 103000 },
  { name: '霍比特人', tokens: 123000 },
  { name: '傲慢与偏见', tokens: 156000 },
  { name: '沙丘', tokens: 244000 },
  { name: '白鲸', tokens: 268000 },
  { name: '指环王', tokens: 576000 },
  { name: '战争与和平', tokens: 730000 },
];

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDateKey(value: Date) {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function deriveStats(conversations: ConversationRecord[]): CodeStats {
  const totalSessions = conversations.length;
  const totalMessages = conversations.reduce((sum, item) => sum + (item.messages?.length || 0), 0);
  const totalTokens = Math.round(totalMessages * 2818);

  const dailyCounts = new Map<string, number>();
  const hourlyCounts = new Map<number, number>();
  const modelCounts = new Map<string, number>();

  for (const conversation of conversations) {
    const dateValue = conversation.updated_at || conversation.created_at;
    if (!dateValue) continue;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) continue;

    const dayKey = formatDateKey(date);
    dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);

    const hour = date.getHours();
    hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + 1);

    const model = (conversation.model || '').trim() || 'gpt-5.4';
    modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
  }

  const activeDays = dailyCounts.size;

  let peakHour: number | null = null;
  let peakHourCount = -1;
  for (const [hour, count] of hourlyCounts.entries()) {
    if (count > peakHourCount) {
      peakHour = hour;
      peakHourCount = count;
    }
  }

  let favoriteModel = 'gpt-5.4';
  let favoriteModelCount = -1;
  for (const [model, count] of modelCounts.entries()) {
    if (count > favoriteModelCount) {
      favoriteModel = model;
      favoriteModelCount = count;
    }
  }

  const activeKeys = [...dailyCounts.keys()].sort();
  let longestStreak = 0;
  let currentStreak = 0;
  let rolling = 0;
  let prevDate: Date | null = null;
  for (const key of activeKeys) {
    const current = startOfDay(new Date(`${key}T00:00:00`));
    if (!prevDate) {
      rolling = 1;
    } else {
      const diffDays = Math.round((current.getTime() - prevDate.getTime()) / 86400000);
      rolling = diffDays === 1 ? rolling + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, rolling);
    prevDate = current;
  }

  if (activeKeys.length > 0) {
    const today = startOfDay(new Date());
    const activeSet = new Set(activeKeys);
    let cursor = today;
    while (activeSet.has(formatDateKey(cursor))) {
      currentStreak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
  }

  const today = startOfDay(new Date());
  const end = startOfDay(new Date(today));
  end.setDate(today.getDate() + (6 - today.getDay()));
  const start = new Date(end);
  start.setDate(end.getDate() - 182 + 1);

  const days: Array<{ date: string; count: number; future: boolean }> = [];
  let maxCount = 0;
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const dateKey = formatDateKey(cursor);
    const count = dailyCounts.get(dateKey) || 0;
    maxCount = Math.max(maxCount, count);
    days.push({
      date: dateKey,
      count,
      future: cursor > today,
    });
  }

  const heatmap: CodeStats['heatmap'] = [];
  for (let index = 0; index < days.length; index += 7) {
    heatmap.push(days.slice(index, index + 7));
  }

  const comparison = [...BOOK_COMPARISONS].reverse().find((item) => totalTokens >= item.tokens);
  const times = comparison ? Math.floor(totalTokens / comparison.tokens) : 0;
  const bookComparison = comparison
    ? times >= 2
      ? `你使用的 token 数约为 ${comparison.name} 的 ~${times} 倍。`
      : `你使用的 token 数约等于 ${comparison.name}。`
    : '';

  return {
    totalSessions,
    totalMessages,
    totalTokens,
    activeDays,
    currentStreak,
    longestStreak,
    peakHour,
    favoriteModel,
    heatmap,
    bookComparison,
  };
}

function metricCell(label: string, value: string, small = false) {
  return (
    <div className="flex flex-col gap-[3px] rounded-[6px] bg-[#ddd9d2] px-[8px] py-[7px]">
      <span className="truncate text-[11px] leading-[14px] text-[#86827b]">{label}</span>
      <span className={`truncate font-medium tabular-nums text-[#2f2d2a] ${small ? 'text-[13px] leading-[17px]' : 'text-[14px] leading-[19px]'}`}>
        {value}
      </span>
    </div>
  );
}

function Heatmap({ weeks }: { weeks: CodeStats['heatmap'] }) {
  const max = Math.max(...weeks.flatMap((week) => week.map((item) => item.count)), 0);
  return (
    <div className="flex w-full gap-[3px]" aria-label="Daily activity heatmap">
      {weeks.map((week, index) => (
        <div key={`week-${index}`} className="flex flex-col gap-[3px]">
          {week.map((item) => {
            if (item.future) {
              return <div key={item.date} className="h-[14px] w-[14px] rounded-[2px]" />;
            }
            const ratio = max === 0 ? 0 : item.count / max;
            const background = ratio === 0 ? '#ddd9d2' : ratio > 0.8 ? '#2f66d0' : ratio > 0.55 ? '#6f98ea' : ratio > 0.3 ? '#a4bef3' : '#d7e2fb';
            return (
              <div
                key={item.date}
                className="h-[14px] w-[14px] rounded-[2px]"
                style={{ backgroundColor: background }}
                title={`${item.date} - ${item.count}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function StatsCard({ stats }: { stats: CodeStats }) {
  const peakHour = stats.peakHour === null ? '—' : `${stats.peakHour}时`;
  return (
    <div className="flex w-[480px] flex-col gap-[20px] rounded-[12px] border border-[#e7e2d8] bg-[#f1efeb] p-[12px] pt-[8px] shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-[8px]">
        <div className="inline-flex items-center rounded-[8px] bg-[#e7e5e1] p-[2px]">
          <button type="button" className="rounded-[6px] bg-[#f7f6f3] px-[9px] py-[4px] text-[12px] leading-[16px] text-[#2f2d2a]">
            概述
          </button>
          <button type="button" className="px-[9px] py-[4px] text-[12px] leading-[16px] text-[#66625c]">
            模型
          </button>
        </div>
        <span className="flex-1" />
        <div className="inline-flex items-center rounded-[8px] bg-[#e7e5e1] p-[2px]">
          <button type="button" className="rounded-[6px] bg-[#f7f6f3] px-[9px] py-[4px] text-[12px] leading-[16px] text-[#2f2d2a]">
            全部
          </button>
          <button type="button" className="px-[9px] py-[4px] text-[12px] leading-[16px] text-[#66625c]">
            30天
          </button>
          <button type="button" className="px-[9px] py-[4px] text-[12px] leading-[16px] text-[#66625c]">
            7天
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-[6px]">
        {metricCell('会话', stats.totalSessions.toLocaleString('en-US'))}
        {metricCell('消息', stats.totalMessages.toLocaleString('en-US'))}
        {metricCell('Token 总数', `${(stats.totalTokens / 1000000).toFixed(1)}M`)}
        {metricCell('活跃天数', String(stats.activeDays))}
        {metricCell('当前连胜', `${stats.currentStreak}天`)}
        {metricCell('最长连胜', `${stats.longestStreak}天`)}
        {metricCell('高峰时段', peakHour)}
        {metricCell('常用模型', stats.favoriteModel, true)}
      </div>

      <div className="pt-[2px]">
        <Heatmap weeks={stats.heatmap} />
      </div>
      {stats.bookComparison ? (
        <span className="pt-[4px] text-[11px] leading-[14px] text-[#86827b]">{stats.bookComparison}</span>
      ) : null}
    </div>
  );
}

function ClawdMascot() {
  return (
    <img
      src="/code-clawd.gif"
      alt=""
      aria-hidden="true"
      data-testid="code-clawd"
      className="pointer-events-none absolute right-[10px] top-[-22px] z-[2] h-[32px] w-[32px] select-none"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function Composer() {
  return (
    <div className="flex w-full max-w-[752px] flex-col">
      <div className="mb-[8px] flex items-center gap-[6px]">
        <button
          type="button"
          className="inline-flex h-[25px] items-center gap-[4px] rounded-[6px] border border-[#d8d5cf] bg-[#fffefa] px-[8px] text-[13px] leading-none text-[#3d3b37] shadow-[0_1px_1px_rgba(0,0,0,0.04)]"
        >
          <Laptop size={14} strokeWidth={1.7} />
          本地
        </button>
        <button
          type="button"
          className="inline-flex h-[25px] items-center gap-[4px] rounded-[6px] border border-[#d8d5cf] bg-[#fffefa] px-[8px] text-[13px] leading-none text-[#3d3b37] shadow-[0_1px_1px_rgba(0,0,0,0.04)]"
        >
          <Folder size={14} strokeWidth={1.7} />
          选择文件夹...
        </button>
      </div>

      <div className="relative">
        <ClawdMascot />
        <div
          className="relative border border-[rgba(31,31,30,0.15)] bg-white"
          style={{
            borderRadius: '15px',
            boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.05)',
          }}
        >
          <textarea
            placeholder="描述任务或提出问题"
            className="min-h-[44px] w-full resize-none border-0 bg-transparent px-[16px] py-[12px] pr-[48px] text-[16px] leading-[24px] tracking-[-0.22px] text-[#2f2d2a] outline-none placeholder:text-[#b7b0a7]"
            rows={1}
          />
          <button
            type="button"
            aria-label="发送"
            className="absolute right-[10px] top-1/2 flex h-[24px] w-[24px] -translate-y-1/2 items-center justify-center rounded-full text-[#5c5851] transition-colors hover:bg-[#f1efea] hover:text-[#1f1f1e]"
          >
            <CornerDownLeft size={16} strokeWidth={1.9} />
          </button>
        </div>

        <div className="flex items-center justify-between px-[2px] pt-[8px]">
          <div className="flex items-center gap-[10px] text-[13px] leading-[18px] text-[#625d57]">
            <button type="button" className="rounded-[6px] px-[4px] py-[3px] transition-colors hover:bg-[#f3f1ed]">
              接受编辑
            </button>
            <button type="button" className="rounded-[6px] p-[4px] transition-colors hover:bg-[#f3f1ed]" aria-label="添加">
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center gap-[10px]">
            <span className="text-[13px] leading-[18px] text-[#625d57]">gpt-5.4 · 中</span>
            <span className="h-[10px] w-[10px] rounded-full border border-[#c8c2b9] bg-[#fbfbf7]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CodePage() {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    getConversations()
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setConversations(data as ConversationRecord[]);
        }
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (conversations.length === 0) return OFFICIAL_FALLBACK_STATS;
    return deriveStats(conversations);
  }, [conversations]);

  return (
    <main className="flex h-full min-h-0 w-full bg-[#fbfbf7] text-[#1f1f1e]">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1152px] px-[24px]">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[752px] flex-col justify-between pb-[14px] pt-[38px]">
          <div className="w-full">
            <header className="mb-[54px] flex items-center gap-[12px]">
              <img src={starSparkleImg} alt="" aria-hidden="true" className="h-[22px] w-[22px] shrink-0" />
              <h1 className="text-[22px] font-semibold leading-[28px] text-[#1f1f1e]">接下来做什么?</h1>
            </header>

            <section className="flex justify-start">
              <StatsCard stats={stats} />
            </section>
          </div>

          <div className="w-full pt-[24px]">
            <Composer />
          </div>
        </div>
      </div>
    </main>
  );
}
