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
mkdir grovely && cd grovely
curl -O https://raw.githubusercontent.com/Moriyarnn/grovely-app/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/Moriyarnn/grovely-app/main/grovely-backend/.env.example
# edit .env: set OWNER1_* and OWNER2_*
docker compose up -d
```

Then open `http://your-server:5173`.

See [INSTALL.md](./INSTALL.md) for full instructions, including reverse proxy setups (Caddy, Nginx, Traefik, Nginx Proxy Manager), backups, license keys, and troubleshooting.

## Tech Stack

- **Frontend:** Vue 3 + TypeScript + Vuetify
- **Backend:** Express 5 + SQLite (better-sqlite3)
- **Infra:** Docker Compose — dev (HMR), UAT, and prod environments

## Privacy

No telemetry. No phone-home. No external calls unless you configure SMTP — and that's opt-in. Your data never leaves your server.

## License

AGPL-3.0 open core. Household/couple features (partner access, notifications, groceries) require a $20/year offline license key — offline validation, no server calls.
