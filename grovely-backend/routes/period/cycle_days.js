const express = require('express')
const router = express.Router()
const { logPeriodEvent } = require('../../logger')
const { requireOwner } = require('../../middleware/auth')
const { recomputeAllPredictions } = require('./_calcHelpers')
const { encrypt, revealPrivateFields, partnerSettingEnabled } = require('../../utils/encryption')
const { emitActivity } = require('../../realtime')

module.exports = (db) => {
  // Get all cycle days with cycle info (for calendar population)
  router.get('/all', (req, res) => {
    const days = db.prepare(`
      SELECT cd.*, GROUP_CONCAT(s.symptom) as symptoms,
             c.start_date as cycle_start, c.end_date as cycle_end
      FROM cycle_days cd
      LEFT JOIN symptoms s ON s.cycle_day_id = cd.id
      LEFT JOIN cycles c ON c.id = cd.cycle_id
      GROUP BY cd.id
      ORDER BY cd.date ASC
    `).all()
    res.json(revealPrivateFields(db, req, 'cycle_days', days))
  })

  // Get all days for a cycle
  router.get('/cycle/:cycle_id', (req, res) => {
    const days = db.prepare(`
      SELECT cd.*, GROUP_CONCAT(s.symptom) as symptoms
      FROM cycle_days cd
      LEFT JOIN symptoms s ON s.cycle_day_id = cd.id
      WHERE cd.cycle_id = ?
      GROUP BY cd.id
      ORDER BY cd.date ASC
    `).all(req.params.cycle_id)
    res.json(revealPrivateFields(db, req, 'cycle_days', days))
  })

  // Get a single day
  router.get('/:id', (req, res) => {
    const day = db.prepare(`
      SELECT cd.*, GROUP_CONCAT(s.symptom) as symptoms
      FROM cycle_days cd
      LEFT JOIN symptoms s ON s.cycle_day_id = cd.id
      WHERE cd.id = ?
      GROUP BY cd.id
    `).get(req.params.id)
    if (!day) return res.status(404).json({ error: 'Day not found' })
    res.json(revealPrivateFields(db, req, 'cycle_days', day))
  })

  // Log a day
  router.post('/', requireOwner, (req, res) => {
    const { cycle_id, date, flow_intensity, notes, symptoms } = req.body
    if (!cycle_id || !date) return res.status(400).json({ error: 'cycle_id and date are required' })

    const existingDay = db.prepare(
      'SELECT id, cycle_id, date FROM cycle_days WHERE date = ? ORDER BY id ASC LIMIT 1'
    ).get(date)
    if (existingDay) {
      return res.status(409).json({
        error: 'This day is already logged',
        code: 'CYCLE_DAY_EXISTS',
        date: existingDay.date,
      })
    }

    // Insert the day
    const result = db.prepare(`
      INSERT INTO cycle_days (cycle_id, date, flow_intensity, notes)
      VALUES (?, ?, ?, ?)
    `).run(cycle_id, date, flow_intensity || null, encrypt(notes || null))

    const cycle_day_id = result.lastInsertRowid

    // Insert symptoms if any
    if (symptoms && symptoms.length > 0) {
      const insertSymptom = db.prepare('INSERT INTO symptoms (cycle_day_id, symptom) VALUES (?, ?)')
      symptoms.forEach(symptom => insertSymptom.run(cycle_day_id, symptom))
    }

    // Day-by-day logging advances the end boundary. It must not shrink an
    // imported or range-logged period whose explicit end has no matching rows.
    const latestLoggedDate = db.prepare(
      'SELECT MAX(date) AS date FROM cycle_days WHERE cycle_id = ?'
    ).get(cycle_id).date
    db.prepare(`
      UPDATE cycles SET
        end_date = CASE
          WHEN end_date IS NULL OR end_date < ? THEN ?
          ELSE end_date
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(latestLoggedDate, latestLoggedDate, cycle_id)

    logPeriodEvent(db, { entity: 'cycle_day', entity_id: cycle_day_id, action: 'create', cycle_id, date })
    emitActivity(req, { type: 'period.change', action: 'create', dates: [date] })
    res.json({ id: cycle_day_id, cycle_id, date })
  })

  // Update a day
  router.patch('/:id', requireOwner, (req, res) => {
    const { flow_intensity, notes, symptoms, visibleChange } = req.body
    const id = Number(req.params.id)

    db.prepare(`
      UPDATE cycle_days SET flow_intensity = ?, notes = ? WHERE id = ?
    `).run(flow_intensity || null, encrypt(notes || null), id)

    // Replace symptoms
    if (symptoms) {
      db.prepare('DELETE FROM symptoms WHERE cycle_day_id = ?').run(id)
      const insertSymptom = db.prepare('INSERT INTO symptoms (cycle_day_id, symptom) VALUES (?, ?)')
      symptoms.forEach(symptom => insertSymptom.run(id, symptom))
    }

    const updated = db.prepare('SELECT cycle_id, date FROM cycle_days WHERE id = ?').get(id)
    if (updated) logPeriodEvent(db, { entity: 'cycle_day', entity_id: id, action: 'update', cycle_id: updated.cycle_id, date: updated.date })

    // Live activity: a notes-only edit must not notify the partner when notes are
    // hidden from them - otherwise they get a bubble for a change they cannot see,
    // signalling that private notes were written. The client sends visibleChange
    // (did flow/symptoms change). The partner_can_read_notes setting is checked
    // here (authoritative). Absent flag defaults to notifying (safe). Note CONTENT
    // confidentiality is enforced separately by revealPrivateFields, not here.
    if (visibleChange !== false || partnerSettingEnabled(db, 'partner_can_read_notes')) {
      emitActivity(req, { type: 'period.change', action: 'update', dates: updated ? [updated.date] : [] })
    }

    res.json({ success: true })
  })

  // Delete a day
  router.delete('/:id', requireOwner, (req, res) => {
    const id = Number(req.params.id)
    const day = db.prepare(`
      SELECT cd.cycle_id, cd.date, c.start_date, c.end_date as cycle_end_date, c.review_state
      FROM cycle_days cd
      JOIN cycles c ON c.id = cd.cycle_id
      WHERE cd.id = ?
    `).get(id)
    if (!day) return res.status(404).json({ error: 'Day not found' })
    const outsideCycleRange = day.date < day.start_date || (day.cycle_end_date && day.date > day.cycle_end_date)

    db.prepare('DELETE FROM symptoms WHERE cycle_day_id = ?').run(id)
    db.prepare('DELETE FROM cycle_days WHERE id = ?').run(id)
    logPeriodEvent(db, { entity: 'cycle_day', entity_id: id, action: 'delete', cycle_id: day.cycle_id, date: day.date })

    // Adjust Cycle makes start_date/end_date authoritative. Removing data that
    // was deliberately left outside that range must not resize or delete it.
    if (outsideCycleRange) {
      emitActivity(req, { type: 'period.change', action: 'delete', dates: [day.date] })
      return res.json({ success: true, range_preserved: true })
    }

    // For a multi-day period, deleting an actual edge moves that edge by one
    // day. Remaining orphan rows must never become the new boundary.
    if (day.cycle_end_date && day.start_date < day.cycle_end_date) {
      let boundaryChanged = false
      const reviewState = day.review_state === 'confirmed' ? null : day.review_state
      if (day.date === day.start_date) {
        const nextStart = new Date(day.start_date + 'T00:00:00')
        nextStart.setDate(nextStart.getDate() + 1)
        db.prepare('UPDATE cycles SET start_date = ?, review_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(nextStart.toISOString().split('T')[0], reviewState, day.cycle_id)
        boundaryChanged = true
      } else if (day.date === day.cycle_end_date) {
        const previousEnd = new Date(day.cycle_end_date + 'T00:00:00')
        previousEnd.setDate(previousEnd.getDate() - 1)
        db.prepare('UPDATE cycles SET end_date = ?, review_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(previousEnd.toISOString().split('T')[0], reviewState, day.cycle_id)
        boundaryChanged = true
      }
      if (boundaryChanged) recomputeAllPredictions(db)
      emitActivity(req, { type: 'period.change', action: 'delete', dates: [day.date] })
      return res.json({ success: true, boundary_changed: boundaryChanged })
    }

    // Auto-update end_date to the latest remaining day (NULL if none left)
    db.prepare(`
      UPDATE cycles SET end_date = (SELECT MAX(date) FROM cycle_days WHERE cycle_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(day.cycle_id, day.cycle_id)

    const remaining = db.prepare('SELECT COUNT(*) as cnt FROM cycle_days WHERE cycle_id = ?').get(day.cycle_id)

    if (remaining.cnt === 0) {
      if (day.date === day.start_date && day.cycle_end_date && day.cycle_end_date > day.date) {
        // Deleted the only cycle_day but the cycle range extends beyond — advance start_date by one day.
        // Happens when adjacent days were extended via /end without creating cycle_day rows (retroactive logging).
        const nextDate = new Date(day.date + 'T00:00:00')
        nextDate.setDate(nextDate.getDate() + 1)
        db.prepare('UPDATE cycles SET start_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(nextDate.toISOString().split('T')[0], day.cycle_id)
      } else if (day.cycle_end_date && day.cycle_end_date > day.date) {
        // end_date extended past deleted day — collapse to single-day on original end_date
        db.prepare('UPDATE cycles SET start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(day.cycle_end_date, day.cycle_end_date, day.cycle_id)
      } else if (day.start_date < day.date) {
        // Cycle started before deleted day — collapse to single-day on start_date
        db.prepare('UPDATE cycles SET end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(day.start_date, day.cycle_id)
      } else {
        db.prepare('DELETE FROM cycles WHERE id = ?').run(day.cycle_id)
      }
    } else if (day.date === day.start_date) {
      // Deleted the start day — promote the earliest remaining day as the new cycle start
      const newStart = db.prepare(
        'SELECT date FROM cycle_days WHERE cycle_id = ? ORDER BY date ASC LIMIT 1'
      ).get(day.cycle_id)
      if (newStart) {
        db.prepare('UPDATE cycles SET start_date = ? WHERE id = ?').run(newStart.date, day.cycle_id)
      }
    }

    if (remaining.cnt === 0 || day.date === day.start_date) {
      recomputeAllPredictions(db)
    }
    emitActivity(req, { type: 'period.change', action: 'delete', dates: [day.date] })
    res.json({ success: true })
  })

  return router
}
