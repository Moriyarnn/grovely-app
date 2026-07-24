/**
 * Scheduled Automatic Backups (premium feature — issue #136)
 *
 * Architecture:
 *   - runBackup(db, trigger) writes a snapshot to disk, prunes old ones, logs the run.
 *   - startBackups(db) schedules the daily cron (time from backup_schedule_time setting)
 *     AND runs a catch-up on startup if the cron didn't fire today (computer was off).
 *   - rescheduleBackups(db) rebuilds the cron from the current backup_schedule_time setting;
 *     call this whenever backup_schedule_time or backup_schedule_enabled is updated via PATCH.
 *   - Snapshot helpers (buildSnapshot, EXCLUDED_TABLES, etc.) are also consumed by
 *     routes/backup.js for the free on-demand `/api/backup/export` download. The JSON
 *     shape is identical between manual and scheduled — a snapshot written by the cron
 *     can be downloaded and fed straight into `/api/backup/restore`.
 *
 * Phase A: local snapshot + retention only. Phase B adds remote push (S3 / WebDAV).
 */

const fs = require('fs')
const path = require('path')
const cron = require('node-cron')
const { logSystemError } = require('../logger')
const { licensePayload } = require('../middleware/license')
const { encryptExistingRows } = require('../utils/encryption')
const { pushToRemotes, getConfiguredTargets, describeTargets, diagnoseTargets, listTarget, downloadFromTarget } = require('./remote')

// ---------------------------------------------------------------------------
// Snapshot building (shared with routes/backup.js)
// ---------------------------------------------------------------------------

const MIN_COMPATIBLE_SCHEMA = 8

// Tables that must never appear in a backup — credentials, system state, derived data, logs.
// Everything else discovered in sqlite_master is included automatically.
const EXCLUDED_TABLES = new Set([
  'users',
  'migrations',
  'sqlite_sequence',
  'cycle_predictions',
  'push_subscriptions',
  'log_system_errors',
  'log_system_notification_runs',
  'log_system_notification_sends',
  'log_system_backups',
  'log_system_backup_destinations',
  'log_period_events',
  'log_period_calculations',
])

let appVersion = 'unknown'
try { appVersion = require('../package.json').version } catch {}

function getSchemaVersion (db) {
  return db.prepare('SELECT COUNT(*) as n FROM migrations').get().n
}

function getBackupTables (db) {
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(r => r.name).filter(n => !EXCLUDED_TABLES.has(n))
}

/**
 * Build the in-memory snapshot object (meta + data). Pure — no disk I/O.
 * Returns { snapshot, table_count, row_count }.
 */
function buildSnapshot (db) {
  const tables = getBackupTables(db)
  const data = {}
  let row_count = 0

  for (const table of tables) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table}`).all()
      data[table] = rows
      row_count += rows.length
    } catch {
      data[table] = []
    }
  }

  const snapshot = {
    meta: {
      app_version: appVersion,
      schema_version: getSchemaVersion(db),
      min_compatible_schema: MIN_COMPATIBLE_SCHEMA,
      created_at: new Date().toISOString(),
    },
    data,
  }

  return { snapshot, table_count: tables.length, row_count }
}

// ---------------------------------------------------------------------------
// On-disk snapshot + retention
// ---------------------------------------------------------------------------

/**
 * Resolve the backup directory.
 *   - BACKUP_DIR env var overrides (absolute path; self-hosters who mount a separate
 *     volume for off-site sync).
 *   - Default lives inside the existing data volume so no compose change is required.
 */
function getBackupDir () {
  const fromEnv = process.env.BACKUP_DIR
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return path.join(__dirname, '..', 'data', 'backups')
}

/**
 * Write a snapshot to disk. Creates the directory if needed.
 * Filename: grovely-backup-YYYY-MM-DDTHH-MM-SS-sssZ.json (ISO-safe, sortable).
 */
function writeSnapshotToDisk (db) {
  const dir = getBackupDir()
  fs.mkdirSync(dir, { recursive: true })

  const { snapshot, table_count, row_count } = buildSnapshot(db)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file_path = path.join(dir, `grovely-backup-${stamp}.json`)
  const json = JSON.stringify(snapshot)
  fs.writeFileSync(file_path, json)
  const size_bytes = Buffer.byteLength(json, 'utf8')

  return { file_path, size_bytes, table_count, row_count }
}

// A pre-update snapshot is intentionally separate from scheduled backups: it
// must remain available while an update is being assessed, and it must not use
// premium remote destinations. The JSON shape remains identical to every other
// Grovely backup, so the existing restore flow can import it if recovery is
// needed.
function getPreUpdateBackupDir () {
  return path.join(__dirname, '..', 'data', 'pre-update-snapshots')
}

function writePreUpdateSnapshotToDisk (db) {
  const dir = getPreUpdateBackupDir()
  fs.mkdirSync(dir, { recursive: true })

  const { snapshot, table_count, row_count } = buildSnapshot(db)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file_path = path.join(dir, `pre-update-${stamp}.json`)
  const json = JSON.stringify(snapshot)
  fs.writeFileSync(file_path, json)
  return { file_path, size_bytes: Buffer.byteLength(json, 'utf8'), table_count, row_count }
}

function runPreUpdateBackup (db) {
  const start = Date.now()
  try {
    const written = writePreUpdateSnapshotToDisk(db)
    const duration_ms = Date.now() - start
    db.prepare(`
      INSERT INTO log_system_backups
        (trigger, status, file_path, size_bytes, duration_ms, table_count, row_count)
      VALUES ('pre_update', 'ok', ?, ?, ?, ?, ?)
    `).run(written.file_path, written.size_bytes, duration_ms, written.table_count, written.row_count)
    return { status: 'ok', ...written, duration_ms }
  } catch (err) {
    const error = err?.message || String(err)
    db.prepare(`
      INSERT INTO log_system_backups (trigger, status, duration_ms, error_message)
      VALUES ('pre_update', 'error', ?, ?)
    `).run(Date.now() - start, error)
    return { status: 'error', error }
  }
}

/**
 * Keep only the most recent N snapshots in the backup directory. Older files are removed.
 * Filenames sort lexicographically thanks to the ISO timestamp.
 */
function pruneOldSnapshots (keep) {
  const dir = getBackupDir()
  if (!fs.existsSync(dir)) return 0

  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('grovely-backup-') && f.endsWith('.json'))
    .sort()

  const toRemove = files.slice(0, Math.max(0, files.length - keep))
  for (const f of toRemove) {
    try { fs.unlinkSync(path.join(dir, f)) } catch {}
  }
  return toRemove.length
}

// ---------------------------------------------------------------------------
// Run + logging
// ---------------------------------------------------------------------------

function getSetting (db, key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row?.value ?? fallback
}

/**
 * Execute one backup run end-to-end: write snapshot, prune retention, push to any
 * configured remotes, log the result.
 *
 * `trigger` is one of 'scheduled' | 'startup_catchup' | 'manual'.
 * Never throws — local failure short-circuits before remote push; remote failure
 * is captured into per-destination log rows and does not affect the local snapshot's success.
 * Returns a Promise so callers can await the full pipeline if they need to.
 */
async function runBackup (db, trigger = 'scheduled') {
  const start = Date.now()
  const retentionRaw = parseInt(getSetting(db, 'backup_retention_count', '7'), 10)
  const retention = Number.isFinite(retentionRaw) ? retentionRaw : 7

  let written = null
  let localStatus = 'error'
  let localError = null

  try {
    written = writeSnapshotToDisk(db)
    if (retention > 0) pruneOldSnapshots(retention)
    localStatus = 'ok'
  } catch (err) {
    localError = err?.message || String(err)
    logSystemError(db, { source: 'backup', message: localError, stack: err?.stack ?? null })
  }

  // Remote push — only if local write succeeded; each remote is independent.
  const enabledTargets = []
  if (getSetting(db, 'backup_dest_s3_enabled',     '1') === '1') enabledTargets.push('s3')
  if (getSetting(db, 'backup_dest_webdav_enabled', '1') === '1') enabledTargets.push('webdav')
  const remoteDestinations = localStatus === 'ok'
    ? await pushToRemotes(written.file_path, { enabledTargets })
    : []

  const duration_ms = Date.now() - start

  // Insert run header row.
  const runRow = db.prepare(`
    INSERT INTO log_system_backups
      (trigger, status, file_path, size_bytes, duration_ms, table_count, row_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    trigger, localStatus,
    written?.file_path  ?? null,
    written?.size_bytes ?? null,
    duration_ms,
    written?.table_count ?? null,
    written?.row_count   ?? null,
  )
  const run_id = runRow.lastInsertRowid

  // Insert one row per destination (local first, then each remote).
  const insertDest = db.prepare(
    'INSERT INTO log_system_backup_destinations (run_id, destination, status, error) VALUES (?, ?, ?, ?)'
  )
  insertDest.run(run_id, 'local', localStatus, localError)
  for (const d of remoteDestinations) {
    insertDest.run(run_id, d.destination, d.status, d.error ?? null)
  }

  if (localStatus === 'ok') {
    const remoteErrors = remoteDestinations.filter(d => d.status === 'error')
    const remoteTag = remoteDestinations.length === 0
      ? 'no remote'
      : remoteErrors.length === 0
        ? 'ok'
        : `errors: ${remoteErrors.map(d => d.destination).join(', ')}`
    console.log(`💾 Backup ok — trigger=${trigger} file=${path.basename(written.file_path)} size=${written.size_bytes}B rows=${written.row_count} duration=${duration_ms}ms remote=${remoteTag}`)
    for (const d of remoteErrors) console.warn(`⚠️  Backup remote issue [${d.destination}] — ${d.error}`)
    return {
      status: 'ok', ...written, duration_ms,
      destinations: [{ destination: 'local', status: 'ok', error: null }, ...remoteDestinations],
    }
  } else {
    console.error(`💾 Backup failed — trigger=${trigger} duration=${duration_ms}ms error=${localError}`)
    return {
      status: 'error', error: localError, duration_ms,
      destinations: [{ destination: 'local', status: 'error', error: localError }],
    }
  }
}

// ---------------------------------------------------------------------------
// Cron scheduling
// ---------------------------------------------------------------------------

let _cronJob = null

// Parses HH:MM → cron expression. Falls back to 03:00 on invalid input.
function buildCronExpr (timeStr, db) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr ?? '')
  if (match) {
    const h = parseInt(match[1], 10)
    const m = parseInt(match[2], 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${m} ${h} * * *`
  }
  if (timeStr !== undefined && timeStr !== null) {
    logSystemError(db, { source: 'backup', message: `Invalid backup_schedule_time "${timeStr}" — falling back to 03:00`, stack: '' })
    console.warn(`⚠️  Invalid backup_schedule_time "${timeStr}" — falling back to 03:00`)
  }
  return '0 3 * * *'
}

function isEnabled (db) {
  return getSetting(db, 'backup_schedule_enabled', '0') === '1'
}

/**
 * Rebuild the cron from current settings. Safe to call repeatedly.
 * Stops the existing job, starts a new one if scheduling is enabled and licensed.
 */
function rescheduleBackups (db) {
  if (_cronJob) {
    _cronJob.stop()
    _cronJob = null
  }

  if (!licensePayload) {
    console.log('💾 Scheduled backups: no license — cron not started')
    return
  }
  if (!isEnabled(db)) {
    console.log('💾 Scheduled backups: disabled in settings — cron not started')
    return
  }

  const expr = buildCronExpr(getSetting(db, 'backup_schedule_time', '03:00'), db)
  _cronJob = cron.schedule(expr, () => {
    runBackup(db, 'scheduled').catch(err => console.error('Scheduled backup failed:', err))
  })
  console.log(`💾 Backup cron scheduled: ${expr}`)
}

/**
 * Call once on startup. Schedules the cron and, if a backup hasn't been written today
 * (computer was off at cron time), runs a catch-up immediately.
 */
function startBackups (db) {
  if (!licensePayload) {
    console.log('💾 Scheduled backups: no license — feature disabled')
    return
  }
  if (!isEnabled(db)) {
    console.log('💾 Scheduled backups: disabled in settings — feature dormant')
    return
  }

  // Catch-up check: did we already write a snapshot today?
  const today = new Date().toISOString().split('T')[0]
  const ranToday = db.prepare(
    "SELECT id FROM log_system_backups WHERE status = 'ok' AND date(logged_at) = ? LIMIT 1"
  ).get(today)

  if (!ranToday) {
    console.log('💾 Startup catch-up: no successful backup yet today — running now')
    setImmediate(() => {
      runBackup(db, 'startup_catchup').catch(err => console.error('Startup backup failed:', err))
    })
  } else {
    console.log('✅ Backup already ran today — skipping startup catch-up')
  }

  const expr = buildCronExpr(getSetting(db, 'backup_schedule_time', '03:00'), db)
  _cronJob = cron.schedule(expr, () => {
    runBackup(db, 'scheduled').catch(err => console.error('Scheduled backup failed:', err))
  })
  console.log(`💾 Backup cron scheduled: ${expr}`)
}

// ---------------------------------------------------------------------------
// Restore from snapshot — shared by manual upload restore (routes/backup.js)
// and "restore from stored backup" in the premium backups panel.
//
// Saves a pre-restore snapshot, validates schema compatibility, then clears
// and re-populates each backup table inside a transaction. FK constraints are
// disabled for the duration so tables can be repopulated in any order.
// ---------------------------------------------------------------------------

const PRE_RESTORE_DIR  = path.join(__dirname, '..', 'data', 'pre-restore-snapshots')
const PRE_RESTORE_KEEP = 5

function savePreRestoreSnapshot (db) {
  fs.mkdirSync(PRE_RESTORE_DIR, { recursive: true })
  const { snapshot } = buildSnapshot(db)
  const filename = `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  fs.writeFileSync(path.join(PRE_RESTORE_DIR, filename), JSON.stringify(snapshot))
  const files = fs.readdirSync(PRE_RESTORE_DIR)
    .filter(f => f.startsWith('pre-restore-') && f.endsWith('.json'))
    .sort()
  for (const old of files.slice(0, -PRE_RESTORE_KEEP)) {
    try { fs.unlinkSync(path.join(PRE_RESTORE_DIR, old)) } catch {}
  }
}

function getTableColumns (db, table) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
  } catch {
    return null
  }
}

function restoreFromSnapshot (db, backup, { recompute } = {}) {
  if (!backup?.meta || !backup?.data) {
    return { status: 400, error: 'Invalid backup file - missing meta or data.' }
  }
  const { schema_version, min_compatible_schema } = backup.meta
  if (typeof schema_version !== 'number' || typeof min_compatible_schema !== 'number') {
    return { status: 400, error: 'Invalid backup file - meta fields must be numbers.' }
  }

  const currentSchema = getSchemaVersion(db)

  if (currentSchema < min_compatible_schema) {
    return { status: 422, error: `This backup requires app schema version ${min_compatible_schema} or higher. Your app is at version ${currentSchema}. Update your app before restoring.` }
  }
  if (schema_version < MIN_COMPATIBLE_SCHEMA) {
    return { status: 422, error: `This backup is too old (schema version ${schema_version}). The minimum supported version is ${MIN_COMPATIBLE_SCHEMA}.` }
  }

  const warnings = []
  if (schema_version > currentSchema) {
    warnings.push(`Backup was made on a newer version of the app (schema v${schema_version}, your app is v${currentSchema}). Some fields may have been skipped.`)
  }

  try { savePreRestoreSnapshot(db) } catch {}

  db.pragma('foreign_keys = OFF')
  try {
    db.transaction(() => {
      const tables = getBackupTables(db)
      for (const table of tables) {
        db.prepare(`DELETE FROM ${table}`).run()
      }
      for (const table of tables) {
        const rows = backup.data[table]
        if (!Array.isArray(rows) || rows.length === 0) continue
        const currentColumns = getTableColumns(db, table)
        if (!currentColumns) {
          warnings.push(`Table "${table}" not found in your app - skipped.`)
          continue
        }
        for (const row of rows) {
          const cols = Object.keys(row).filter(k => currentColumns.includes(k))
          if (cols.length === 0) continue
          const placeholders = cols.map(() => '?').join(', ')
          db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(cols.map(c => row[c]))
        }
      }
    })()
  } catch (err) {
    db.pragma('foreign_keys = ON')
    return { status: 500, error: `Restore failed: ${err.message}` }
  }
  db.pragma('foreign_keys = ON')

  // An older backup may hold plaintext private fields — encrypt them at rest now
  // so the partner can't read them from a freshly re-exported backup.
  try { encryptExistingRows(db) } catch {}

  if (recompute) {
    try { recompute(db) } catch {}
  }

  return { status: 200, success: true, warnings }
}

module.exports = {
  // Lifecycle
  startBackups,
  rescheduleBackups,
  runBackup,
  runPreUpdateBackup,
  // Snapshot helpers (shared with routes/backup.js)
  MIN_COMPATIBLE_SCHEMA,
  EXCLUDED_TABLES,
  getSchemaVersion,
  getBackupTables,
  buildSnapshot,
  restoreFromSnapshot,
  // Disk helpers (for Phase C admin endpoints)
  getBackupDir,
  writeSnapshotToDisk,
  getPreUpdateBackupDir,
  writePreUpdateSnapshotToDisk,
  pruneOldSnapshots,
  // Remote target introspection (for Phase C status panel)
  getConfiguredTargets,
  describeTargets,
  diagnoseTargets,
  // Live listing and download — protocol-agnostic, target-name-driven
  listTarget,
  downloadFromTarget,
}
