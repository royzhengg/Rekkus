jest.mock('@/lib/services/search', () => ({
  fetchSearchQualityMetrics: jest.fn(),
}))

import { buildSearchHealthReport } from '@/lib/search/health'
import type { SearchQualityMetricRow } from '@/lib/services/search'

function metricRow(overrides: Partial<SearchQualityMetricRow> = {}): SearchQualityMetricRow {
  return {
    day: '2026-06-03',
    result_type: null,
    result_position: null,
    search_sessions: 100,
    query_count: 120,
    click_count: 30,
    attributed_view_count: 20,
    attributed_save_count: 10,
    attributed_review_count: 2,
    zero_result_count: 8,
    reformulation_count: 20,
    success_count: 60,
    success_rate: 60,
    ctr: 25,
    zero_result_rate: 8,
    reformulation_rate: 16.7,
    ...overrides,
  }
}

describe('buildSearchHealthReport', () => {
  it('summarizes daily aggregate rows into privacy-safe health metrics', () => {
    const report = buildSearchHealthReport(
      [
        metricRow(),
        metricRow({
          result_type: 'place',
          result_position: 1,
          search_sessions: 100,
          query_count: 120,
          click_count: 50,
        }),
      ],
      30,
      Date.parse('2026-06-03T00:00:00.000Z')
    )

    expect(report).toEqual(expect.objectContaining({
      lookbackDays: 30,
      generatedAt: '2026-06-03T00:00:00.000Z',
      rowsAnalyzed: 1,
      status: 'healthy',
    }))
    expect(report.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'success_rate', value: 60, status: 'healthy' }),
      expect.objectContaining({ key: 'zero_result_rate', value: 8, status: 'healthy' }),
      expect.objectContaining({ key: 'ctr', value: 25, status: 'healthy' }),
      expect.objectContaining({ key: 'downstream_actions', value: 32, status: 'healthy' }),
    ]))
    expect(report.notes.join(' ')).toContain('no user IDs')
  })

  it('promotes watch and incident statuses from threshold breaches', () => {
    const watch = buildSearchHealthReport([
      metricRow({ success_count: 40, zero_result_count: 20, click_count: 20 }),
    ], 7)
    expect(watch.status).toBe('watch')
    expect(watch.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'success_rate', status: 'watch' }),
      expect.objectContaining({ key: 'zero_result_rate', status: 'watch' }),
    ]))

    const incident = buildSearchHealthReport([
      metricRow({ success_count: 20, zero_result_count: 35, click_count: 3 }),
    ], 7)
    expect(incident.status).toBe('incident')
    expect(incident.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'success_rate', status: 'incident' }),
      expect.objectContaining({ key: 'zero_result_rate', status: 'incident' }),
      expect.objectContaining({ key: 'ctr', status: 'incident' }),
    ]))
  })
})
