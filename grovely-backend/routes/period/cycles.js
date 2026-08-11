const express = require('express')
const router = express.Router()
const { logPeriodEvent } = require('../../logger')
const { requireOwner } = require('../../middleware/auth')
const { getCalculationCycleState, recomputeAllPredictions } = require('./_calcHelpers')
const { findUnresolvedShortCyclePair } = require('./_shortCyclePairs')
const { emitActivity } = require('../../realtime')

function resolveConfirmationCycleId(cycles, unresolvedLongCycleIds, selectedCycleId, pairCycleId) {
  if (pairCycleId === undefined || pairCycleId === null) {
    return unresolvedLongCycleIds.has(Number(selectedCycleId)) ? Number(selectedCycleId) : null
  }
  return findUnresolvedShortCyclePair(cycles, selectedCycleId, pairCycleId)?.later.id ?? null
}

function createCyclesRouter(db) {
  // Get all cycles with last logged day
  router.get('/', (req, res) => {
    const cycles = db.prepare(`
      SELECT c.*, MAX(cd.date) as last_logged_day
      FROM cycles c
      LEFT JOIN cycle_days cd ON cd.cycle_id = c.id
      GROUP BY c.id
      ORDER BY c.start_date DESC
    `).all()
    res.json(cycles)
  })

  // Get single cycle
  router.get('/:id', (req, res) => {
    const cycle = db.prepare('SELECT * FROM cycles WHERE id = ?').get(req.params.id)
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' })
    res.json(cycle)
  })

  // Start a new period
  router.post('/start', requireOwner, (req, res) => {
    const { start_date, predicted_start_date } = req.body
    if (!start_date) return res.status(400).json({ error: 'start_date is required' })
    const result = db.prepare(
      'INSERT INTO cycles (start_date, predicted_start_date, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    ).run(start_date, predicted_start_date ?? null)
    const id = result.lastInsertRowid
    logPeriodEvent(db, { entity: 'cycle', entity_id: id, action: 'create', cycle_id: id, date: start_date })
    recomputeAllPredictions(db)
    emitActivity(req, { type: 'period.change', action: 'cycle', dates: [start_date] })
    res.json({ id, start_date })
  })

  // Move a period start to an earlier date
  router.patch('/:id/start', requireOwner, (req, res) => {
    const { start_date } = req.body
    if (!start_date) return res.status(400).json({ error: 'start_date is required' })
    const id = Number(req.params.id)
    const cycle = db.prepare('SELECT start_date FROM cycles WHERE id = ?').get(id)
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' })
    if (start_date >= cycle.start_date) return res.status(400).json({ error: 'New start_date must be before current start_date' })
    db.prepare('UPDATE cycles SET start_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(start_date, id)
    logPeriodEvent(db, { entity: 'cycle', entity_id: id, action: 'update', cycle_id: id, date: start_date })
    recomputeAllPredictions(db)
    emitActivity(req, { type: 'period.change', action: 'cycle', dates: [start_date] })
    res.json({ success: true })
  })

  // End a period (also cascade-deletes orphaned cycle_days after end_date)
  router.patch('/:id/end', requireOwner, (req, res) => {
    const { end_date } = req.body
    if (!end_date) return res.status(400).json({ error: 'end_date is required' })
    const id = Number(req.params.id)
    db.prepare('UPDATE cycles SET end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(end_date, id)
    // Issue #35: delete cycle_days logged after end_date and their symptoms
    const orphaned = db.prepare('SELECT id FROM cycle_days WHERE cycle_id = ? AND date > ?').all(id, end_date)
    if (orphaned.length > 0) {
      const placeholders = orphaned.map(() => '?').join(',')
      db.prepare(`DELETE FROM symptoms WHERE cycle_day_id IN (${placeholders})`).run(...orphaned.map(d => d.id))
      db.prepare(`DELETE FROM cycle_days WHERE id IN (${placeholders})`).run(...orphaned.map(d => d.id))
    }
    logPeriodEvent(db, { entity: 'cycle', entity_id: id, action: 'update', cycle_id: id, date: end_date })
    recomputeAllPredictions(db)
    emitActivity(req, { type: 'period.change', action: 'cycle', dates: [end_date] })
    res.json({ success: true })
  })

  // Adjust cycle start/end without deleting orphaned cycle_days.
  // Used by the free removeDay flow (edge-day deletion). The premium Adjust Cycle
  // hold-drag gesture routes to /api/premium/period/cycles/:id/adjust instead.
  router.patch('/:id/adjust', requireOwner, (req, res) => {
    const { start_date, end_date } = req.body
    const id = Number(req.params.id)
    const cycle = db.prepare('SELECT * FROM cycles WHERE id = ?').get(id)
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' })
    const newStart = start_date ?? cycle.start_date
    const newEnd = end_date ?? cycle.end_date
    if (newEnd && newStart > newEnd)
      return res.status(400).json({ error: 'start_date must be before end_date' })
    db.prepare('UPDATE cycles SET start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStart, newEnd, id)
    logPeriodEvent(db, { entity: 'cycle', entity_id: id, action: 'update', cycle_id: id, date: newStart })
    recomputeAllPredictions(db)
    emitActivity(req, { type: 'period.change', action: 'cycle', dates: [newStart] })
    res.json({ id, start_date: newStart, end_date: newEnd })
  })

  // Exclude or restore one cycle, or confirm the short-gap pair it belongs to.
  router.patch('/:id/review', requireOwner, (req, res) => {
    const { reviewState, pairCycleId } = req.body
    const valid = [null, 'confirmed', 'excluded']
    if (!valid.includes(reviewState ?? null)) return res.status(400).json({ error: 'reviewState must be confirmed, excluded, or null' })
    const id = Number(req.params.id)
    const cycle = db.prepare('SELECT * FROM cycles WHERE id = ?').get(id)
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' })
    if (reviewState === 'confirmed') {
      const cycles = db.prepare(`SELECT * FROM cycles WHERE start_date IS NOT NULL ORDER BY start_date ASC`).all()
      const { unresolvedLongCycles } = getCalculationCycleState(db)
      const unresolvedLongCycleIds = new Set(unresolvedLongCycles.map(item => item.id))
      const confirmationId = resolveConfirmationCycleId(cycles, unresolvedLongCycleIds, id, pairCycleId)
      if (confirmationId === null) {
        return res.status(400).json({ error: 'No unresolved cycle warning found' })
      }
      db.prepare('UPDATE cycles SET review_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('confirmed', confirmationId)
    } else {
      db.prepare('UPDATE cycles SET review_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(reviewState ?? null, id)
    }
    recomputeAllPredictions(db)
    emitActivity(req, { type: 'period.change', action: 'cycle', dates: [] })
    res.json({ success: true })
  })

  // Confirm one long cycle, exclude only its interval, or reopen the decision.
  router.patch('/gaps/:earlierId/:laterId/review', requireOwner, (req, res) => {
    const { reviewState, gapDays } = req.body
    const valid = [null, 'confirmed', 'excluded']
    if (!valid.includes(reviewState ?? null)) return res.status(400).json({ error: 'reviewState must be confirmed, excluded, or null' })

    const earlierId = Number(req.params.earlierId)
    const laterId = Number(req.params.laterId)
    if (!Number.isInteger(earlierId) || !Number.isInteger(laterId)) {
      return res.status(400).json({ error: 'Cycle IDs must be integers' })
    }

    const pair = getCalculationCycleState(db).missingPeriodPairs.find(item =>
      item.earlier.id === earlierId && item.later.id === laterId
    )
    if (!pair) return res.status(400).json({ error: 'No missing-period warning found for this interval' })
    if (!Number.isInteger(gapDays) || gapDays !== pair.gap) {
      return res.status(409).json({ error: 'The cycle interval changed. Refresh and review it again.' })
    }

    if (reviewState === null || reviewState === undefined) {
      db.prepare(`
        DELETE FROM cycle_gap_reviews
        WHERE earlier_cycle_id = ? AND later_cycle_id = ?
      `).run(earlierId, laterId)
    } else {
      db.prepare(`
        INSERT INTO cycle_gap_reviews (
          earlier_cycle_id, later_cycle_id, gap_days, review_state, updated_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(earlier_cycle_id, later_cycle_id) DO UPDATE SET
          gap_days = excluded.gap_days,
          review_state = excluded.review_state,
          updated_at = CURRENT_TIMESTAMP
      `).run(earlierId, laterId, gapDays, reviewState)
    }

    recomputeAllPredictions(db)
    emitActivity(req, {
      type: 'period.change',
      action: 'cycle',
      dates: [pair.earlier.start_date, pair.later.start_date]
    })
    res.json({ success: true })
  })

  // Set or clear ovulation date for a cycle
  router.patch('/:id/ovulation', requireOwner, (req, res) => {
    const { ovulation_date } = req.body
    db.prepare('UPDATE cycles SET ovulation_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ovulation_date ?? null, req.params.id)
    recomputeAllPredictions(db)
    emitActivity(req, { type: 'period.change', action: 'cycle', dates: [] })
    res.json({ success: true })
  })

  // Delete a cycle (also removes all cycle_days and their symptoms)
  router.delete('/:id', requireOwner, (req, res) => {
    const id = Number(req.params.id)
    const cycle = db.prepare('SELECT start_date FROM cycles WHERE id = ?').get(id)

    const days = db.prepare('SELECT id FROM cycle_days WHERE cycle_id = ?').all(id)
    if (days.length > 0) {
      const placeholders = days.map(() => '?').join(',')
      db.prepare(`DELETE FROM symptoms WHERE cycle_day_id IN (${placeholders})`).run(...days.map(d => d.id))
    }
    db.prepare('DELETE FROM cycle_days WHERE cycle_id = ?').run(id)
    db.prepare('DELETE FROM cycles WHERE id = ?').run(id)
    if (cycle) logPeriodEvent(db, { entity: 'cycle', entity_id: id, action: 'delete', cycle_id: id, date: cycle.start_date })
    recomputeAllPredictions(db)
    emitActivity(req, { type: 'period.change', action: 'cycle', dates: cycle ? [cycle.start_date] : [] })
    res.json({ success: true })
  })

  return router
}

module.exports = createCyclesRouter
module.exports.resolveConfirmationCycleId = resolveConfirmationCycleId
