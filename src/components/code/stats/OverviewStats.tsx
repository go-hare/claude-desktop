import Heatmap from './Heatmap';
import MetricCard from './MetricCard';
import TokenComparison from './TokenComparison';
import type { RangedStats, RawCodeStats } from './types';
import { displayModelName, formatNumber, formatTokens } from './utils';

export default function OverviewStats({ stats, ranged }: { stats: RawCodeStats; ranged: RangedStats }) {
  const favoriteModel = ranged.modelTotals[0]?.model ? displayModelName(ranged.modelTotals[0].model) : '-';
  const peakHour =
    stats.peakActivityHour === null
      ? '-'
      : new Date(2000, 0, 1, stats.peakActivityHour).toLocaleTimeString([], {
          hour: 'numeric',
        });

  return (
    <div className="flex flex-col gap-g5">
      <div className="grid grid-cols-4 gap-g3">
        <MetricCard label="Sessions" value={formatNumber(ranged.totalSessions)} />
        <MetricCard label="Messages" value={formatNumber(ranged.totalMessages)} />
        <MetricCard label="Total tokens" value={formatTokens(ranged.totalTokens)} />
        <MetricCard label="Active days" value={String(ranged.activeDays)} />
        <MetricCard label="Current streak" value={`${stats.streaks.currentStreak}d`} />
        <MetricCard label="Longest streak" value={`${stats.streaks.longestStreak}d`} />
        <MetricCard label="Peak hour" value={peakHour} />
        <MetricCard label="Favorite model" value={favoriteModel} small />
      </div>
      <Heatmap dailyActivity={stats.dailyActivity} />
      <TokenComparison totalTokens={ranged.totalTokens} />
    </div>
  );
}
