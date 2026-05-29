const express = require('express')
const router = express.Router()

module.exports = (db) => {
  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM user_preferences WHERE user_id = ?').all(req.user.id)
    const prefs = {}
    rows.forEach(r => { prefs[r.key] = r.value })
    res.json(prefs)
  })

  router.patch('/:key', (req, res) => {
    const { value } = req.body
    if (value === undefined) return res.status(400).json({ error: 'value is required' })
    db.prepare(`
      INSERT INTO user_preferences (user_id, key, value, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(req.user.id, req.params.key, String(value))
    res.json({ success: true })
  })

  return router
}
