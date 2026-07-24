const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')

let feedPayload = { version: 'v0.14.1', summary: 'Test release' }
let feedServer
let updater
let updaterPort
let tempDir
const token = 'test-updater-token'

function listen (server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
}

async function request (url, options) {
  const response = await fetch(url, options)
  return { status: response.status, body: await response.json() }
}

async function waitForUpdater () {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const result = await request(`http://127.0.0.1:${updaterPort}/status`, { headers: { 'X-Grovely-Updater-Token': token } })
      if (result.status === 200) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('Updater did not start')
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grovely-updater-test-'))
  feedServer = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(feedPayload))
  })
  const feedPort = await listen(feedServer)

  const portServer = http.createServer()
  updaterPort = await listen(portServer)
  await new Promise(resolve => portServer.close(resolve))

  updater = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(updaterPort),
      UPDATER_TOKEN: token,
      UPDATE_CHECK_ENABLED: 'false',
      UPDATE_FEED_URL: `http://127.0.0.1:${feedPort}/stable.json`,
      UPDATE_STATE_FILE: path.join(tempDir, 'state.json'),
    },
    stdio: 'ignore',
  })
  await waitForUpdater()
})

after(async () => {
  updater?.kill()
  await new Promise(resolve => feedServer?.close(resolve))
  await fs.rm(tempDir, { recursive: true, force: true })
})

test('rejects requests without the local updater token', async () => {
  const result = await request(`http://127.0.0.1:${updaterPort}/status`)
  assert.equal(result.status, 401)
  assert.equal(result.body.error, 'Unauthorized updater request.')
})

test('accepts only valid public release metadata', async () => {
  const options = { method: 'POST', headers: { 'X-Grovely-Updater-Token': token } }
  const valid = await request(`http://127.0.0.1:${updaterPort}/check`, options)
  assert.equal(valid.status, 200)
  assert.equal(valid.body.latest.version, 'v0.14.1')

  feedPayload = { version: 'not-a-version' }
  const invalid = await request(`http://127.0.0.1:${updaterPort}/check`, options)
  assert.equal(invalid.status, 200)
  assert.match(invalid.body.error, /invalid version/i)
  feedPayload = { version: 'v0.14.1', summary: 'Test release' }
})

test('creates a persistent local credential when no environment token exists', async () => {
  const credentialDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grovely-updater-token-'))
  const tokenFile = path.join(credentialDir, 'updater-token')
  const portServer = http.createServer()
  const port = await listen(portServer)
  await new Promise(resolve => portServer.close(resolve))
  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      UPDATE_CHECK_ENABLED: 'false',
      UPDATE_STATE_FILE: path.join(credentialDir, 'state.json'),
      UPDATER_TOKEN_FILE: tokenFile,
    },
    stdio: 'ignore',
  })
  try {
    let generated = ''
    for (let attempt = 0; attempt < 40; attempt++) {
      try { generated = (await fs.readFile(tokenFile, 'utf8')).trim() } catch {}
      if (generated) break
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    assert.match(generated, /^[a-f0-9]{64}$/)
    const result = await request(`http://127.0.0.1:${port}/status`, { headers: { 'X-Grovely-Updater-Token': generated } })
    assert.equal(result.status, 200)
  } finally {
    child.kill()
    await fs.rm(credentialDir, { recursive: true, force: true })
  }
})
