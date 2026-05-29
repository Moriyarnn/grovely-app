export const PANTRY_UNITS = ['g', 'kg', 'ml', 'L', 'cup', 'tbsp', 'tsp']

export const DENSITY_UNITS = ['g/ml', 'g/L', 'kg/L'] as const
export type DensityUnit = typeof DENSITY_UNITS[number]

export const UNIT_ALIASES: Record<string, string> = {
  gr: 'g', Kg: 'kg', KG: 'kg', kG: 'kg',
  Ml: 'ml', ML: 'ml', mL: 'ml',
  l: 'L',
  Tsp: 'tsp', TSP: 'tsp',
  Tbsp: 'tbsp', TBSP: 'tbsp',
  Cup: 'cup', CUP: 'cup',

}

export const UNIT_TO_BASE: Record<string, number> = {
  g: 1, kg: 1000,
  ml: 1, L: 1000,
  tsp: 5, tbsp: 15, cup: 240,
}

export const WEIGHT_UNITS = new Set(['g', 'kg'])
export const VOLUME_UNITS = new Set(['ml', 'L', 'tsp', 'tbsp', 'cup'])
export const UNIT_GROUPS: Set<string>[] = [WEIGHT_UNITS, VOLUME_UNITS]

export const DENSITY_UNIT_TO_GRAMS_PER_ML: Record<string, number> = {
  'g/ml': 1,
  'g/L': 0.001,
  'kg/L': 1,
}

export function normalizeUnit(u: string | null | undefined): string {
  if (!u) return ''
  return UNIT_ALIASES[u] ?? u
}

export function unitGroup(u: string | null | undefined): Set<string> | null {
  const n = normalizeUnit(u)
  return UNIT_GROUPS.find(g => g.has(n)) ?? null
}

export function gramsPerMl(density?: number | null, densityUnit?: string | null): number | null {
  if (!density || !densityUnit) return null
  const factor = DENSITY_UNIT_TO_GRAMS_PER_ML[densityUnit]
  if (!factor) return null
  return density * factor
}

export function convertToUnit(
  amount: number,
  fromUnit: string,
  toUnit: string,
  density?: number | null,
  densityUnit?: string | null,
): number | null {
  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)
  if (from === to) return amount

  const fromBase = UNIT_TO_BASE[from]
  const toBase = UNIT_TO_BASE[to]
  if (!fromBase || !toBase) return null

  const fromGroup = unitGroup(from)
  const toGroup = unitGroup(to)
  if (!fromGroup || !toGroup) return null

  if (fromGroup === toGroup) {
    return parseFloat((amount * fromBase / toBase).toPrecision(8))
  }

  const ratio = gramsPerMl(density, densityUnit)
  if (!ratio) return null

  if (fromGroup === WEIGHT_UNITS && toGroup === VOLUME_UNITS) {
    const grams = amount * fromBase
    const ml = grams / ratio
    return parseFloat((ml / toBase).toPrecision(8))
  }
  if (fromGroup === VOLUME_UNITS && toGroup === WEIGHT_UNITS) {
    const ml = amount * fromBase
    const grams = ml * ratio
    return parseFloat((grams / toBase).toPrecision(8))
  }
  return null
}

export function compatibleUnits(
  unit: string | null | undefined,
  density?: number | null,
  densityUnit?: string | null,
): string[] {
  const n = normalizeUnit(unit)
  if (!n) return []
  const group = unitGroup(n)
  if (!group) return [n]
  const base = [...group]
  if (density && densityUnit && DENSITY_UNIT_TO_GRAMS_PER_ML[densityUnit]) {
    const opposite = group === WEIGHT_UNITS ? VOLUME_UNITS : WEIGHT_UNITS
    return [...base, ...opposite]
  }
  return base
}
