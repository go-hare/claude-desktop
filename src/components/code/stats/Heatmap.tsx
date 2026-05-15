import { useMemo } from 'react';
import type { DailyActivity } from './types';
import { formatNumber, getDateKey } from './utils';

export default function Heatmap({ dailyActivity }: { dailyActivity: DailyActivity[] }) {
  const { weeks, max } = useMemo(() => {
    const counts = new Map(dailyActivity.map((day) => [day.date, day.messageCount]));
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(end.getDate() - 182 + 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let maxCount = 0;
    const cells: Array<{ date: string; count: number; future: boolean }> = [];

    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const date = getDateKey(cursor);
      const count = counts.get(date) || 0;
      maxCount = Math.max(maxCount, count);
      cells.push({ date, count, future: cursor > today });
    }

    const grouped = [];
    for (let index = 0; index < cells.length; index += 7) {
      grouped.push(cells.slice(index, index + 7));
    }
    return { weeks: grouped, max: maxCount };
  }, [dailyActivity]);

  return (
    <div role="img" aria-label="Daily activity heatmap" className="flex gap-[3px] w-full">
      {weeks.map((week, weekIndex) => (
        <div key={`week-${weekIndex}`} className="flex flex-col gap-[3px] flex-1 min-w-0">
          {week.map((cell) => {
            if (cell.future) return <div key={cell.date} className="aspect-square rounded-r1" />;
            const ratio = max === 0 ? 0 : cell.count / max;
            const level = ratio === 0 ? null : 80 - 8 * Math.ceil(4 * ratio);
            return (
              <div
                key={cell.date}
                className="aspect-square rounded-r1 bg-t2"
                title={`${cell.date} - ${formatNumber(cell.count)}`}
                style={level === null ? undefined : { backgroundColor: `hsl(217 70% ${level}%)` }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
