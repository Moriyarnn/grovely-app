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

function diagnostic (event, details = {}) {
  console.log(`[updater] ${new Date().toISOString()} ${event} ${JSON.stringify(details)}`)
}

function safeMessage (error) {
  return String(error?.message || error || 'Unknown error')
    .replace(/(token|secret|password|authorization|cookie)=?[^\s,;]*/gi, '$1=[redacted]')
    .slice(0, 1200)
}

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
      diagnostic('credential_loaded', { source: 'state_file' })
      return existing
    }
  } catch {}

  const generated = crypto.randomBytes(32).toString('hex')
  fs.mkdirSync(path.dirname(tokenFile), { recursive: true })
  fs.writeFileSync(tokenFile, `${generated}\n`, { mode: 0o644 })
  diagnostic('credential_generated', { source: 'state_file' })
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
    diagnostic('release_check_skipped', { reason: 'checks_disabled' })
    state.error = null
    return state
  }
  if (state.checking) {
    diagnostic('release_check_skipped', { reason: 'already_checking' })
    return state
  }
  state.checking = true
  state.error = null
  save()
  const startedAt = Date.now()
  diagnostic('release_check_started', { force, feed_url: feedUrl })
  try {
    const response = await fetch(feedUrl, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
    diagnostic('release_feed_responded', { status: response.status, ok: response.ok })
    if (!response.ok) throw new Error(`Release feed returned ${response.status}`)
    const release = await response.json()
    if (!release || typeof release.version !== 'string' || !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(release.version)) {
      throw new Error('Release feed returned an invalid version.')
    }
    state.latest = release
    state.last_checked_at = new Date().toISOString()
    diagnostic('release_check_succeeded', { version: release.version, duration_ms: Date.now() - startedAt })
  } catch (err) {
    state.error = `Could not check for updates: ${err.message}`
    diagnostic('release_check_failed', { error: safeMessage(err), duration_ms: Date.now() - startedAt })
  } finally {
    state.checking = false
    save()
  }
  return state
}

function run (command, args) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    diagnostic('command_started', { command, args: args.map(arg => arg === composeEnvFile ? '[environment-file]' : arg) })
    const child = spawn(command, args, { cwd: appDir, stdio: 'pipe' })
    let stderr = ''
    child.stderr.on('data', data => { stderr += data.toString() })
    child.on('error', err => {
      diagnostic('command_failed', { command, error: safeMessage(err), duration_ms: Date.now() - startedAt })
      reject(err)
    })
    child.on('close', code => {
      if (code === 0) {
        diagnostic('command_succeeded', { command, duration_ms: Date.now() - startedAt })
        return resolve()
      }
      const error = new Error(stderr.trim() || `${command} exited ${code}`)
      diagnostic('command_failed', { command, exit_code: code, error: safeMessage(error), duration_ms: Date.now() - startedAt })
      reject(error)
    })
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
  diagnostic('version_file_updated', { version: normalized, already_present: /^GROVELY_VERSION=/m.test(current) })
}

async function snapshot () {
  const startedAt = Date.now()
  diagnostic('snapshot_started', { backend_url: backendUrl })
  const response = await fetch(`${backendUrl}/api/system/update/internal/pre-update-snapshot`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'X-Grovely-Updater-Token': token },
  })
  const body = await response.json().catch(() => ({}))
  diagnostic('snapshot_responded', { status: response.status, ok: response.ok })
  if (!response.ok) throw new Error(body.error || 'Could not create pre-update snapshot.')
  state.recovery_snapshot_at = body.created_at
  diagnostic('snapshot_succeeded', { created_at: body.created_at, duration_ms: Date.now() - startedAt })
}

async function install () {
  diagnostic('install_started')
  await releaseCheck(true)
  if (!state.latest?.version) throw new Error(state.error || 'No release information is available.')

  try {
    diagnostic('install_release_selected', { version: state.latest.compose_version || state.latest.version, pull_enabled: pullEnabled, build_on_install: buildOnInstall })
    await snapshot()
    updateVersionFile(state.latest.compose_version || state.latest.version)
    if (pullEnabled) await run('docker', composeArgs(composeEnvFile, composeFiles, ['pull', ...managedServices]))
    const upArgs = ['up', '-d', '--wait', '--wait-timeout', '90']
    if (buildOnInstall) upArgs.push('--build')
    await run('docker', composeArgs(composeEnvFile, composeFiles, [...upArgs, ...managedServices]))
    diagnostic('install_succeeded', { version: state.latest.compose_version || state.latest.version })
  } catch (err) {
    state.error = `Update stopped safely: ${err.message}`
    diagnostic('install_failed', { error: safeMessage(err) })
    throw err
  } finally {
    state.updating = false
    save()
  }
}

function startInstall () {
  if (state.updating) {
    diagnostic('install_rejected', { reason: 'already_updating' })
    throw new Error('An update is already in progress.')
  }

  state.updating = true
  state.error = null
  save()
  diagnostic('install_queued')
  void install().catch(err => {
    diagnostic('install_background_failed', { error: safeMessage(err) })
  })
  return state
}

http.createServer(async (req, res) => {
  if (!authorized(req)) {
    diagnostic('request_rejected', { method: req.method, reason: 'unauthorized' })
    return json(res, 401, { error: 'Unauthorized updater request.' })
  }
  const route = new URL(req.url, 'http://updater').pathname
  diagnostic('request_received', { method: req.method, route })
  if (req.method === 'GET' && route === '/status') return json(res, 200, state)
  if (req.method === 'POST' && route === '/check') return json(res, 200, await releaseCheck(true))
  if (req.method === 'POST' && route === '/install') {
    try { return json(res, 202, { accepted: true, ...startInstall() }) }
    catch (err) { return json(res, 409, { error: state.error || err.message, ...state }) }
  }
  return json(res, 404, { error: 'Not found.' })
}).listen(port, () => diagnostic('service_started', {
  port,
  checks_enabled: checksEnabled,
  interval_hours: intervalHours,
  pull_enabled: pullEnabled,
  build_on_install: buildOnInstall,
  compose_files: composeFiles,
}))

// One quiet check per household server, not once per browser or partner.
// Errors are retained for Home to explain but never crash the running app.
if (checksEnabled) {
  releaseCheck()
  setInterval(releaseCheck, intervalHours * 60 * 60 * 1000).unref()
}
