// One-shot UAT seed for Lemon Squeezy approval demo video.
// Wipes period + pantry data, renames users to demo/partner, reseeds neutral data.
// Run inside container: docker exec grovely-uat-backend node /app/scripts/seed-uat-demo.js

const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

const db = new Database('/app/data/wifey.db')
db.pragma('foreign_keys = ON')

const TODAY = '2026-05-20'

const tx = db.transaction(() => {
  // --- Rename users, reset passwords ---
  const demoHash = bcrypt.hashSync('demo1234', 10)
  const partnerHash = bcrypt.hashSync('partner1234', 10)
  db.prepare("UPDATE users SET username='demo', password_hash=? WHERE role='owner'").run(demoHash)
  db.prepare("UPDATE users SET username='partner', password_hash=? WHERE role='partner'").run(partnerHash)
  const demoUser = db.prepare("SELECT id FROM users WHERE role='owner'").get()
  const demoUserId = demoUser.id

  // --- Wipe period + pantry data ---
  db.prepare('DELETE FROM gap_day_symptoms').run()
  db.prepare('DELETE FROM gap_day_logs').run()
  db.prepare('DELETE FROM symptoms').run()
  db.prepare('DELETE FROM cycle_days').run()
  db.prepare('DELETE FROM cycles').run()
  db.prepare('DELETE FROM pantry').run()
  db.prepare('DELETE FROM shopping_list').run()
  db.prepare('DELETE FROM notification_log').run()

  // --- Seed cycles (4 historical, all on demo user) ---
  // Pattern: ~28-29 day cycles, 6-7 day periods, leading up to a "just ended" most recent cycle
  const cycles = [
    { start: '2026-02-15', end: '2026-02-21' },
    { start: '2026-03-16', end: '2026-03-21' },
    { start: '2026-04-13', end: '2026-04-19' },
    { start: '2026-05-12', end: '2026-05-17' }, // most recent, ended 3 days ago
  ]

  const insertCycle = db.prepare(
    'INSERT INTO cycles (user_id, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  )
  const insertDay = db.prepare(
    "INSERT INTO cycle_days (cycle_id, date, flow_intensity, notes, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
  )

  // Flow intensity pattern across a typical period: light, medium, heavy, heavy, medium, light, (spotting)
  const flowPattern = ['light', 'medium', 'heavy', 'heavy', 'medium', 'light', 'spotting']

  for (const c of cycles) {
    const result = insertCycle.run(demoUserId, c.start, c.end, c.start + ' 08:00:00', c.start + ' 08:00:00')
    const cycleId = result.lastInsertRowid
    const startDate = new Date(c.start + 'T00:00:00Z')
    const endDate = new Date(c.end + 'T00:00:00Z')
    const days = Math.round((endDate - startDate) / 86400000) + 1
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setUTCDate(d.getUTCDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      insertDay.run(cycleId, dateStr, flowPattern[i] || 'light', null)
    }
  }

  // --- Seed pantry ---
  const pantryItems = [
    { name: 'Milk',           amount: 1000, unit: 'ml',  expiry: '2026-05-25', price: 2.50,  bought: '2026-05-18' },
    { name: 'Eggs',           amount: 12,   unit: 'pcs', expiry: '2026-06-05', price: 4.20,  bought: '2026-05-15' },
    { name: 'Bread',          amount: 500,  unit: 'g',   expiry: '2026-05-24', price: 3.00,  bought: '2026-05-19' },
    { name: 'Chicken breast', amount: 800,  unit: 'g',   expiry: '2026-05-22', price: 7.50,  bought: '2026-05-17' },
    { name: 'Rice',           amount: 2000, unit: 'g',   expiry: null,         price: 5.00,  bought: '2026-04-30' },
    { name: 'Pasta',          amount: 500,  unit: 'g',   expiry: null,         price: 1.80,  bought: '2026-05-02' },
    { name: 'Cheese',         amount: 250,  unit: 'g',   expiry: '2026-06-10', price: 4.50,  bought: '2026-05-16' },
    { name: 'Tomato sauce',   amount: 400,  unit: 'g',   expiry: '2026-11-01', price: 2.20,  bought: '2026-05-10' },
    { name: 'Olive oil',      amount: 750,  unit: 'ml',  expiry: null,         price: 9.00,  bought: '2026-04-20' },
    { name: 'Apples',         amount: 6,    unit: 'pcs', expiry: '2026-05-27', price: 3.50,  bought: '2026-05-19' },
  ]
  const insertPantry = db.prepare(
    `INSERT INTO pantry (name, amount, unit, expiry_date, price, bought_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
  )
  for (const p of pantryItems) {
    insertPantry.run(p.name, p.amount, p.unit, p.expiry, p.price, p.bought)
  }

  // --- Seed shopping list ---
  const shoppingItems = [
    { name: 'Bananas',  amount: 6,   unit: 'pcs' },
    { name: 'Yogurt',   amount: 500, unit: 'g'   },
    { name: 'Coffee',   amount: 250, unit: 'g'   },
    { name: 'Onions',   amount: 3,   unit: 'pcs' },
    { name: 'Spinach',  amount: 200, unit: 'g'   },
    { name: 'Butter',   amount: 200, unit: 'g'   },
    { name: 'Lemons',   amount: 4,   unit: 'pcs' },
    { name: 'Salt',     amount: 1,   unit: 'pcs' },
  ]
  const insertShop = db.prepare(
    `INSERT INTO shopping_list (name, amount, unit, checked, added_by, created_at)
     VALUES (?, ?, ?, 0, ?, datetime('now'))`
  )
  for (const s of shoppingItems) {
    insertShop.run(s.name, s.amount, s.unit, demoUserId)
  }

  return {
    user_id: demoUserId,
    cycles: cycles.length,
    pantry: pantryItems.length,
    shopping: shoppingItems.length,
  }
})

const result = tx()
console.log('Seed complete:', JSON.stringify(result, null, 2))
console.log('Logins: demo / demo1234   |   partner / partner1234')
