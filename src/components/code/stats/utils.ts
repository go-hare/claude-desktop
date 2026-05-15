import type { RawCodeStats, RangedStats, StatsRange } from './types';

const RANGE_DAYS: Record<StatsRange, number | null> = {
  all: null,
  '30d': 30,
  '7d': 7,
};

export const BOOK_COMPARISONS = [
  { name: 'The Little Prince', tokens: 22000 },
  { name: 'Animal Farm', tokens: 39000 },
  { name: 'The Great Gatsby', tokens: 62000 },
  { name: "Harry Potter and the Philosopher's Stone", tokens: 103000 },
  { name: 'The Hobbit', tokens: 123000 },
  { name: 'Pride and Prejudice', tokens: 156000 },
  { name: 'Dune', tokens: 244000 },
  { name: 'Moby-Dick', tokens: 268000 },
  { name: 'The Lord of the Rings', tokens: 576000 },
  { name: 'War and Peace', tokens: 730000 },
];

export const MODEL_COLORS = [
  'hsl(217 70% 56%)',
  'hsl(15 63% 60%)',
  'hsl(134 58% 38%)',
  'hsl(259 52% 62%)',
  'hsl(342 63% 48%)',
  'hsl(48 62% 42%)',
  'hsl(190 52% 42%)',
  'hsl(24 42% 48%)',
];

export function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatNumber(value: number) {
  return value.toLocaleString('en-US');
}

export function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return formatNumber(value);
}

export function displayModelName(model: string) {
  return model.replace(/-20\d{6}$/, '');
}

function getRangeStart(range: StatsRange) {
  const days = RANGE_DAYS[range];
  if (!days) return null;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return getDateKey(date);
}

export function rangeStats(stats: RawCodeStats, range: StatsRange): RangedStats {
  const start = getRangeStart(range);
  const inRange = (date: string) => !start || date >= start;
  let totalSessions = 0;
  let totalMessages = 0;
  let totalToolCalls = 0;

  for (const day of stats.dailyActivity) {
    if (!inRange(day.date)) continue;
    totalSessions += day.sessionCount;
    totalMessages += day.messageCount;
    totalToolCalls += day.toolCallCount;
  }

  const modelTokenMap = new Map<string, number>();
  const chartRows: RangedStats['chartRows'] = [];
  for (const day of stats.dailyModelTokens) {
    if (!inRange(day.date)) continue;
    const row: Record<string, number | string> = {
      date: new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    };
    for (const [model, tokens] of Object.entries(day.tokensByModel)) {
      modelTokenMap.set(model, (modelTokenMap.get(model) || 0) + tokens);
      row[model] = tokens;
    }
    chartRows.push(row);
  }

  const totalTokens = Array.from(modelTokenMap.values()).reduce((sum, value) => sum + value, 0);
  const threshold = 0.0005 * totalTokens;
  const modelTotals = Array.from(modelTokenMap.entries())
    .map(([model, tokens]) => ({
      model,
      tokens,
      usage: stats.modelUsage[model] || {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
    }))
    .filter((entry) => entry.tokens >= threshold)
    .sort((left, right) => right.tokens - left.tokens);

  return {
    totalSessions,
    totalMessages,
    totalToolCalls,
    totalTokens,
    activeDays: stats.dailyActivity.filter((day) => inRange(day.date)).length,
    modelTotals,
    chartRows,
    modelKeys: modelTotals.map((entry) => entry.model),
  };
}
