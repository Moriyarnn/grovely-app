const DEFAULT_URL = 'http://updater:3003'
const DEFAULT_TOKEN_FILE = '/updater-state/updater-token'

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
  if (!token) return { available: false, error: 'The Grovely Update Service is not configured.' }

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
    if (!response.ok) return { available: true, error: body.error || 'The Update Service could not complete that request.' }
    return { available: true, ...body }
  } catch {
    return { available: false, error: 'The Grovely Update Service is unavailable.' }
  }
}

function getStatus () { return request('/status') }
function checkNow () { return request('/check', { method: 'POST' }) }
function installNow () { return request('/install', { method: 'POST' }) }
module.exports = { getStatus, checkNow, installNow, getToken }
