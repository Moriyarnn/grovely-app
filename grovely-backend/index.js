const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const envMap = {
  development: '.env.dev',
  staging: '.env.uat',
  production: '.env'
}
const envFile = envMap[process.env.NODE_ENV] || '.env'
require('dotenv').config({ path: path.resolve(__dirname, envFile) })


const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use((req, _res, next) => { req.db = db; next() })

// Database setup
const dbPath = path.join(__dirname, 'data', 'wifey.db')
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true })
const db = new Database(dbPath)

// Run migrations
const runMigrations = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      filename  TEXT NOT NULL UNIQUE,
      run_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const migrationsPath = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsPath).sort()

  for (const file of files) {
    const alreadyRun = db.prepare('SELECT id FROM migrations WHERE filename = ?').get(file)
    if (alreadyRun) continue

    const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8')
    db.exec(sql)
    db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file)
    console.log(`✅ Migration run: ${file}`)
  }

  console.log('✅ All migrations up to date')
}

runMigrations()

const { recomputeAllPredictions } = require('./routes/period/_calcHelpers')
recomputeAllPredictions(db)

// JWT secret — load from env, otherwise auto-generate and persist to data/secret.key
const secretKeyPath = path.join(__dirname, 'data', 'secret.key')
let jwtSecret = process.env.JWT_SECRET || ''
if (!jwtSecret) {
  if (fs.existsSync(secretKeyPath)) {
    jwtSecret = fs.readFileSync(secretKeyPath, 'utf8').trim()
  } else {
    jwtSecret = crypto.randomBytes(48).toString('hex')
    fs.writeFileSync(secretKeyPath, jwtSecret, { mode: 0o600 })
    console.log('✅ Generated JWT secret and saved to data/secret.key')
  }
}
process.env.JWT_SECRET = jwtSecret

// Seed users from env on startup — only inserts if not already present
const PLACEHOLDER_VALUES = new Set(['your_username', 'partner_username', 'change_me'])
const seedUsers = () => {
  const pairs = [
    { username: process.env.OWNER1_USERNAME, password: process.env.OWNER1_PASSWORD, role: 'owner1' },
    { username: process.env.OWNER2_USERNAME, password: process.env.OWNER2_PASSWORD, role: 'owner2' },
  ]
  for (const { username, password, role } of pairs) {
    if (!username || !password) continue
    if (PLACEHOLDER_VALUES.has(username) || PLACEHOLDER_VALUES.has(password)) {
      console.log(`⚠️  Skipped seeding ${role} — edit your .env to replace the placeholder credentials`)
      continue
    }
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) continue
    const password_hash = bcrypt.hashSync(password, 10)
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, password_hash, role)
    console.log(`✅ Seeded user: ${username} (${role})`)
  }
}

seedUsers()

// Encrypt any pre-existing plaintext private notes at rest (idempotent —
// already-encrypted rows are skipped). See utils/encryption.js.
const { encryptExistingRows } = require('./utils/encryption')
const encryptedCount = encryptExistingRows(db)
if (encryptedCount > 0) console.log(`🔒 Encrypted ${encryptedCount} existing private note(s) at rest`)

// Auth
const { requireAuth } = require('./middleware/auth')
const authRouter = require('./routes/auth')(db)
app.use('/api/auth', authRouter)

// Routes
const cyclesRouter = require('./routes/period/cycles')(db)
const cycleDaysRouter = require('./routes/period/cycle_days')(db)
const calculationsRouter = require('./routes/period/calculations')(db)
const gapDaysRouter = require('./routes/period/gap_days')(db)

app.use('/api/period/cycles', requireAuth, cyclesRouter)
app.use('/api/period/cycle-days', requireAuth, cycleDaysRouter)
app.use('/api/period/calculations', requireAuth, calculationsRouter)
app.use('/api/period/gap-days', requireAuth, gapDaysRouter)

// Pantry
const pantryListRouter    = require('./routes/pantry/list')(db)
const pantryItemsRouter   = require('./routes/pantry/pantry')(db)
const pantryCatalogRouter = require('./routes/pantry/catalog')(db)
app.use('/api/pantry/list',    requireAuth, pantryListRouter)
app.use('/api/pantry/catalog', requireAuth, pantryCatalogRouter)
app.use('/api/pantry',         requireAuth, pantryItemsRouter)

// Backup / restore
const backupRouter = require('./routes/backup')(db)
app.use('/api/backup', requireAuth, backupRouter)

// Settings
const settingsRouter = require('./routes/settings')(db)
app.use('/api/settings', requireAuth, settingsRouter)

// User preferences
const preferencesRouter = require('./routes/preferences')(db)
app.use('/api/preferences', requireAuth, preferencesRouter)

const { requireLicense, licensePayload } = require('./middleware/license')
const premiumRouter = require('./routes/premium/index')
app.use('/api/premium', requireAuth, requireLicense, premiumRouter)

app.get('/api/license/status', requireAuth, (_req, res) => {
  res.json({ active: !!licensePayload })
})

app.get('/api/license/active', (_req, res) => {
  res.json({ active: !!licensePayload })
})

// Logs dashboard — all active log tables, newest first, paginated
app.get('/api/logs', requireAuth, (req, res) => {
  const LIMIT = 200
  const offset = Math.max(0, parseInt(req.query.offset) || 0)
  res.json({
    offset,
    system_errors: db.prepare('SELECT * FROM log_system_errors ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset),
    notification_runs: db.prepare('SELECT * FROM log_system_notification_runs ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset),
    notification_sends: db.prepare('SELECT * FROM log_system_notification_sends ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset),
    backups: db.prepare('SELECT * FROM log_system_backups ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset),
    period_events: db.prepare('SELECT * FROM log_period_events ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset),
    period_calculations: db.prepare('SELECT * FROM log_period_calculations ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset)
  })
})

// Instance stats
app.get('/api/instance', requireAuth, (_req, res) => {
  const stat = fs.statSync(dbPath)
  const dbSizeMB = parseFloat((stat.size / 1024 / 1024).toFixed(2))
  const first = db.prepare('SELECT run_at FROM migrations ORDER BY run_at ASC LIMIT 1').get()
  let daysRunning = null
  if (first) {
    const d0 = new Date(first.run_at); d0.setHours(0, 0, 0, 0)
    const now = new Date(); now.setHours(0, 0, 0, 0)
    daysRunning = Math.floor((now - d0) / 86400000)
  }
  res.json({ daysRunning, dbSizeMB })
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'grovely backend is running!' })
})

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  console.log('Grovely is ready - open the frontend in your browser (default: http://localhost:5173)')

  // Start notification cron — runs daily at 08:00 and catches up on startup if missed
  const { startNotifications } = require('./notifications')
  startNotifications(db)

  // Start scheduled backup cron — premium; no-op if no license or disabled in settings
  const { startBackups } = require('./backups')
  startBackups(db)
})
