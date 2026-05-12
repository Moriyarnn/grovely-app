const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const { requireAuth } = require('../middleware/auth')
const { recomputeAllPredictions } = require('./period/_calcHelpers')

const PRE_RESTORE_DIR = path.join(__dirname, '../data/pre-restore-snapshots')
const PRE_RESTORE_KEEP = 5

function savePreRestoreSnapshot(db) {
  fs.mkdirSync(PRE_RESTORE_DIR, { recursive: true })

  const data = {}
  for (const table of getBackupTables(db)) {
    try { data[table] = db.prepare(`SELECT * FROM ${table}`).all() } catch { data[table] = [] }
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

  const filename = `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  fs.writeFileSync(path.join(PRE_RESTORE_DIR, filename), JSON.stringify(snapshot))

  // Prune oldest beyond keep limit
  const files = fs.readdirSync(PRE_RESTORE_DIR)
    .filter(f => f.startsWith('pre-restore-') && f.endsWith('.json'))
    .sort()
  for (const old of files.slice(0, -PRE_RESTORE_KEEP)) {
    try { fs.unlinkSync(path.join(PRE_RESTORE_DIR, old)) } catch {}
  }
}

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
  'log_period_events',
  'log_period_calculations',
])

function getBackupTables(db) {
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(r => r.name).filter(n => !EXCLUDED_TABLES.has(n))
}

let appVersion = 'unknown'
try { appVersion = require('../package.json').version } catch {}

function getSchemaVersion(db) {
  return db.prepare('SELECT COUNT(*) as n FROM migrations').get().n
}

function getTableColumns(db, table) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
  } catch {
    return null
  }
}

module.exports = (db) => {
  router.get('/export', requireAuth, (req, res) => {
    const schemaVersion = getSchemaVersion(db)

    const data = {}
    for (const table of getBackupTables(db)) {
      try {
        data[table] = db.prepare(`SELECT * FROM ${table}`).all()
      } catch {
        data[table] = []
      }
    }

    const backup = {
      meta: {
        app_version: appVersion,
        schema_version: schemaVersion,
        min_compatible_schema: MIN_COMPATIBLE_SCHEMA,
        created_at: new Date().toISOString(),
      },
      data,
    }

    const filename = `wifey-backup-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/json')
    res.json(backup)
  })

  router.post('/restore', requireAuth, (req, res) => {
    const backup = req.body

    if (!backup?.meta || !backup?.data) {
      return res.status(400).json({ error: 'Invalid backup file — missing meta or data.' })
    }

    const { schema_version, min_compatible_schema } = backup.meta

    if (typeof schema_version !== 'number' || typeof min_compatible_schema !== 'number') {
      return res.status(400).json({ error: 'Invalid backup file — meta fields must be numbers.' })
    }

    const currentSchema = getSchemaVersion(db)

    if (currentSchema < min_compatible_schema) {
      return res.status(422).json({
        error: `This backup requires app schema version ${min_compatible_schema} or higher. Your app is at version ${currentSchema}. Update your app before restoring.`,
      })
    }

    if (schema_version < MIN_COMPATIBLE_SCHEMA) {
      return res.status(422).json({
        error: `This backup is too old (schema version ${schema_version}). The minimum supported version is ${MIN_COMPATIBLE_SCHEMA}.`,
      })
    }

    const warnings = []
    if (schema_version > currentSchema) {
      warnings.push(`Backup was made on a newer version of the app (schema v${schema_version}, your app is v${currentSchema}). Some fields may have been skipped.`)
    }

    try { savePreRestoreSnapshot(db) } catch {}

    // FK constraints are enabled by migration 007 for the lifetime of the connection.
    // Disable them for the restore so we can clear and re-populate tables in any order.
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
            warnings.push(`Table "${table}" not found in your app — skipped.`)
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
      return res.status(500).json({ error: `Restore failed: ${err.message}` })
    }
    db.pragma('foreign_keys = ON')

    try { recomputeAllPredictions(db) } catch {}

    res.json({ success: true, warnings })
  })

  return router
}
