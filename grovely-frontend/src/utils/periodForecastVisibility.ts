export type CycleForecastSource = {
  id: number | string
  start_date: string
  end_date?: string | null
  last_logged_day?: string | null
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

export function unresolvedWarningCycleIds(warnings: PredictionDataWarning[]) {
  return new Set(
    warnings
      .filter(warning => !warning.reviewState && warning.code !== 'MISSING_PERIOD_GAP')
      .flatMap(warning => warning.cycleIds ?? [warning.cycleId])
      .filter((id): id is number | string => id !== undefined && id !== null)
  )
}

// A forecast stops when the next eligible period begins. Explicitly excluded and
// unresolved warning periods remain visible as history but do not affect forecasts.
export function getForecastVisibility(
  cycles: CycleForecastSource[],
  warnings: PredictionDataWarning[] = []
) {
  const unresolvedIds = unresolvedWarningCycleIds(warnings)
  const includedCycles = cycles
    .filter(cycle => cycle.review_state !== 'excluded' && !unresolvedIds.has(cycle.id))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const visibility = new Map<number | string, ForecastVisibility>()

  includedCycles.forEach((cycle, index) => {
    visibility.set(cycle.id, {
      hidden: false,
      cutoffDate: includedCycles[index + 1]?.start_date ?? null,
    })
  })

  cycles
    .filter(cycle => cycle.review_state === 'excluded' || unresolvedIds.has(cycle.id))
    .forEach(cycle => visibility.set(cycle.id, { hidden: true, cutoffDate: null }))

  return visibility
}

export function getLatestEligibleCycle<T extends CycleForecastSource>(
  cycles: T[],
  warnings: PredictionDataWarning[] = [],
  preferredId?: number | string | null
) {
  const visibility = getForecastVisibility(cycles, warnings)
  const eligible = cycles.filter(cycle => !visibility.get(cycle.id)?.hidden)
  if (preferredId !== undefined && preferredId !== null) {
    const preferred = eligible.find(cycle => cycle.id === preferredId)
    if (preferred) return preferred
  }
  return eligible.sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null
}

export function isMissedPeriodVisible(
  startDate: string,
  periodLength: number,
  cycles: CycleForecastSource[]
) {
  const predictedEnd = new Date(startDate + 'T00:00:00')
  predictedEnd.setDate(predictedEnd.getDate() + Math.max(1, periodLength) - 1)
  const predictedEndDate = predictedEnd.toISOString().slice(0, 10)

  return !cycles.some(cycle => {
    if (cycle.review_state === 'excluded') return false
    const loggedEnd = cycle.end_date ?? cycle.last_logged_day
    if (!loggedEnd) return false
    return cycle.start_date <= predictedEndDate && loggedEnd >= startDate
  })
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
