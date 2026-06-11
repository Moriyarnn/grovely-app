<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="grovely-frontend/src/assets/Logo README Dark.png">
    <source media="(prefers-color-scheme: light)" srcset="grovely-frontend/src/assets/Logo README Light.png">
    <img src="grovely-frontend/src/assets/Logo README Light.png" width="220" />
  </picture>
</p>

<p align="center">
  <a href="https://www.gnu.org/licenses/agpl-3.0"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg" alt="License: AGPL v3" /></a>
  <a href="https://github.com/Moriyarnn/grovely-app/actions/workflows/docker-publish.yml"><img src="https://github.com/Moriyarnn/grovely-app/actions/workflows/docker-publish.yml/badge.svg" alt="Docker Build" /></a>
  <img src="https://img.shields.io/badge/arch-amd64%20%7C%20arm64-lightgrey" alt="amd64 + arm64" />
  <img src="https://img.shields.io/badge/privacy-first-blueviolet" alt="Privacy First" />
  <img src="https://img.shields.io/badge/telemetry-none-green" alt="No Telemetry" />
  <img src="https://img.shields.io/badge/license%20check-offline-green" alt="Offline License" />
</p>

<p align="center">Self-hosted household hub with couples support - period tracking, shared pantry, and more on the way.</p>

<p align="center">When my wife and I moved in together, we realized every period tracker charged $40/year and sold the data, and nothing handled the rest of the household either. So I built Grovely. Every problem we ran into became a feature that tied everything together, and there's so much more we want to build.</p>

<p align="center">
  <img src="grovely-frontend/src/assets/Mobile Period Tracker.jpg" width="30%" />
  <img src="grovely-frontend/src/assets/Mobile Inventory.jpg" width="30%" />
  <img src="grovely-frontend/src/assets/Mobile Backups.jpg" width="30%" />
</p>
<p align="center"><em>Period tracker · Pantry inventory · Scheduled backups</em></p>

## Features

### Period Tracker

- Two logging modes: tap day-by-day while active, or log a complete date range retrospectively
- Flow intensity per day (spotting, light, medium, heavy) - tints the calendar so you can see patterns at a glance
- Symptom logging per day with free-text notes
- Cycle predictions powered by exponential smoothing - adapts to your history, learns your personal luteal phase length, self-corrects from past errors
- Confidence window for irregular cycles - shows a range instead of a false precise date
- Irregularity detection and data quality warnings (future-dated cycles, short gaps, abnormally long periods)
- Delete a single day from a cycle edge, or delete a complete cycle
- Current Phase card - shows today's phase (follicular, ovulatory, luteal, menstrual) with a confidence label based on logged data or prediction (premium)
- Adjust Cycle - hold-drag to resize a cycle's start or end without deleting and re-logging (premium)
- Animated onboarding tutorial covering all three logging flows
- Full cycle history with detail view per cycle

### Pantry & Shopping List

- Shared shopping list - both partners can add, check off, and remove items
- Categories, quantities, units, and price tracking per item
- Move-to-pantry flow - checked items transfer to inventory with an optional expiry date
- Expiry tracking with 5 visual states (fresh, expiring soon, expiring very soon, expires today, expired)
- Suggested expiry on move-to-pantry based on past shelf life for that item
- Merge hints when adding an item that already exists in the pantry ("Adds 500 ml to existing")
- Smart Autofill - autocomplete backed by your full purchase history, pre-fills quantity, unit, price, and store with a price delta so you know if it's more expensive than usual (premium)

### Notifications

- 18 email notification types covering period alerts, fertile window, partner-facing nudges, and pantry expiry (premium)
- Daily cron at a configurable time with startup catch-up for missed windows
- Works with any SMTP provider - Gmail, Resend, Mailgun, self-hosted
- Fully opt-in: no emails sent unless you configure SMTP credentials

### Backups

- Manual on-demand backup download from the settings panel (free)
- Scheduled automatic backups - daily cron, configurable time, local retention with startup catch-up (premium)
- Remote push to S3-compatible storage or WebDAV targets (premium)
- Backup history with per-destination status, verify, and restore from the UI (premium)

### Accounts & Access

- Two equal accounts - both partners have full access to all shared features (pantry, notifications)
- Period data is private to the account that logged it (your account, owner1) - your partner's account (owner2) sees read-only
- JWT authentication with credentials set via environment variables on first run

### Deployment

- Docker Compose with multi-arch images (amd64 + arm64) - runs on x86, Raspberry Pi, Synology, anything
- One command deploy: `docker compose up -d`
- Installable as a PWA - add to home screen on iOS and Android for a native app feel
- Reverse proxy ready - ships overlay files for Caddy, Nginx, Traefik, and dockerized proxy setups
- SQLite database - no external DB server, everything in one file you own

## Roadmap

**Next (Q3 2026)**
- SSO/OIDC support - Authelia, Authentik, Cloudflare Access
- Sleep tracker - manual logging, weekly chart, morning nudge notification, partner sync (premium)
- Pantry premium expansion - waste and use tracking with monthly summaries, reorder suggestions based on your repurchase history, store price analytics, shopping wizard, Home Assistant webhook (premium)

**Later (Q4 2026)**
- Exercise tracker - log workouts, phase-aware energy suggestions, cycle correlation (premium)
- Advanced period analytics - cycle data export (CSV/PDF), symptom pattern prediction, trend detection, cycle correlation over time, BBT and OPK logging (premium)
- Push notifications for browser and PWA
- Multi-language support

**Future**
- Recipes with cycle-phase matching and pantry crossover ("what can I cook with what's in the pantry?")
- Cross-feature analytics - sleep and exercise patterns correlated with cycle phases
- Shared weekly digest for both partners
- Symptom-triggered suggestions across features (recipes, exercise, partner nudges)
- Android and iOS native apps
- Themes

## Quick Start

```bash
mkdir grovely && cd grovely
curl -O https://raw.githubusercontent.com/Moriyarnn/grovely-app/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/Moriyarnn/grovely-app/main/.env.example
```

Go into the `.env` file and set the usernames and passwords for both accounts, then run:

```bash
docker compose up -d
```

Open **http://localhost:5173** and log in with the credentials you set in `.env`. If you changed the frontend port in `docker-compose.yml`, use that port instead.

See [INSTALL.md](./INSTALL.md) for full instructions, including reverse proxy setups (Caddy, Nginx, Traefik, Nginx Proxy Manager), backups, license keys, and troubleshooting.

## Tech Stack

- **Frontend:** Vue 3 + TypeScript + Vuetify
- **Backend:** Express 5 + SQLite (better-sqlite3)
- **Infra:** Docker Compose - dev (HMR), UAT, and prod environments

## Privacy

No telemetry. No phone-home. No external calls unless you configure SMTP, and that's opt-in. Your data never leaves your server.

## License

AGPL-3.0 open core. Email notifications, automatic backups, and advanced features require a $20/year offline license key - offline validation, no server calls.
