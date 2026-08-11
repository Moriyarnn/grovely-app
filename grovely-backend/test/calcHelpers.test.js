const test = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')

const {
  computeAveragePeriodLength,
  computeCycleParams,
  computePredictionsForCycle,
  getCalculationCycleState,
  recomputeAllPredictions
} = require('../routes/period/_calcHelpers')
const { getFutureCycles, getMissingPeriodWarnings } = require('../routes/period/calculations')
const { __test: notificationTestHelpers } = require('../notifications')

function createPeriodDatabase() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE cycles (
      id INTEGER PRIMARY KEY,
      start_date TEXT NOT NULL,
      end_date TEXT,
      predicted_start_date TEXT,
      ovulation_date TEXT,
      predicted_fertile_start TEXT,
      predicted_fertile_end TEXT,
      predicted_ovulation_date TEXT,
      review_state TEXT,
      updated_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cycle_days (
      id INTEGER PRIMARY KEY,
      cycle_id INTEGER NOT NULL,
      date TEXT NOT NULL
    );
    CREATE TABLE notification_log (
      id INTEGER PRIMARY KEY,
      type_id TEXT NOT NULL,
      date_key TEXT NOT NULL,
      UNIQUE(type_id, date_key)
    );
    CREATE TABLE cycle_gap_reviews (
      earlier_cycle_id INTEGER NOT NULL,
      later_cycle_id INTEGER NOT NULL,
      gap_days INTEGER NOT NULL,
      review_state TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (earlier_cycle_id, later_cycle_id)
    );
  `)
  return db
}

function insertCycle(db, cycle) {
  db.prepare(`
    INSERT INTO cycles (id, start_date, end_date, predicted_start_date, review_state, created_at)
    VALUES (@id, @start_date, @end_date, @predicted_start_date, @review_state, @created_at)
  `).run({ predicted_start_date: null, review_state: null, created_at: `${cycle.start_date} 12:00:00`, ...cycle })
}

test('period predictions use cycle and luteal lengths', () => {
  assert.deepEqual(computePredictionsForCycle('2026-01-01', 28, 14), {
    predicted_fertile_start: '2026-01-10',
    predicted_fertile_end: '2026-01-16',
    predicted_ovulation_date: '2026-01-15',
  })
})

test('period predictions incorporate rounded prediction error', () => {
  assert.deepEqual(computePredictionsForCycle('2026-01-01', 28, 14, 1.6), {
    predicted_fertile_start: '2026-01-12',
    predicted_fertile_end: '2026-01-18',
    predicted_ovulation_date: '2026-01-17',
  })
})

test('unresolved warning cycles are quarantined until confirmed or excluded', () => {
  const db = createPeriodDatabase()
  const cycles = [
    { id: 1, start_date: '2026-01-01', end_date: '2026-01-05' },
    { id: 2, start_date: '2026-02-01', end_date: '2026-02-05' },
    { id: 3, start_date: '2026-03-01', end_date: '2026-03-05' },
    { id: 4, start_date: '2026-03-15', end_date: '2026-03-16' },
    { id: 5, start_date: '2026-04-15', end_date: '2026-04-19' },
    { id: 6, start_date: '2026-05-20', end_date: '2026-05-31' },
  ]
  cycles.forEach(cycle => insertCycle(db, cycle))

  let state = getCalculationCycleState(db)
  assert.deepEqual(state.shortPairs.map(pair => [pair.earlier.id, pair.later.id]), [[3, 4]])
  assert.deepEqual([...state.unresolvedCycleIds], [3, 4, 6])
  assert.deepEqual(state.eligibleCycles.map(cycle => cycle.id), [1, 2, 5])
  assert.deepEqual(state.cycleLengths, [31])
  assert.equal(computeCycleParams(db, state).avgCycleLength, 31)
  assert.equal(computeAveragePeriodLength(state.eligibleCycles), 5)

  db.prepare("UPDATE cycles SET review_state = 'confirmed' WHERE id = 4").run()
  state = getCalculationCycleState(db)
  assert.deepEqual(state.eligibleCycles.map(cycle => cycle.id), [1, 2, 3, 4, 5])
  assert.equal(computeAveragePeriodLength(state.eligibleCycles), 4)

  db.prepare("UPDATE cycles SET review_state = 'excluded' WHERE id = 4").run()
  state = getCalculationCycleState(db)
  assert.deepEqual(state.shortPairs, [])
  assert.deepEqual(state.eligibleCycles.map(cycle => cycle.id), [1, 2, 3, 5])

  db.prepare("UPDATE cycles SET review_state = 'confirmed' WHERE id = 6").run()
  state = getCalculationCycleState(db)
  assert.deepEqual(state.unresolvedLongCycles, [])
  assert.deepEqual(state.eligibleCycles.map(cycle => cycle.id), [1, 2, 3, 5, 6])

  db.prepare("UPDATE cycles SET review_state = 'excluded' WHERE id = 6").run()
  state = getCalculationCycleState(db)
  assert.deepEqual(state.unresolvedLongCycles, [])
  assert.deepEqual(state.eligibleCycles.map(cycle => cycle.id), [1, 2, 3, 5])

  db.close()
})

test('stored forecasts are cleared from every unresolved warning cycle', () => {
  const db = createPeriodDatabase()
  ;[
    { id: 1, start_date: '2026-01-01', end_date: '2026-01-05' },
    { id: 2, start_date: '2026-02-01', end_date: '2026-02-05' },
    { id: 3, start_date: '2026-02-15', end_date: '2026-02-16' },
  ].forEach(cycle => insertCycle(db, cycle))
  db.prepare(`
    UPDATE cycles SET
      predicted_fertile_start = '2026-01-10',
      predicted_fertile_end = '2026-01-16',
      predicted_ovulation_date = '2026-01-15'
  `).run()

  recomputeAllPredictions(db)

  const rows = db.prepare(`
    SELECT id, predicted_fertile_start FROM cycles ORDER BY id
  `).all()
  assert.notEqual(rows[0].predicted_fertile_start, null)
  assert.equal(rows[1].predicted_fertile_start, null)
  assert.equal(rows[2].predicted_fertile_start, null)

  db.close()
})

test('a confirmed short pair keeps both cycles eligible but only the later fertility forecast', () => {
  const db = createPeriodDatabase()
  ;[
    { id: 1, start_date: '2026-01-01', end_date: '2026-01-05' },
    { id: 2, start_date: '2026-02-01', end_date: '2026-02-05' },
    { id: 3, start_date: '2026-02-15', end_date: '2026-02-18', review_state: 'confirmed' },
    { id: 4, start_date: '2026-03-20', end_date: '2026-03-24' },
  ].forEach(cycle => insertCycle(db, cycle))
  db.prepare("UPDATE cycles SET ovulation_date = '2026-02-08' WHERE id = 2").run()

  assert.deepEqual(getCalculationCycleState(db).eligibleCycles.map(cycle => cycle.id), [1, 2, 3, 4])

  recomputeAllPredictions(db)
  const earlier = db.prepare(`
    SELECT ovulation_date, predicted_fertile_start, predicted_fertile_end, predicted_ovulation_date
    FROM cycles WHERE id = 2
  `).get()
  const later = db.prepare(`
    SELECT predicted_fertile_start, predicted_fertile_end, predicted_ovulation_date
    FROM cycles WHERE id = 3
  `).get()

  assert.equal(earlier.ovulation_date, '2026-02-08')
  assert.equal(earlier.predicted_fertile_start, null)
  assert.equal(earlier.predicted_fertile_end, null)
  assert.equal(earlier.predicted_ovulation_date, null)
  assert.notEqual(later.predicted_fertile_start, null)
  assert.notEqual(later.predicted_fertile_end, null)
  assert.notEqual(later.predicted_ovulation_date, null)

  db.close()
})

test('an arbitrarily excluded normal cycle is removed from calculations and stored forecasts', () => {
  const db = createPeriodDatabase()
  ;[
    { id: 1, start_date: '2026-01-01', end_date: '2026-01-05' },
    { id: 2, start_date: '2026-02-01', end_date: '2026-02-03', review_state: 'excluded' },
    { id: 3, start_date: '2026-03-01', end_date: '2026-03-05' },
  ].forEach(cycle => insertCycle(db, cycle))
  db.prepare(`
    UPDATE cycles SET
      predicted_fertile_start = '2026-01-10',
      predicted_fertile_end = '2026-01-16',
      predicted_ovulation_date = '2026-01-15'
  `).run()

  const state = getCalculationCycleState(db)
  assert.deepEqual(state.eligibleCycles.map(cycle => cycle.id), [1, 3])
  assert.deepEqual(state.cycleLengths, [])
  assert.equal(computeCycleParams(db, state).avgCycleLength, 28)

  recomputeAllPredictions(db)
  const excluded = db.prepare('SELECT predicted_fertile_start FROM cycles WHERE id = 2').get()
  assert.equal(excluded.predicted_fertile_start, null)

  db.close()
})

test('an explicitly excluded future cycle is omitted from prediction health warnings', () => {
  const db = createPeriodDatabase()
  insertCycle(db, { id: 1, start_date: '2999-01-01', end_date: '2999-01-03' })
  insertCycle(db, { id: 2, start_date: '2999-02-01', end_date: '2999-02-03', review_state: 'excluded' })

  assert.deepEqual(getFutureCycles(db).map(cycle => cycle.id), [1])

  db.close()
})

test('a possible missing period excludes only its interval until the pair is reviewed', () => {
  const db = createPeriodDatabase()
  ;[
    { id: 1, start_date: '2025-01-01', end_date: '2025-01-05' },
    { id: 2, start_date: '2025-01-31', end_date: '2025-02-04' },
    { id: 3, start_date: '2025-03-02', end_date: '2025-03-06' },
    { id: 4, start_date: '2025-04-01', end_date: '2025-04-05' },
    { id: 5, start_date: '2025-05-01', end_date: '2025-05-05' },
    { id: 6, start_date: '2025-06-30', end_date: '2025-07-04' },
    { id: 7, start_date: '2025-07-30', end_date: '2025-08-03' },
  ].forEach(cycle => insertCycle(db, cycle))
  db.prepare("UPDATE cycles SET ovulation_date = '2025-04-17' WHERE id = 4").run()
  db.prepare("UPDATE cycles SET ovulation_date = '2025-06-10' WHERE id = 5").run()

  let state = getCalculationCycleState(db)
  assert.deepEqual(state.eligibleCycles.map(cycle => cycle.id), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(state.cycleLengths, [30, 30, 30, 30, 30])
  assert.deepEqual(state.unresolvedMissingPeriodPairs.map(pair => [pair.earlier.id, pair.later.id, pair.gap]), [[5, 6, 60]])
  assert.equal(computeCycleParams(db, state).avgCycleLength, 30)
  assert.equal(computeCycleParams(db, state).avgLutealPhase, 14)

  let cycleSummary = notificationTestHelpers.getCycleSummaryContext(
    db, '2025-06-30', state, computeCycleParams(db, state).avgCycleLength
  )
  assert.equal(cycleSummary.comparisonStatus, 'awaiting_review')
  assert.equal(cycleSummary.cycleLengthEstimate, null)

  let warnings = getMissingPeriodWarnings(state)
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].code, 'MISSING_PERIOD_GAP')
  assert.equal(warnings[0].reviewState, null)
  assert.deepEqual(warnings[0].cycleIds, [5, 6])
  assert.doesNotMatch(warnings[0].message, /log it|confirm/i)

  db.prepare(`
    INSERT INTO cycle_gap_reviews (earlier_cycle_id, later_cycle_id, gap_days, review_state)
    VALUES (5, 6, 60, 'confirmed')
  `).run()
  state = getCalculationCycleState(db)
  assert.deepEqual(state.cycleLengths, [30, 30, 30, 30, 60, 30])
  assert.equal(computeCycleParams(db, state).avgCycleLength, 36)
  assert.equal(computeCycleParams(db, state).avgLutealPhase, 16)
  assert.equal(getMissingPeriodWarnings(state)[0].reviewState, 'confirmed')
  cycleSummary = notificationTestHelpers.getCycleSummaryContext(
    db, '2025-06-30', state, computeCycleParams(db, state).avgCycleLength
  )
  assert.equal(cycleSummary.comparisonStatus, 'eligible')
  assert.equal(cycleSummary.cycleLengthEstimate, 36)

  db.prepare(`
    UPDATE cycle_gap_reviews SET review_state = 'excluded'
    WHERE earlier_cycle_id = 5 AND later_cycle_id = 6
  `).run()
  state = getCalculationCycleState(db)
  assert.deepEqual(state.cycleLengths, [30, 30, 30, 30, 30])
  assert.equal(computeCycleParams(db, state).avgLutealPhase, 14)
  assert.equal(getMissingPeriodWarnings(state)[0].reviewState, 'excluded')
  cycleSummary = notificationTestHelpers.getCycleSummaryContext(
    db, '2025-06-30', state, computeCycleParams(db, state).avgCycleLength
  )
  assert.equal(cycleSummary.comparisonStatus, 'excluded')
  assert.equal(cycleSummary.cycleLengthEstimate, null)

  insertCycle(db, { id: 8, start_date: '2025-05-31', end_date: '2025-06-04' })
  state = getCalculationCycleState(db)
  assert.deepEqual(state.missingPeriodPairs, [])
  assert.deepEqual(state.cycleLengths, [30, 30, 30, 30, 30, 30, 30])

  db.close()
})

test('cycle summary keeps a short interval out of the estimate until it is confirmed', () => {
  const db = createPeriodDatabase()
  ;[
    { id: 1, start_date: '2020-01-01', end_date: '2020-01-05' },
    { id: 2, start_date: '2020-02-01', end_date: '2020-02-05' },
    { id: 3, start_date: '2020-02-20', end_date: '2020-02-24' },
  ].forEach(cycle => insertCycle(db, cycle))

  let state = getCalculationCycleState(db)
  let summary = notificationTestHelpers.getCycleSummaryContext(db, '2020-02-20', state, computeCycleParams(db, state).avgCycleLength)
  const notificationType = notificationTestHelpers.notificationTypes.find(type => type.id === 'cycle_summary')
  let html = notificationType.html({ cycleSummary: summary })

  assert.equal(notificationType.dateKey('2020-02-20', db, { cycleSummary: summary }), 'cycle:3')
  assert.equal(notificationType.check({ cycleSummary: summary }), true)
  assert.equal(summary.cycleLength, 19)
  assert.equal(summary.comparisonStatus, 'awaiting_review')
  assert.equal(summary.cycleLengthEstimate, null)
  assert.match(html, /awaiting review/)
  assert.doesNotMatch(html, /cycle-length estimate/)

  db.prepare("UPDATE cycles SET review_state = 'confirmed' WHERE id = 3").run()
  state = getCalculationCycleState(db)
  summary = notificationTestHelpers.getCycleSummaryContext(db, '2020-02-20', state, computeCycleParams(db, state).avgCycleLength)
  html = notificationType.html({ cycleSummary: summary })

  assert.equal(summary.comparisonStatus, 'eligible')
  assert.equal(summary.cycleLengthEstimate, 27)
  assert.match(html, /current cycle-length estimate/)

  db.close()
})

test('cycle summary catches a recent start after the first daily run and uses chronological order', () => {
  const db = createPeriodDatabase()
  ;[
    { id: 1, start_date: '2020-01-01', end_date: '2020-01-05' },
    { id: 2, start_date: '2020-03-01', end_date: '2020-03-05' },
    { id: 3, start_date: '2020-04-01', end_date: '2020-04-05', created_at: '2020-04-01 20:00:00' },
    { id: 4, start_date: '2020-01-15', end_date: '2020-01-19', created_at: '2020-04-02 08:00:00' },
  ].forEach(cycle => insertCycle(db, cycle))

  const state = getCalculationCycleState(db)
  const summary = notificationTestHelpers.getCycleSummaryContext(db, '2020-04-02', state, computeCycleParams(db, state).avgCycleLength)

  assert.equal(summary.targetCycleId, 3)
  assert.equal(summary.previousStartDate, '2020-03-01')
  assert.equal(summary.cycleLength, 31)

  db.close()
})

test('cycle summary suppresses old retroactive entries and already notified cycles', () => {
  const db = createPeriodDatabase()
  insertCycle(db, { id: 1, start_date: '2020-01-01', end_date: '2020-01-05' })
  insertCycle(db, { id: 2, start_date: '2020-03-01', end_date: '2020-03-05', created_at: '2020-04-02 08:00:00' })

  let state = getCalculationCycleState(db)
  let summary = notificationTestHelpers.getCycleSummaryContext(db, '2020-04-02', state, computeCycleParams(db, state).avgCycleLength)
  assert.equal(summary, null)

  insertCycle(db, { id: 3, start_date: '2020-04-01', end_date: '2020-04-05', created_at: '2020-04-01 20:00:00' })
  db.prepare("INSERT INTO notification_log (type_id, date_key) VALUES ('cycle_summary', 'cycle:3')").run()
  state = getCalculationCycleState(db)
  summary = notificationTestHelpers.getCycleSummaryContext(db, '2020-04-02', state, computeCycleParams(db, state).avgCycleLength)
  assert.equal(summary, null)

  db.close()
})
