const express = require('express')
const router = express.Router()
const { convertToUnit, normalizeUnit } = require('../../utils/units')

const VALID_CATEGORIES = ['produce', 'dairy', 'meat', 'bakery', 'frozen', 'dry_goods', 'beverages', 'other']
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

// ---------------------------------------------------------------------------
// Catalog + history helpers
// ---------------------------------------------------------------------------

// Upsert catalog entry for a given item. Returns the catalog row id.
// Canonical name is always updated to whatever was submitted (last-writer-wins,
// case-insensitive dedup enforced by the COLLATE NOCASE unique index).
function upsertCatalog(db, { name, amount, unit, density, density_unit, pieces, price }) {
  db.prepare(`
    INSERT INTO pantry_item_catalog
      (name, amount, unit, density, density_unit, pieces, price, last_added_at, use_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      name          = excluded.name,
      amount        = excluded.amount,
      unit          = excluded.unit,
      density       = excluded.density,
      density_unit  = excluded.density_unit,
      pieces        = excluded.pieces,
      price         = excluded.price,
      last_added_at = datetime('now'),
      use_count     = use_count + 1
  `).run(
    name,
    amount       ?? null,
    unit         ?? null,
    density      ?? null,
    density_unit ?? null,
    pieces       ?? null,
    price        ?? null
  )
  return db.prepare(
    `SELECT id FROM pantry_item_catalog WHERE name = ? COLLATE NOCASE`
  ).get(name)?.id ?? null
}

// Write one row to pantry_purchase_history.
function writePurchaseHistory(db, { catalogId, name, amount, unit, density, density_unit, pieces, price, store, pantryItemId }) {
  db.prepare(`
    INSERT INTO pantry_purchase_history
      (catalog_id, name, amount, unit, density, density_unit, pieces, price, store, pantry_item_id, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    catalogId    ?? null,
    name,
    amount       ?? null,
    unit         ?? null,
    density      ?? null,
    density_unit ?? null,
    pieces       ?? null,
    price        ?? null,
    store        ?? null,
    pantryItemId ?? null
  )
}

// Write one row to pantry_consume_history.
// amount/pieces reflect what was actually consumed (not the original item total).
// price is copied from the pantry row at the moment of the event.
function writeConsumeHistory(db, { name, amount, unit, pieces, price, event, pantryItemId }) {
  const catalog = db.prepare(
    `SELECT id FROM pantry_item_catalog WHERE name = ? COLLATE NOCASE`
  ).get(name)
  db.prepare(`
    INSERT INTO pantry_consume_history
      (catalog_id, name, amount, unit, pieces, price, event, pantry_item_id, consumed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    catalog?.id  ?? null,
    name,
    amount       ?? null,
    unit         ?? null,
    pieces       ?? null,
    price        ?? null,
    event,
    pantryItemId ?? null
  )
}

// ---------------------------------------------------------------------------

module.exports = (db) => {
  // GET all active pantry items, expiring soonest first, nulls last
  router.get('/', (req, res) => {
    const items = db.prepare(`
      SELECT * FROM pantry
      WHERE status = 'active'
        AND deleted_at IS NULL
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
        AND deleted_at IS NULL
        AND expiry_date IS NOT NULL
        AND expiry_date <= date('now', '+' || ? || ' days')
      ORDER BY expiry_date ASC
    `).all(days)
    res.json(items)
  })

  // GET suggested expiry date for an item name. So users don't guess: we take the
  // most recent past entry for this name that had both a bought and expiry date,
  // derive its shelf life (expiry − bought), and apply it forward from today.
  // Returns { suggested_expiry_date, shelf_life_days } or nulls when no history.
  router.get('/suggest-expiry', (req, res) => {
    const name = (req.query.name ?? '').trim()
    if (!name) return res.json({ suggested_expiry_date: null, shelf_life_days: null })
    const row = db.prepare(`
      SELECT
        CAST(julianday(expiry_date) - julianday(bought_date) AS INTEGER) AS shelf_life_days
      FROM pantry
      WHERE name = ? COLLATE NOCASE
        AND bought_date IS NOT NULL
        AND expiry_date IS NOT NULL
        AND deleted_at IS NULL
      ORDER BY bought_date DESC, id DESC
      LIMIT 1
    `).get(name)
    if (!row || row.shelf_life_days === null || row.shelf_life_days < 0) {
      return res.json({ suggested_expiry_date: null, shelf_life_days: null })
    }
    const suggested = db.prepare(
      `SELECT date('now', '+' || ? || ' days') AS d`
    ).get(row.shelf_life_days).d
    res.json({ suggested_expiry_date: suggested, shelf_life_days: row.shelf_life_days })
  })

  // POST add item — used by move-to-pantry and direct inventory add.
  // Merges into an existing active item when name + amount + unit match (amount-type)
  // or name matches an existing pieces item (pieces-type). Always writes catalog +
  // purchase history regardless of whether a merge occurred.
  router.post('/', (req, res) => {
    const { name, quantity, category, expiry_date, bought_date, notes, price, amount, unit, pieces, store } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' })
    const cat = VALID_CATEGORIES.includes(category) ? category : 'other'
    const today = new Date().toISOString().split('T')[0]
    const amountVal = (amount !== undefined && amount !== null && amount !== '') ? parseFloat(amount) : null
    const piecesVal = (pieces !== undefined && pieces !== null && pieces !== '') ? parseInt(pieces) : null
    const priceVal  = (price  !== undefined && price  !== null && price  !== '') ? parseFloat(price)  : null
    const density = parseDensityFields(req.body)
    if (density.error) return res.status(400).json({ error: density.error })
    const densityVal     = density.skip ? null : density.density
    const densityUnitVal = density.skip ? null : density.density_unit
    const expiryVal = expiry_date || null
    const now = new Date().toISOString()

    // --- Inventory merge ---
    // Two items merge only when they share the same expiry date (null matches null,
    // a date never matches null). Different expiry dates stay as separate rows so
    // each batch keeps its true date and expiry notifications stay correct.
    // Amount-type: same name (case-insensitive) + same unit + same expiry
    // Pieces-type: same name (case-insensitive) + same expiry, any existing pieces row
    let pantryItemId = null
    let merged = false

    if (amountVal !== null && unit) {
      const existing = db.prepare(`
        SELECT * FROM pantry
        WHERE name = ? COLLATE NOCASE
          AND unit   = ?
          AND amount IS NOT NULL
          AND expiry_date IS ?
          AND status = 'active'
          AND deleted_at IS NULL
        LIMIT 1
      `).get(name.trim(), unit, expiryVal)

      if (existing) {
        db.prepare(`
          UPDATE pantry SET amount = amount + ?, updated_at = ? WHERE id = ?
        `).run(amountVal, now, existing.id)
        pantryItemId = existing.id
        merged = true
      }
    } else if (piecesVal !== null) {
      const existing = db.prepare(`
        SELECT * FROM pantry
        WHERE name = ? COLLATE NOCASE
          AND pieces IS NOT NULL
          AND expiry_date IS ?
          AND status = 'active'
          AND deleted_at IS NULL
        LIMIT 1
      `).get(name.trim(), expiryVal)

      if (existing) {
        db.prepare(`
          UPDATE pantry SET pieces = pieces + ?, updated_at = ? WHERE id = ?
        `).run(piecesVal, now, existing.id)
        pantryItemId = existing.id
        merged = true
      }
    }

    // No merge — insert a new pantry row
    if (!merged) {
      const result = db.prepare(`
        INSERT INTO pantry (name, quantity, category, bought_date, expiry_date, notes, price, amount, unit, density, density_unit, pieces)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(), quantity?.trim() || null, cat,
        bought_date || today, expiryVal, notes || null,
        priceVal, amountVal, unit || null, densityVal, densityUnitVal, piecesVal
      )
      pantryItemId = result.lastInsertRowid
    }

    // --- Catalog upsert + purchase history ---
    const catalogId = upsertCatalog(db, {
      name:         name.trim(),
      amount:       amountVal,
      unit:         unit || null,
      density:      densityVal,
      density_unit: densityUnitVal,
      pieces:       piecesVal,
      price:        priceVal,
    })
    writePurchaseHistory(db, {
      catalogId,
      name:         name.trim(),
      amount:       amountVal,
      unit:         unit || null,
      density:      densityVal,
      density_unit: densityUnitVal,
      pieces:       piecesVal,
      price:        priceVal,
      store:        store?.trim() || null,
      pantryItemId,
    })

    res.status(201).json(db.prepare('SELECT * FROM pantry WHERE id = ?').get(pantryItemId))
  })

  // PATCH update fields
  router.patch('/:id', (req, res) => {
    const item = db.prepare('SELECT * FROM pantry WHERE id = ?').get(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })

    const { name, quantity, category, expiry_date, opened_date, notes, price, amount, unit, pieces } = req.body
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
    if (pieces !== undefined) {
      const piecesVal = (pieces !== null && pieces !== '') ? parseInt(pieces) : null
      db.prepare('UPDATE pantry SET pieces = ?, updated_at = ? WHERE id = ?').run(piecesVal, now, req.params.id)
    }

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
    if (!['use', 'waste', 'mark_one'].includes(action)) return res.status(400).json({ error: 'action must be use, waste, or mark_one' })
    const now = new Date().toISOString()

    if (action === 'mark_one') {
      // Decrement one piece — item not fully consumed, no history write
      const currentPieces = item.pieces ?? 1
      if (currentPieces < 2) return res.status(400).json({ error: 'item does not have multiple pieces' })
      const newPieces = currentPieces - 1
      db.prepare('UPDATE pantry SET pieces = ?, updated_at = ? WHERE id = ?').run(newPieces, now, req.params.id)
      return res.json({ removed: false, item: db.prepare('SELECT * FROM pantry WHERE id = ?').get(req.params.id) })
    }

    if (item.amount === null || item.amount === undefined) {
      if (item.pieces != null && consumed != null) {
        const piecesConsumed = parseInt(consumed) || 0
        if (piecesConsumed > 0 && piecesConsumed < item.pieces) {
          // Partial pieces consume
          db.prepare('UPDATE pantry SET pieces = ?, updated_at = ? WHERE id = ?').run(item.pieces - piecesConsumed, now, req.params.id)
          writeConsumeHistory(db, { name: item.name, pieces: piecesConsumed, price: item.price, event: action === 'use' ? 'used' : 'wasted', pantryItemId: item.id })
          return res.json({ removed: false, item: db.prepare('SELECT * FROM pantry WHERE id = ?').get(req.params.id) })
        }
      }
      // Full pieces consume
      const status = action === 'use' ? 'used' : 'wasted'
      db.prepare('UPDATE pantry SET status = ?, updated_at = ? WHERE id = ?').run(status, now, req.params.id)
      writeConsumeHistory(db, { name: item.name, pieces: item.pieces, price: item.price, event: status, pantryItemId: item.id })
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

    const newAmount = parseFloat((item.amount - consumedInItemUnit).toPrecision(8))
    if (newAmount <= 0) {
      // Full amount consume
      const status = action === 'use' ? 'used' : 'wasted'
      db.prepare('UPDATE pantry SET status = ?, updated_at = ? WHERE id = ?').run(status, now, req.params.id)
      writeConsumeHistory(db, { name: item.name, amount: item.amount, unit: item.unit, price: item.price, event: status, pantryItemId: item.id })
      return res.json({ removed: true })
    }

    // Partial amount consume
    db.prepare('UPDATE pantry SET amount = ?, updated_at = ? WHERE id = ?').run(newAmount, now, req.params.id)
    writeConsumeHistory(db, { name: item.name, amount: consumedInItemUnit, unit: item.unit, price: item.price, event: action === 'use' ? 'used' : 'wasted', pantryItemId: item.id })
    res.json({ removed: false, item: db.prepare('SELECT * FROM pantry WHERE id = ?').get(req.params.id) })
  })

  // PATCH set status (used / wasted)
  router.patch('/:id/status', (req, res) => {
    const item = db.prepare('SELECT * FROM pantry WHERE id = ?').get(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    const { status } = req.body
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })
    db.prepare('UPDATE pantry SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), req.params.id)
    if (status === 'used' || status === 'wasted') {
      writeConsumeHistory(db, { name: item.name, amount: item.amount, unit: item.unit, pieces: item.pieces, price: item.price, event: status, pantryItemId: item.id })
    }
    res.json({ ok: true })
  })

  // DELETE soft delete — sets deleted_at, preserves status and history references
  router.delete('/:id', (req, res) => {
    const item = db.prepare('SELECT id FROM pantry WHERE id = ?').get(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    db.prepare('UPDATE pantry SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date().toISOString(), req.params.id)
    res.json({ ok: true })
  })

  return router
}
