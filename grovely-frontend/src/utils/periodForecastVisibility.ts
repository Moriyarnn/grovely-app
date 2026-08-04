export type CycleForecastSource = {
  id: number | string
  start_date: string
  review_state?: 'confirmed' | 'excluded' | null
}

export type PredictionDataWarning = {
  code?: string
  cycleId?: number | string
  cycleIds?: Array<number | string>
  targetDate?: string
  reviewState?: 'confirmed' | 'excluded' | null
}

export type ForecastVisibility = {
  hidden: boolean
  cutoffDate: string | null
}

function unresolvedShortCycleIds(warnings: PredictionDataWarning[]) {
  return new Set(
    warnings
      .filter(warning => warning.code === 'SHORT_CYCLE_GAP' && !warning.reviewState)
      .flatMap(warning => warning.cycleIds ?? [warning.cycleId])
      .filter((id): id is number | string => id !== undefined && id !== null)
  )
}

// A forecast stops when the next included period begins. An unresolved short-gap
// period also keeps its own forecast hidden until the gap is reviewed.
export function getForecastVisibility(
  cycles: CycleForecastSource[],
  warnings: PredictionDataWarning[] = []
) {
  const unresolvedIds = unresolvedShortCycleIds(warnings)
  const includedCycles = cycles
    .filter(cycle => cycle.review_state !== 'excluded')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const visibility = new Map<number | string, ForecastVisibility>()

  includedCycles.forEach((cycle, index) => {
    visibility.set(cycle.id, {
      hidden: unresolvedIds.has(cycle.id),
      cutoffDate: includedCycles[index + 1]?.start_date ?? null,
    })
  })

  cycles
    .filter(cycle => cycle.review_state === 'excluded')
    .forEach(cycle => visibility.set(cycle.id, { hidden: true, cutoffDate: null }))

  return visibility
}

export function isForecastDateVisible(
  sourceId: number | string,
  forecastDate: string,
  visibility: Map<number | string, ForecastVisibility>
) {
  const source = visibility.get(sourceId)
  if (!source || source.hidden) return false
  return !source.cutoffDate || forecastDate < source.cutoffDate
}
