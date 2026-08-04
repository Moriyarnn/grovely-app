import { describe, expect, it } from 'vitest'

import { getForecastVisibility, isForecastDateVisible } from '../periodForecastVisibility'

describe('period forecast visibility', () => {
  it('stops a forecast when the next included period begins', () => {
    const visibility = getForecastVisibility([
      { id: 1, start_date: '2026-06-13', review_state: null },
      { id: 2, start_date: '2026-07-03', review_state: null },
    ])

    expect(isForecastDateVisible(1, '2026-07-02', visibility)).toBe(true)
    expect(isForecastDateVisible(1, '2026-07-03', visibility)).toBe(false)
    expect(isForecastDateVisible(2, '2026-07-10', visibility)).toBe(true)
  })

  it('hides forecasts from an unresolved short-gap cycle and cuts off its predecessor', () => {
    const visibility = getForecastVisibility(
      [
        { id: 1, start_date: '2026-06-13', review_state: null },
        { id: 2, start_date: '2026-07-03', review_state: null },
      ],
      [{ code: 'SHORT_CYCLE_GAP', cycleId: 2, cycleIds: [1, 2], targetDate: '2026-07-03', reviewState: null }]
    )

    expect(isForecastDateVisible(1, '2026-07-05', visibility)).toBe(false)
    expect(isForecastDateVisible(1, '2026-07-02', visibility)).toBe(false)
    expect(isForecastDateVisible(2, '2026-07-10', visibility)).toBe(false)
  })

  it('does not let an excluded period cut off the preceding forecast', () => {
    const visibility = getForecastVisibility([
      { id: 1, start_date: '2026-06-13', review_state: null },
      { id: 2, start_date: '2026-07-03', review_state: 'excluded' },
    ])

    expect(isForecastDateVisible(1, '2026-07-10', visibility)).toBe(true)
    expect(isForecastDateVisible(2, '2026-07-10', visibility)).toBe(false)
  })

  it('treats a confirmed short cycle as the new forecast source', () => {
    const visibility = getForecastVisibility([
      { id: 1, start_date: '2026-06-13', review_state: null },
      { id: 2, start_date: '2026-07-03', review_state: 'confirmed' },
    ])

    expect(isForecastDateVisible(1, '2026-07-05', visibility)).toBe(false)
    expect(isForecastDateVisible(2, '2026-07-10', visibility)).toBe(true)
  })
})
