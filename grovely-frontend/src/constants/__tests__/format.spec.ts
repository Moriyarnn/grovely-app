import { describe, expect, it } from 'vitest'

import { clampNumber, clampPrice, clampQty, formatMonthDayRange, formatPeriodDayType } from '../format'

describe('number formatting', () => {
  it('returns an empty string for missing and invalid values', () => {
    expect(clampNumber(null, 4)).toBe('')
    expect(clampNumber('not-a-number', 4)).toBe('')
  })

  it('reduces precision to fit the available characters', () => {
    expect(clampNumber(12.345, 5)).toBe('12.35')
    expect(clampPrice(12.345, 5)).toBe('12.35')
  })

  it('preserves space for a quantity unit', () => {
    expect(clampQty(1.25, 'kg', 7)).toBe('1.25 kg')
  })
})

describe('date range formatting', () => {
  it('shows a single date for a one-day period', () => {
    expect(formatMonthDayRange('2026-07-19', '2026-07-19')).toBe('July 19')
  })

  it('keeps both month names when a period crosses into another month', () => {
    expect(formatMonthDayRange('2026-07-31', '2026-08-02')).toBe('July 31 → August 2')
  })
})

describe('period day status formatting', () => {
  it('identifies when a period day is excluded from calculations', () => {
    expect(formatPeriodDayType(false)).toBe('Period day')
    expect(formatPeriodDayType(true)).toBe('Period day - Excluded from calculations')
  })
})
