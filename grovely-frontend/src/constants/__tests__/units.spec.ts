import { describe, expect, it } from 'vitest'

import { compatibleUnits, convertToUnit, gramsPerMl, normalizeUnit } from '../units'

describe('pantry unit conversion', () => {
  it('normalizes supported aliases', () => {
    expect(normalizeUnit('KG')).toBe('kg')
    expect(normalizeUnit('Ml')).toBe('ml')
  })

  it('converts within weight and volume groups', () => {
    expect(convertToUnit(2, 'kg', 'g')).toBe(2000)
    expect(convertToUnit(3, 'tbsp', 'ml')).toBe(45)
  })

  it('uses density for weight-to-volume conversion', () => {
    expect(gramsPerMl(0.8, 'g/ml')).toBe(0.8)
    expect(convertToUnit(800, 'g', 'L', 0.8, 'g/ml')).toBe(1)
  })

  it('rejects incompatible units without density', () => {
    expect(convertToUnit(100, 'g', 'ml')).toBeNull()
    expect(compatibleUnits('g')).not.toContain('ml')
  })
})
