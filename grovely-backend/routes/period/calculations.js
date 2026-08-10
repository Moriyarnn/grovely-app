const express = require('express')
const router = express.Router()
const { logPeriodCalculation } = require('../../logger')
const {
  MAX_PERIOD_LENGTH,
  computeAveragePeriodLength,
  computeCycleParams,
  getCalculationCycleState
} = require('./_calcHelpers')

function getFutureCycles(db) {
  return db.prepare(`
    SELECT * FROM cycles
    WHERE start_date > date('now')
      AND review_state IS NOT 'excluded'
    ORDER BY start_date ASC
  `).all()
}

module.exports = (db) => {

  // GET /api/calculations/summary
  // Returns everything the frontend needs in one call
  router.get('/summary', (req, res) => {
    const today = new Date().toISOString().split('T')[0]
    const dataWarnings = []

    const prefRows = db.prepare('SELECT key, value FROM user_preferences WHERE user_id = ?').all(req.user.id)
    const prefs = prefRows.reduce((acc, r) => { acc[r.key] = r.value; return acc }, {})

    // Detect future cycles (start_date > today), one warning per cycle
    const futureCycles = getFutureCycles(db)
    futureCycles.forEach(c => {
      dataWarnings.push({
        code: 'FUTURE_CYCLE',
        message: `The period starting on ${c.start_date} is in the future, so it is excluded from calculations. Correct its date, remove it, or exclude it to dismiss this warning.`,
        targetDate: c.start_date,
        affectedDates: [c.start_date],
        cycleId: c.id,
        reviewState: null
      })
    })

    const cycleState = getCalculationCycleState(db)
    const {
      cycles: allCycles,
      eligibleCycles,
      cycleLengths,
      shortPairs,
      unresolvedCycleIds,
      unresolvedLongCycles
    } = cycleState
    const completedCycles = allCycles.filter(cycle => cycle.effective_end < today)

    // Warn about impossibly short gaps
    shortPairs.forEach(({ earlier, later, gap }) => {
      dataWarnings.push({
        code: 'SHORT_CYCLE_GAP',
        message: `The periods starting on ${earlier.start_date} and ${later.start_date} begin only ${gap} ${gap === 1 ? 'day' : 'days'} apart (minimum expected cycle length is 21 days). Both periods are excluded from calculations until you review them.`,
        targetDate: earlier.start_date,
        affectedDates: [earlier.start_date, later.start_date],
        cycleId: later.id,
        cycleIds: [earlier.id, later.id],
        confirmationCycleId: later.id,
        reviewState: null
      })
    })

    unresolvedLongCycles.forEach(c => {
      dataWarnings.push({
        code: 'LONG_PERIOD',
        message: `The period starting on ${c.start_date} spans ${c.period_length} ${c.period_length === 1 ? 'day' : 'days'}. A period longer than ${MAX_PERIOD_LENGTH} days may be a data entry mistake. It is excluded from calculations until you review it.`,
        targetDate: c.start_date,
        affectedDates: [c.start_date, c.end_date].filter(Boolean),
        cycleId: c.id,
        reviewState: null
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

    const validPeriodCycles = completedCycles.filter(cycle =>
      cycle.review_state !== 'excluded' && !unresolvedCycleIds.has(cycle.id)
    )

    // Average period length (start to end), using only valid entries
    const avgPeriodLength = computeAveragePeriodLength(validPeriodCycles)

    const lastCycle = eligibleCycles[eligibleCycles.length - 1] ?? null
    const { avgLutealPhase, avgPredictionError } = computeCycleParams(db, cycleState)

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
      const sorted = eligibleCycles

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
      const loggedRanges = eligibleCycles
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
    const yesterdayDate = new Date(today + 'T00:00:00')
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = yesterdayDate.toISOString().split('T')[0]
    const currentCycle = eligibleCycles
      .slice()
      .reverse()
      .find(cycle => cycle.start_date <= today && cycle.end_date && cycle.end_date >= yesterday) ?? null

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

module.exports.getFutureCycles = getFutureCycles
