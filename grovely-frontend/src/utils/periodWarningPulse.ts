type Cycle = { id: number; start_date: string; end_date?: string | null; last_logged_day?: string | null }
type Warning = { affectedDates?: string[]; cycleIds?: number[]; cycleId?: number; targetDate?: string }

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
