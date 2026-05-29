const MIN_CYCLE_GAP = 21
const ALPHA = 0.3

function computeCycleParams(db) {
  const cycles = db.prepare(`
    SELECT c.* FROM cycles c
    WHERE c.start_date IS NOT NULL
      AND c.start_date <= date('now')
      AND (c.end_date IS NOT NULL OR EXISTS (SELECT 1 FROM cycle_days cd WHERE cd.cycle_id = c.id))
    ORDER BY c.start_date ASC
  `).all()

  const effective = cycles.filter(c => c.review_state !== 'excluded')

  const lengths = []
  let anchorIdx = 0
  for (let i = 1; i < effective.length; i++) {
    const diff = Math.round(
      (new Date(effective[i].start_date) - new Date(effective[anchorIdx].start_date)) / 86400000
    )
    if (diff >= MIN_CYCLE_GAP || effective[i].review_state === 'confirmed') {
      lengths.push(diff)
      anchorIdx = i
    }
  }

  const avgCycleLength = lengths.length > 0
    ? Math.round(lengths.slice(1).reduce((est, len) => ALPHA * len + (1 - ALPHA) * est, lengths[0]))
    : 28

  const lutealLengths = db.prepare(`
    SELECT
      CAST(julianday(next_c.start_date) - julianday(c.ovulation_date) AS INTEGER) AS luteal_length
    FROM cycles c
    JOIN cycles next_c ON next_c.start_date = (
      SELECT MIN(start_date) FROM cycles WHERE start_date > c.start_date AND review_state IS NOT 'excluded'
    )
    WHERE c.ovulation_date IS NOT NULL
      AND c.start_date <= date('now')
      AND c.review_state IS NOT 'excluded'
    ORDER BY c.start_date ASC
  `).all()
    .map(r => r.luteal_length)
    .filter(l => l >= 7 && l <= 20)

  const avgLutealPhase = lutealLengths.length > 0
    ? Math.round(lutealLengths.slice(1).reduce((est, l) => ALPHA * l + (1 - ALPHA) * est, lutealLengths[0]))
    : 14

  const predictionErrors = db.prepare(`
    SELECT CAST(julianday(start_date) - julianday(predicted_start_date) AS INTEGER) AS error_days
    FROM cycles
    WHERE predicted_start_date IS NOT NULL
      AND start_date IS NOT NULL
      AND start_date <= date('now')
      AND ABS(julianday(start_date) - julianday(predicted_start_date)) <= 14
      AND review_state IS NOT 'excluded'
    ORDER BY start_date ASC
  `).all().map(r => r.error_days)

  const avgPredictionError = predictionErrors.length >= 2
    ? predictionErrors.slice(1).reduce((est, e) => ALPHA * e + (1 - ALPHA) * est, predictionErrors[0])
    : 0

  return { avgCycleLength, avgLutealPhase, avgPredictionError }
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
  const cycles = db.prepare(`
    SELECT c.id, c.start_date
    FROM cycles c
    WHERE c.start_date <= date('now')
      AND c.review_state IS NOT 'excluded'
  `).all()

  if (cycles.length === 0) return

  const { avgCycleLength, avgLutealPhase, avgPredictionError } = computeCycleParams(db)

  const stmt = db.prepare(`
    UPDATE cycles SET
      predicted_fertile_start = ?,
      predicted_fertile_end = ?,
      predicted_ovulation_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  db.transaction(() => {
    for (const cycle of cycles) {
      const p = computePredictionsForCycle(cycle.start_date, avgCycleLength, avgLutealPhase, avgPredictionError)
      stmt.run(p.predicted_fertile_start, p.predicted_fertile_end, p.predicted_ovulation_date, cycle.id)
    }
  })()
}

module.exports = { computeCycleParams, computePredictionsForCycle, recomputeAllPredictions }
