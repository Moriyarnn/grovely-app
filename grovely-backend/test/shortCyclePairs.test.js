const test = require('node:test')
const assert = require('node:assert/strict')
const { findUnresolvedShortCyclePair, getUnresolvedShortCyclePairs } = require('../routes/period/_shortCyclePairs')

const cycles = [
  { id: 1, start_date: '2026-06-01', review_state: null },
  { id: 2, start_date: '2026-06-14', review_state: null },
  { id: 3, start_date: '2026-06-27', review_state: null },
]

test('creates one warning for each unresolved adjacent short pair', () => {
  const pairs = getUnresolvedShortCyclePairs(cycles)
  assert.deepEqual(pairs.map(pair => [pair.earlier.id, pair.later.id]), [[1, 2], [2, 3]])
})

test('exclusion recalculates adjacency and confirmation clears only its pair', () => {
  assert.deepEqual(getUnresolvedShortCyclePairs(cycles.map(c => c.id === 2 ? { ...c, review_state: 'excluded' } : c)), [])
  assert.deepEqual(getUnresolvedShortCyclePairs(cycles.map(c => c.id === 2 ? { ...c, review_state: 'confirmed' } : c)).map(pair => [pair.earlier.id, pair.later.id]), [[2, 3]])
})

test('either member can resolve the same short pair', () => {
  assert.equal(findUnresolvedShortCyclePair(cycles, 1, 2)?.later.id, 2)
  assert.equal(findUnresolvedShortCyclePair(cycles, 2, 2)?.earlier.id, 1)
})
