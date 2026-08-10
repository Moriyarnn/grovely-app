const test = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')

const {
  computeAveragePeriodLength,
  computePredictionsForCycle,
  getCalculationCycleState,
  recomputeAllPredictions
} = require('../routes/period/_calcHelpers')
const { getFutureCycles } = require('../routes/period/calculations')

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
      updated_at TEXT
    );
    CREATE TABLE cycle_days (
      id INTEGER PRIMARY KEY,
      cycle_id INTEGER NOT NULL,
      date TEXT NOT NULL
    );
  `)
  return db
}

function insertCycle(db, cycle) {
  db.prepare(`
    INSERT INTO cycles (id, start_date, end_date, predicted_start_date, review_state)
    VALUES (@id, @start_date, @end_date, @predicted_start_date, @review_state)
  `).run({ predicted_start_date: null, review_state: null, ...cycle })
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
