import { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RangedStats } from './types';
import { displayModelName, formatTokens, MODEL_COLORS } from './utils';

const AXIS_TICK = {
  fill: 'var(--t6)',
  fontSize: 10,
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-r3 bg-t1 effect-shadow-small px-p3 py-p2 text-footnote">
      <div className="text-t8">{String(label)}</div>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-g2">
          <span className="size-[6px] rounded-r1" style={{ backgroundColor: String(entry.color) }} aria-hidden="true" />
          <span className="text-t7 flex-1">{displayModelName(entry.name)}</span>
          <span className="text-t9 tabular-nums">{formatTokens(Number(entry.value || 0))}</span>
        </div>
      ))}
    </div>
  );
}

export default function ModelsStats({ ranged }: { ranged: RangedStats }) {
  const [expanded, setExpanded] = useState(false);
  const total = ranged.totalTokens || 1;
  const visibleModels = expanded ? ranged.modelTotals : ranged.modelTotals.slice(0, 6);
  const hiddenCount = ranged.modelTotals.length - visibleModels.length;

  return (
    <div className="flex flex-col gap-g4">
      <div role="img" aria-label="Daily tokens by model" className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ranged.chartRows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} tickFormatter={formatTokens} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--t2)' }} />
            {ranged.modelKeys.map((model, index) => (
              <Bar
                key={model}
                dataKey={model}
                stackId="tokens"
                fill={MODEL_COLORS[index % MODEL_COLORS.length]}
                radius={index === 0 ? [2, 2, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-g2">
        {visibleModels.map((model, index) => (
          <div key={model.model} className="flex items-center gap-g3 text-footnote">
            <span
              className="size-[8px] rounded-r1 shrink-0"
              style={{ backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length] }}
              aria-hidden="true"
            />
            <span className="text-t8 flex-1 truncate">{displayModelName(model.model)}</span>
            <span className="text-t6 shrink-0 tabular-nums">
              {formatTokens(model.usage.inputTokens)} in · {formatTokens(model.usage.outputTokens)} out
            </span>
            <span className="text-t8 shrink-0 tabular-nums w-[56px] text-right">
              {((model.tokens / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
        {ranged.modelTotals.length === 0 ? (
          <span className="text-footnote text-t6">No model usage in this range.</span>
        ) : null}
        {ranged.modelTotals.length > 6 ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className="self-start text-footnote text-t6 hover:text-t8 transition-colors mt-g1"
          >
            {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
