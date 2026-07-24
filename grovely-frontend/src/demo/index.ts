// @ts-nocheck - this is the demo bootstrap glue. It statically imports the real
// backend route factories (CommonJS, transformed by Vite's commonjs handling
// and resolved through the demo-backend plugin, which swaps their Node-only
// deps for browser shims). Those imports are untyped, so type-checking is
// disabled for this file only.
//
// initDemoBackend() runs once, before the Vue app mounts (see main.ts): load
// sql.js (self-hosted WASM), build the in-memory DB from the real migrations,
// seed it, mount every demo-safe router, and register the in-browser request
// handler with api.ts. After this returns, every apiFetch is served locally -
// nothing ever leaves the tab.

import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

import { setDemoHandler, setToken, setUser } from '../api'
import { DemoDatabase } from './db-shim'
import { runMigrations } from './migrations'
import { seed, seedPantryPipeline } from './seed'
import { configureServer, mount, handleRequest, DEMO_USER } from './server'
import { createRouter } from './router-shim'

// Real backend route factories - run verbatim against the in-memory DB.
import makeCyclesRouter from '../../../grovely-backend/routes/period/cycles.js'
import makeCycleDaysRouter from '../../../grovely-backend/routes/period/cycle_days.js'
import makeCalculationsRouter from '../../../grovely-backend/routes/period/calculations.js'
import makeGapDaysRouter from '../../../grovely-backend/routes/period/gap_days.js'
import makeListRouter from '../../../grovely-backend/routes/pantry/list.js'
import makeCatalogRouter from '../../../grovely-backend/routes/pantry/catalog.js'
import makePantryRouter from '../../../grovely-backend/routes/pantry/pantry.js'
import makeSettingsRouter from '../../../grovely-backend/routes/settings.js'
import makePreferencesRouter from '../../../grovely-backend/routes/preferences.js'
import calcHelpers from '../../../grovely-backend/routes/period/_calcHelpers.js'
// premium/index.js exports a ready router (not a factory); handlers use req.db.
import premiumRouter from '../../../grovely-backend/routes/premium/index.js'
// The premium backups sub-router. premium/index mounts it with router.use(),
// which the demo dispatcher ignores, so it is mounted directly below (before
// the /api/premium catch-all). Engine + fs/path are shimmed; /status and
// /history run for real against the in-browser DB.
import backupsRouter from '../../../grovely-backend/routes/premium/backups.js'

let ready = false

export async function initDemoBackend(): Promise<void> {
  if (ready) return

  // settings.js reads process.env.MAIL_HOST etc; give it an empty env so the
  // reference resolves to undefined instead of throwing in the browser.
  ;(globalThis as any).process ??= { env: {} }
  // The premium adjust-cycle handler defers recompute with setImmediate, which
  // browsers don't have; map it to a macrotask.
  ;(globalThis as any).setImmediate ??= (fn: (...a: unknown[]) => void, ...a: unknown[]) =>
    setTimeout(() => fn(...a), 0)

  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl })
  const db = new DemoDatabase(new SQL.Database())

  runMigrations(db)
  seed(db)
  // The normal backend performs this on startup. Demo cycles are inserted
  // directly, so they need the same stored predictions before the first
  // calendar request.
  calcHelpers.recomputeAllPredictions(db)

  configureServer(db)

  // Mount the real routers. Order mirrors index.js: more specific pantry
  // prefixes (list, catalog) before the catch-all /api/pantry.
  mount('/api/period/cycles', makeCyclesRouter(db))
  mount('/api/period/cycle-days', makeCycleDaysRouter(db))
  mount('/api/period/calculations', makeCalculationsRouter(db))
  mount('/api/period/gap-days', makeGapDaysRouter(db))
  mount('/api/pantry/list', makeListRouter(db))
  mount('/api/pantry/catalog', makeCatalogRouter(db))
  mount('/api/pantry', makePantryRouter(db))
  mount('/api/settings', makeSettingsRouter(db))
  mount('/api/preferences', makePreferencesRouter(db))
  // Premium backups read endpoints (status/history) - specific prefix before
  // the /api/premium catch-all so the dispatcher matches it first.
  mount('/api/premium/backups', backupsRouter)
  // Premium routes (Adjust Cycle, notification-types, premium catalog). The
  // license stub reports active, so PremiumGate/PremiumBadge unlock and these
  // are reachable.
  mount('/api/premium', premiumRouter)

  mountStubs()

  setDemoHandler(handleRequest)

  // Auto-login as the demo owner so the router guard passes and the app shows
  // the shell instead of the login screen. Done BEFORE seeding so the app always
  // comes up logged in even if the (best-effort) pipeline seed is slow or fails.
  setToken('demo-session')
  setUser({ username: DEMO_USER.username, role: DEMO_USER.role })

  // Seed the shopping list + pantry through the real request pipeline now that
  // the routers are mounted. POST /api/pantry (move-to-pantry) is what writes
  // pantry_purchase_history + pantry_item_catalog, so the premium Smart Autofill
  // autocomplete has data to suggest. A direct DB insert would leave it empty.
  // Best-effort: a failure here degrades to an emptier pantry, it never blocks
  // the app from mounting.
  try {
    await seedPantryPipeline(handleRequest)
  } catch (err) {
    console.error('[demo] pantry pipeline seed failed:', err)
  }

  ready = true
}

// Routes that the real backend serves outside the mounted routers (auth,
// license status, instance stats). In the demo these are tiny fixed responses:
// premium is always "active" (one switch unlocks every PremiumBadge/PremiumGate),
// and there is no real auth.
function mountStubs(): void {
  const auth = createRouter()
  const session = () => ({ token: 'demo-session', user: { username: DEMO_USER.username, role: DEMO_USER.role } })
  auth.post('/login', (_req, res) => res.json(session()))
  auth.get('/me', (_req, res) => res.json(session().user))
  auth.get('/verify', (_req, res) => res.json({ valid: true, user: session().user }))
  mount('/api/auth', auth)

  const license = createRouter()
  license.get('/status', (_req, res) => res.json({ active: true }))
  license.get('/active', (_req, res) => res.json({ active: true }))
  mount('/api/license', license)

  const instance = createRouter()
  instance.get('/', (_req, res) => res.json({ daysRunning: 0, dbSizeMB: 0 }))
  mount('/api/instance', instance)
}
