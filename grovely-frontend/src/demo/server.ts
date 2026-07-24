// In-browser request dispatcher. Stands in for Express + the HTTP layer: takes
// the (url, fetch-options) an apiFetch call would have sent to the server,
// routes it to the matching mounted router, runs the handler chain against the
// in-memory DB, and returns a real Response so callers use res.ok / res.json()
// exactly as they would against the network.

import type { DemoDatabase } from './db-shim'
import type { DemoHandler, DemoRequest, DemoResponse, DemoRouter } from './router-shim'

export const DEMO_USER = { id: 1, role: 'owner1', username: 'You' }

interface Mount { prefix: string; router: DemoRouter }

const mounts: Mount[] = []
let database: DemoDatabase | null = null

export function configureServer(db: DemoDatabase): void {
  database = db
}

// Mount order matters: register more specific prefixes first (e.g.
// /api/pantry/list and /api/pantry/catalog before /api/pantry), mirroring the
// registration order in the real index.js.
export function mount(prefix: string, router: DemoRouter): void {
  mounts.push({ prefix, router })
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildRequest(u: URL, options: RequestInit, params: Record<string, string>): DemoRequest {
  let body: Record<string, unknown> = {}
  if (typeof options.body === 'string' && options.body.length) {
    try { body = JSON.parse(options.body) } catch { /* leave empty */ }
  }
  return {
    method: (options.method ?? 'GET').toUpperCase(),
    params,
    query: Object.fromEntries(u.searchParams.entries()),
    body,
    user: DEMO_USER,
    db: database,
    headers: {},
  }
}

// Runs a handler chain (middleware..., handler) the way Express would: each
// link may respond (resolving the Response) or call next() to advance. If the
// chain ends without responding, we 404.
function runChain(handlers: DemoHandler[], req: DemoRequest): Promise<Response> {
  return new Promise((resolve) => {
    let settled = false
    let status = 200
    const finish = (r: Response) => { if (!settled) { settled = true; resolve(r) } }

    const res: DemoResponse = {
      status(code: number) { status = code; return this },
      json(b: unknown) { finish(jsonResponse(status, b)) },
      send(b: unknown) {
        finish(typeof b === 'object' && b !== null
          ? jsonResponse(status, b)
          : new Response(String(b ?? ''), { status }))
      },
      end() { finish(new Response(null, { status })) },
      set() { return this },
      type() { return this },
    }

    let i = 0
    const next = () => {
      if (settled) return
      const handler = handlers[i++]
      if (!handler) { finish(jsonResponse(404, { error: 'Not found (demo)' })); return }
      try {
        const out = handler(req, res, next)
        if (out && typeof (out as Promise<unknown>).then === 'function') {
          (out as Promise<unknown>).catch((err) =>
            finish(jsonResponse(500, { error: String(err?.message ?? err) })))
        }
      } catch (err) {
        finish(jsonResponse(500, { error: String((err as Error)?.message ?? err) }))
      }
    }
    next()
  })
}

export async function handleRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const u = new URL(url, window.location.origin)
  const pathname = u.pathname
  const method = (options.method ?? 'GET').toUpperCase()

  const mountMatch = mounts.find(
    (m) => pathname === m.prefix || pathname.startsWith(m.prefix + '/'),
  )
  if (!mountMatch) return jsonResponse(404, { error: `No demo route for ${pathname}` })

  const sub = pathname.slice(mountMatch.prefix.length) || '/'
  for (const route of mountMatch.router.routes) {
    if (route.method !== method) continue
    const m = route.regex.exec(sub)
    if (!m) continue
    const params: Record<string, string> = {}
    route.keys.forEach((k, idx) => {
      const value = m[idx + 1]
      if (value !== undefined) params[k] = decodeURIComponent(value)
    })
    return runChain(route.handlers, buildRequest(u, options, params))
  }
  return jsonResponse(404, { error: `No demo handler for ${method} ${pathname}` })
}
