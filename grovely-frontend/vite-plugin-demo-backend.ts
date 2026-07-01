// Vite plugin for the demo build. The demo statically imports real backend
// route files (CommonJS) that `require()` Node-only modules - express, the SSE
// layer, the logger, auth middleware, encryption, the notifications/backups
// crons. This plugin intercepts those specifiers (only when imported from
// within grovely-backend) and resolves them to browser-safe shims in
// src/demo/shims, so the route logic itself runs unchanged. Anything not listed
// here (utils/units, period/_calcHelpers) is pure JS and bundles as-is.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))
const shimDir = path.resolve(here, 'src/demo/shims')
const backendDir = path.resolve(here, '../grovely-backend')

// Keyed by the resolved backend module path without extension.
const RELATIVE_SHIMS: Record<string, string> = {
  [path.resolve(backendDir, 'realtime/index')]: 'realtime.ts',
  [path.resolve(backendDir, 'realtime')]: 'realtime.ts',
  [path.resolve(backendDir, 'logger')]: 'logger.ts',
  [path.resolve(backendDir, 'logger/index')]: 'logger.ts',
  [path.resolve(backendDir, 'middleware/auth')]: 'auth.ts',
  [path.resolve(backendDir, 'utils/encryption')]: 'encryption.ts',
  [path.resolve(backendDir, 'notifications')]: 'notifications.ts',
  [path.resolve(backendDir, 'notifications/index')]: 'notifications.ts',
  [path.resolve(backendDir, 'backups')]: 'backups.ts',
  [path.resolve(backendDir, 'backups/index')]: 'backups.ts',
  // routes/premium/backups.js runs for real in the demo (its /status and
  // /history are real SQL against the in-browser DB). Its only Node deps are
  // the backups engine (shimmed above) and fs/path (shimmed below); its
  // server-only handlers are gated on the frontend, so they never execute.
}

// Node builtins required at module load by routes/premium/backups.js. Only its
// gated server-only handlers use them, so inert shims are enough to load.
const BUILTIN_SHIMS: Record<string, string> = {
  fs: 'fs.ts',
  'node:fs': 'fs.ts',
  path: 'path.ts',
  'node:path': 'path.ts',
}

export function demoBackend(): Plugin {
  return {
    name: 'demo-backend-shims',
    enforce: 'pre',
    resolveId(source, importer) {
      // express is a bare specifier and only the backend files import it.
      if (source === 'express') return path.resolve(shimDir, 'express.ts')

      // fs/path are Node builtins; only redirect them when required from inside
      // the backend tree (the backups route), never for the frontend's own deps.
      const builtin = BUILTIN_SHIMS[source]
      if (builtin && importer && importer.replace(/\\/g, '/').includes('/grovely-backend/')) {
        return path.resolve(shimDir, builtin)
      }

      if (!importer || !source.startsWith('.')) return null
      // Only redirect relative requires originating inside the backend tree.
      if (!importer.replace(/\\/g, '/').includes('/grovely-backend/')) return null

      const resolved = path.resolve(path.dirname(importer), source)
      const noExt = resolved.replace(/\.(c?js)$/, '')
      const shim = RELATIVE_SHIMS[noExt]
      return shim ? path.resolve(shimDir, shim) : null
    },
  }
}
