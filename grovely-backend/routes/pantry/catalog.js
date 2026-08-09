const express = require('express')
const router = express.Router()

module.exports = (db) => {
  // GET /api/pantry/catalog/search?q=
  // Free tier: returns name, category + last_added_at only. Limit 30.
  // Empty q returns top 30 most recently added (for on-focus dropdown).
  // Non-empty q returns prefix + substring matches ordered by recency.
  router.get('/search', (req, res) => {
    const q = (req.query.q ?? '').trim()

    if (!q) {
      const rows = db.prepare(`
        SELECT id, name, category, last_added_at
        FROM pantry_item_catalog
        ORDER BY last_added_at DESC
        LIMIT 30
      `).all()
      return res.json(rows)
    }

    // Prefix matches first, then broader substring matches, deduped, limit 30
    const rows = db.prepare(`
      SELECT id, name, category, last_added_at
      FROM pantry_item_catalog
      WHERE name LIKE ? ESCAPE '\\'
      ORDER BY
        CASE WHEN name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
        last_added_at DESC
      LIMIT 30
    `).all(`%${q}%`, `${q}%`)

    res.json(rows)
  })

  return router
}
