const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const { composeArgs } = require('./compose')

const port = Number(process.env.PORT || 3003)
const feedUrl = process.env.UPDATE_FEED_URL || 'https://grovely.org/releases/stable.json'
const appDir = process.env.GROVELY_APP_DIR || '/grovely'
const stateFile = process.env.UPDATE_STATE_FILE || '/state/update-state.json'
const tokenFile = process.env.UPDATER_TOKEN_FILE || '/state/updater-token'
const envFile = process.env.GROVELY_ENV_FILE || '.env'
const composeEnvFile = process.env.GROVELY_COMPOSE_ENV_FILE || envFile
const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://backend:3000'
const intervalHours = Math.max(1, Number(process.env.UPDATE_CHECK_INTERVAL_HOURS || 24))
const checksEnabled = process.env.UPDATE_CHECK_ENABLED !== 'false'
const pullEnabled = process.env.UPDATE_PULL_ENABLED !== 'false'
const buildOnInstall = process.env.UPDATE_BUILD_ON_INSTALL === 'true'
const composeFiles = (process.env.GROVELY_COMPOSE_FILES || 'docker-compose.yml')
  .split(',').map(file => file.trim()).filter(Boolean)
const managedServices = ['frontend', 'backend']

function loadToken () {
  // Keep an explicitly supplied legacy token working, but new installations
  // use the generated, persistent token below.
  if (process.env.UPDATER_TOKEN) return process.env.UPDATER_TOKEN
  try {
    const existing = fs.readFileSync(tokenFile, 'utf8').trim()
    if (existing) {
      // The backend runs as a non-root user and has this volume mounted
      // read-only. Docker access already implies host-level trust; the mode
      // lets only the intended backend process read this shared credential.
      fs.chmodSync(tokenFile, 0o644)
      return existing
    }
  } catch {}

  const generated = crypto.randomBytes(32).toString('hex')
  fs.mkdirSync(path.dirname(tokenFile), { recursive: true })
  fs.writeFileSync(tokenFile, `${generated}\n`, { mode: 0o644 })
  console.log('✅ Generated local Update Service credential')
  return generated
}

const token = loadToken()

const state = { checking: false, updating: false, last_checked_at: null, latest: null, error: null, recovery_snapshot_at: null }
try { Object.assign(state, JSON.parse(fs.readFileSync(stateFile, 'utf8'))) } catch {}

function save () {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true })
  fs.writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 })
}

function json (res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function authorized (req) {
  return Boolean(token) && req.headers['x-grovely-updater-token'] === token
}

async function releaseCheck (force = false) {
  if (!checksEnabled && !force) {
    state.error = null
    return state
  }
  if (state.checking) return state
  state.checking = true
  state.error = null
  save()
  try {
    const response = await fetch(feedUrl, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Release feed returned ${response.status}`)
    const release = await response.json()
    if (!release || typeof release.version !== 'string' || !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(release.version)) {
      throw new Error('Release feed returned an invalid version.')
    }
    state.latest = release
    state.last_checked_at = new Date().toISOString()
  } catch (err) {
    state.error = `Could not check for updates: ${err.message}`
  } finally {
    state.checking = false
    save()
  }
  return state
}

function run (command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: appDir, stdio: 'pipe' })
    let stderr = ''
    child.stderr.on('data', data => { stderr += data.toString() })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.trim() || `${command} exited ${code}`)))
  })
}

function updateVersionFile (version) {
  const envPath = path.join(appDir, envFile)
  const current = fs.readFileSync(envPath, 'utf8')
  const normalized = version.startsWith('v') ? version : `v${version}`
  const next = /^GROVELY_VERSION=/m.test(current)
    ? current.replace(/^GROVELY_VERSION=.*/m, `GROVELY_VERSION=${normalized}`)
    : `${current.trimEnd()}\nGROVELY_VERSION=${normalized}\n`
  fs.writeFileSync(envPath, next, { mode: 0o600 })
}

async function snapshot () {
  const response = await fetch(`${backendUrl}/api/system/update/internal/pre-update-snapshot`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'X-Grovely-Updater-Token': token },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Could not create pre-update snapshot.')
  state.recovery_snapshot_at = body.created_at
}

async function install () {
  if (state.updating) throw new Error('An update is already in progress.')
  await releaseCheck(true)
  if (!state.latest?.version) throw new Error(state.error || 'No release information is available.')

  state.updating = true
  state.error = null
  save()
  try {
    await snapshot()
    updateVersionFile(state.latest.compose_version || state.latest.version)
    if (pullEnabled) await run('docker', composeArgs(composeEnvFile, composeFiles, ['pull', ...managedServices]))
    const upArgs = ['up', '-d', '--wait', '--wait-timeout', '90']
    if (buildOnInstall) upArgs.push('--build')
    await run('docker', composeArgs(composeEnvFile, composeFiles, [...upArgs, ...managedServices]))
  } catch (err) {
    state.error = `Update stopped safely: ${err.message}`
    throw err
  } finally {
    state.updating = false
    save()
  }
}

http.createServer(async (req, res) => {
  if (!authorized(req)) return json(res, 401, { error: 'Unauthorized updater request.' })
  const route = new URL(req.url, 'http://updater').pathname
  if (req.method === 'GET' && route === '/status') return json(res, 200, state)
  if (req.method === 'POST' && route === '/check') return json(res, 200, await releaseCheck(true))
  if (req.method === 'POST' && route === '/install') {
    try { await install(); return json(res, 202, { accepted: true, ...state }) }
    catch (err) { return json(res, 502, { error: state.error || err.message, ...state }) }
  }
  return json(res, 404, { error: 'Not found.' })
}).listen(port, () => console.log(`Grovely Update Service listening on ${port}`))

// One quiet check per household server, not once per browser or partner.
// Errors are retained for Home to explain but never crash the running app.
if (checksEnabled) {
  releaseCheck()
  setInterval(releaseCheck, intervalHours * 60 * 60 * 1000).unref()
}
