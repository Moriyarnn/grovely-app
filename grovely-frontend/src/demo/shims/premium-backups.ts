// Stand-in for the premium backups sub-router (routes/premium/backups.js). That
// file requires Node's fs/path and the backups engine to manage scheduled
// backups - all server-only. premium/index.js mounts it with router.use(), which
// the demo dispatcher ignores, so the routes are never reachable anyway. Shimming
// it to an empty router keeps fs/path out of the demo bundle entirely.
import { createRouter } from '../router-shim'

export default createRouter()
