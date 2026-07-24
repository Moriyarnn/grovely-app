const test = require('node:test')
const assert = require('node:assert/strict')

const bcrypt = require('bcryptjs')
const Database = require('better-sqlite3')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'grovely-test-secret'
delete process.env.LICENSE_KEY

const { requireAuth } = require('../middleware/auth')
const { requireLicense } = require('../middleware/license')

function createTestDatabase() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL
    );
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  )
  insertUser.run('owner', bcrypt.hashSync('owner-password', 4), 'owner1')
  insertUser.run('partner', bcrypt.hashSync('partner-password', 4), 'owner2')
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('pantry_currency', 'USD')
  return db
}

async function startTestApp() {
  const db = createTestDatabase()
  const app = express()
  app.use(express.json())
  app.use('/api/auth', require('../routes/auth')(db))
  app.use('/api/settings', requireAuth, require('../routes/settings')(db))
  app.get('/api/premium/check', requireAuth, requireLicense, (_req, res) => {
    res.json({ active: true })
  })

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
  })
  const address = server.address()
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    db,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        db.close()
        if (error) reject(error)
        else resolve()
      })
    }),
  }
}

function tokenFor(id, username, role) {
  return jwt.sign({ id, username, role }, process.env.JWT_SECRET, { expiresIn: '5m' })
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(baseUrl + path, options)
  const body = await response.json()
  return { response, body }
}

let app

test.before(async () => {
  app = await startTestApp()
})

test.after(async () => {
  await app.close()
})

test('settings reject unauthenticated requests', async () => {
  const { response, body } = await request(app.baseUrl, '/api/settings')
  assert.equal(response.status, 401)
  assert.equal(body.error, 'Unauthorized')
})

test('owner can update and retrieve a setting', async () => {
  const token = tokenFor(1, 'owner', 'owner1')

  const update = await request(app.baseUrl, '/api/settings/pantry_currency', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value: 'CLP' }),
  })
  assert.equal(update.response.status, 200)
  assert.equal(update.body.success, true)

  const read = await request(app.baseUrl, '/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(read.response.status, 200)
  assert.equal(read.body.pantry_currency, 'CLP')
})

test('partner cannot update an owner-only setting', async () => {
  const token = tokenFor(2, 'partner', 'owner2')

  const { response, body } = await request(
    app.baseUrl,
    '/api/settings/partner_can_read_notes',
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: 'true' }),
    }
  )
  assert.equal(response.status, 403)
  assert.equal(body.error, 'Owner access required')
})

test('login issues a token accepted by the authenticated profile route', async () => {
  const login = await request(app.baseUrl, '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'owner-password' }),
  })
  assert.equal(login.response.status, 200)
  assert.equal(login.body.role, 'owner1')
  assert.ok(login.body.token)

  const profile = await request(app.baseUrl, '/api/auth/me', {
    headers: { Authorization: `Bearer ${login.body.token}` },
  })
  assert.equal(profile.response.status, 200)
  assert.equal(profile.body.username, 'owner')
  assert.equal(profile.body.role, 'owner1')
})

test('premium route returns payment required without a license', async () => {
  const token = tokenFor(1, 'owner', 'owner1')

  const { response, body } = await request(app.baseUrl, '/api/premium/check', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(response.status, 402)
  assert.equal(body.error, 'license_required')
})
