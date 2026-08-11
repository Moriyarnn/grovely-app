import { describe, expect, it } from 'vitest'

import {
  getForecastVisibility,
  getLatestEligibleCycle,
  isForecastDateVisible,
  isMissedPeriodVisible,
} from '../periodForecastVisibility'

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

  it('quarantines both periods in an unresolved short-gap pair', () => {
    const visibility = getForecastVisibility(
      [
        { id: 1, start_date: '2026-06-13', review_state: null },
        { id: 2, start_date: '2026-07-03', review_state: null },
      ],
      [{ code: 'SHORT_CYCLE_GAP', cycleId: 2, cycleIds: [1, 2], targetDate: '2026-07-03', reviewState: null }]
    )

    expect(isForecastDateVisible(1, '2026-07-02', visibility)).toBe(false)
    expect(isForecastDateVisible(2, '2026-07-10', visibility)).toBe(false)
  })

  it('does not let unresolved warning periods cut off an earlier eligible forecast', () => {
    const visibility = getForecastVisibility(
      [
        { id: 1, start_date: '2026-05-01', review_state: null },
        { id: 2, start_date: '2026-06-13', review_state: null },
        { id: 3, start_date: '2026-07-03', review_state: null },
      ],
      [{ code: 'SHORT_CYCLE_GAP', cycleIds: [2, 3], reviewState: null }]
    )

    expect(isForecastDateVisible(1, '2026-07-10', visibility)).toBe(true)
  })

  it('keeps both periods eligible when only their connecting interval is under review', () => {
    const visibility = getForecastVisibility(
      [
        { id: 1, start_date: '2026-05-01', review_state: null },
        { id: 2, start_date: '2026-06-30', review_state: null },
      ],
      [{ code: 'MISSING_PERIOD_GAP', cycleIds: [1, 2], reviewState: null }]
    )

    expect(visibility.get(1)?.hidden).toBe(false)
    expect(visibility.get(1)?.cutoffDate).toBe('2026-06-30')
    expect(visibility.get(2)?.hidden).toBe(false)
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

  it('never selects unresolved or excluded periods as the duration-ghost anchor', () => {
    const cycles = [
      { id: 1, start_date: '2026-05-01', review_state: null },
      { id: 2, start_date: '2026-06-13', review_state: null },
      { id: 3, start_date: '2026-07-03', review_state: null },
      { id: 4, start_date: '2026-07-20', review_state: 'excluded' as const },
    ]
    const warnings = [{ code: 'SHORT_CYCLE_GAP', cycleIds: [2, 3], reviewState: null }]

    expect(getLatestEligibleCycle(cycles, warnings)?.id).toBe(1)
    expect(getLatestEligibleCycle(cycles, warnings, 3)?.id).toBe(1)
  })

  it('quarantines long-period and future-cycle warnings from ghost selection', () => {
    const cycles = [
      { id: 1, start_date: '2026-05-01', review_state: null },
      { id: 2, start_date: '2026-06-01', review_state: null },
      { id: 3, start_date: '2026-09-01', review_state: null },
    ]
    const warnings = [
      { code: 'LONG_PERIOD', cycleId: 2, reviewState: null },
      { code: 'FUTURE_CYCLE', cycleId: 3, reviewState: null },
    ]

    expect(getLatestEligibleCycle(cycles, warnings)?.id).toBe(1)
  })

  it('suppresses a complete missed-period ghost when it overlaps an unresolved period', () => {
    const cycles = [
      { id: 494, start_date: '2026-07-19', end_date: '2026-07-21', review_state: null },
      { id: 495, start_date: '2026-07-28', end_date: '2026-07-30', review_state: null },
    ]

    expect(isMissedPeriodVisible('2026-07-18', 7, cycles)).toBe(false)
  })

  it('lets an explicitly excluded period remain transparent to missed predictions', () => {
    const cycles = [
      { id: 494, start_date: '2026-07-19', end_date: '2026-07-21', review_state: 'excluded' as const },
    ]

    expect(isMissedPeriodVisible('2026-07-18', 7, cycles)).toBe(true)
  })

  it('keeps a missed-period ghost when the logged period does not overlap it', () => {
    const cycles = [
      { id: 495, start_date: '2026-07-28', end_date: '2026-07-30', review_state: null },
    ]

    expect(isMissedPeriodVisible('2026-07-18', 7, cycles)).toBe(true)
  })
})
