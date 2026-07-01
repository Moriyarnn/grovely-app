// Demo seed data. Runs once after migrations so the sandbox opens populated
// rather than empty: a household (owner + partner), a few weeks of realistic
// cycle history (so predictions and the calendar have something to show), and a
// stocked shopping list + pantry with varied expiry states. All of this lives
// only in the tab's in-memory DB and is recreated fresh on every page load.
//
// Two-phase seeding:
//   1. seed(db)               - synchronous direct inserts (users, cycles).
//   2. seedPantryPipeline(h)  - async, runs AFTER the routers are mounted and
//      drives the REAL request pipeline (POST /api/pantry/list, POST /api/pantry).
//      This matters: the premium "Smart Autofill" autocomplete reads
//      pantry_purchase_history + pantry_item_catalog, and ONLY the move-to-pantry
//      route (POST /api/pantry) writes those tables. A direct INSERT into pantry
//      would leave autofill empty, so inventory is seeded through the same
//      endpoint the app itself calls.

import type { DemoDatabase } from './db-shim'

type Handle = (url: string, options?: RequestInit) => Promise<Response>

function isoDaysFromNow(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export function seed(db: DemoDatabase): void {
  seedUsers(db)
  seedCycles(db)
}

function seedUsers(db: DemoDatabase): void {
  // role is free-text after migration 026; owner1 is the primary account the
  // demo runs as (DEMO_USER.id === 1).
  const insert = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
  )
  insert.run('You', 'demo', 'owner1')
  insert.run('Partner', 'demo', 'owner2')
}

function seedCycles(db: DemoDatabase): void {
  // Four completed cycles ~28 days apart, each a 5-day period. The most recent
  // start is 26 days ago, so the predicted next period lands a couple of days
  // out - enough to exercise predictions, the summary strip, and the calendar.
  const cycleStarts = [-110, -82, -54, -26]
  const flow = ['medium', 'heavy', 'heavy', 'medium', 'light']

  const insertCycle = db.prepare(
    'INSERT INTO cycles (start_date, end_date, user_id) VALUES (?, ?, ?)',
  )
  const insertDay = db.prepare(
    'INSERT INTO cycle_days (cycle_id, date, flow_intensity) VALUES (?, ?, ?)',
  )

  for (const startOffset of cycleStarts) {
    const start = isoDaysFromNow(startOffset)
    const end = isoDaysFromNow(startOffset + 4)
    const { lastInsertRowid: cycleId } = insertCycle.run(start, end, 1)
    for (let i = 0; i < 5; i++) {
      insertDay.run(cycleId, isoDaysFromNow(startOffset + i), flow[i])
    }
  }
}

// ── Pantry / shopping list, seeded through the real request pipeline ──────────

// Units must be one of PANTRY_UNITS (g, kg, ml, L, cup, tbsp, tsp). Discrete
// items (eggs, bananas, cans, loaves) are NOT a unit - they use `pieces`.
// Categories must be one of: produce, dairy, meat, bakery, frozen, dry_goods,
// beverages, other.
interface ItemSpec {
  name: string
  category: string
  amount?: number
  unit?: string
  pieces?: number
  price?: number
  store?: string
  expiry?: number   // days from now; omit for no tracked expiry
}

// To-buy items that stay on the shopping list. Mix of pieces / amount+unit,
// prices on most, stores on some, a couple already checked off.
const SHOPPING_LIST: ItemSpec[] = [
  { name: 'Bananas',        category: 'produce',   pieces: 6,              price: 1.80, store: 'Store A' },
  { name: 'Spinach',        category: 'produce',   amount: 200, unit: 'g', price: 1.10 },
  { name: 'Greek yogurt',   category: 'dairy',     amount: 500, unit: 'g', price: 1.90, store: 'Store B' },
  { name: 'Cheddar',        category: 'dairy',     amount: 250, unit: 'g', price: 3.20 },
  { name: 'Chicken breast', category: 'meat',      pieces: 4,              price: 5.40, store: 'Store A' },
  { name: 'Ground beef',    category: 'meat',      amount: 500, unit: 'g', price: 4.10 },
  { name: 'Sourdough',      category: 'bakery',    pieces: 1,              price: 3.00, store: 'Store C' },
  { name: 'Croissants',     category: 'bakery',    pieces: 4,              price: 2.60 },
  { name: 'Frozen peas',    category: 'frozen',    amount: 500, unit: 'g', price: 1.30 },
  { name: 'Ice cream',      category: 'frozen',    pieces: 1,              price: 4.50, store: 'Store B' },
  { name: 'Rice',           category: 'dry_goods', amount: 1, unit: 'kg',  price: 1.70 },
  { name: 'Olive oil',      category: 'dry_goods', amount: 500, unit: 'ml', price: 4.80, store: 'Store A' },
  { name: 'Sparkling water', category: 'beverages', pieces: 6,             price: 2.40 },
  { name: 'Orange juice',   category: 'beverages', amount: 1, unit: 'L',   price: 1.60, store: 'Store C' },
]

// Past purchases that are no longer on the shelf (used up). They exist only to
// give the premium autofill multiple store/price points for items the household
// buys repeatedly. Posted through the move-to-pantry route (so purchase history
// is written) then soft-deleted (history rows survive deletion).
const PAST_PURCHASES: ItemSpec[] = [
  { name: 'Milk',           category: 'dairy',     amount: 1, unit: 'L',   price: 1.30, store: 'Store B' },
  { name: 'Eggs',           category: 'dairy',     pieces: 12,             price: 2.20, store: 'Store B' },
  { name: 'Coffee',         category: 'beverages', amount: 250, unit: 'g', price: 6.40, store: 'Store B' },
  { name: 'Pasta',          category: 'dry_goods', amount: 500, unit: 'g', price: 0.95, store: 'Store C' },
  { name: 'Bananas',        category: 'produce',   pieces: 5,              price: 1.60, store: 'Store B' },
  { name: 'Butter',         category: 'dairy',     amount: 250, unit: 'g', price: 2.10, store: 'Store A' },
  { name: 'Tomatoes',       category: 'produce',   amount: 500, unit: 'g', price: 1.40, store: 'Store C' },
  { name: 'Chicken breast', category: 'meat',      pieces: 4,              price: 5.90, store: 'Store C' },
]

// Current inventory - bought and still on the shelf. Varied expiry states
// (expired, today, soon, fresh, far, none) drive the expiry tinting. Each post
// also writes a purchase-history row, so these names autofill too.
const INVENTORY: ItemSpec[] = [
  { name: 'Milk',           category: 'dairy',     amount: 2, unit: 'L',   price: 1.10, store: 'Store A', expiry: 2 },
  { name: 'Strawberries',   category: 'produce',   pieces: 1,              price: 2.50, store: 'Store B', expiry: 0 },
  { name: 'Hummus',         category: 'dairy',     amount: 200, unit: 'g', price: 1.40, store: 'Store A', expiry: 3 },
  { name: 'Tomatoes',       category: 'produce',   amount: 400, unit: 'g', price: 1.50, store: 'Store B', expiry: 4 },
  { name: 'Orange juice',   category: 'beverages', amount: 1, unit: 'L',   price: 1.70, store: 'Store B', expiry: 6 },
  { name: 'Eggs',           category: 'dairy',     pieces: 12,             price: 2.40, store: 'Store C', expiry: 10 },
  { name: 'Butter',         category: 'dairy',     amount: 250, unit: 'g', price: 2.30, store: 'Store B', expiry: 25 },
  { name: 'Cheddar',        category: 'dairy',     amount: 200, unit: 'g', price: 3.10, store: 'Store A', expiry: 40 },
  { name: 'Chicken breast', category: 'meat',      pieces: 3,              price: 5.50, store: 'Store A', expiry: 1 },
  { name: 'Bacon',          category: 'meat',      amount: 200, unit: 'g', price: 3.20, store: 'Store C', expiry: -2 },
  { name: 'Frozen peas',    category: 'frozen',    amount: 500, unit: 'g', price: 1.30, store: 'Store C', expiry: 180 },
  { name: 'Coffee',         category: 'beverages', amount: 250, unit: 'g', price: 6.80, store: 'Store A', expiry: 120 },
  { name: 'Pasta',          category: 'dry_goods', amount: 500, unit: 'g', price: 1.00, store: 'Store B', expiry: 200 },
  { name: 'Olive oil',      category: 'dry_goods', amount: 500, unit: 'ml', price: 4.80, store: 'Store A' },
  { name: 'Rice',           category: 'dry_goods', amount: 1, unit: 'kg',  price: 1.80, store: 'Store A' },
  { name: 'Canned tomatoes', category: 'dry_goods', pieces: 2,            price: 0.80, store: 'Store C' },
]

function listBody(it: ItemSpec): Record<string, unknown> {
  return {
    name: it.name,
    category: it.category,
    amount: it.amount ?? null,
    unit: it.unit ?? null,
    pieces: it.pieces ?? null,
    price: it.price ?? null,
    store: it.store ?? null,
  }
}

function pantryBody(it: ItemSpec): Record<string, unknown> {
  return {
    ...listBody(it),
    expiry_date: it.expiry !== undefined ? isoDaysFromNow(it.expiry) : null,
  }
}

export async function seedPantryPipeline(handle: Handle): Promise<void> {
  const post = (path: string, body: Record<string, unknown>) =>
    handle(path, { method: 'POST', body: JSON.stringify(body) })
  const del = (path: string) => handle(path, { method: 'DELETE' })

  // 1. Shopping list - the to-buy list. All unchecked (no "Done" section).
  for (const it of SHOPPING_LIST) {
    await post('/api/pantry/list', listBody(it))
  }

  // 2. Past purchases - write history, then soft-delete so they only enrich
  //    autofill (multiple store/price points) without cluttering the shelf.
  //    Done before current inventory so the delete can't merge-collide with a
  //    live item of the same name.
  for (const it of PAST_PURCHASES) {
    const res = await post('/api/pantry', pantryBody(it))
    const row = await res.json()
    if (row?.id != null) await del(`/api/pantry/${row.id}`)
  }

  // 3. Current inventory - the move-to-pantry route writes pantry + catalog +
  //    purchase history in one shot, exactly as the app does.
  for (const it of INVENTORY) {
    await post('/api/pantry', pantryBody(it))
  }
}
