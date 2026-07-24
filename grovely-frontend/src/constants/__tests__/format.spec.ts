import { describe, expect, it } from 'vitest'

import { clampNumber, clampPrice, clampQty } from '../format'

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
