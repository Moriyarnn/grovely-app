const test = require('node:test')
const assert = require('node:assert/strict')

const { computePredictionsForCycle } = require('../routes/period/_calcHelpers')

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
