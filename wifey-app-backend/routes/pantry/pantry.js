const express = require('express')
const router = express.Router()
const { convertToUnit, normalizeUnit } = require('../../utils/units')

const VALID_CATEGORIES = ['produce', 'dairy', 'meat', 'bakery', 'frozen', 'dry_goods', 'other']
const VALID_STATUSES = ['active', 'used', 'wasted']
const VALID_DENSITY_UNITS = ['g/ml', 'g/L', 'kg/L']

function parseDensityFields(body) {
  const hasDensity = body.density !== undefined
  const hasDensityUnit = body.density_unit !== undefined
  if (!hasDensity && !hasDensityUnit) return { skip: true }

  const rawD = body.density
  const rawU = body.density_unit
  const dEmpty = rawD === '' || rawD === null || rawD === undefined
  const uEmpty = rawU === '' || rawU === null || rawU === undefined

  if (dEmpty && uEmpty) return { density: null, density_unit: null }
  if (dEmpty !== uEmpty) {
    return { error: 'density and density_unit must be provided together' }
  }
  const dNum = parseFloat(rawD)
  if (!isFinite(dNum) || dNum <= 0) {
    return { error: 'density must be a positive number' }
  }
  if (!VALID_DENSITY_UNITS.includes(rawU)) {
    return { error: `density_unit must be one of ${VALID_DENSITY_UNITS.join(', ')}` }
  }
  return { density: dNum, density_unit: rawU }
}

module.exports = (db) => {
  // GET all active pantry items, expiring soonest first, nulls last
  router.get('/', (req, res) => {
    const items = db.prepare(`
      SELECT * FROM pantry
      WHERE status = 'active'
      ORDER BY
        CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
        expiry_date ASC,
        name ASC
    `).all()
    res.json(items)
  })

  // GET items expiring within N days (used by notification cron)
  router.get('/expiring', (req, res) => {
    const days = Math.max(1, parseInt(req.query.days) || 7)
    const items = db.prepare(`
      SELECT * FROM pantry
      WHERE status = 'active'
        AND expiry_date IS NOT NULL
        AND expiry_date <= date('now', '+' || ? || ' days')
      ORDER BY expiry_date ASC
    `).all(days)
    res.json(items)
  })

  // POST add item directly (not from shopping list)
  router.post('/', (req, res) => {
    const { name, quantity, category, expiry_date, bought_date, notes, price, amount, unit } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' })
    const cat = VALID_CATEGORIES.includes(category) ? category : 'other'
    const today = new Date().toISOString().split('T')[0]
    const amountVal = (amount !== undefined && amount !== null && amount !== '') ? parseFloat(amount) : null
    const density = parseDensityFields(req.body)
    if (density.error) return res.status(400).json({ error: density.error })
    const densityVal = density.skip ? null : density.density
    const densityUnitVal = density.skip ? null : density.density_unit
    const result = db.prepare(`
      INSERT INTO pantry (name, quantity, category, bought_date, expiry_date, notes, price, amount, unit, density, density_unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), quantity?.trim() || null, cat, bought_date || today, expiry_date || null, notes || null, price ?? null, amountVal, unit || null, densityVal, densityUnitVal)
    res.status(201).json(db.prepare('SELECT * FROM pantry WHERE id = ?').get(result.lastInsertRowid))
  })

  // PATCH update fields
  router.patch('/:id', (req, res) => {
    const item = db.prepare('SELECT * FROM pantry WHERE id = ?').get(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })

    const { name, quantity, category, expiry_date, opened_date, notes, price, amount, unit } = req.body
    const now = new Date().toISOString()

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'name cannot be empty' })
      db.prepare('UPDATE pantry SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), now, req.params.id)
    }
    if (quantity !== undefined) db.prepare('UPDATE pantry SET quantity = ?, updated_at = ? WHERE id = ?').run(quantity || null, now, req.params.id)
    if (category !== undefined) {
      const cat = VALID_CATEGORIES.includes(category) ? category : 'other'
      db.prepare('UPDATE pantry SET category = ?, updated_at = ? WHERE id = ?').run(cat, now, req.params.id)
    }
    if (expiry_date !== undefined) db.prepare('UPDATE pantry SET expiry_date = ?, updated_at = ? WHERE id = ?').run(expiry_date || null, now, req.params.id)
    if (opened_date !== undefined) db.prepare('UPDATE pantry SET opened_date = ?, updated_at = ? WHERE id = ?').run(opened_date || null, now, req.params.id)
    if (notes !== undefined) db.prepare('UPDATE pantry SET notes = ?, updated_at = ? WHERE id = ?').run(notes || null, now, req.params.id)
    if (price !== undefined) db.prepare('UPDATE pantry SET price = ?, updated_at = ? WHERE id = ?').run(price ?? null, now, req.params.id)
    if (amount !== undefined) {
      const amountVal = (amount !== null && amount !== '') ? parseFloat(amount) : null
      db.prepare('UPDATE pantry SET amount = ?, updated_at = ? WHERE id = ?').run(amountVal, now, req.params.id)
    }
    if (unit !== undefined) db.prepare('UPDATE pantry SET unit = ?, updated_at = ? WHERE id = ?').run(unit || null, now, req.params.id)

    const density = parseDensityFields(req.body)
    if (density.error) return res.status(400).json({ error: density.error })
    if (!density.skip) {
      db.prepare('UPDATE pantry SET density = ?, density_unit = ?, updated_at = ? WHERE id = ?')
        .run(density.density, density.density_unit, now, req.params.id)
    }

    res.json(db.prepare('SELECT * FROM pantry WHERE id = ?').get(req.params.id))
  })

  // PATCH consume partial or full amount
  router.patch('/:id/consume', (req, res) => {
    const item = db.prepare('SELECT * FROM pantry WHERE id = ?').get(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    const { consumed, consumedUnit, action } = req.body
    if (!['use', 'waste'].includes(action)) return res.status(400).json({ error: 'action must be use or waste' })
    const now = new Date().toISOString()
    if (item.amount === null || item.amount === undefined) {
      const status = action === 'use' ? 'used' : 'wasted'
      db.prepare('UPDATE pantry SET status = ?, updated_at = ? WHERE id = ?').run(status, now, req.params.id)
      return res.json({ removed: true })
    }

    const consumedRaw = parseFloat(consumed) || 0
    const fromUnit = consumedUnit ? normalizeUnit(consumedUnit) : normalizeUnit(item.unit)
    const toUnit = normalizeUnit(item.unit)
    let consumedInItemUnit = consumedRaw
    if (fromUnit && toUnit && fromUnit !== toUnit) {
      const converted = convertToUnit(consumedRaw, fromUnit, toUnit, item.density, item.density_unit)
      if (converted === null) {
        if (!item.density || !item.density_unit) {
          return res.status(400).json({ error: `Cannot convert ${fromUnit} to ${toUnit} without density set on this item` })
        }
        return res.status(400).json({ error: `Cannot convert ${fromUnit} to ${toUnit}` })
      }
      consumedInItemUnit = converted
    }

    const remainder = item.amount - consumedInItemUnit
    if (remainder > 0) {
      db.prepare('UPDATE pantry SET amount = ?, updated_at = ? WHERE id = ?').run(remainder, now, req.params.id)
      return res.json({ removed: false, item: db.prepare('SELECT * FROM pantry WHERE id = ?').get(req.params.id) })
    }
    const status = action === 'use' ? 'used' : 'wasted'
    db.prepare('UPDATE pantry SET status = ?, updated_at = ? WHERE id = ?').run(status, now, req.params.id)
    res.json({ removed: true })
  })

  // PATCH set status (used / wasted)
  router.patch('/:id/status', (req, res) => {
    const item = db.prepare('SELECT * FROM pantry WHERE id = ?').get(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    const { status } = req.body
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })
    db.prepare('UPDATE pantry SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), req.params.id)
    res.json({ ok: true })
  })

  // DELETE hard delete
  router.delete('/:id', (req, res) => {
    const item = db.prepare('SELECT id FROM pantry WHERE id = ?').get(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    db.prepare('DELETE FROM pantry WHERE id = ?').run(req.params.id)
    res.json({ ok: true })
  })

  return router
}
