/**
 * Code stats helper — called by bridge-server via Bun subprocess
 * Usage: bun stats-helper.ts [range]
 * range: all | 30d | 7d
 */

import { aggregateClaudeCodeStatsForRange, type StatsDateRange } from './src/utils/stats.ts'

const rawRange = (process.argv[2] || 'all').trim()
const range: StatsDateRange =
  rawRange === '7d' || rawRange === '30d' ? rawRange : 'all'

try {
  const stats = await aggregateClaudeCodeStatsForRange(range)
  console.log(JSON.stringify({ ok: true, range, stats }))
} catch (error: any) {
  console.error(
    JSON.stringify({
      ok: false,
      range,
      error: error?.message || 'Failed to aggregate code stats',
    }),
  )
  process.exit(1)
}
