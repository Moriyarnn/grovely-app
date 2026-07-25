const express = require('express')
const { emitActivity } = require('../realtime')
const updater = require('../utils/updateService')

function diagnostic (event, details = {}) {
  console.log(`[system-update] ${new Date().toISOString()} ${event} ${JSON.stringify(details)}`)
}

function appVersion () {
  return require('../package.json').version
}

module.exports = (db) => {
  const router = express.Router()

  router.get('/', async (_req, res) => {
    const service = await updater.getStatus()
    diagnostic('status_requested', { available: service.available, updating: service.updating, has_error: Boolean(service.error) })
    res.json({
      current_version: appVersion(),
      checks_enabled: process.env.UPDATE_CHECK_ENABLED !== 'false',
      check_interval_hours: Math.max(1, Number(process.env.UPDATE_CHECK_INTERVAL_HOURS || 24)),
      ...service,
    })
  })

  router.post('/check', async (_req, res) => {
    const service = await updater.checkNow()
    diagnostic('check_requested', { available: service.available, has_error: Boolean(service.error) })
    if (service.error) return res.status(service.available ? 502 : 503).json(service)
    res.json({ current_version: appVersion(), ...service })
  })

  router.post('/install', async (req, res) => {
    diagnostic('install_requested')
    const service = await updater.installNow()
    if (service.error) {
      diagnostic('install_rejected', { available: service.available, has_error: true })
      return res.status(service.available ? 502 : 503).json(service)
    }
    emitActivity(req, { type: 'system.update', silent: true })
    diagnostic('install_accepted')
    res.status(202).json(service)
  })

  // This endpoint is only reachable inside Docker through the updater's token.
  // It creates a free, local recovery snapshot before any automated update.
  router.post('/internal/pre-update-snapshot', (req, res) => {
    const token = updater.getToken()
    if (!token || req.get('X-Grovely-Updater-Token') !== token) {
      diagnostic('snapshot_rejected', { reason: 'unauthorized' })
      return res.status(401).json({ error: 'Unauthorized updater request.' })
    }
    try {
      const { runPreUpdateBackup } = require('../backups')
      const snapshot = runPreUpdateBackup(db)
      if (snapshot.status !== 'ok') throw new Error(snapshot.error || 'Snapshot failed.')
      diagnostic('snapshot_succeeded', { created_at: new Date().toISOString() })
      res.json({ ok: true, file: snapshot.file_path, created_at: new Date().toISOString() })
    } catch (err) {
      diagnostic('snapshot_failed', { error: String(err.message || err).slice(0, 1200) })
      res.status(500).json({ error: `Could not create pre-update snapshot: ${err.message}` })
    }
  })

  return router
}
