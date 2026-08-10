import { describe, expect, it } from 'vitest'
import {
  getLoggedDateConflict,
  getPeriodWarningGuidance,
  getShortCycleWarningGap,
  getWarningPulseDates,
  isValidCycleRange,
  shouldShowGapDayActions,
  shouldShowLongCycleGuard,
} from '../periodWarningPulse'

describe('period warning pulse dates', () => {
  it('highlights every period involved in a short-cycle pair', () => {
    const dates = getWarningPulseDates(
      { targetDate: '2026-06-13', cycleIds: [1, 2], affectedDates: ['2026-06-13', '2026-07-03'] },
      [
        { id: 1, start_date: '2026-06-13', end_date: '2026-06-15' },
        { id: 2, start_date: '2026-07-03', end_date: '2026-07-06' },
      ]
    )

    expect([...dates]).toEqual(['2026-06-13', '2026-06-14', '2026-06-15', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06'])
  })
})

describe('period warning guidance', () => {
  it.each([
    ['SHORT_CYCLE_GAP', 'Confirm the pair to include both, or exclude the mistaken period to keep it out of calculations.'],
    ['LONG_PERIOD', 'Confirm it to include it, or exclude it to keep it out of calculations.'],
    ['FUTURE_CYCLE', 'Correct its date, remove it, or exclude it from calculations.'],
  ])('gives a clear resolution for %s', (code, expected) => {
    expect(getPeriodWarningGuidance({ code })).toContain(expected)
  })

  it('directs orphaned data to reconciliation without implying it must be deleted', () => {
    const guidance = getPeriodWarningGuidance({ isOrphaned: true })
    expect(guidance).toContain('review the logged data')
    expect(guidance).toContain('Adjust the cycle to include it')
    expect(guidance).toContain('delete the entry if it is not needed')
  })

  it('does not expose gap-day actions for orphaned cycle data', () => {
    expect(shouldShowGapDayActions('orphaned', true)).toBe(false)
    expect(shouldShowGapDayActions(null, true)).toBe(true)
  })
})

describe('adjusted period short-gap warnings', () => {
  const cycles = [
    { id: 1, start_date: '2026-06-01' },
    { id: 2, start_date: '2026-07-01' },
    { id: 3, start_date: '2026-08-01', review_state: 'excluded' },
  ]

  it('checks a proposed start without comparing it with the cycle old position', () => {
    expect(getShortCycleWarningGap('2026-06-20', cycles, 2)).toBe(19)
  })

  it('checks the following included period and ignores excluded periods', () => {
    expect(getShortCycleWarningGap('2026-06-12', cycles, 1)).toBe(19)
    expect(getShortCycleWarningGap('2026-07-15', cycles, 2)).toBeNull()
  })

  it('warns through 20 days but accepts the 21-day boundary', () => {
    expect(getShortCycleWarningGap('2026-06-21', cycles, 2)).toBe(20)
    expect(getShortCycleWarningGap('2026-06-22', cycles, 2)).toBeNull()
  })
})

describe('long-period warning episodes', () => {
  it('warns again after the same period returns to 10 days or fewer', () => {
    const warnedCycleIds = new Set([2])

    expect(shouldShowLongCycleGuard(12, 2, warnedCycleIds)).toBe(false)
    expect(shouldShowLongCycleGuard(10, 2, warnedCycleIds)).toBe(false)
    expect(warnedCycleIds.has(2)).toBe(false)
    expect(shouldShowLongCycleGuard(11, 2, warnedCycleIds)).toBe(true)
  })
})

describe('adjusted period range validation', () => {
  it('accepts extensions and shrinking without allowing crossed handles', () => {
    expect(isValidCycleRange('2026-07-12', '2026-07-31')).toBe(true)
    expect(isValidCycleRange('2026-07-18', '2026-07-18')).toBe(true)
    expect(isValidCycleRange('2026-07-18', '2026-07-17')).toBe(false)
  })

  it('finds the earliest already-logged day without blocking days owned by the adjusted period', () => {
    const days = [
      { cycle_id: 1, date: '2026-07-18' },
      { cycle_id: 2, date: '2026-07-20' },
      { cycle_id: 3, date: '2026-07-19' },
    ]

    expect(getLoggedDateConflict('2026-07-18', '2026-07-21', days)).toBe('2026-07-18')
    expect(getLoggedDateConflict('2026-07-18', '2026-07-21', days, 1)).toBe('2026-07-19')
    expect(getLoggedDateConflict('2026-07-21', '2026-07-22', days)).toBeNull()
  })
})
