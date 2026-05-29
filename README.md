# Grovely

Self-hosted household hub for couples. Period tracker with cycle predictions,
email notifications, and a shared grocery list — runs on your own hardware.

## Features

- Period tracker: log day-by-day or retrospectively as a date range
- Flow intensity levels (spotting → light → medium → heavy) that affect the calendar color
- Cycle predictions that adapt — exponential smoothing over your history, personalized luteal phase, self-correcting confidence window for irregular cycles
- Email notifications: 13+ types (Gmail SMTP, opt-in) — period due, overdue, fertile window, period ended, and partner-facing versions
- Two-account system: owner (full access) + partner (read-only on period data, full grocery access)
- Shared grocery list with categories, quantities, prices, and move-to-pantry flow
- Pantry inventory tracker
- Installable as a PWA — add to home screen on iOS and Android
- Docker Compose deploy — one `docker compose up` and it runs

## Quick Start

```bash
cp .env.example .env   # fill in SMTP settings
docker compose up -d
```

## Reverse Proxy

The base compose file publishes the frontend on `5173` and the backend on `3000`. Two opt-in overrides take those ports off public interfaces when a reverse proxy fronts the app:

```bash
# Reverse proxy on the host (Caddy, Nginx, etc.) — binds both services to 127.0.0.1
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build

# Reverse proxy in another container (Traefik, NPM, dockerized Caddy) — no host ports,
# both services attach to an external Docker network named "proxy"
docker network create proxy
docker compose -f docker-compose.yml -f docker-compose.proxy-docker.yml up -d --build
```

`Caddyfile.example` at the repo root is a working same-origin Caddy config (SPA at `/`, API at `/api/*` and `/health`, automatic HTTPS via Let's Encrypt). Replace the hostname and email and copy it into place.

## Tech Stack

- **Frontend:** Vue 3 + TypeScript + Vuetify
- **Backend:** Express 5 + SQLite (better-sqlite3)
- **Infra:** Docker Compose — dev (HMR), UAT, and prod environments

## Privacy

No telemetry. No phone-home. No external calls unless you configure SMTP — and that's opt-in. Your data never leaves your server.

## License

AGPL-3.0 open core. Household/couple features (partner access, notifications, groceries) require a $20/year offline license key — offline validation, no server calls.
