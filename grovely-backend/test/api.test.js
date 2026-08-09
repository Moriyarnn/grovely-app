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
    CREATE TABLE shopping_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity TEXT,
      category TEXT DEFAULT 'other',
      added_by INTEGER,
      checked INTEGER DEFAULT 0,
      checked_at TEXT,
      price REAL,
      notes TEXT,
      amount REAL,
      unit TEXT,
      density REAL,
      density_unit TEXT,
      pieces INTEGER,
      store TEXT
    );
    CREATE TABLE pantry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity TEXT,
      category TEXT DEFAULT 'other',
      bought_date TEXT,
      expiry_date TEXT,
      opened_date TEXT,
      notes TEXT,
      price REAL,
      amount REAL,
      unit TEXT,
      density REAL,
      density_unit TEXT,
      pieces INTEGER,
      status TEXT DEFAULT 'active',
      deleted_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE pantry_item_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      category TEXT NOT NULL DEFAULT 'other',
      amount REAL,
      unit TEXT,
      density REAL,
      density_unit TEXT,
      pieces INTEGER,
      price REAL,
      store TEXT,
      use_count INTEGER NOT NULL DEFAULT 1,
      last_added_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE pantry_purchase_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_id INTEGER,
      name TEXT NOT NULL,
      amount REAL,
      unit TEXT,
      density REAL,
      density_unit TEXT,
      pieces INTEGER,
      price REAL,
      store TEXT,
      pantry_item_id INTEGER,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  app.use('/api/pantry/list', requireAuth, require('../routes/pantry/list')(db))
  app.use('/api/pantry/catalog', requireAuth, require('../routes/pantry/catalog')(db))
  app.use('/api/pantry', requireAuth, require('../routes/pantry/pantry')(db))
  app.use('/api/test-premium', (req, _res, next) => { req.db = db; next() }, require('../routes/premium'))
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

test('shopping-list categories become the global autocomplete preference for an item name', async () => {
  const token = tokenFor(1, 'owner', 'owner1')
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  app.db.prepare(`
    INSERT INTO pantry_item_catalog (name, category, last_added_at)
    VALUES ('Milk', 'other', datetime('now'))
  `).run()
  app.db.prepare(`
    INSERT INTO pantry_purchase_history (name, amount, unit, price, store)
    VALUES ('Milk', 1000, 'ml', 3.5, 'Local market')
  `).run()

  const add = await request(app.baseUrl, '/api/pantry/list', {
    method: 'POST', headers, body: JSON.stringify({ name: 'milk', category: 'dairy' }),
  })
  assert.equal(add.response.status, 201)
  assert.equal(add.body.category, 'dairy')

  const freeSearch = await request(app.baseUrl, '/api/pantry/catalog/search?q=milk', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(freeSearch.response.status, 200)
  assert.equal(freeSearch.body[0].category, 'dairy')

  const premiumSearch = await request(app.baseUrl, '/api/test-premium/pantry/catalog/search?q=milk')
  assert.equal(premiumSearch.response.status, 200)
  assert.equal(premiumSearch.body[0].category, 'dairy')

  app.db.prepare(`
    INSERT INTO pantry_purchase_history (name, amount, unit, price, store, added_at)
    VALUES ('Milk', 1000, 'ml', 3, 'Other market', datetime('now', '+1 second'))
  `).run()
  const crossStoreSearch = await request(app.baseUrl, '/api/test-premium/pantry/catalog/search?q=milk')
  const localMarket = crossStoreSearch.body.find(row => row.store === 'Local market')
  assert.equal(localMarket.lowest_recent_price, 3)
  assert.equal(localMarket.lowest_recent_store, 'Other market')
  assert.equal(localMarket.recent_store_count, 2)

  const update = await request(app.baseUrl, `/api/pantry/list/${add.body.id}`, {
    method: 'PATCH', headers, body: JSON.stringify({ category: 'produce' }),
  })
  assert.equal(update.response.status, 200)

  const afterEdit = await request(app.baseUrl, '/api/pantry/catalog/search?q=milk', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(afterEdit.body[0].category, 'produce')
})
