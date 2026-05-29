const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { recomputeAllPredictions } = require('./period/_calcHelpers')
const { buildSnapshot, restoreFromSnapshot } = require('../backups')

module.exports = (db) => {
  router.get('/export', requireAuth, (req, res) => {
    const { snapshot } = buildSnapshot(db)
    const filename = `grovely-backup-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/json')
    res.json(snapshot)
  })

  router.post('/restore', requireAuth, (req, res) => {
    const result = restoreFromSnapshot(db, req.body, { recompute: recomputeAllPredictions })
    if (!result.success) return res.status(result.status).json({ error: result.error })
    res.json({ success: true, warnings: result.warnings })
  })

  return router
}
