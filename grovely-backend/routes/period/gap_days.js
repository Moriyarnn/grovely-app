const express = require('express')
const router = express.Router()
const { requireOwner } = require('../../middleware/auth')

module.exports = (db) => {
  // Get all gap day logs for the authenticated user
  router.get('/', (req, res) => {
    const rows = db.prepare(`
      SELECT g.*, GROUP_CONCAT(s.symptom) as symptoms
      FROM gap_day_logs g
      LEFT JOIN gap_day_symptoms s ON s.gap_day_id = g.id
      WHERE g.user_id = ?
      GROUP BY g.id
      ORDER BY g.date ASC
    `).all(req.user.id)
    res.json(rows)
  })

  // Create a gap day log
  router.post('/', requireOwner, (req, res) => {
    const { date, notes, symptoms } = req.body
    if (!date) return res.status(400).json({ error: 'date is required' })

    const result = db.prepare(`
      INSERT INTO gap_day_logs (user_id, date, notes) VALUES (?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET notes = excluded.notes, updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, date, notes || null)

    const id = result.lastInsertRowid || db.prepare(
      'SELECT id FROM gap_day_logs WHERE user_id = ? AND date = ?'
    ).get(req.user.id, date)?.id

    if (symptoms && symptoms.length > 0) {
      db.prepare('DELETE FROM gap_day_symptoms WHERE gap_day_id = ?').run(id)
      const ins = db.prepare('INSERT INTO gap_day_symptoms (gap_day_id, symptom) VALUES (?, ?)')
      symptoms.forEach(s => ins.run(id, s))
    }

    res.json({ id, date })
  })

  // Update a gap day log
  router.patch('/:id', requireOwner, (req, res) => {
    const id = Number(req.params.id)
    const row = db.prepare('SELECT id FROM gap_day_logs WHERE id = ? AND user_id = ?').get(id, req.user.id)
    if (!row) return res.status(404).json({ error: 'Not found' })

    const { notes, symptoms } = req.body
    db.prepare('UPDATE gap_day_logs SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(notes || null, id)

    if (symptoms !== undefined) {
      db.prepare('DELETE FROM gap_day_symptoms WHERE gap_day_id = ?').run(id)
      if (symptoms.length > 0) {
        const ins = db.prepare('INSERT INTO gap_day_symptoms (gap_day_id, symptom) VALUES (?, ?)')
        symptoms.forEach(s => ins.run(id, s))
      }
    }

    res.json({ success: true })
  })

  // Delete a gap day log
  router.delete('/:id', requireOwner, (req, res) => {
    const id = Number(req.params.id)
    const row = db.prepare('SELECT id FROM gap_day_logs WHERE id = ? AND user_id = ?').get(id, req.user.id)
    if (!row) return res.status(404).json({ error: 'Not found' })

    db.prepare('DELETE FROM gap_day_symptoms WHERE gap_day_id = ?').run(id)
    db.prepare('DELETE FROM gap_day_logs WHERE id = ?').run(id)
    res.json({ success: true })
  })

  return router
}
