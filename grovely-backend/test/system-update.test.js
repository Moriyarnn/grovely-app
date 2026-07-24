const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'grovely-system-update-test-secret'

const { requireAuth } = require('../middleware/auth')
const systemUpdateRouter = require('../routes/system-update')

function tokenFor (id, username, role) {
  return jwt.sign({ id, username, role }, process.env.JWT_SECRET, { expiresIn: '5m' })
}

async function startApp () {
  const app = express()
  app.use(express.json())
  app.use('/api/system/update', requireAuth, systemUpdateRouter({}))
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
  })
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  }
}

async function request (baseUrl, path, options = {}) {
  const response = await fetch(baseUrl + path, options)
  return { response, body: await response.json() }
}

let app

test.before(async () => { app = await startApp() })
test.after(async () => { await app.close() })

test('both household roles can read update status', async () => {
  for (const [id, username, role] of [[1, 'owner', 'owner1'], [2, 'partner', 'owner2']]) {
    const { response, body } = await request(app.baseUrl, '/api/system/update', {
      headers: { Authorization: `Bearer ${tokenFor(id, username, role)}` },
    })
    assert.equal(response.status, 200)
    assert.equal(body.current_version, require('../package.json').version)
    assert.equal(body.available, false)
  }
})

test('pre-update snapshots require the internal updater credential', async () => {
  const owner = { Authorization: `Bearer ${tokenFor(1, 'owner', 'owner1')}` }
  const previousToken = process.env.UPDATER_TOKEN
  process.env.UPDATER_TOKEN = 'local-test-token'

  const absent = await request(app.baseUrl, '/api/system/update/internal/pre-update-snapshot', { method: 'POST', headers: owner })
  assert.equal(absent.response.status, 401)

  const incorrect = await request(app.baseUrl, '/api/system/update/internal/pre-update-snapshot', {
    method: 'POST',
    headers: { ...owner, 'X-Grovely-Updater-Token': 'incorrect' },
  })
  assert.equal(incorrect.response.status, 401)
  if (previousToken === undefined) delete process.env.UPDATER_TOKEN
  else process.env.UPDATER_TOKEN = previousToken
})
