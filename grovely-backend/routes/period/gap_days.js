const express = require('express')
const router = express.Router()
const { requireOwner } = require('../../middleware/auth')
const { encrypt, revealPrivateFields, partnerSettingEnabled } = require('../../utils/encryption')
const { emitActivity } = require('../../realtime')

module.exports = (db) => {
  // Get all gap day logs. Gap logs belong to the period owner (owner1 is the
  // only role that can create them); the partner gets the same read-only view
  // as the rest of the period calendar, with notes gated by revealPrivateFields.
  router.get('/', (req, res) => {
    const rows = db.prepare(`
      SELECT g.*, GROUP_CONCAT(s.symptom) as symptoms
      FROM gap_day_logs g
      LEFT JOIN gap_day_symptoms s ON s.gap_day_id = g.id
      GROUP BY g.id
      ORDER BY g.date ASC
    `).all()
    res.json(revealPrivateFields(db, req, 'gap_day_logs', rows))
  })

  // Create a gap day log
  router.post('/', requireOwner, (req, res) => {
    const { date, notes, symptoms, visibleChange } = req.body
    if (!date) return res.status(400).json({ error: 'date is required' })

    const result = db.prepare(`
      INSERT INTO gap_day_logs (user_id, date, notes) VALUES (?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET notes = excluded.notes, updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, date, encrypt(notes || null))

    const id = result.lastInsertRowid || db.prepare(
      'SELECT id FROM gap_day_logs WHERE user_id = ? AND date = ?'
    ).get(req.user.id, date)?.id

    if (symptoms && symptoms.length > 0) {
      db.prepare('DELETE FROM gap_day_symptoms WHERE gap_day_id = ?').run(id)
      const ins = db.prepare('INSERT INTO gap_day_symptoms (gap_day_id, symptom) VALUES (?, ?)')
      symptoms.forEach(s => ins.run(id, s))
    }

    // See cycle_days PATCH: suppress notes-only changes when notes are hidden
    // from the partner. visibleChange = did symptoms change (gap days have no flow).
    if (visibleChange !== false || partnerSettingEnabled(db, 'partner_can_read_notes')) {
      emitActivity(req, { type: 'period.change', action: 'create', dates: [date] })
    }
    res.json({ id, date })
  })

  // Update a gap day log
  router.patch('/:id', requireOwner, (req, res) => {
    const id = Number(req.params.id)
    const row = db.prepare('SELECT id FROM gap_day_logs WHERE id = ? AND user_id = ?').get(id, req.user.id)
    if (!row) return res.status(404).json({ error: 'Not found' })

    const { notes, symptoms, visibleChange } = req.body
    const existing = db.prepare('SELECT date FROM gap_day_logs WHERE id = ?').get(id)
    db.prepare('UPDATE gap_day_logs SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(encrypt(notes || null), id)

    if (symptoms !== undefined) {
      db.prepare('DELETE FROM gap_day_symptoms WHERE gap_day_id = ?').run(id)
      if (symptoms.length > 0) {
        const ins = db.prepare('INSERT INTO gap_day_symptoms (gap_day_id, symptom) VALUES (?, ?)')
        symptoms.forEach(s => ins.run(id, s))
      }
    }

    // Suppress notes-only edits when notes are hidden from the partner (symptoms
    // are the only partner-visible gap-day field; the marker already exists).
    if (visibleChange !== false || partnerSettingEnabled(db, 'partner_can_read_notes')) {
      emitActivity(req, { type: 'period.change', action: 'update', dates: existing ? [existing.date] : [] })
    }
    res.json({ success: true })
  })

  // Delete a gap day log
  router.delete('/:id', requireOwner, (req, res) => {
    const id = Number(req.params.id)
    const row = db.prepare('SELECT id, date FROM gap_day_logs WHERE id = ? AND user_id = ?').get(id, req.user.id)
    if (!row) return res.status(404).json({ error: 'Not found' })

    db.prepare('DELETE FROM gap_day_symptoms WHERE gap_day_id = ?').run(id)
    db.prepare('DELETE FROM gap_day_logs WHERE id = ?').run(id)
    // Deleting removes the visible gap-day marker for the partner - always notify.
    emitActivity(req, { type: 'period.change', action: 'delete', dates: [row.date] })
    res.json({ success: true })
  })

  return router
}
