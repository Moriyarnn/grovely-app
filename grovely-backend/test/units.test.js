const test = require('node:test')
const assert = require('node:assert/strict')

const { compatibleUnits, convertToUnit, normalizeUnit } = require('../utils/units')

test('unit aliases are normalized', () => {
  assert.equal(normalizeUnit('KG'), 'kg')
  assert.equal(normalizeUnit('Ml'), 'ml')
})

test('units convert within the same measurement group', () => {
  assert.equal(convertToUnit(2, 'kg', 'g'), 2000)
  assert.equal(convertToUnit(3, 'tbsp', 'ml'), 45)
})

test('density enables conversion between weight and volume', () => {
  assert.equal(convertToUnit(800, 'g', 'L', 0.8, 'g/ml'), 1)
  assert.ok(compatibleUnits('g', 0.8, 'g/ml').includes('ml'))
})

test('incompatible units return null without density', () => {
  assert.equal(convertToUnit(100, 'g', 'ml'), null)
})
