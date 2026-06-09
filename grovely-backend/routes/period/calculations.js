const express = require('express')
const router = express.Router()
const { logPeriodCalculation } = require('../../logger')

module.exports = (db) => {

  const MIN_CYCLE_GAP = 21 // days — gaps shorter than this are biologically unlikely (minimum normal cycle)

  // Helper: get all completed cycles (past only, start_date <= today)
  // Uses last logged cycle_day as effective end when end_date is not set
  const getCompletedCycles = () => {
    return db.prepare(`
      SELECT c.*,
        CAST(julianday(COALESCE(c.end_date, MAX(cd.date))) - julianday(c.start_date) + 1 AS INTEGER) as period_length
      FROM cycles c
      LEFT JOIN cycle_days cd ON cd.cycle_id = c.id
      WHERE c.start_date IS NOT NULL
        AND c.start_date <= date('now')
        AND c.review_state IS NOT 'excluded'
      GROUP BY c.id
      HAVING COALESCE(c.end_date, MAX(cd.date)) IS NOT NULL
        AND COALESCE(c.end_date, MAX(cd.date)) < date('now')
      ORDER BY c.start_date ASC
    `).all()
  }

  // Helper: get cycle lengths (start to start) — past cycles only, skips short gaps
  // Returns { lengths, skippedGaps } where skippedGaps holds warning details
  const getCycleLengths = () => {
    const cycles = db.prepare(`
      SELECT c.* FROM cycles c
      WHERE c.start_date IS NOT NULL
        AND c.start_date <= date('now')
        AND (c.end_date IS NOT NULL OR EXISTS (SELECT 1 FROM cycle_days cd WHERE cd.cycle_id = c.id))
      ORDER BY c.start_date ASC
    `).all()

    // Drop explicitly excluded cycles before gap analysis
    const effective = cycles.filter(c => c.review_state !== 'excluded')

    const lengths = []
    const skippedGaps = []
    let anchorIdx = 0

    for (let i = 1; i < effective.length; i++) {
      const diff = Math.round(
        (new Date(effective[i].start_date) - new Date(effective[anchorIdx].start_date))
        / (1000 * 60 * 60 * 24)
      )
      if (diff >= MIN_CYCLE_GAP || effective[i].review_state === 'confirmed') {
        lengths.push(diff)
        anchorIdx = i
      } else {
        // Flagged cycle: skip it as an anchor point, bridge over it from the current anchor
        skippedGaps.push({
          from: effective[anchorIdx].start_date,
          to: effective[i].start_date,
          gap: diff,
          cycleId: effective[i].id,
          reviewState: effective[i].review_state
        })
      }
    }
    return { lengths, skippedGaps }
  }

  // GET /api/calculations/summary
  // Returns everything the frontend needs in one call
  router.get('/summary', (req, res) => {
    const today = new Date().toISOString().split('T')[0]
    const dataWarnings = []

    const prefRows = db.prepare('SELECT key, value FROM user_preferences WHERE user_id = ?').all(req.user.id)
    const prefs = prefRows.reduce((acc, r) => { acc[r.key] = r.value; return acc }, {})

    // Detect future cycles (start_date > today), one warning per cycle
    const futureCycles = db.prepare(`
      SELECT * FROM cycles WHERE start_date > date('now') ORDER BY start_date ASC
    `).all()
    futureCycles.forEach(c => {
      dataWarnings.push({
        code: 'FUTURE_CYCLE',
        message: `Cycle starting on ${c.start_date} is in the future, so it was excluded from predictions. Remove it or correct the date.`,
        targetDate: c.start_date,
        affectedDates: [c.start_date]
      })
    })

    const completedCycles = getCompletedCycles()
    const { lengths: cycleLengths, skippedGaps } = getCycleLengths()

    // Warn about impossibly short gaps
    skippedGaps.forEach(({ from, to, gap, cycleId, reviewState }) => {
      dataWarnings.push({
        code: 'SHORT_CYCLE_GAP',
        message: `Cycles on ${from} and ${to} are only ${gap} day(s) apart (minimum expected is 21). This looks like a data entry mistake, so the gap was excluded from predictions.`,
        targetDate: to,
        affectedDates: [from, to],
        cycleId,
        reviewState: reviewState ?? null
      })
    })

    // Average cycle length (start to start) — exponential smoothing (α=0.3)
    // Recent cycles get more weight: est = α * latest + (1-α) * past_estimate
    // With 1 cycle it equals that cycle; with more cycles it adapts toward recent data
    const ALPHA = 0.3
    const seedValue = prefs.period_cycle_seed ? parseInt(prefs.period_cycle_seed) : null
    const useSeed = seedValue && seedValue >= 15 && seedValue <= 60 && cycleLengths.length < 3
    const avgCycleLength = useSeed
      ? seedValue
      : cycleLengths.length > 0
        ? Math.round(
            cycleLengths.slice(1).reduce(
              (est, len) => ALPHA * len + (1 - ALPHA) * est,
              cycleLengths[0]
            )
          )
        : 28 // default assumption

    // Cycle variability — standard deviation of cycle lengths
    const cycleStdDev = cycleLengths.length >= 2
      ? Math.round(Math.sqrt(
          cycleLengths.reduce((sum, l) => sum + Math.pow(l - avgCycleLength, 2), 0) / cycleLengths.length
        ))
      : null

    // Irregular cycles: user-flagged setting or std dev > 7 days
    const irregularSetting = prefs.period_irregular === '1'
    const isIrregular = irregularSetting || (cycleStdDev !== null && cycleStdDev > 7)

    // Confidence window: ±stdDev days (min ±2); widened to ±7 when user flagged irregular
    const confidenceWindow = irregularSetting
      ? 7
      : (cycleStdDev !== null && cycleLengths.length >= 3 ? Math.max(2, cycleStdDev) : null)

    const MAX_PERIOD_LENGTH = 10 // days — longer than this is medically unusual

    // Warn about and exclude abnormally long period entries
    const validPeriodCycles = []
    completedCycles.forEach(c => {
      if (c.review_state === 'excluded') return
      if (c.period_length > MAX_PERIOD_LENGTH && c.review_state !== 'confirmed') {
        dataWarnings.push({
          code: 'LONG_PERIOD',
          message: `The entry starting on ${c.start_date} spans ${c.period_length} day(s). A period longer than ${MAX_PERIOD_LENGTH} days looks like a data entry mistake (e.g. the end date was set to the end of the cycle instead of the end of the bleeding). It was excluded from the period length average.`,
          targetDate: c.start_date,
          affectedDates: [c.start_date, c.end_date].filter(Boolean),
          cycleId: c.id,
          reviewState: c.review_state ?? null
        })
        return // both null and 'excluded' states are kept out of the avg
      }
      validPeriodCycles.push(c)
    })

    // Average period length (start to end), using only valid entries
    const avgPeriodLength = validPeriodCycles.length > 0
      ? Math.round(validPeriodCycles.reduce((a, b) => a + b.period_length, 0) / validPeriodCycles.length)
      : 5 // default assumption

    // Last cycle — past only, exclude orphaned cycles (no days, no explicit end_date)
    const allCycles = db.prepare(`
      SELECT c.* FROM cycles c
      WHERE c.start_date <= date('now')
        AND (c.end_date IS NOT NULL
         OR EXISTS (SELECT 1 FROM cycle_days cd WHERE cd.cycle_id = c.id))
      ORDER BY c.start_date DESC
    `).all()
    const skippedCycleIds = new Set(skippedGaps.map(g => g.cycleId))
    const lastCycle = allCycles.find(c =>
      c.review_state !== 'excluded' && !skippedCycleIds.has(c.id)
    ) || null

    // Personalised luteal phase — days between ovulation_date and the next cycle's start
    // Falls back to the clinical default of 14 if no ovulation days have been marked
    const ovulationRows = db.prepare(`
      SELECT
        c.ovulation_date,
        CAST(julianday(next_c.start_date) - julianday(c.ovulation_date) AS INTEGER) AS luteal_length
      FROM cycles c
      JOIN cycles next_c ON next_c.start_date = (
        SELECT MIN(start_date) FROM cycles WHERE start_date > c.start_date AND review_state IS NOT 'excluded'
      )
      WHERE c.ovulation_date IS NOT NULL
        AND c.start_date <= date('now')
        AND c.review_state IS NOT 'excluded'
      ORDER BY c.start_date ASC
    `).all().filter(r => r.luteal_length >= 7 && r.luteal_length <= 20)

    const lutealLengths = ovulationRows.map(r => r.luteal_length)
    const avgLutealPhase = lutealLengths.length > 0
      ? Math.round(
          lutealLengths.slice(1).reduce(
            (est, l) => ALPHA * l + (1 - ALPHA) * est,
            lutealLengths[0]
          )
        )
      : 14 // clinical default

    // Prediction accuracy correction — compare stored predictions to actual start dates
    // Only use pairs that are within 14 days of each other to filter out historical backdated entries
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
      ? predictionErrors.slice(1).reduce(
          (est, e) => ALPHA * e + (1 - ALPHA) * est,
          predictionErrors[0]
        )
      : 0

    // Next period prediction — always a future date.
    // Also collect missed predictions: predicted dates that passed without a logged cycle.
    let nextPeriodDate = null
    const missedPredictions = []
    if (lastCycle) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const errorAdj = Math.round(avgPredictionError)

      const pushMissed = (predDate) => {
        const startStr = predDate.toISOString().split('T')[0]
        const ov = new Date(predDate)
        ov.setDate(ov.getDate() + avgCycleLength + errorAdj - avgLutealPhase)
        const fStart = new Date(ov)
        fStart.setDate(fStart.getDate() - 5)
        const fEnd = new Date(ov)
        fEnd.setDate(fEnd.getDate() + 1)
        missedPredictions.push({
          startDate: startStr,
          fertileWindow: { start: fStart.toISOString().split('T')[0], end: fEnd.toISOString().split('T')[0] },
          ovulationDate: ov.toISOString().split('T')[0]
        })
      }

      // Between consecutive logged cycles: detect gaps wide enough for a missed prediction
      const sorted = allCycles
        .filter(c => c.review_state !== 'excluded' && !skippedCycleIds.has(c.id))
        .sort((a, b) => a.start_date.localeCompare(b.start_date))

      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = Math.round(
          (new Date(sorted[i + 1].start_date) - new Date(sorted[i].start_date)) / 86400000
        )
        if (gap >= avgCycleLength * 1.5) {
          const pred = new Date(sorted[i].start_date + 'T00:00:00')
          pred.setDate(pred.getDate() + avgCycleLength + errorAdj)
          const nextStart = new Date(sorted[i + 1].start_date + 'T00:00:00')
          while (pred < nextStart) {
            pushMissed(new Date(pred))
            pred.setDate(pred.getDate() + avgCycleLength + errorAdj)
          }
        }
      }

      // After the last cycle: predictions that passed without being logged.
      // A prediction whose start date is today or earlier without a corresponding
      // logged cycle becomes a missed prediction, and the chain advances.
      const predicted = new Date(lastCycle.start_date + 'T00:00:00')
      predicted.setDate(predicted.getDate() + avgCycleLength + errorAdj)
      while (predicted <= today) {
        pushMissed(new Date(predicted))
        predicted.setDate(predicted.getDate() + avgCycleLength + errorAdj)
      }
      nextPeriodDate = predicted.toISOString().split('T')[0]

      // Drop missed predictions that overlap with an actually logged cycle.
      // When the user logs a period on a predicted date, the prediction is no longer "missed".
      const loggedRanges = allCycles.filter(c => c.review_state !== 'excluded')
      for (let i = missedPredictions.length - 1; i >= 0; i--) {
        const pDate = missedPredictions[i].startDate
        if (loggedRanges.some(c => c.start_date <= pDate && (c.end_date ?? c.start_date) >= pDate)) {
          missedPredictions.splice(i, 1)
        }
      }
    }

    // Fertile window and ovulation — read from stored predictions on the most recent cycle
    // (same source as the calendar) to guarantee both surfaces always agree
    const fertileWindow = lastCycle?.predicted_fertile_start
      ? { start: lastCycle.predicted_fertile_start, end: lastCycle.predicted_fertile_end }
      : null
    const ovulationDate = lastCycle?.ovulation_date ?? lastCycle?.predicted_ovulation_date ?? null

    // Next fertile window and ovulation — always future, always bound to nextPeriodDate.
    // Gated at 3 cycles normally; seed lowers the threshold to 1 logged cycle
    const minCyclesRequired = useSeed ? 1 : 3
    const predictionsReady = useSeed ? lastCycle !== null : cycleLengths.length >= 2
    let nextFertileWindow = null
    let nextOvulationDate = null
    if (predictionsReady && nextPeriodDate) {
      // Fertile window belongs to the cycle that STARTS on nextPeriodDate,
      // mirroring how each logged cycle on the calendar has its fertile window after it
      const cycleStart = new Date(nextPeriodDate + 'T00:00:00')
      const ov = new Date(cycleStart)
      ov.setDate(ov.getDate() + avgCycleLength + Math.round(avgPredictionError) - avgLutealPhase)
      const fStart = new Date(ov)
      fStart.setDate(fStart.getDate() - 5)
      const fEnd = new Date(ov)
      fEnd.setDate(fEnd.getDate() + 1)
      nextFertileWindow = { start: fStart.toISOString().split('T')[0], end: fEnd.toISOString().split('T')[0] }
      nextOvulationDate = ov.toISOString().split('T')[0]
    } else {
      nextPeriodDate = null
    }

    // Is she currently on her period?
    // A cycle is active if end_date is today or yesterday (end_date is always kept at MAX logged day via #36)
    const currentCycle = db.prepare(`
      SELECT c.*
      FROM cycles c
      WHERE c.start_date <= ?
        AND c.end_date >= date('now', '-1 day')
        AND c.review_state IS NOT 'excluded'
      ORDER BY c.start_date DESC
      LIMIT 1
    `).get(today)

    logPeriodCalculation(db, {
      source: 'api',
      avg_cycle_length: avgCycleLength,
      avg_period_length: avgPeriodLength,
      next_period_date: nextPeriodDate,
      ovulation_date: ovulationDate,
      fertile_window_start: fertileWindow?.start ?? null,
      fertile_window_end: fertileWindow?.end ?? null,
      is_irregular: isIrregular,
      cycle_std_dev: cycleStdDev,
      data_warnings_count: dataWarnings.length,
      total_cycles_tracked: allCycles.length
    })

    res.json({
      avgCycleLength,
      avgLutealPhase,
      avgPeriodLength,
      nextPeriodDate,
      missedPredictions,
      nextFertileWindow,
      nextOvulationDate,
      ovulationDate,
      fertileWindow,
      confidenceWindow,
      confidence: isIrregular ? 'low' : (confidenceWindow ? 'high' : null),
      isIrregular,
      currentCycle: currentCycle || null,
      totalCyclesTracked: allCycles.length,
      dataWarnings,
      minCyclesRequired,
      note: !predictionsReady
        ? `Track ${minCyclesRequired} cycle${minCyclesRequired === 1 ? '' : 's'} to unlock period and fertile window predictions`
        : null
    })
  })

  return router
}