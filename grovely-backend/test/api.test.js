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
const { getCalculationCycleState } = require('../routes/period/_calcHelpers')

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
    CREATE TABLE cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      predicted_start_date TEXT,
      ovulation_date TEXT,
      predicted_fertile_start TEXT,
      predicted_fertile_end TEXT,
      predicted_ovulation_date TEXT,
      review_state TEXT,
      updated_at TEXT
    );
    CREATE TABLE cycle_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      flow_intensity TEXT,
      notes TEXT
    );
    CREATE TABLE symptoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_day_id INTEGER NOT NULL,
      symptom TEXT NOT NULL
    );
    CREATE TABLE log_period_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      cycle_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      logged_at TEXT DEFAULT CURRENT_TIMESTAMP
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
  app.use('/api/test-premium', (req, _res, next) => {
    req.db = db
    req.user = { id: 1, username: 'owner', role: 'owner1' }
    next()
  }, require('../routes/premium'))
  app.use('/api/test-period/cycle-days', (req, _res, next) => {
    req.db = db
    req.user = { id: 1, username: 'owner', role: 'owner1' }
    next()
  }, require('../routes/period/cycle_days')(db))
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

test('premium cycle adjustment reopens confirmed warnings and preserves exclusions', async () => {
  app.db.prepare('DELETE FROM symptoms').run()
  app.db.prepare('DELETE FROM cycle_days').run()
  app.db.prepare('DELETE FROM cycles').run()
  const insert = app.db.prepare(`
    INSERT INTO cycles (
      id, start_date, end_date, predicted_fertile_start, predicted_fertile_end,
      predicted_ovulation_date, review_state
    ) VALUES (@id, @start_date, @end_date, @predicted_fertile_start, @predicted_fertile_end,
      @predicted_ovulation_date, @review_state)
  `)
  const forecast = {
    predicted_fertile_start: '2026-01-10',
    predicted_fertile_end: '2026-01-16',
    predicted_ovulation_date: '2026-01-15',
  }
  insert.run({ id: 1, start_date: '2026-01-20', end_date: '2026-01-24', review_state: null, ...forecast })
  insert.run({ id: 2, start_date: '2026-02-15', end_date: '2026-02-18', review_state: 'confirmed', ...forecast })
  insert.run({ id: 3, start_date: '2026-03-01', end_date: '2026-03-05', review_state: 'excluded', ...forecast })
  insert.run({ id: 4, start_date: '2026-04-01', end_date: '2026-04-05', review_state: 'confirmed', ...forecast })

  const confirmedAdjustment = await request(app.baseUrl, '/api/test-premium/period/cycles/2/adjust', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_date: '2026-02-09' }),
  })
  assert.equal(confirmedAdjustment.response.status, 200)
  assert.deepEqual(
    app.db.prepare('SELECT review_state, predicted_fertile_start FROM cycles WHERE id = 2').get(),
    { review_state: null, predicted_fertile_start: null }
  )
  assert.equal(app.db.prepare('SELECT predicted_fertile_start FROM cycles WHERE id = 1').get().predicted_fertile_start, null)
  assert.deepEqual(getCalculationCycleState(app.db).shortPairs.map(pair => [pair.earlier.id, pair.later.id]), [[1, 2]])

  const excludedAdjustment = await request(app.baseUrl, '/api/test-premium/period/cycles/3/adjust', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ end_date: '2026-03-06' }),
  })
  assert.equal(excludedAdjustment.response.status, 200)
  assert.equal(app.db.prepare('SELECT review_state FROM cycles WHERE id = 3').get().review_state, 'excluded')

  const longAdjustment = await request(app.baseUrl, '/api/test-premium/period/cycles/4/adjust', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ end_date: '2026-04-12' }),
  })
  assert.equal(longAdjustment.response.status, 200)
  assert.deepEqual(getCalculationCycleState(app.db).unresolvedLongCycles.map(cycle => cycle.id), [4])

  app.db.prepare("UPDATE cycles SET review_state = 'confirmed' WHERE id = 4").run()
  const unchangedAdjustment = await request(app.baseUrl, '/api/test-premium/period/cycles/4/adjust', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ end_date: '2026-04-12' }),
  })
  assert.equal(unchangedAdjustment.response.status, 200)
  assert.equal(app.db.prepare('SELECT review_state FROM cycles WHERE id = 4').get().review_state, 'confirmed')
})

test('adjust cycle keeps explicit boundaries authoritative and deletes orphan data without resizing', async () => {
  app.db.prepare('DELETE FROM symptoms').run()
  app.db.prepare('DELETE FROM cycle_days').run()
  app.db.prepare('DELETE FROM cycles').run()
  app.db.prepare(`
    INSERT INTO cycles (id, start_date, end_date, review_state)
    VALUES (10, '2026-07-12', '2026-07-31', 'confirmed'),
           (20, '2026-08-02', '2026-08-03', NULL),
           (30, '2026-09-02', '2026-09-03', 'confirmed')
  `).run()
  const insertDay = app.db.prepare(`
    INSERT INTO cycle_days (id, cycle_id, date, flow_intensity, notes)
    VALUES (@id, @cycle_id, @date, @flow_intensity, @notes)
  `)
  ;[
    { id: 101, cycle_id: 10, date: '2026-07-12', flow_intensity: null, notes: null },
    { id: 102, cycle_id: 10, date: '2026-07-16', flow_intensity: null, notes: null },
    { id: 103, cycle_id: 10, date: '2026-07-17', flow_intensity: 'spotting', notes: null },
    { id: 104, cycle_id: 10, date: '2026-07-31', flow_intensity: 'medium', notes: null },
    { id: 201, cycle_id: 20, date: '2026-08-02', flow_intensity: 'light', notes: null },
    { id: 202, cycle_id: 20, date: '2026-08-04', flow_intensity: 'spotting', notes: null },
    { id: 203, cycle_id: 20, date: '2026-08-06', flow_intensity: 'spotting', notes: null },
    { id: 301, cycle_id: 30, date: '2026-09-02', flow_intensity: 'light', notes: null },
    { id: 302, cycle_id: 30, date: '2026-09-03', flow_intensity: 'medium', notes: null },
    { id: 303, cycle_id: 30, date: '2026-09-06', flow_intensity: 'spotting', notes: null },
  ].forEach(day => insertDay.run(day))
  app.db.prepare("INSERT INTO symptoms (cycle_day_id, symptom) VALUES (102, 'Cramps')").run()

  const shrink = await request(app.baseUrl, '/api/test-premium/period/cycles/10/adjust', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_date: '2026-07-18' }),
  })
  assert.equal(shrink.response.status, 200)
  assert.equal(shrink.body.removed_empty_days, 1)
  assert.deepEqual(
    app.db.prepare('SELECT start_date, end_date, review_state FROM cycles WHERE id = 10').get(),
    { start_date: '2026-07-18', end_date: '2026-07-31', review_state: null }
  )
  assert.deepEqual(
    app.db.prepare('SELECT id FROM cycle_days WHERE cycle_id = 10 ORDER BY id').all().map(day => day.id),
    [102, 103, 104]
  )

  const crossedHandles = await request(app.baseUrl, '/api/test-premium/period/cycles/10/adjust', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ end_date: '2026-07-17' }),
  })
  assert.equal(crossedHandles.response.status, 400)
  assert.deepEqual(
    app.db.prepare('SELECT start_date, end_date FROM cycles WHERE id = 10').get(),
    { start_date: '2026-07-18', end_date: '2026-07-31' }
  )
  assert.deepEqual(
    app.db.prepare('SELECT id FROM cycle_days WHERE cycle_id = 10 ORDER BY id').all().map(day => day.id),
    [102, 103, 104]
  )

  const extend = await request(app.baseUrl, '/api/test-premium/period/cycles/10/adjust', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ end_date: '2026-08-01' }),
  })
  assert.equal(extend.response.status, 200)
  assert.deepEqual(
    app.db.prepare('SELECT start_date, end_date FROM cycles WHERE id = 10').get(),
    { start_date: '2026-07-18', end_date: '2026-08-01' }
  )

  const overlappingExtension = await request(app.baseUrl, '/api/test-premium/period/cycles/10/adjust', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ end_date: '2026-08-02' }),
  })
  assert.equal(overlappingExtension.response.status, 409)
  assert.deepEqual(
    app.db.prepare('SELECT start_date, end_date FROM cycles WHERE id = 10').get(),
    { start_date: '2026-07-18', end_date: '2026-08-01' }
  )
  assert.deepEqual(
    app.db.prepare('SELECT id FROM cycle_days WHERE cycle_id = 10 ORDER BY id').all().map(day => day.id),
    [102, 103, 104]
  )

  const deleteOutsideEnd = await request(app.baseUrl, '/api/test-period/cycle-days/203', { method: 'DELETE' })
  assert.equal(deleteOutsideEnd.response.status, 200)
  assert.equal(deleteOutsideEnd.body.range_preserved, true)
  assert.deepEqual(
    app.db.prepare('SELECT start_date, end_date FROM cycles WHERE id = 20').get(),
    { start_date: '2026-08-02', end_date: '2026-08-03' }
  )
  assert.deepEqual(
    app.db.prepare('SELECT date FROM cycle_days WHERE cycle_id = 20 ORDER BY date').all().map(day => day.date),
    ['2026-08-02', '2026-08-04']
  )

  const deleteInRangeEnd = await request(app.baseUrl, '/api/test-period/cycle-days/302', { method: 'DELETE' })
  assert.equal(deleteInRangeEnd.response.status, 200)
  assert.equal(deleteInRangeEnd.body.boundary_changed, true)
  assert.deepEqual(
    app.db.prepare('SELECT start_date, end_date, review_state FROM cycles WHERE id = 30').get(),
    { start_date: '2026-09-02', end_date: '2026-09-02', review_state: null }
  )
  assert.deepEqual(
    app.db.prepare('SELECT date FROM cycle_days WHERE cycle_id = 30 ORDER BY date').all().map(day => day.date),
    ['2026-09-02', '2026-09-06']
  )
})

test('period day creation and adjustment softly reject dates that are already logged', async () => {
  app.db.prepare('DELETE FROM symptoms').run()
  app.db.prepare('DELETE FROM cycle_days').run()
  app.db.prepare('DELETE FROM cycles').run()
  app.db.prepare(`
    INSERT INTO cycles (id, start_date, end_date)
    VALUES (40, '2026-05-01', '2026-05-03'),
           (50, '2026-06-01', '2026-06-03')
  `).run()
  app.db.prepare(`
    INSERT INTO cycle_days (cycle_id, date, flow_intensity)
    VALUES (40, '2026-05-02', 'medium'),
           (50, '2026-05-04', 'spotting')
  `).run()

  const duplicateDay = await request(app.baseUrl, '/api/test-period/cycle-days', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cycle_id: 50, date: '2026-05-02', flow_intensity: 'light' }),
  })
  assert.equal(duplicateDay.response.status, 409)
  assert.equal(duplicateDay.body.code, 'CYCLE_DAY_EXISTS')
  assert.equal(duplicateDay.body.date, '2026-05-02')
  assert.equal(app.db.prepare("SELECT COUNT(*) AS count FROM cycle_days WHERE date = '2026-05-02'").get().count, 1)

  const orphanConflict = await request(app.baseUrl, '/api/test-premium/period/cycles/40/adjust', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ end_date: '2026-05-04' }),
  })
  assert.equal(orphanConflict.response.status, 409)
  assert.equal(orphanConflict.body.code, 'CYCLE_DAY_EXISTS')
  assert.equal(orphanConflict.body.date, '2026-05-04')
  assert.equal(app.db.prepare('SELECT end_date FROM cycles WHERE id = 40').get().end_date, '2026-05-03')

  const futureAdjustment = await request(app.baseUrl, '/api/test-premium/period/cycles/40/adjust', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ end_date: '2099-01-01' }),
  })
  assert.equal(futureAdjustment.response.status, 400)
  assert.equal(futureAdjustment.body.code, 'FUTURE_CYCLE_DATE')
  assert.equal(app.db.prepare('SELECT end_date FROM cycles WHERE id = 40').get().end_date, '2026-05-03')
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
