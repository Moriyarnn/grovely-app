const test = require('node:test')
const assert = require('node:assert/strict')
const {
  findUnresolvedShortCyclePair,
  getConfirmedShortCycleForecastSuppressionIds,
  getUnresolvedShortCycleIds,
  getUnresolvedShortCyclePairs
} = require('../routes/period/_shortCyclePairs')
const { resolveConfirmationCycleId } = require('../routes/period/cycles')

const cycles = [
  { id: 1, start_date: '2026-06-01', review_state: null },
  { id: 2, start_date: '2026-06-14', review_state: null },
  { id: 3, start_date: '2026-06-27', review_state: null },
]

test('creates one warning for each unresolved adjacent short pair', () => {
  const pairs = getUnresolvedShortCyclePairs(cycles)
  assert.deepEqual(pairs.map(pair => [pair.earlier.id, pair.later.id]), [[1, 2], [2, 3]])
})

test('detects a short pair when the earlier cycle was logged after the later cycle', () => {
  const pairs = getUnresolvedShortCyclePairs([
    { id: 2, start_date: '2026-06-14', review_state: null },
    { id: 1, start_date: '2026-06-01', review_state: null },
  ])

  assert.deepEqual(pairs.map(pair => [pair.earlier.id, pair.later.id]), [[1, 2]])
})

test('suppresses only the earlier forecast source after a short pair is confirmed', () => {
  const confirmedPair = [
    { id: 1, start_date: '2026-06-01', review_state: null },
    { id: 2, start_date: '2026-06-14', review_state: 'confirmed' },
  ]

  assert.deepEqual([...getConfirmedShortCycleForecastSuppressionIds(confirmedPair)], [1])
})

test('quarantines every member of every unresolved short pair', () => {
  assert.deepEqual([...getUnresolvedShortCycleIds(cycles)], [1, 2, 3])
})

test('exclusion recalculates adjacency and confirmation clears only its pair', () => {
  assert.deepEqual(getUnresolvedShortCyclePairs(cycles.map(c => c.id === 2 ? { ...c, review_state: 'excluded' } : c)), [])
  assert.deepEqual(getUnresolvedShortCyclePairs(cycles.map(c => c.id === 2 ? { ...c, review_state: 'confirmed' } : c)).map(pair => [pair.earlier.id, pair.later.id]), [[2, 3]])
})

test('either member can resolve the same short pair', () => {
  assert.equal(findUnresolvedShortCyclePair(cycles, 1, 2)?.later.id, 2)
  assert.equal(findUnresolvedShortCyclePair(cycles, 2, 2)?.earlier.id, 1)
})

test('confirmation targets only a valid short pair or unresolved long period', () => {
  assert.equal(resolveConfirmationCycleId(cycles, new Set(), 1, 2), 2)
  assert.equal(resolveConfirmationCycleId(cycles, new Set([3]), 3, null), 3)
  assert.equal(resolveConfirmationCycleId(cycles, new Set(), 3, null), null)
  assert.equal(resolveConfirmationCycleId(cycles, new Set(), 1, 99), null)
})
