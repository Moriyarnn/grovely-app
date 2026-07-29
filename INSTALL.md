# Installing Grovely

A self-hosted household hub for couples: period tracker, shared grocery list, pantry. Runs on your own hardware with Docker Compose.

This guide walks you through three deployment shapes:

- **Direct**: open Grovely locally on `http://localhost:5173`, no domain or HTTPS
- **Behind a host-installed reverse proxy**: Caddy, Nginx, Apache, or HAProxy running directly on the host
- **Behind a dockerized reverse proxy**: Traefik, Nginx Proxy Manager, dockerized Caddy

You only need one `docker-compose.yml` and an `.env` file. No cloning, no building.

## Requirements

- A Linux, macOS, or Windows host with Docker Engine 24+ and Docker Compose v2
- 256 MB free RAM (backend) + 128 MB (frontend)
- ~50 MB disk for the images, plus growth for your data
- (Optional) A domain name and reverse proxy if you want HTTPS and a real URL

Grovely's images are published as multi-arch (linux/amd64 and linux/arm64), so they run on x86 servers, Apple Silicon Macs, and Raspberry Pi 4/5.

## 1. Direct install (no reverse proxy)

The fastest path. Frontend served on port 5173, backend on 3000.

### Step 1: create a folder for Grovely

```bash
mkdir grovely && cd grovely
```

### Step 2: download the compose file and the env template

```bash
curl -LO https://github.com/grovely-org/grovely-app/releases/latest/download/docker-compose.yml
curl -L -o .env https://github.com/grovely-org/grovely-app/releases/latest/download/example.env
```

The `example.env` file is the canonical reference for every supported variable, with inline notes explaining what each one does (accounts, license, SMTP, backups, timezone, etc.). Open it, fill in `OWNER1_*` and `OWNER2_*`, leave the rest commented until you need it.

If you'd rather start from scratch, the absolute minimum to boot Grovely is:

```env
OWNER1_USERNAME=you
OWNER1_PASSWORD=change-me
OWNER2_USERNAME=partner
OWNER2_PASSWORD=change-me
DISABLE_EMAIL=true
```

Drop that into a file called `.env` next to `docker-compose.yml` and you're ready. Pull `example.env` later when you want to enable notifications, backups, or a license.

### Step 3 (optional): validate your `.env`

Catches typos, leftover placeholders, missing required values, and common gotchas before you start the stack:

```bash
curl -LO https://github.com/grovely-org/grovely-app/releases/latest/download/validate-env.sh
chmod +x validate-env.sh
./validate-env.sh
```

It exits non-zero on any error so you can chain it: `./validate-env.sh && docker compose up -d`.

### Step 4: pull and start

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Open `http://localhost:5173`, log in with `OWNER1_USERNAME` / `OWNER1_PASSWORD`, and you're in.

## 2. With a host-installed reverse proxy (Caddy, Nginx, Apache)

Use this when your reverse proxy runs directly on the host OS, not in Docker. Grovely binds to `127.0.0.1` only, so the host's reverse proxy reaches it via loopback and nothing is exposed publicly.

### Step 1: folder, compose files, and env

```bash
mkdir grovely && cd grovely
curl -LO https://github.com/grovely-org/grovely-app/releases/latest/download/docker-compose.yml
curl -LO https://github.com/grovely-org/grovely-app/releases/latest/download/docker-compose.proxy-host.yml
curl -L -o .env https://github.com/grovely-org/grovely-app/releases/latest/download/example.env
```

Fill in your `.env` (see Step 2 of section 1).

### Step 2: start

Optional: validate your `.env` before starting (catches placeholders, missing required values, and common mistakes). See [Step 3 of section 1](#step-3-optional-validate-your-env) for the validator script — it works the same for any install method.

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy-host.yml pull
docker compose -f docker-compose.yml -f docker-compose.proxy-host.yml up -d
```

### Step 3: point your reverse proxy at Grovely

`docker-compose.proxy-host.yml` includes ready-to-paste Caddyfile and Nginx snippets at the top of the file. Replace `grovely.example.com` with your domain.

For a full Caddyfile with security headers, gzip, and health-check routing, grab the example from the repo and replace the domain and email:

```bash
curl -LO https://github.com/grovely-org/grovely-app/releases/latest/download/Caddyfile.example
```

The minimal version:

**Caddy** (`/etc/caddy/Caddyfile` on Linux, `C:\caddy\Caddyfile` on Windows):

```
grovely.example.com {
  handle /api/* {
    reverse_proxy 127.0.0.1:3000
  }
  handle /health {
    reverse_proxy 127.0.0.1:3000
  }
  reverse_proxy 127.0.0.1:5173
}
```

**Nginx**:

```nginx
server {
  server_name grovely.example.com;
  location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location / {
    proxy_pass http://127.0.0.1:5173/;
    proxy_set_header Host $host;
  }
}
```

Reload your proxy (`sudo systemctl reload caddy` or `sudo nginx -s reload`), and Grovely is live at your domain.

## 3. With a dockerized reverse proxy (Traefik, NPM, dockerized Caddy)

Use this when your reverse proxy is itself a Docker container. Grovely publishes no host ports, the reverse proxy reaches it over a shared Docker network.

### Step 1: create the shared network (once)

```bash
docker network create proxy
```

If you already have a shared network with a different name (e.g. `web`, `traefik`, `caddy_net`), put `PROXY_NETWORK=your-network-name` in your `.env`.

### Step 2: folder, compose files, and env

```bash
mkdir grovely && cd grovely
curl -LO https://github.com/grovely-org/grovely-app/releases/latest/download/docker-compose.yml
curl -LO https://github.com/grovely-org/grovely-app/releases/latest/download/docker-compose.proxy-docker.yml
curl -L -o .env https://github.com/grovely-org/grovely-app/releases/latest/download/example.env
```

Fill in your `.env` (see Step 2 of section 1).

### Step 3: start

Optional: validate your `.env` before starting (catches placeholders, missing required values, and common mistakes). See [Step 3 of section 1](#step-3-optional-validate-your-env) for the validator script — it works the same for any install method.

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy-docker.yml pull
docker compose -f docker-compose.yml -f docker-compose.proxy-docker.yml up -d
```

### Step 4: point your reverse proxy at Grovely

Attach your reverse-proxy container to the same `proxy` network, then point it at:

- Frontend: `grovely-prod-frontend:5173`
- Backend: `grovely-prod-backend:3000`

For Traefik, you'd typically use container labels. For Nginx Proxy Manager, add proxy hosts via its admin UI. The same Caddyfile shape from section 2 works inside a dockerized Caddy.

## Configuration

Everything Grovely accepts is documented inline in [`example.env`](https://github.com/grovely-org/grovely-app/blob/main/example.env), with comments explaining each variable. The quick summary:

**Required**

- `OWNER1_USERNAME` / `OWNER1_PASSWORD`: primary account (full access). Seeded on first run.
- `OWNER2_USERNAME` / `OWNER2_PASSWORD`: partner account (shared household + read-only period data).

**Common optional**

- `LICENSE_KEY`: premium license, unlocks notifications, backups, advanced analytics. Get one at [grovely.lemonsqueezy.com](https://grovely.lemonsqueezy.com/).
- `DISABLE_EMAIL=true`: disable email entirely (useful during setup).
- `TZ`: container timezone, e.g. `Europe/Madrid`. Defaults to UTC.
- `PUID` / `PGID`: user/group IDs for files in the data volume. Defaults to `1000:1000`.
- `MAIL_*`: SMTP settings for notifications (premium). Works with any provider.
- `BACKUP_S3_*` / `BACKUP_WEBDAV_*`: off-site backup targets (premium).

### Changing credentials

`OWNER1_*` / `OWNER2_*` are only used on first run to seed the accounts. To change a username or password later, do it in-app under Settings.

## Updating

Grovely's updater checks `https://grovely.org/releases/stable.json` once every 24 hours to show both household accounts when a tagged release is available. The request contains no account, license, installed-version, usage, or household data. Normal network metadata such as your server's public IP is visible to the release service. Set `UPDATE_CHECK_ENABLED=false` in `.env` and restart if you prefer not to make release checks.

When the updater is available, either partner can start an update from Home. It creates a local pre-update recovery snapshot before pulling matched images and waiting for the stack health check. If the updater is unavailable, use the commands below.

Normal releases update the images while keeping your local Compose files and proxy configuration intact. If a future release requires a Compose-structure migration, its release notes will call that out and provide the exact one-time command. Grovely never silently overwrites local Compose files.

```bash
docker compose pull
docker compose up -d
```

(Add `-f docker-compose.proxy-host.yml` or `-f docker-compose.proxy-docker.yml` if you're using one of those overlays.)

Your data is in a named Docker volume (`grovely-prod_sqlite_data_prod`) and persists across updates.

## Backups

Grovely's database lives in a named volume, so it survives `docker compose down` and image updates. For real off-site backups (premium), configure one of:

- `BACKUP_S3_*`: S3-compatible (AWS S3, Backblaze B2, Cloudflare R2, Wasabi, MinIO)
- `BACKUP_WEBDAV_*`: WebDAV (Nextcloud, ownCloud, Synology, QNAP, TrueNAS)

Schedule and retention are configured in-app under Settings → Backups.

A free, manual backup is always available: Settings → Download backup.

## Adding a license key

Premium features (notifications, backups, advanced cycle analytics, partner features) require a license. Purchase at [grovely.lemonsqueezy.com](https://grovely.lemonsqueezy.com/); you'll receive a signed key by email.

Add it to your `.env`:

```env
LICENSE_KEY=eyJhbGciOi...
```

Then restart:

```bash
docker compose up -d
```

License validation is fully offline, no calls leave your server.

## Troubleshooting

### `502 Bad Gateway` from my reverse proxy

You're probably using the wrong overlay. If your reverse proxy runs on the host, use `docker-compose.proxy-host.yml` (loopback bindings). If it runs in Docker, use `docker-compose.proxy-docker.yml` (shared network, no host ports). Mixing them is the most common cause of a 502.

### `docker compose pull` says `denied` or `not found`

The images are public, but some Docker setups try to authenticate. Log out of GHCR to force anonymous pulls:

```bash
docker logout ghcr.io
docker compose pull
```

### Update checks are unavailable

Your reverse proxy only handles incoming browser traffic and does not affect update checks. The updater and Docker need outgoing access to `grovely.org` and `ghcr.io`. Check DNS, firewall rules, or your Docker daemon proxy settings. On an air-gapped server, disable release checks and update manually from a trusted image source.

### Frontend loads but login fails

The browser's network tab will show where the API call went. If it's hitting `:3000` directly, you're running the standard frontend image behind a proxy. Switch to the proxy overlay (sections 2 or 3). If it's hitting `/api/...` and returning HTML, your reverse proxy isn't routing `/api/*` to the backend.

### Caddy fails to get an HTTPS certificate

Let's Encrypt needs to reach your server on ports 80 and 443 to verify domain ownership. If Caddy logs `Timeout during connect (likely firewall problem)` or `tls: internal error`:

1. Forward ports 80 and 443 on your router to your server's LAN IP
2. Allow inbound traffic on 80 and 443 in your OS firewall (e.g. Windows Firewall, `ufw`)
3. Make sure your domain's DNS points to your public IP

To test the proxy routing without a real certificate, temporarily replace your domain with `localhost` in the Caddyfile - Caddy will use a self-signed cert.

### Wrong timezone in notifications and cycle predictions

Set `TZ` in your `.env`:

```env
TZ=Europe/Madrid
```

Restart with `docker compose up -d`.

### File permission errors in the data volume

Set `PUID` and `PGID` to your host user's IDs:

```bash
id -u   # your PUID
id -g   # your PGID
```

```env
PUID=1000
PGID=1000
```

## Uninstalling

```bash
docker compose down
```

To also delete your data:

```bash
docker compose down -v
```

That's it. No leftover system services or scattered config.
