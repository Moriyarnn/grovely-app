const express = require('express')
const router = express.Router()
const { rescheduleNotifications } = require('../notifications')
const { rescheduleBackups } = require('../backups')

const OWNER_ONLY_KEYS = new Set([
  'partner_can_read_notes',
])

module.exports = (db) => {
  router.get('/email-status', (req, res) => {
    const smtp     = !!(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASSWORD)
    const account1 = !!process.env.ACCOUNT1_EMAIL
    const account2 = !!process.env.ACCOUNT2_EMAIL
    res.json({ smtp, account1, account2, configured: smtp && account1 })
  })

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all()
    const settings = {}
    rows.forEach(r => { settings[r.key] = r.value })
    settings.server_timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    res.json(settings)
  })

  router.patch('/:key', (req, res) => {
    const { value } = req.body
    if (value === undefined) return res.status(400).json({ error: 'value is required' })
    if (OWNER_ONLY_KEYS.has(req.params.key) && req.user?.role !== 'owner1') {
      return res.status(403).json({ error: 'Owner access required' })
    }
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP')
      .run(req.params.key, String(value))
    if (req.params.key === 'notification_time') {
      rescheduleNotifications(db)
    }
    if (req.params.key === 'backup_schedule_time' || req.params.key === 'backup_schedule_enabled') {
      rescheduleBackups(db)
    }
    res.json({ success: true })
  })

  return router
}
