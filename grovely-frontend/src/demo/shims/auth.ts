// Stand-in for the auth middleware. The demo runs as a single fixed owner
// account (see DEMO_USER), so requireAuth just ensures req.user is set and
// requireOwner always passes. These are used as inline route middleware, so
// they follow the (req, res, next) contract.
import { DEMO_USER } from '../server'

export function requireAuth(req: { user?: unknown }, _res: unknown, next: () => void) {
  if (!req.user) req.user = DEMO_USER
  next()
}

export function requireOwner(_req: unknown, _res: unknown, next: () => void) {
  next()
}

export default { requireAuth, requireOwner }
