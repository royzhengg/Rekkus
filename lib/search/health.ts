import { fetchSearchQualityMetrics, type SearchQualityMetricRow } from '@/lib/services/search'

export type SearchHealthStatus = 'healthy' | 'watch' | 'incident'

export type SearchHealthMetricKey =
  | 'success_rate'
  | 'zero_result_rate'
  | 'ctr'
  | 'reformulation_rate'
  | 'downstream_actions'

export type SearchHealthMetric = {
  key: SearchHealthMetricKey
  label: string
  value: number
  unit: 'percent' | 'count'
  status: SearchHealthStatus
  threshold: string
}

export type SearchHealthReport = {
  lookbackDays: number
  generatedAt: string
  rowsAnalyzed: number
  status: SearchHealthStatus
  metrics: SearchHealthMetric[]
  notes: string[]
}

export async function fetchSearchHealthReport(lookbackDays = 30): Promise<SearchHealthReport> {
  const rows = await fetchSearchQualityMetrics(lookbackDays)
  return buildSearchHealthReport(rows, lookbackDays)
}

export function buildSearchHealthReport(
  rows: SearchQualityMetricRow[],
  lookbackDays: number,
  now = Date.now()
): SearchHealthReport {
  const dailyRows = rows.filter(row => row.result_type == null && row.result_position == null)
  const totals = dailyRows.reduce(
    (next, row) => ({
      sessions: next.sessions + row.search_sessions,
      queries: next.queries + row.query_count,
      clicks: next.clicks + row.click_count,
      success: next.success + row.success_count,
      zeroResults: next.zeroResults + row.zero_result_count,
      reformulations: next.reformulations + row.reformulation_count,
      downstream:
        next.downstream +
        row.attributed_view_count +
        row.attributed_save_count +
        row.attributed_review_count,
    }),
    { sessions: 0, queries: 0, clicks: 0, success: 0, zeroResults: 0, reformulations: 0, downstream: 0 }
  )

  const metrics: SearchHealthMetric[] = [
    {
      key: 'success_rate',
      label: 'Search success rate',
      value: percent(totals.success, totals.sessions),
      unit: 'percent',
      status: lowIsBad(percent(totals.success, totals.sessions), 45, 25),
      threshold: 'Watch <45%; incident <25%',
    },
    {
      key: 'zero_result_rate',
      label: 'Zero-result rate',
      value: percent(totals.zeroResults, totals.sessions),
      unit: 'percent',
      status: highIsBad(percent(totals.zeroResults, totals.sessions), 15, 30),
      threshold: 'Watch >15%; incident >30%',
    },
    {
      key: 'ctr',
      label: 'Click-through rate',
      value: percent(totals.clicks, totals.queries),
      unit: 'percent',
      status: lowIsBad(percent(totals.clicks, totals.queries), 10, 5),
      threshold: 'Watch <10%; incident <5%',
    },
    {
      key: 'reformulation_rate',
      label: 'Reformulation rate',
      value: percent(totals.reformulations, totals.queries),
      unit: 'percent',
      status: highIsBad(percent(totals.reformulations, totals.queries), 35, 50),
      threshold: 'Watch >35%; incident >50%',
    },
    {
      key: 'downstream_actions',
      label: 'Attributed downstream actions',
      value: totals.downstream,
      unit: 'count',
      status: 'healthy',
      threshold: 'Informational',
    },
  ]

  return {
    lookbackDays,
    generatedAt: new Date(now).toISOString(),
    rowsAnalyzed: dailyRows.length,
    status: worstStatus(metrics.map(metric => metric.status)),
    metrics,
    notes: [
      'Uses aggregate get_search_quality_metrics rows only; no user IDs, per-session rows, precise coordinates, or raw provider payloads.',
      'Provider fallback/cache/error investigation uses existing analytics/provider events until those rates are promoted into the aggregate RPC.',
    ],
  }
}

function percent(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part * 1000) / whole) / 10
}

function highIsBad(value: number, watch: number, incident: number): SearchHealthStatus {
  if (value >= incident) return 'incident'
  if (value >= watch) return 'watch'
  return 'healthy'
}

function lowIsBad(value: number, watch: number, incident: number): SearchHealthStatus {
  if (value <= incident) return 'incident'
  if (value <= watch) return 'watch'
  return 'healthy'
}

function worstStatus(statuses: SearchHealthStatus[]): SearchHealthStatus {
  if (statuses.includes('incident')) return 'incident'
  if (statuses.includes('watch')) return 'watch'
  return 'healthy'
}
