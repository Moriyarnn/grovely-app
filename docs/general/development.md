# Development Guidelines

## Running the App

| Environment | Compose file             | Frontend              | Backend               |
|-------------|--------------------------|-----------------------|-----------------------|
| prod        | `docker-compose.yml`     | http://localhost:5173 | http://localhost:3000 |
| dev         | `docker-compose.dev.yml` | http://localhost:5174 | http://localhost:3001 |
| uat         | `docker-compose.uat.yml` | http://localhost:5175 | http://localhost:3002 |

- prod and UAT run frozen built images — code changes don't apply until you rebuild (`docker compose up -d --build`)
- dev uses live volume mounts with HMR — changes apply instantly
- UAT shows a `UAT` badge (bottom-right); dev shows `DEV`; prod shows nothing

## Env Promotion Workflow
1. Develop and test in **dev** (5174)
2. Rebuild UAT and verify: `docker compose -f docker-compose.uat.yml up -d --build`
3. Once UAT is validated, promote to prod: `docker compose up -d --build`
4. Never test unvalidated features directly in prod

## GitHub CLI
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
```
Installed at `C:\Program Files\GitHub CLI\gh.exe` — PATH must be set manually in bash.

Bug tracking: GitHub Issues on `Moriyarnn/grovely-app`

## Docker Notes
- `.dockerignore` in `grovely-backend/` excludes `node_modules`, `.env`, and `data` from the build context — critical for native modules (`better-sqlite3`) so Windows-compiled binaries don't overwrite Linux ones in the image.
- Anonymous volumes (`- /app/node_modules`) mask host bind-mount. If a native module breaks after a rebuild, remove the stale volume: `docker volume rm <id>`.
- Env vars are loaded via `env_file: ./grovely-backend/.env` in `docker-compose.yml`.
