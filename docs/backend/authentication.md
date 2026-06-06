# Authentication

## Overview

Two accounts: **owner** (full read/write on all features) and **partner** (read-only on period data, full access on shared features like groceries). Both accounts are free - no premium gate on access.

Authentication uses JWT (JSON Web Token). The client sends credentials to `/api/auth/login`, receives a token, and includes it as a `Bearer` header on every subsequent request.

---

## First-Run Setup

Credentials are set via `.env` before the first run. The backend seeds both accounts into the database on startup - only if they don't already exist.

```env
OWNER_USERNAME=owner
OWNER_PASSWORD=yourpassword

PARTNER_USERNAME=partner
PARTNER_PASSWORD=yourpassword
```

**Important:** changing these values after the first run has no effect. The accounts are already in the database. To reset credentials, delete the database file (`data/wifey.db`) and restart - this wipes all data.

Passwords are hashed with bcrypt (cost factor 10) before being stored. The plaintext password is never persisted.

---

## JWT Secret

The JWT secret is used to sign and verify login tokens. It is auto-generated on first run and saved to `data/secret.key`. You never need to touch it.

**What it is:** a long random string that acts as a private key for the app's login tokens. If someone knows the secret, they can forge tokens and log in as any user. It must be random - not a word or phrase.

**How it works:**
1. On startup, if `JWT_SECRET` is not set in `.env`, the app checks for `data/secret.key`
2. If the file doesn't exist, it generates 96 random hex characters and saves them there
3. If the file exists, it loads from there
4. The secret is never logged or exposed via any API

`data/secret.key` is excluded from both `.gitignore` and `.dockerignore` - it never leaves the server.

**Advanced:** if you want to manage the secret yourself (e.g. to rotate it, or sync across instances), set `JWT_SECRET` in `.env`. This overrides the auto-generated file. Minimum 32 characters; shorter values are rejected at startup with a warning.

**Rotating the secret:** delete `data/secret.key` (or change `JWT_SECRET` in `.env`) and restart. All existing sessions are immediately invalidated - every logged-in user will be sent back to the login screen.

---

## Token Behaviour

- Tokens expire after **30 days**
- There is no refresh token - after expiry the user logs in again
- Token payload: `{ id, username, role }`
- Algorithm: HS256 (symmetric, single-server setup)

---

## Rate Limiting

The `/api/auth/login` endpoint is rate-limited to **10 attempts per 15 minutes per IP**. After that, requests return `429 Too Many Requests` until the window resets. This prevents brute-force attacks against the login endpoint.

---

## Protected Routes

All API routes except `/api/auth/login` require a valid `Authorization: Bearer <token>` header. Requests without a token return `401 Unauthorized`. Requests with an invalid or expired token also return `401`.

The `/api/auth/me` endpoint returns the current user's id, username, and role - useful for the frontend to restore session state on page load.

---

## HTTPS

The app does not handle TLS directly. HTTPS must be provided by a reverse proxy in front of the container. Recommended options:

- **Caddy** - easiest; handles Let's Encrypt certificates automatically with zero config
- **Nginx Proxy Manager** - UI-based, also does Let's Encrypt automatically
- **Traefik** - Docker-native, common in advanced self-hosted setups

If you are only running the app on your local network (never exposed to the internet), HTTP is acceptable. For any internet-facing deployment, a reverse proxy with HTTPS is required - credentials and tokens travel in plaintext over plain HTTP.

---

## Roles

| Role | Period data | Groceries | Settings |
|------|-------------|-----------|----------|
| owner | read + write | read + write | read + write |
| partner | read only | read + write | read + write |

The distinction is only on period data writes - everything else is equal between roles. Either partner in the household may be more tech-savvy or more engaged with the app; settings access should not be gated by who owns the period data.

Role is stored in the JWT payload and checked on protected routes. The `requireOwner` middleware is applied to all period write routes (POST, PATCH, DELETE on `/api/period/cycles` and `/api/period/cycle-days`). Shared household features (groceries, settings) do not use `requireOwner`.

### Private notes (partner visibility)

Period notes belong to the owner. By default the partner cannot read them; the owner can opt to share them via the `partner_can_read_notes` setting (global, owner-managed, default off). This is enforced on the **backend**, not just in the UI: `cycle_days.notes` and `gap_day_logs.notes` are decrypted and returned to the owner always, and to the partner only when the setting is on - otherwise they are withheld. The gate lives in `revealPrivateFields` (`utils/encryption.js`) and is applied on every period read route.

The notes are also encrypted at rest, so they stay private even inside a backup file the partner could export (see [Backups](backups.md#encrypted-fields)). Gap day notes follow the same gate as cycle day notes - previously they were filtered out of the partner view entirely and the setting never revealed them.

### Frontend role enforcement

Write controls (log day, delete cycle, adjust cycle) are hidden entirely for the partner role - not disabled, not shown at all. A single passive notice is shown at the top of PeriodHome when the logged-in user is a partner, explaining that period data is read-only. No per-action error messages.

### Role policy for new features

Every new feature must define its role access before implementation:
- Which actions (read/write/delete) are available to each role
- Whether the feature is shared (both roles full access) or owner-only writes
- What the partner sees: full UI, read-only UI, or hidden entirely

Document this in the feature's backend and frontend docs before writing any route or component code.

---

## Per-User Preferences

Visual and personalization settings (e.g. flow hue, theme options) are stored per user in the database, not in `localStorage`. This matters because both partners may use the app on the same device - `localStorage` is per-browser, not per-user, so it would cause them to overwrite each other's preferences.

**Design:** a `user_preferences` table keyed to `user_id`. On login, the frontend calls `/api/auth/me` (or a dedicated preferences endpoint) to load that user's preferences and apply them. On change, it saves back via the API.

**Current state:** flow hue is temporarily stored in `localStorage` (see `App.vue`). This must be migrated to per-user DB storage when settings (#21) is implemented. Do not add more `localStorage`-based preferences in the meantime.

---

## Phase 2b - SSO/OIDC (post-launch, premium)

Planned after launch: support for Authelia, Authentik, and Cloudflare Access via OIDC. This maps `preferred_username` from the OIDC provider to the existing owner/partner roles. Configured via `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` in `.env`. Premium feature.
