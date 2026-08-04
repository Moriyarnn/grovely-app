const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('all Docker images use the production-compatible Node runtime', () => {
  const dockerfiles = [
    path.join(__dirname, '..', 'Dockerfile'),
    path.join(__dirname, '..', '..', 'grovely-frontend', 'Dockerfile'),
    path.join(__dirname, '..', '..', 'grovely-updater', 'Dockerfile'),
  ]

  dockerfiles.forEach(dockerfile => {
    assert.match(fs.readFileSync(dockerfile, 'utf8'), /^FROM node:24\.18\.0-alpine(?: |$)/m)
  })

  const ci = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'ci.yml'), 'utf8')
  assert.equal((ci.match(/node-version: 24\.18\.0/g) ?? []).length, 2)
})
