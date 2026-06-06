/**
 * Premium backup routes (issue #136, Phase C).
 *
 * Mounted under /api/premium/backups — requireAuth + requireLicense are already
 * applied at the /api/premium prefix in grovely-backend/index.js. Nothing here
 * needs to re-check the license.
 *
 *   GET  /status                   — schedule + last/next + configured remote targets
 *   GET  /history                  — paginated rows from log_system_backups (newest first)
 *   POST /run-now                  — fire a one-off backup synchronously, return the result row
 *   POST /verify/:id               — re-read the snapshot at row.file_path, parse JSON, count tables/rows
 *   GET  /available/:target        — live list of files actually present in a destination
 *                                    target: 'local' | 's3' | 'webdav' (extensible to 's3:archive' etc.)
 *   POST /restore-remote           — download from a remote target and restore; body: { target, remote_key }
 *   GET  /download-remote          — stream a remote file as an attachment; query: target, key
 */

const fs   = require('fs')
const path = require('path')
const express = require('express')
const router  = express.Router()

const { runBackup, getConfiguredTargets, describeTargets, diagnoseTargets, restoreFromSnapshot, MIN_COMPATIBLE_SCHEMA, getBackupDir, listTarget, downloadFromTarget } = require('../../backups')
const { recomputeAllPredictions } = require('../period/_calcHelpers')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSetting (db, key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row?.value ?? fallback
}

// Attaches a `destinations` array to each run row by subquerying
// log_system_backup_destinations. Falls back to [] for old rows that
// predate the per-destination log table.
function attachDestinations (db, rows) {
  if (!rows || rows.length === 0) return rows
  const ids = rows.map(r => r.id)
  const placeholders = ids.map(() => '?').join(',')
  const destRows = db.prepare(
    `SELECT run_id, destination, status, error FROM log_system_backup_destinations WHERE run_id IN (${placeholders}) ORDER BY id ASC`
  ).all(...ids)
  const byRunId = {}
  for (const d of destRows) {
    if (!byRunId[d.run_id]) byRunId[d.run_id] = []
    byRunId[d.run_id].push({ destination: d.destination, status: d.status, error: d.error })
  }
  return rows.map(r => ({ ...r, destinations: byRunId[r.id] ?? [] }))
}

const RUN_COLUMNS = 'id, trigger, status, file_path, size_bytes, duration_ms, table_count, row_count, logged_at'

// Given an HH:MM string, return the next ISO timestamp for that wall-clock time.
// Today if it hasn't passed yet, otherwise tomorrow.
function computeNextRun (timeStr) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr || '03:00')
  const h = match ? parseInt(match[1], 10) : 3
  const m = match ? parseInt(match[2], 10) : 0
  const next = new Date()
  next.setHours(h, m, 0, 0)
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
  return next.toISOString()
}

// ---------------------------------------------------------------------------
// GET /api/premium/backups/status
// ---------------------------------------------------------------------------

router.get('/status', (req, res) => {
  const db = req.db
  try {
    const enabled   = getSetting(db, 'backup_schedule_enabled', '0') === '1'
    const time      = getSetting(db, 'backup_schedule_time', '03:00')
    const retentionRaw = parseInt(getSetting(db, 'backup_retention_count', '7'), 10)
    const retention = Number.isFinite(retentionRaw) ? retentionRaw : 7

    const last_run_raw = db.prepare(
      `SELECT ${RUN_COLUMNS} FROM log_system_backups ORDER BY id DESC LIMIT 1`
    ).get() ?? null
    const last_run = last_run_raw ? attachDestinations(db, [last_run_raw])[0] : null

    // Per-destination diagnosis + user enable toggles. Frontend joins this with
    // the history rows to compute the per-pill green/red state.
    const diagnosis = diagnoseTargets()
    const destinations = {
      s3: {
        config_state: diagnosis.s3.state,
        missing:      diagnosis.s3.missing,
        enabled:      getSetting(db, 'backup_dest_s3_enabled',     '1') === '1',
      },
      webdav: {
        config_state: diagnosis.webdav.state,
        missing:      diagnosis.webdav.missing,
        enabled:      getSetting(db, 'backup_dest_webdav_enabled', '1') === '1',
      },
    }

    res.json({
      enabled,
      time,
      retention,
      last_run,
      next_run: enabled ? computeNextRun(time) : null,
      targets: describeTargets(),
      configured_target_names: getConfiguredTargets(),
      destinations,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/premium/backups/history?offset=0&limit=20
// ---------------------------------------------------------------------------

router.get('/history', (req, res) => {
  const db     = req.db
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0)
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20))
  try {
    const raw = db.prepare(
      `SELECT ${RUN_COLUMNS} FROM log_system_backups ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(limit, offset)
    const rows = attachDestinations(db, raw)
    const total = db.prepare('SELECT COUNT(*) as n FROM log_system_backups').get().n
    res.json({ rows, offset, limit, total })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/premium/backups/run-now
// ---------------------------------------------------------------------------

router.post('/run-now', async (req, res) => {
  const db = req.db
  try {
    const result = await runBackup(db, 'manual')
    // Return the row we just inserted so the UI can refresh without a second round-trip.
    const raw = db.prepare(
      `SELECT ${RUN_COLUMNS} FROM log_system_backups ORDER BY id DESC LIMIT 1`
    ).get()
    const [row] = attachDestinations(db, raw ? [raw] : [])
    res.json({ ok: result.status === 'ok', result, row })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/premium/backups/verify/:id
//
// Re-reads the snapshot file referenced by a log row and reports whether it
// parses and what's inside. Doesn't touch the database — purely a "can I trust
// this file?" check the user can run from the UI.
// ---------------------------------------------------------------------------

router.post('/verify/:id', (req, res) => {
  const db = req.db
  const id = parseInt(req.params.id, 10)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' })

  const row = db.prepare('SELECT id, file_path, status FROM log_system_backups WHERE id = ?').get(id)
  if (!row)            return res.status(404).json({ error: 'Backup log row not found' })
  if (!row.file_path)  return res.json({ readable: false, error: 'No local file recorded for this run' })
  if (!fs.existsSync(row.file_path)) {
    return res.json({ readable: false, error: 'File no longer on disk (pruned by retention?)', file_path: row.file_path })
  }

  try {
    const raw = fs.readFileSync(row.file_path, 'utf8')
    const parsed = JSON.parse(raw)
    const data = parsed?.data ?? {}
    const table_names = Object.keys(data)
    const row_count = table_names.reduce((acc, t) => acc + (Array.isArray(data[t]) ? data[t].length : 0), 0)

    res.json({
      readable: true,
      file_path: row.file_path,
      size_bytes: Buffer.byteLength(raw, 'utf8'),
      table_count: table_names.length,
      row_count,
      app_version:    parsed?.meta?.app_version    ?? null,
      schema_version: parsed?.meta?.schema_version ?? null,
      min_compatible_schema: parsed?.meta?.min_compatible_schema ?? MIN_COMPATIBLE_SCHEMA,
      created_at:     parsed?.meta?.created_at     ?? null,
    })
  } catch (err) {
    res.json({ readable: false, error: err.message, file_path: row.file_path })
  }
})

// ---------------------------------------------------------------------------
// GET /api/premium/backups/:id/download
//
// Streams the snapshot JSON file referenced by a log row as a downloadable
// attachment. Only local file paths are served — remote-only rows (no
// file_path) return 404.
// ---------------------------------------------------------------------------

router.get('/:id/download', (req, res) => {
  const db = req.db
  const id = parseInt(req.params.id, 10)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' })

  const row = db.prepare('SELECT id, file_path, logged_at FROM log_system_backups WHERE id = ?').get(id)
  if (!row)           return res.status(404).json({ error: 'Backup not found' })
  if (!row.file_path) return res.status(404).json({ error: 'No local file recorded for this run' })
  if (!fs.existsSync(row.file_path)) {
    return res.status(404).json({ error: 'File no longer on disk (pruned by retention?)' })
  }

  const filename = `grovely-backup-${(row.logged_at || '').slice(0, 10) || 'snapshot'}-${id}.json`
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Type', 'application/json')
  fs.createReadStream(row.file_path).pipe(res)
})

// ---------------------------------------------------------------------------
// POST /api/premium/backups/:id/restore
//
// Reads the snapshot at row.file_path and runs it through restoreFromSnapshot.
// A pre-restore safety snapshot is written automatically by the shared helper
// so the previous state can be recovered manually if needed.
// ---------------------------------------------------------------------------

router.post('/:id/restore', (req, res) => {
  const db = req.db
  const id = parseInt(req.params.id, 10)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' })

  const row = db.prepare('SELECT id, file_path, status FROM log_system_backups WHERE id = ?').get(id)
  if (!row)           return res.status(404).json({ error: 'Backup not found' })
  if (!row.file_path) return res.status(404).json({ error: 'No local file recorded for this run' })
  if (!fs.existsSync(row.file_path)) {
    return res.status(404).json({ error: 'File no longer on disk (pruned by retention?)' })
  }

  let snapshot
  try {
    snapshot = JSON.parse(fs.readFileSync(row.file_path, 'utf8'))
  } catch (err) {
    return res.status(422).json({ error: `Snapshot is not readable: ${err.message}` })
  }

  const result = restoreFromSnapshot(db, snapshot, { recompute: recomputeAllPredictions })
  if (!result.success) return res.status(result.status).json({ error: result.error })
  res.json({ success: true, warnings: result.warnings, restored_from: row.id })
})

// ---------------------------------------------------------------------------
// GET /api/premium/backups/available/:target
//
// Returns what is actually present in the destination right now — not history.
// For 'local': scans the backup directory and checks each file exists.
// For remote targets: calls listTarget() which hits the live S3/WebDAV API.
// History rows are joined by filename to attach metadata (row_count, trigger, etc.)
// where available, but a file is only included if it physically exists.
// ---------------------------------------------------------------------------

router.get('/available/:target', async (req, res) => {
  const db     = req.db
  const target = req.params.target

  if (!['local', 's3', 'webdav'].includes(target) && !target.startsWith('s3:') && !target.startsWith('webdav:')) {
    return res.status(400).json({ error: `Unknown target '${target}'` })
  }

  // History rows keyed by filename for fast metadata join.
  const historyRows = db.prepare(
    `SELECT ${RUN_COLUMNS} FROM log_system_backups WHERE status = 'ok' ORDER BY id DESC`
  ).all()
  const byFilename = {}
  for (const row of historyRows) {
    if (row.file_path) {
      const fname = path.basename(row.file_path)
      if (!byFilename[fname]) byFilename[fname] = row
    }
  }

  try {
    if (target === 'local') {
      const dir = getBackupDir()
      if (!fs.existsSync(dir)) return res.json([])
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('grovely-backup-') && f.endsWith('.json'))
        .sort().reverse()
      const result = files.map(filename => {
        const file_path = path.join(dir, filename)
        const stat      = fs.statSync(file_path)
        const hist      = byFilename[filename] ?? null
        return {
          source:      'local',
          history_id:  hist?.id        ?? null,
          file_path,
          remote_key:  null,
          filename,
          size_bytes:  stat.size,
          logged_at:   hist?.logged_at ?? stat.mtime.toISOString(),
          row_count:   hist?.row_count  ?? null,
          table_count: hist?.table_count ?? null,
          trigger:     hist?.trigger    ?? null,
        }
      })
      return res.json(result)
    }

    // Remote target - call the live listing API.
    const items = await listTarget(target)
    if (items === null) return res.status(400).json({ error: `Target '${target}' is not configured` })

    const result = items.map(item => {
      const hist = byFilename[item.filename] ?? null
      return {
        source:      target,
        history_id:  hist?.id         ?? null,
        file_path:   null,
        remote_key:  item.remote_key,
        filename:    item.filename,
        size_bytes:  item.size_bytes  ?? hist?.size_bytes  ?? null,
        logged_at:   item.last_modified ?? hist?.logged_at ?? null,
        row_count:   hist?.row_count  ?? null,
        table_count: hist?.table_count ?? null,
        trigger:     hist?.trigger    ?? null,
      }
    })
    return res.json(result)

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/premium/backups/restore-remote
//
// Downloads a backup file from a named remote target and restores from it.
// Body: { target, remote_key }
// ---------------------------------------------------------------------------

router.post('/restore-remote', async (req, res) => {
  const db         = req.db
  const { target, remote_key } = req.body ?? {}

  if (!target || !remote_key) {
    return res.status(400).json({ error: 'target and remote_key are required' })
  }

  let content
  try {
    content = await downloadFromTarget(target, remote_key)
  } catch (err) {
    return res.status(502).json({ error: `Failed to download from ${target}: ${err.message}` })
  }

  let snapshot
  try {
    snapshot = JSON.parse(content.toString('utf8'))
  } catch (err) {
    return res.status(422).json({ error: `Downloaded file is not valid JSON: ${err.message}` })
  }

  const result = restoreFromSnapshot(db, snapshot, { recompute: recomputeAllPredictions })
  if (!result.success) return res.status(result.status).json({ error: result.error })
  res.json({ success: true, warnings: result.warnings })
})

// ---------------------------------------------------------------------------
// GET /api/premium/backups/download-remote?target=s3&key=backups%2Ffile.json
//
// Streams a backup file from a named remote target as a downloadable attachment.
// ---------------------------------------------------------------------------

router.get('/download-remote', async (req, res) => {
  const { target, key } = req.query

  if (!target || !key) {
    return res.status(400).json({ error: 'target and key query params are required' })
  }

  let content
  try {
    content = await downloadFromTarget(target, key)
  } catch (err) {
    return res.status(502).json({ error: `Failed to download from ${target}: ${err.message}` })
  }

  const filename = path.basename(key) || 'grovely-backup.json'
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Type', 'application/json')
  res.send(content)
})

module.exports = router
