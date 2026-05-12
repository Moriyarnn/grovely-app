const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '50mb' }))

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
const seedUsers = () => {
  const pairs = [
    { username: process.env.OWNER_USERNAME, password: process.env.OWNER_PASSWORD, role: 'owner' },
    { username: process.env.PARTNER_USERNAME, password: process.env.PARTNER_PASSWORD, role: 'partner' },
  ]
  for (const { username, password, role } of pairs) {
    if (!username || !password) continue
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) continue
    const password_hash = bcrypt.hashSync(password, 10)
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, password_hash, role)
    console.log(`✅ Seeded user: ${username} (${role})`)
  }
}

seedUsers()

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
const pantryListRouter = require('./routes/pantry/list')(db)
const pantryItemsRouter = require('./routes/pantry/pantry')(db)
app.use('/api/pantry/list', requireAuth, pantryListRouter)
app.use('/api/pantry', requireAuth, pantryItemsRouter)

// Backup / restore
const backupRouter = require('./routes/backup')(db)
app.use('/api/backup', requireAuth, backupRouter)

// Settings
const settingsRouter = require('./routes/settings')(db)
app.use('/api/settings', requireAuth, settingsRouter)

// User preferences
const preferencesRouter = require('./routes/preferences')(db)
app.use('/api/preferences', requireAuth, preferencesRouter)

// Logs dashboard — all active log tables, newest first, paginated
app.get('/api/logs', requireAuth, (req, res) => {
  const LIMIT = 200
  const offset = Math.max(0, parseInt(req.query.offset) || 0)
  res.json({
    offset,
    system_errors: db.prepare('SELECT * FROM log_system_errors ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset),
    notification_runs: db.prepare('SELECT * FROM log_system_notification_runs ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset),
    notification_sends: db.prepare('SELECT * FROM log_system_notification_sends ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset),
    period_events: db.prepare('SELECT * FROM log_period_events ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset),
    period_calculations: db.prepare('SELECT * FROM log_period_calculations ORDER BY logged_at DESC LIMIT ? OFFSET ?').all(LIMIT, offset)
  })
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'wifey app backend is running!' })
})

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)

  // Start notification cron — runs daily at 08:00 and catches up on startup if missed
  const { startNotifications } = require('./notifications')
  startNotifications(db)
})