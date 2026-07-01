// Minimal express.Router() replacement. The real route files call
// router.get/post/patch/delete(path, ...handlers) and return the router from
// their factory. We capture each registration as a matchable route; the
// dispatcher in server.ts walks them. Path syntax supports the patterns the
// routes actually use: "/", "/:id", and static segments like "/checked".

export type DemoHandler = (req: DemoRequest, res: DemoResponse, next: () => void) => unknown

export interface DemoRequest {
  method: string
  params: Record<string, string>
  query: Record<string, string>
  body: Record<string, unknown>
  user: { id: number; role: string; username: string }
  db: unknown
  headers: Record<string, string>
}

export interface DemoResponse {
  status(code: number): DemoResponse
  json(body: unknown): void
  send(body: unknown): void
  end(): void
  set(...args: unknown[]): DemoResponse
  type(...args: unknown[]): DemoResponse
}

export interface DemoRoute {
  method: string
  regex: RegExp
  keys: string[]
  handlers: DemoHandler[]
}

export interface DemoRouter {
  routes: DemoRoute[]
  get(path: string, ...handlers: DemoHandler[]): void
  post(path: string, ...handlers: DemoHandler[]): void
  patch(path: string, ...handlers: DemoHandler[]): void
  put(path: string, ...handlers: DemoHandler[]): void
  delete(path: string, ...handlers: DemoHandler[]): void
  use(...args: unknown[]): void
}

function compile(path: string, keys: string[]): RegExp {
  const pattern = path
    .replace(/\/+$/, '') // trim trailing slash
    .replace(/:([A-Za-z0-9_]+)/g, (_m, key: string) => {
      keys.push(key)
      return '([^/]+)'
    })
  // "" (root) matches "/" or ""; everything else is anchored exactly.
  return new RegExp('^' + (pattern || '') + '/?$')
}

export function createRouter(): DemoRouter {
  const routes: DemoRoute[] = []
  const add = (method: string, path: string, handlers: DemoHandler[]) => {
    const keys: string[] = []
    routes.push({ method, regex: compile(path, keys), keys, handlers })
  }
  return {
    routes,
    get: (p, ...h) => add('GET', p, h),
    post: (p, ...h) => add('POST', p, h),
    patch: (p, ...h) => add('PATCH', p, h),
    put: (p, ...h) => add('PUT', p, h),
    delete: (p, ...h) => add('DELETE', p, h),
    use: () => { /* app-level middleware is handled by the dispatcher, not here */ },
  }
}
