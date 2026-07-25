const DEFAULT_URL = 'http://updater:3003'
const DEFAULT_TOKEN_FILE = '/updater-state/updater-token'

function diagnostic (event, details = {}) {
  console.log(`[system-update] ${new Date().toISOString()} ${event} ${JSON.stringify(details)}`)
}

function safeMessage (error) {
  return String(error?.message || error || 'Unknown error')
    .replace(/(token|secret|password|authorization|cookie)=?[^\s,;]*/gi, '$1=[redacted]')
    .slice(0, 1200)
}

function getToken () {
  if (process.env.UPDATER_TOKEN) return process.env.UPDATER_TOKEN
  try {
    return require('node:fs').readFileSync(process.env.UPDATER_TOKEN_FILE || DEFAULT_TOKEN_FILE, 'utf8').trim()
  } catch {
    return ''
  }
}

function config () {
  return {
    url: (process.env.UPDATE_SERVICE_URL || DEFAULT_URL).replace(/\/$/, ''),
    token: getToken(),
  }
}

async function request (path, options = {}) {
  const { url, token } = config()
  if (!token) {
    diagnostic('request_skipped', { path, reason: 'missing_local_credential' })
    return { available: false, error: 'The Grovely Update Service is not configured.' }
  }

  const startedAt = Date.now()
  diagnostic('request_started', { path, method: options.method || 'GET', service_url: url })
  try {
    const response = await fetch(`${url}${path}`, {
      ...options,
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
        'X-Grovely-Updater-Token': token,
        ...(options.headers || {}),
      },
    })
    const body = await response.json().catch(() => ({}))
    diagnostic('request_responded', { path, status: response.status, ok: response.ok, duration_ms: Date.now() - startedAt })
    if (!response.ok) return { available: true, error: body.error || 'The Update Service could not complete that request.' }
    return { available: true, ...body }
  } catch (err) {
    diagnostic('request_failed', { path, error: safeMessage(err), duration_ms: Date.now() - startedAt })
    return { available: false, error: 'The Grovely Update Service is unavailable.' }
  }
}

function getStatus () { return request('/status') }
function checkNow () { return request('/check', { method: 'POST' }) }
function installNow () { return request('/install', { method: 'POST' }) }
module.exports = { getStatus, checkNow, installNow, getToken }
