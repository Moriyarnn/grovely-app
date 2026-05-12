const express = require('express')
const router = express.Router()
const { rescheduleNotifications } = require('../notifications')

const OWNER_ONLY_KEYS = new Set([
  'partner_can_read_notes',
])

module.exports = (db) => {
  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all()
    const settings = {}
    rows.forEach(r => { settings[r.key] = r.value })
    res.json(settings)
  })

  router.patch('/:key', (req, res) => {
    const { value } = req.body
    if (value === undefined) return res.status(400).json({ error: 'value is required' })
    if (OWNER_ONLY_KEYS.has(req.params.key) && req.user?.role !== 'owner') {
      return res.status(403).json({ error: 'Owner access required' })
    }
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP')
      .run(req.params.key, String(value))
    if (req.params.key === 'notification_time') {
      rescheduleNotifications(db)
    }
    res.json({ success: true })
  })

  return router
}
