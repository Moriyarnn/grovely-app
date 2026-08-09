const express = require('express')
const router = express.Router()
const { emitActivity } = require('../../realtime')

const VALID_CATEGORIES = ['produce', 'dairy', 'meat', 'bakery', 'frozen', 'dry_goods', 'beverages', 'other']
const CATEGORY_ORDER = VALID_CATEGORIES.join("','")
const VALID_DENSITY_UNITS = ['g/ml', 'g/L', 'kg/L']

// Categories are a preference for an existing catalog name, rather than a
// store- or quantity-specific purchase detail. Catalog entries are created on
// move-to-pantry, so this deliberately does not turn unfinished list entries
// into autocomplete suggestions.
function updateCatalogCategory(db, name, category) {
  db.prepare(`
    UPDATE pantry_item_catalog
    SET category = ?
    WHERE name = ? COLLATE NOCASE
  `).run(category, name)
}

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
  // GET all items — unchecked first (by category order), checked last (by checked_at)
  router.get('/', (req, res) => {
    const items = db.prepare(`
      SELECT sl.*, u.username as added_by_username
      FROM shopping_list sl
      LEFT JOIN users u ON u.id = sl.added_by
      ORDER BY
        sl.checked ASC,
        CASE sl.category
          WHEN 'produce'   THEN 1
          WHEN 'dairy'     THEN 2
          WHEN 'meat'      THEN 3
          WHEN 'bakery'    THEN 4
          WHEN 'frozen'    THEN 5
          WHEN 'dry_goods' THEN 6
          ELSE 7
        END,
        sl.name ASC,
        sl.checked_at ASC
    `).all()
    res.json(items)
  })

  // POST add item
  router.post('/', (req, res) => {
    const { name, quantity, category, price, notes, amount, unit, pieces, store } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' })
    const cat = VALID_CATEGORIES.includes(category) ? category : 'other'
    const userId = req.user?.id ?? null
    const priceVal = (price !== undefined && price !== '' && price !== null) ? parseFloat(price) : null
    const amountVal = (amount !== undefined && amount !== null && amount !== '') ? parseFloat(amount) : null
    const piecesVal = (pieces !== undefined && pieces !== null && pieces !== '') ? parseInt(pieces) : null
    const density = parseDensityFields(req.body)
    if (density.error) return res.status(400).json({ error: density.error })
    const densityVal = density.skip ? null : density.density
    const densityUnitVal = density.skip ? null : density.density_unit
    const result = db.prepare(
      'INSERT INTO shopping_list (name, quantity, category, added_by, price, notes, amount, unit, density, density_unit, pieces, store) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name.trim(), quantity?.trim() || null, cat, userId, priceVal, notes?.trim() || null, amountVal, unit || null, densityVal, densityUnitVal, piecesVal, store?.trim() || null)
    updateCatalogCategory(db, name.trim(), cat)
    const item = db.prepare('SELECT * FROM shopping_list WHERE id = ?').get(result.lastInsertRowid)
    emitActivity(req, { type: 'pantry.list.add', item: item.name, row: item })
    res.status(201).json(item)
  })

  // DELETE bulk-clear all checked items — must be before /:id
  router.delete('/checked', (req, res) => {
    const cleared = db.prepare('SELECT id FROM shopping_list WHERE checked = 1').all().map(r => r.id)
    db.prepare('DELETE FROM shopping_list WHERE checked = 1').run()
    emitActivity(req, { type: 'pantry.list.modify', action: 'clear', ids: cleared })
    res.json({ ok: true })
  })

  // PATCH update or toggle checked
  router.patch('/:id', (req, res) => {
    const { id } = req.params
    const item = db.prepare('SELECT * FROM shopping_list WHERE id = ?').get(id)
    if (!item) return res.status(404).json({ error: 'Item not found' })

    const { name, quantity, category, checked, expiry_date, price, notes, amount, unit, pieces, store } = req.body

    if (checked !== undefined) {
      const nowChecked = checked ? 1 : 0
      db.prepare(
        'UPDATE shopping_list SET checked = ?, checked_at = ? WHERE id = ?'
      ).run(nowChecked, nowChecked ? new Date().toISOString() : null, id)
    }

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'name cannot be empty' })
      db.prepare('UPDATE shopping_list SET name = ? WHERE id = ?').run(name.trim(), id)
    }

    if (quantity !== undefined) {
      db.prepare('UPDATE shopping_list SET quantity = ? WHERE id = ?').run(quantity?.trim() || null, id)
    }

    if (category !== undefined) {
      const cat = VALID_CATEGORIES.includes(category) ? category : 'other'
      db.prepare('UPDATE shopping_list SET category = ? WHERE id = ?').run(cat, id)
      updateCatalogCategory(db, item.name, cat)
    }

    if (expiry_date !== undefined) {
      db.prepare('UPDATE shopping_list SET expiry_date = ? WHERE id = ?').run(expiry_date || null, id)
    }

    if (price !== undefined) {
      const priceVal = (price !== '' && price !== null) ? parseFloat(price) : null
      db.prepare('UPDATE shopping_list SET price = ? WHERE id = ?').run(priceVal, id)
    }

    if (notes !== undefined) {
      db.prepare('UPDATE shopping_list SET notes = ? WHERE id = ?').run(notes?.trim() || null, id)
    }

    if (amount !== undefined) {
      const amountVal = (amount !== null && amount !== '') ? parseFloat(amount) : null
      db.prepare('UPDATE shopping_list SET amount = ? WHERE id = ?').run(amountVal, id)
    }

    if (unit !== undefined) {
      db.prepare('UPDATE shopping_list SET unit = ? WHERE id = ?').run(unit || null, id)
    }

    if (pieces !== undefined) {
      const piecesVal = (pieces !== null && pieces !== '') ? parseInt(pieces) : null
      db.prepare('UPDATE shopping_list SET pieces = ? WHERE id = ?').run(piecesVal, id)
    }

    const density = parseDensityFields(req.body)
    if (density.error) return res.status(400).json({ error: density.error })
    if (!density.skip) {
      db.prepare('UPDATE shopping_list SET density = ?, density_unit = ? WHERE id = ?')
        .run(density.density, density.density_unit, id)
    }

    if (store !== undefined) {
      db.prepare('UPDATE shopping_list SET store = ? WHERE id = ?').run(store?.trim() || null, id)
    }

    const updated = db.prepare('SELECT * FROM shopping_list WHERE id = ?').get(id)
    emitActivity(req, {
      type: 'pantry.list.modify',
      action: checked !== undefined ? 'check' : 'edit',
      id: Number(id),
      row: updated
    })
    res.json(updated)
  })

  // DELETE single item
  router.delete('/:id', (req, res) => {
    const item = db.prepare('SELECT id FROM shopping_list WHERE id = ?').get(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    db.prepare('DELETE FROM shopping_list WHERE id = ?').run(req.params.id)
    // A move-to-pantry deletes the list item as a side-effect; sync it but
    // suppress its bubble (the move itself raises the only bubble we want).
    emitActivity(req, { type: 'pantry.list.modify', action: 'delete', id: Number(req.params.id), silent: req.query.via === 'move' })
    res.json({ ok: true })
  })

  return router
}
