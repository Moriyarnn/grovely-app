const UNIT_ALIASES = {
  gr: 'g', Kg: 'kg', KG: 'kg', kG: 'kg',
  Ml: 'ml', ML: 'ml', mL: 'ml',
  l: 'L',
  Tsp: 'tsp', TSP: 'tsp',
  Tbsp: 'tbsp', TBSP: 'tbsp',
  Cup: 'cup', CUP: 'cup',
  Pcs: 'pcs', PCS: 'pcs', pc: 'pcs',
}

const UNIT_TO_BASE = {
  g: 1, kg: 1000,
  ml: 1, L: 1000,
  tsp: 5, tbsp: 15, cup: 240,
}

const WEIGHT_UNITS = new Set(['g', 'kg'])
const VOLUME_UNITS = new Set(['ml', 'L', 'tsp', 'tbsp', 'cup'])
const UNIT_GROUPS = [WEIGHT_UNITS, VOLUME_UNITS]

const DENSITY_UNITS = ['g/ml', 'g/L', 'kg/L']
const DENSITY_UNIT_TO_GRAMS_PER_ML = {
  'g/ml': 1,
  'g/L': 0.001,
  'kg/L': 1,
}

function normalizeUnit(u) {
  if (!u) return u
  return UNIT_ALIASES[u] ?? u
}

function unitGroup(u) {
  const n = normalizeUnit(u)
  return UNIT_GROUPS.find(g => g.has(n))
}

function gramsPerMl(density, densityUnit) {
  const factor = DENSITY_UNIT_TO_GRAMS_PER_ML[densityUnit]
  if (!factor || !density) return null
  return density * factor
}

function convertToUnit(amount, fromUnit, toUnit, density, densityUnit) {
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

function compatibleUnits(unit, density, densityUnit) {
  const n = normalizeUnit(unit)
  const group = unitGroup(n)
  if (!group) return n ? [n] : []
  const base = [...group]
  if (density && densityUnit && DENSITY_UNIT_TO_GRAMS_PER_ML[densityUnit]) {
    const opposite = group === WEIGHT_UNITS ? VOLUME_UNITS : WEIGHT_UNITS
    return [...base, ...opposite]
  }
  return base
}

module.exports = {
  UNIT_ALIASES,
  UNIT_TO_BASE,
  UNIT_GROUPS,
  WEIGHT_UNITS,
  VOLUME_UNITS,
  DENSITY_UNITS,
  DENSITY_UNIT_TO_GRAMS_PER_ML,
  normalizeUnit,
  convertToUnit,
  compatibleUnits,
}
