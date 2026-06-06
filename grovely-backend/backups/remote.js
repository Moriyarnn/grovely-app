/**
 * Remote backup push (premium — issue #136, Phase B)
 *
 * Two protocols supported, both env-configured (never in DB, never in UI):
 *   - S3-compatible: AWS S3, Backblaze B2, Cloudflare R2, Wasabi, MinIO, etc.
 *   - WebDAV: Nextcloud, ownCloud, Synology, QNAP, TrueNAS, Apache mod_dav, etc.
 *
 * Both are optional. If neither is configured, runBackup() reports remote_status='skipped'.
 * If one is configured and fails, the local snapshot still succeeds — remote push is best-effort.
 *
 * Credentials live in env vars only. They never appear in the database, the UI, the logs
 * (only target name + error message are logged), or the backup file itself.
 */

const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Configuration discovery
// ---------------------------------------------------------------------------

function s3Config () {
  const endpoint = (process.env.BACKUP_S3_ENDPOINT || '').trim()
  const bucket   = (process.env.BACKUP_S3_BUCKET   || '').trim()
  const key      = (process.env.BACKUP_S3_KEY      || '').trim()
  const secret   = (process.env.BACKUP_S3_SECRET   || '').trim()
  const region   = (process.env.BACKUP_S3_REGION   || 'us-east-1').trim()
  const prefix   = (process.env.BACKUP_S3_PREFIX   || '').trim()
  // All four are required. Endpoint is optional for real AWS but required for everything
  // else, so we always demand it — keeps the config surface obvious.
  if (!endpoint || !bucket || !key || !secret) return null
  const name = (process.env.BACKUP_S3_NAME || '').trim()
  return { endpoint, bucket, key, secret, region, prefix, name }
}

// Reports which required S3 fields are missing. Used by the Phase C destinations
// panel to flag partial configs in red instead of silently hiding them.
function s3ConfigDiagnose () {
  const fields = {
    BACKUP_S3_ENDPOINT: (process.env.BACKUP_S3_ENDPOINT || '').trim(),
    BACKUP_S3_BUCKET:   (process.env.BACKUP_S3_BUCKET   || '').trim(),
    BACKUP_S3_KEY:      (process.env.BACKUP_S3_KEY      || '').trim(),
    BACKUP_S3_SECRET:   (process.env.BACKUP_S3_SECRET   || '').trim(),
  }
  const set     = Object.entries(fields).filter(([, v]) => v).map(([k]) => k)
  const missing = Object.entries(fields).filter(([, v]) => !v).map(([k]) => k)
  let state = 'absent'
  if (set.length === 4) state = 'configured'
  else if (set.length > 0) state = 'partial'
  return { state, missing }
}

function webdavConfig () {
  const url  = (process.env.BACKUP_WEBDAV_URL  || '').trim()
  const user = (process.env.BACKUP_WEBDAV_USER || '').trim()
  const pass = (process.env.BACKUP_WEBDAV_PASS || '').trim()
  if (!url || !user || !pass) return null
  const name = (process.env.BACKUP_WEBDAV_NAME || '').trim()
  return { url, user, pass, name }
}

function webdavConfigDiagnose () {
  const fields = {
    BACKUP_WEBDAV_URL:  (process.env.BACKUP_WEBDAV_URL  || '').trim(),
    BACKUP_WEBDAV_USER: (process.env.BACKUP_WEBDAV_USER || '').trim(),
    BACKUP_WEBDAV_PASS: (process.env.BACKUP_WEBDAV_PASS || '').trim(),
  }
  const set     = Object.entries(fields).filter(([, v]) => v).map(([k]) => k)
  const missing = Object.entries(fields).filter(([, v]) => !v).map(([k]) => k)
  let state = 'absent'
  if (set.length === 3) state = 'configured'
  else if (set.length > 0) state = 'partial'
  return { state, missing }
}

/**
 * Names of every remote currently configured. Used by Phase C status endpoint
 * to render "Destination" panel without exposing credentials.
 */
function getConfiguredTargets () {
  const targets = []
  if (s3Config())     targets.push('s3')
  if (webdavConfig()) targets.push('webdav')
  return targets
}

// ---------------------------------------------------------------------------
// Per-protocol push
// ---------------------------------------------------------------------------

// Hard cap on how long a single remote push can hang. Without this, a bad
// endpoint can stall the whole /run-now request for tens of seconds while the
// SDK retries — long enough that the browser fetch times out and the UI shows
// a false failure even though the local snapshot succeeded.
const REMOTE_PUSH_TIMEOUT_MS = 4000

async function pushS3 (filePath) {
  const cfg = s3Config()
  if (!cfg) return { status: 'skipped' }

  // Lazy require — the SDK is ~10 MB. No point loading it if no one's using S3.
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: { accessKeyId: cfg.key, secretAccessKey: cfg.secret },
    forcePathStyle: true, // broadest compatibility across S3-compatible providers
    maxAttempts: 1,        // no SDK-level retry storm on a bad endpoint
  })

  const filename = path.basename(filePath)
  const remoteKey = cfg.prefix
    ? `${cfg.prefix.replace(/\/+$/, '')}/${filename}`
    : filename

  const body = fs.readFileSync(filePath)

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), REMOTE_PUSH_TIMEOUT_MS)
  try {
    await client.send(new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: remoteKey,
      Body: body,
      ContentType: 'application/json',
    }), { abortSignal: ac.signal })
  } finally {
    clearTimeout(timer)
  }

  return { status: 'ok', remoteKey: `s3://${cfg.bucket}/${remoteKey}` }
}

async function pushWebDAV (filePath) {
  const cfg = webdavConfig()
  if (!cfg) return { status: 'skipped' }

  // Lazy require for symmetry with S3 — and so that a missing `webdav` install
  // only breaks the people who actually configured it.
  const { createClient } = require('webdav')

  const client = createClient(cfg.url, { username: cfg.user, password: cfg.pass })

  const filename = path.basename(filePath)
  // The WebDAV URL is the root; we drop the file straight under it. Users who want a
  // subfolder put it in the URL (e.g. https://nc.example.com/remote.php/dav/files/me/grovely-backups/).
  const remotePath = `/${filename}`

  const body = fs.readFileSync(filePath)

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), REMOTE_PUSH_TIMEOUT_MS)
  try {
    await client.putFileContents(remotePath, body, { overwrite: true, signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }

  return { status: 'ok', remoteKey: `webdav:${remotePath}` }
}

// ---------------------------------------------------------------------------
// Target resolution helpers
// ---------------------------------------------------------------------------

// Derives the protocol type from a target name.
// Convention: 's3' and 's3:*' are S3-compatible; 'webdav' and 'webdav:*' are WebDAV.
// Future named targets ('s3:archive', 'webdav:nextcloud') follow the same convention
// — add config resolution for them in s3Config(name) / webdavConfig(name) without
// touching this function or the routes.
function targetProtocol (name) {
  if (name === 's3'     || name.startsWith('s3:'))     return 's3'
  if (name === 'webdav' || name.startsWith('webdav:')) return 'webdav'
  return null
}

// Resolve S3 config for a named target.
// When multi-target support is added, extend this to read per-name env vars
// (e.g. BACKUP_S3_ARCHIVE_ENDPOINT for 's3:archive') before falling back to the
// default set — callers don't change.
function s3ConfigForTarget (name) {
  return s3Config()  // currently one S3 target; extend here for named variants
}

// Same pattern for WebDAV.
function webdavConfigForTarget (name) {
  return webdavConfig()
}

// ---------------------------------------------------------------------------
// Live listing — returns what is actually in the destination right now
// ---------------------------------------------------------------------------

const LIST_TIMEOUT_MS     = 10000
const DOWNLOAD_TIMEOUT_MS = 30000

async function _listS3 (cfg) {
  const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3')
  const client = new S3Client({
    endpoint: cfg.endpoint, region: cfg.region,
    credentials: { accessKeyId: cfg.key, secretAccessKey: cfg.secret },
    forcePathStyle: true, maxAttempts: 1,
  })
  const ac    = new AbortController()
  const timer = setTimeout(() => ac.abort(), LIST_TIMEOUT_MS)
  let result
  try {
    result = await client.send(
      new ListObjectsV2Command({ Bucket: cfg.bucket, Prefix: cfg.prefix || '' }),
      { abortSignal: ac.signal }
    )
  } finally {
    clearTimeout(timer)
  }
  return (result.Contents || [])
    .filter(obj => obj.Key.endsWith('.json'))
    .map(obj => ({
      remote_key:    obj.Key,
      filename:      path.basename(obj.Key),
      size_bytes:    obj.Size ?? null,
      last_modified: obj.LastModified ? obj.LastModified.toISOString() : null,
    }))
    .sort((a, b) => (b.last_modified || '').localeCompare(a.last_modified || ''))
}

async function _listWebDAV (cfg) {
  const { createClient } = require('webdav')
  const client  = createClient(cfg.url, { username: cfg.user, password: cfg.pass })
  const ac      = new AbortController()
  const timer   = setTimeout(() => ac.abort(), LIST_TIMEOUT_MS)
  let contents
  try {
    contents = await client.getDirectoryContents('/', { signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }
  return contents
    .filter(item => item.type === 'file' && item.basename.endsWith('.json'))
    .map(item => ({
      remote_key:    item.filename,
      filename:      item.basename,
      size_bytes:    item.size ?? null,
      last_modified: item.lastmod ?? null,
    }))
    .sort((a, b) => (b.last_modified || '').localeCompare(a.last_modified || ''))
}

/**
 * List all backup files currently present in a named remote target.
 * Returns null when the target is not configured, an array otherwise.
 * targetName matches the strings returned by getConfiguredTargets() —
 * currently 's3' or 'webdav', extensible to 's3:archive', 'webdav:nextcloud', etc.
 */
async function listTarget (targetName) {
  const protocol = targetProtocol(targetName)
  if (protocol === 's3') {
    const cfg = s3ConfigForTarget(targetName)
    if (!cfg) return null
    return _listS3(cfg)
  }
  if (protocol === 'webdav') {
    const cfg = webdavConfigForTarget(targetName)
    if (!cfg) return null
    return _listWebDAV(cfg)
  }
  return null
}

// ---------------------------------------------------------------------------
// Download — fetch the raw bytes of a single backup from a named target
// ---------------------------------------------------------------------------

async function _downloadS3 (cfg, remoteKey) {
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
  const client = new S3Client({
    endpoint: cfg.endpoint, region: cfg.region,
    credentials: { accessKeyId: cfg.key, secretAccessKey: cfg.secret },
    forcePathStyle: true, maxAttempts: 1,
  })
  const ac    = new AbortController()
  const timer = setTimeout(() => ac.abort(), DOWNLOAD_TIMEOUT_MS)
  let response
  try {
    response = await client.send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: remoteKey }),
      { abortSignal: ac.signal }
    )
  } finally {
    clearTimeout(timer)
  }
  const chunks = []
  for await (const chunk of response.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function _downloadWebDAV (cfg, remoteKey) {
  const { createClient } = require('webdav')
  const client  = createClient(cfg.url, { username: cfg.user, password: cfg.pass })
  const ac      = new AbortController()
  const timer   = setTimeout(() => ac.abort(), DOWNLOAD_TIMEOUT_MS)
  let content
  try {
    content = await client.getFileContents(remoteKey, { format: 'text', signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }
  return Buffer.from(typeof content === 'string' ? content : JSON.stringify(content))
}

/**
 * Download a single backup file from a named remote target.
 * targetName and remoteKey come from the items returned by listTarget().
 */
async function downloadFromTarget (targetName, remoteKey) {
  const protocol = targetProtocol(targetName)
  if (protocol === 's3') {
    const cfg = s3ConfigForTarget(targetName)
    if (!cfg) throw new Error(`Target '${targetName}' is not configured`)
    return _downloadS3(cfg, remoteKey)
  }
  if (protocol === 'webdav') {
    const cfg = webdavConfigForTarget(targetName)
    if (!cfg) throw new Error(`Target '${targetName}' is not configured`)
    return _downloadWebDAV(cfg, remoteKey)
  }
  throw new Error(`Unknown target '${targetName}'`)
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Push the file to every configured remote. Always resolves (never throws) —
 * remote failures are returned, not raised, so the local backup stays the source of truth.
 *
 * Returns an array of per-destination results (one entry per configured+enabled remote):
 *   []                                                          — no remotes configured
 *   [{ destination: 's3',    status: 'ok',      error: null }]
 *   [{ destination: 'webdav', status: 'error',  error: '...' }]
 *
 * The destination string ('s3', 'webdav') is intentionally extensible — future named
 * targets like 's3:archive' or 'webdav:nextcloud' add new entries without schema changes.
 */
async function pushToRemotes (filePath, { enabledTargets } = {}) {
  const allTargets = getConfiguredTargets()
  const targets = enabledTargets
    ? allTargets.filter(name => enabledTargets.includes(name))
    : allTargets

  const results = []
  for (const name of targets) {
    try {
      const fn = name === 's3' ? pushS3 : pushWebDAV
      const r = await fn(filePath)
      results.push({ destination: name, status: r.status, error: null })
    } catch (err) {
      results.push({ destination: name, status: 'error', error: err?.message || String(err) })
    }
  }
  return results
}

module.exports = {
  getConfiguredTargets,
  pushToRemotes,
  listTarget,
  downloadFromTarget,
  // Exposed for Phase C status panel (without leaking credentials)
  describeTargets () {
    const out = []
    const s3 = s3Config()
    if (s3) out.push({ name: 's3', display_name: s3.name || null, endpoint: s3.endpoint, bucket: s3.bucket, prefix: s3.prefix || null })
    const wd = webdavConfig()
    if (wd) out.push({ name: 'webdav', display_name: wd.name || null, url: wd.url })
    return out
  },
  // Per-destination config diagnosis — surfaces partial configs (some env vars
  // set, some missing) so the UI can flag them in red instead of hiding them.
  diagnoseTargets () {
    return {
      s3:     s3ConfigDiagnose(),
      webdav: webdavConfigDiagnose(),
    }
  },
}
