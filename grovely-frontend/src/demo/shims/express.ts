// Stand-in for `require('express')` inside the backend route files. They only
// ever use express.Router(); everything else (the app, listen, json middleware)
// lives in index.js, which the demo does not run.
import { createRouter } from '../router-shim'

export function Router() {
  return createRouter()
}

export default { Router }
