type Cycle = {
  id: number
  start_date: string
  end_date?: string | null
  last_logged_day?: string | null
  review_state?: string | null
}
type Warning = {
  affectedDates?: string[]
  cycleIds?: number[]
  cycleId?: number
  targetDate?: string
  code?: string
  isOrphaned?: boolean
}
type CycleDay = {
  cycle_id?: number
  date: string
}

export function getPeriodWarningGuidance(warning: Warning) {
  if (warning.code === 'SHORT_CYCLE_GAP')
    return 'Tap either period. Confirm the pair to include both, or exclude the mistaken period to keep it out of calculations.'
  if (warning.code === 'LONG_PERIOD')
    return 'Tap the period. Confirm it to include it, or exclude it to keep it out of calculations.'
  if (warning.code === 'FUTURE_CYCLE')
    return 'Tap the period. Correct its date, remove it, or exclude it from calculations.'
  if (warning.isOrphaned)
    return 'Tap the date to review the logged data. Adjust the cycle to include it, or delete the entry if it is not needed.'
  return 'Tap the highlighted date to review it.'
}

export function shouldShowGapDayActions(tapContext: string | null, hasOvulationCycle: boolean) {
  return tapContext !== 'orphaned' && hasOvulationCycle
}

export function getShortCycleWarningGap(newStartDate: string, cycles: Cycle[], adjustedCycleId?: number) {
  const neighboringCycles = cycles
    .filter(cycle => cycle.id !== adjustedCycleId && cycle.review_state !== 'excluded')
    .slice()
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const preceding = neighboringCycles.filter(cycle => cycle.start_date < newStartDate).at(-1)
  const following = neighboringCycles.find(cycle => cycle.start_date > newStartDate)

  for (const [earlier, later] of [[preceding?.start_date, newStartDate], [newStartDate, following?.start_date]]) {
    if (!earlier || !later) continue
    const gap = Math.round(
      (new Date(`${later}T00:00:00`).getTime() - new Date(`${earlier}T00:00:00`).getTime()) / 86400000
    )
    if (gap > 0 && gap < 21) return gap
  }

  return null
}

export function shouldShowLongCycleGuard(dayCount: number, cycleId: number | null, warnedCycleIds: Set<number>) {
  if (cycleId !== null && dayCount <= 10) warnedCycleIds.delete(cycleId)
  return dayCount > 10 && (cycleId === null || !warnedCycleIds.has(cycleId))
}

export function isValidCycleRange(startDate: string, endDate: string) {
  return startDate <= endDate
}

export function getLoggedDateConflict(
  startDate: string,
  endDate: string,
  cycleDays: CycleDay[],
  allowedCycleId?: number,
) {
  return cycleDays
    .filter(day => day.date >= startDate && day.date <= endDate)
    .filter(day => allowedCycleId === undefined || Number(day.cycle_id) !== allowedCycleId)
    .map(day => day.date)
    .sort()[0] ?? null
}

export function getWarningPulseDates(warning: Warning, cycles: Cycle[]) {
  const dates = new Set<string>()
  const cycleIds = warning.cycleIds ?? (warning.cycleId ? [warning.cycleId] : [])
  const affectedCycles = cycles.filter(cycle =>
    cycleIds.includes(cycle.id) || warning.affectedDates?.includes(cycle.start_date)
  )

  affectedCycles.forEach(cycle => {
    const end = cycle.end_date || cycle.last_logged_day || cycle.start_date
    const current = new Date(`${cycle.start_date}T00:00:00`)
    const last = new Date(`${end}T00:00:00`)
    while (current <= last) {
      dates.add(current.toISOString().slice(0, 10))
      current.setDate(current.getDate() + 1)
    }
  })

  if (!dates.size) (warning.affectedDates ?? [warning.targetDate]).filter(Boolean).forEach(date => dates.add(date!))
  return dates
}
