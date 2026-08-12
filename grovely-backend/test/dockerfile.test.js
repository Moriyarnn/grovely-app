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

test('reverse proxy installs preserve API paths and trust exactly one proxy hop', () => {
  const root = path.join(__dirname, '..', '..')
  const backend = fs.readFileSync(path.join(root, 'grovely-backend', 'index.js'), 'utf8')
  const baseCompose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8')
  const hostProxy = fs.readFileSync(path.join(root, 'docker-compose.proxy-host.yml'), 'utf8')
  const dockerProxy = fs.readFileSync(path.join(root, 'docker-compose.proxy-docker.yml'), 'utf8')
  const uatHostProxy = fs.readFileSync(
    path.join(root, 'docker-compose.uat.proxy-host.yml'),
    'utf8',
  )
  const installGuide = fs.readFileSync(path.join(root, 'INSTALL.md'), 'utf8')

  assert.match(backend, /if \(process\.env\.TRUST_PROXY === 'true'\) app\.set\('trust proxy', 1\)/)
  assert.doesNotMatch(baseCompose, /TRUST_PROXY/)
  assert.equal((hostProxy.match(/TRUST_PROXY=true/g) ?? []).length, 1)
  assert.equal((dockerProxy.match(/TRUST_PROXY=true/g) ?? []).length, 1)
  assert.equal((uatHostProxy.match(/TRUST_PROXY=true/g) ?? []).length, 1)

  for (const nginxExample of [hostProxy, installGuide]) {
    assert.match(nginxExample, /proxy_pass http:\/\/127\.0\.0\.1:3000;/)
    assert.doesNotMatch(nginxExample, /proxy_pass http:\/\/127\.0\.0\.1:3000\/;/)
  }
})
