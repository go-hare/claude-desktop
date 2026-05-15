export type StatsRange = 'all' | '30d' | '7d';
export type StatsView = 'overview' | 'models';

export type DailyActivity = {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
};

export type DailyModelTokens = {
  date: string;
  tokensByModel: Record<string, number>;
};

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
};

export type RawCodeStats = {
  totalSessions: number;
  totalMessages: number;
  activeDays: number;
  streaks: {
    currentStreak: number;
    longestStreak: number;
  };
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, ModelUsage>;
  peakActivityHour: number | null;
};

export type RangedStats = {
  totalSessions: number;
  totalMessages: number;
  totalToolCalls: number;
  totalTokens: number;
  activeDays: number;
  modelTotals: Array<{
    model: string;
    tokens: number;
    usage: ModelUsage;
  }>;
  chartRows: Array<Record<string, number | string>>;
  modelKeys: string[];
};
