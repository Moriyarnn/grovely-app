const MAX_PERIOD_LENGTH = 10
const ALPHA = 0.3
const {
  getConfirmedShortCycleForecastSuppressionIds,
  getUnresolvedShortCycleIds,
  getUnresolvedShortCyclePairs
} = require('./_shortCyclePairs')

function getCalculationCycleState(db) {
  const cycles = db.prepare(`
    SELECT c.*,
      COALESCE(c.end_date, MAX(cd.date)) AS effective_end,
      CAST(julianday(COALESCE(c.end_date, MAX(cd.date))) - julianday(c.start_date) + 1 AS INTEGER) AS period_length
    FROM cycles c
    LEFT JOIN cycle_days cd ON cd.cycle_id = c.id
    WHERE c.start_date IS NOT NULL
      AND c.start_date <= date('now')
    GROUP BY c.id
    HAVING effective_end IS NOT NULL
    ORDER BY c.start_date ASC
  `).all()

  const includedCycles = cycles.filter(cycle => cycle.review_state !== 'excluded')
  const shortPairs = getUnresolvedShortCyclePairs(includedCycles)
  const unresolvedCycleIds = getUnresolvedShortCycleIds(includedCycles)
  const today = new Date().toISOString().split('T')[0]
  const unresolvedLongCycles = includedCycles.filter(cycle =>
    cycle.effective_end < today &&
    cycle.period_length > MAX_PERIOD_LENGTH &&
    cycle.review_state !== 'confirmed'
  )
  unresolvedLongCycles.forEach(cycle => unresolvedCycleIds.add(cycle.id))

  const eligibleCycles = includedCycles.filter(cycle => !unresolvedCycleIds.has(cycle.id))
  const cycleLengths = eligibleCycles.slice(1).map((cycle, index) =>
    Math.round((new Date(cycle.start_date) - new Date(eligibleCycles[index].start_date)) / 86400000)
  )

  return {
    cycles,
    includedCycles,
    eligibleCycles,
    cycleLengths,
    shortPairs,
    unresolvedCycleIds,
    unresolvedLongCycles
  }
}

function computeCycleParams(db, cycleState = getCalculationCycleState(db)) {
  const { eligibleCycles, cycleLengths } = cycleState

  const avgCycleLength = cycleLengths.length > 0
    ? Math.round(cycleLengths.slice(1).reduce((est, len) => ALPHA * len + (1 - ALPHA) * est, cycleLengths[0]))
    : 28

  const lutealLengths = eligibleCycles.slice(0, -1)
    .map((cycle, index) => cycle.ovulation_date
      ? Math.round((new Date(eligibleCycles[index + 1].start_date) - new Date(cycle.ovulation_date)) / 86400000)
      : null)
    .filter(length => length !== null && length >= 7 && length <= 20)

  const avgLutealPhase = lutealLengths.length > 0
    ? Math.round(lutealLengths.slice(1).reduce((est, l) => ALPHA * l + (1 - ALPHA) * est, lutealLengths[0]))
    : 14

  const predictionErrors = eligibleCycles
    .filter(cycle => cycle.predicted_start_date)
    .map(cycle => Math.round((new Date(cycle.start_date) - new Date(cycle.predicted_start_date)) / 86400000))
    .filter(error => Math.abs(error) <= 14)

  const avgPredictionError = predictionErrors.length >= 2
    ? predictionErrors.slice(1).reduce((est, e) => ALPHA * e + (1 - ALPHA) * est, predictionErrors[0])
    : 0

  return { avgCycleLength, avgLutealPhase, avgPredictionError }
}

function computeAveragePeriodLength(cycles) {
  return cycles.length > 0
    ? Math.round(cycles.reduce((sum, cycle) => sum + cycle.period_length, 0) / cycles.length)
    : 5
}

function computePredictionsForCycle(startDate, avgCycleLength, avgLutealPhase, avgPredictionError = 0) {
  const nextPeriod = new Date(startDate + 'T00:00:00')
  nextPeriod.setDate(nextPeriod.getDate() + avgCycleLength + Math.round(avgPredictionError))

  const ovulation = new Date(nextPeriod)
  ovulation.setDate(ovulation.getDate() - avgLutealPhase)

  const fertileStart = new Date(ovulation)
  fertileStart.setDate(fertileStart.getDate() - 5)
  const fertileEnd = new Date(ovulation)
  fertileEnd.setDate(fertileEnd.getDate() + 1)

  return {
    predicted_fertile_start: fertileStart.toISOString().split('T')[0],
    predicted_fertile_end:   fertileEnd.toISOString().split('T')[0],
    predicted_ovulation_date: ovulation.toISOString().split('T')[0]
  }
}

// Recomputes and stores predictions for all past cycles.
// Called at startup and after any mutation that could change avgCycleLength or avgLutealPhase.
function recomputeAllPredictions(db) {
  const cycleState = getCalculationCycleState(db)
  const { eligibleCycles } = cycleState
  const { avgCycleLength, avgLutealPhase, avgPredictionError } = computeCycleParams(db, cycleState)
  const suppressedForecastIds = getConfirmedShortCycleForecastSuppressionIds(eligibleCycles)

  const stmt = db.prepare(`
    UPDATE cycles SET
      predicted_fertile_start = ?,
      predicted_fertile_end = ?,
      predicted_ovulation_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  const clearStmt = db.prepare(`
    UPDATE cycles SET
      predicted_fertile_start = NULL,
      predicted_fertile_end = NULL,
      predicted_ovulation_date = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND (predicted_fertile_start IS NOT NULL
        OR predicted_fertile_end IS NOT NULL
        OR predicted_ovulation_date IS NOT NULL)
  `)

  db.transaction(() => {
    const eligibleIds = new Set(eligibleCycles.map(cycle => cycle.id))
    for (const cycle of db.prepare('SELECT id FROM cycles').all()) {
      if (!eligibleIds.has(cycle.id) || suppressedForecastIds.has(cycle.id)) clearStmt.run(cycle.id)
    }
    for (const cycle of eligibleCycles) {
      if (suppressedForecastIds.has(cycle.id)) continue
      const p = computePredictionsForCycle(cycle.start_date, avgCycleLength, avgLutealPhase, avgPredictionError)
      stmt.run(p.predicted_fertile_start, p.predicted_fertile_end, p.predicted_ovulation_date, cycle.id)
    }
  })()
}

// Returns the upcoming fertile window + ovulation for the most recent cycle, mirroring
// the calendar/PeriodDetail logic so the email never disagrees with the UI:
//   1. the stored window on lastCycle, while it hasn't fully passed (end >= today)
//   2. otherwise advance through successive predicted cycles (the missed-prediction /
//      nextFertileWindow chain) until a window whose end is today or later
// `today` is a 'YYYY-MM-DD' string; ISO dates compare correctly as strings.
function upcomingFertileWindow(db, lastCycle, today) {
  if (!lastCycle) return { fertileWindow: null, ovulationDate: null }

  // 1. Stored window on the most recent cycle — same value the calendar paints
  if (lastCycle.predicted_fertile_start && lastCycle.predicted_fertile_end
      && lastCycle.predicted_fertile_end >= today) {
    return {
      fertileWindow: { start: lastCycle.predicted_fertile_start, end: lastCycle.predicted_fertile_end },
      ovulationDate: lastCycle.ovulation_date ?? lastCycle.predicted_ovulation_date ?? null
    }
  }

  // 2. Stored window has passed un-logged — advance to the next predicted window
  const { avgCycleLength, avgLutealPhase, avgPredictionError } = computeCycleParams(db)
  const step = avgCycleLength + Math.round(avgPredictionError)
  if (step <= 0) return { fertileWindow: null, ovulationDate: null } // guard against runaway loop

  let anchor = lastCycle.start_date
  for (let i = 0; i < 24; i++) {
    const p = computePredictionsForCycle(anchor, avgCycleLength, avgLutealPhase, avgPredictionError)
    if (p.predicted_fertile_end >= today) {
      return {
        fertileWindow: { start: p.predicted_fertile_start, end: p.predicted_fertile_end },
        ovulationDate: p.predicted_ovulation_date
      }
    }
    const next = new Date(anchor + 'T00:00:00')
    next.setDate(next.getDate() + step)
    anchor = next.toISOString().split('T')[0]
  }
  return { fertileWindow: null, ovulationDate: null }
}

module.exports = {
  MAX_PERIOD_LENGTH,
  getCalculationCycleState,
  computeAveragePeriodLength,
  computeCycleParams,
  computePredictionsForCycle,
  recomputeAllPredictions,
  upcomingFertileWindow
}
