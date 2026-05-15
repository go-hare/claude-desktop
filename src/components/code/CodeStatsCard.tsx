import { useMemo, useState } from 'react';
import ModelsStats from './stats/ModelsStats';
import OverviewStats from './stats/OverviewStats';
import SegmentedTabs from './stats/SegmentedTabs';
import type { RawCodeStats, StatsRange, StatsView } from './stats/types';
import { rangeStats } from './stats/utils';

export type { RawCodeStats } from './stats/types';

export function CodeStatsSkeleton() {
  return (
    <div className="flex flex-col gap-[20px] p-[12px] pt-[8px] rounded-r6 bg-t1 max-w-[480px]" aria-busy="true">
      <div className="grid grid-cols-4 gap-g3 animate-pulse">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-[44px] rounded-r4 bg-t2" />
        ))}
      </div>
      <div className="h-[120px] rounded-r4 bg-t2 animate-pulse" />
    </div>
  );
}

export default function CodeStatsCard({ stats }: { stats: RawCodeStats }) {
  const [view, setView] = useState<StatsView>('overview');
  const [range, setRange] = useState<StatsRange>('all');
  const ranged = useMemo(() => rangeStats(stats, range), [stats, range]);

  return (
    <div className="flex flex-col gap-[20px] p-[12px] pt-[8px] rounded-r6 bg-t1 max-w-[480px]">
      <div className="flex items-center gap-g4 min-w-0">
        <SegmentedTabs
          value={view}
          ariaLabel="Stats view"
          onChange={setView}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'models', label: 'Models' },
          ]}
        />
        <span className="flex-1" />
        <SegmentedTabs
          value={range}
          ariaLabel="Date range"
          onChange={setRange}
          items={[
            { value: 'all', label: 'All' },
            { value: '30d', label: '30d' },
            { value: '7d', label: '7d' },
          ]}
        />
      </div>
      {view === 'overview' ? <OverviewStats stats={stats} ranged={ranged} /> : <ModelsStats ranged={ranged} />}
    </div>
  );
}
