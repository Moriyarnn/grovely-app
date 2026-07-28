# Grovely updater

Grovely's updater is the self-hosted update component. Its technical Docker Compose service and image are named `grovely-updater`.

It lets either household account see whether a newer Grovely release exists and, when one does, request a safe update from Home. It is free, included in the production stack, and is not a premium feature, add-on platform, Docker dashboard, or generic command runner.

## What it does and does not do

The updater:

- checks the public release feed once every 24 hours by default;
- shows update status in Home on desktop and mobile;
- lets either authenticated household account choose `Check now`;
- lets either authenticated household account confirm `Update now` when a newer release exists;
- writes a local recovery snapshot before changing application containers;
- updates only Grovely's fixed `frontend` and `backend` services;
- waits for Docker Compose health checks before considering the update complete.

It does not:

- make unattended updates;
- inspect or manage arbitrary Docker containers, images, networks, paths, services, Compose files, or shell commands;
- publish a host port;
- give the web backend Docker-socket access;
- run in the in-browser demo;
- overwrite a household's local Compose or proxy files.

## Release source and privacy

GitHub Releases made from `vX.Y.Z` tags are the canonical release source. The updater requests:

```text
https://grovely.org/releases/stable.json
```

The Grovely site Worker obtains the existing public GitHub latest-release metadata, validates its semantic version tag, caches a compact response, and returns:

```json
{
  "version": "v0.14.0",
  "compose_version": "v0.14.0",
  "release_url": "https://github.com/Moriyarnn/grovely-app/releases/tag/v0.14.0",
  "published_at": "2026-07-01T01:35:40Z"
}
```

The Worker route bypasses landing-site analytics, counters, cookies, identifiers, and Pages proxy handling. It does not need a special manifest asset to be attached to each release.

The request contains no account, household, license, installed-version, usage, browser, or other application identifier. As with any outgoing request, the receiving infrastructure can observe normal network metadata such as a server IP address. The updater does not send household data.

Automatic checks can be disabled in the installation's local `.env`:

```env
UPDATE_CHECK_ENABLED=false
```

This disables scheduled checks only. A person may still explicitly choose `Check now`. Grovely otherwise continues to work locally and can always be updated manually.

## User experience

The Home update card can show:

- current and up to date;
- a newer version available;
- checking;
- updating;
- an unavailable updater or release feed;
- an update failure with preserved recovery information.

After a person confirms an update, the updater first records that work is in progress and the backend returns `202 Accepted`. This acknowledgement is not a success claim: it lets Home show the reconnecting state before the backend is recreated. Home automatically reloads only after it can reach the restarted backend and that backend reports the exact offered version. The refreshed frontend bundle then shows the matching application version. A snapshot, pull, container, health-check, or version-confirmation failure remains an error rather than a successful update.

The card does not expose Docker output, host paths, Compose arguments, credentials, or snapshot file paths. A failed check stays visible until Home is reloaded or the person chooses `Check now` again. This makes an outage visible without continuous browser polling.

Both accounts have equal update access. The update action emits a silent realtime activity event so connected clients can refresh without showing private system details.

## Architecture and trust boundary

The production Compose stack contains three relevant services:

```text
Browser
  -> authenticated Grovely backend
    -> internal updater API
      -> Docker daemon, fixed Grovely frontend and backend services
```

The browser only calls authenticated backend routes. The backend has no Docker socket. The updater has Docker-socket access because it must perform the controlled Compose operation, but its HTTP API is reachable only on the internal Docker network and requires its internal credential.

The updater has no published host port. The backend contacts it at `http://updater:3003`. Its port is explicitly fixed to `3003` so a general backend `PORT=3000` environment value cannot change the internal protocol.

Direct, host-proxy, and Docker-proxy installations provide their fixed Compose-file list through local configuration. The updater never accepts that list from a browser request.

## Internal credential

On first startup, the updater generates a random 256-bit credential and stores it in its persistent updater-state volume. On later starts it reuses that credential.

The updater mounts the volume read-write. The backend mounts the same volume read-only and reads the credential only when it needs to call the updater or verify the internal pre-update-snapshot request. The credential is not stored in `.env`, `example.env`, installer output, GitHub, browser responses, or external requests.

The shared volume is private to the two intended services. Docker administrator access already has host-level authority, so it is the relevant trust boundary for this local credential.

## Backend routes

All public routes require normal application authentication and are available to both household accounts:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/system/update` | Read non-sensitive updater state and current backend version. |
| `POST` | `/api/system/update/check` | Perform an explicit release check. |
| `POST` | `/api/system/update/install` | Start a user-confirmed update. |

The updater calls one additional route from inside Docker:

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/system/update/internal/pre-update-snapshot` | Create the required local recovery snapshot. |

That internal route rejects absent or incorrect updater credentials. The backend also exposes its version in `/api/instance` and `/health`.

## Update lifecycle and recovery

When a person confirms an available update:

1. The updater records that the requested update is in progress and Home receives an acknowledgement.
2. It performs a fresh release check.
3. It asks the backend to create a local pre-update snapshot.
4. It updates `GROVELY_VERSION` in the installation's local environment file.
5. Production pulls the fixed frontend and backend release images.
6. Docker Compose recreates only frontend and backend and waits for health.
7. The updater persists success or failure state. Home confirms the restarted backend's version before reloading the frontend bundle.

The updater deliberately does not recreate itself during its own request. A newer updater image is obtained on a later full manual Compose pull and recreate. This prevents the updater from terminating the request that is coordinating the application update.

If a snapshot, image pull, container recreation, or health wait fails, the operation stops safely. The updater preserves its recovery state and does not automatically roll back, because a database migration may already have run.

### Pre-update snapshots

Pre-update snapshots use the existing portable Grovely JSON snapshot format. They are saved separately under `pre-update-snapshots` and logged with the `pre_update` trigger.

They are intentionally separate from scheduled backups:

- they are always local;
- they do not use premium remote targets;
- they do not consume scheduled-backup retention;
- they can be restored through the existing snapshot restore flow if recovery is needed.

## Installation and release bundle

New installations use the latest GitHub Release bundle, not a moving raw branch. The guided installers, README, INSTALL guide, and landing-page manual commands download release assets from:

```text
https://github.com/Moriyarnn/grovely-app/releases/latest/download/
```

The bundle contains matching Compose files, both proxy overlays, `example.env`, `validate-env.sh`, and `Caddyfile.example`. Manual `curl` commands use `-L` because GitHub Release downloads redirect.

Normal updates change images while preserving the local Compose and proxy configuration. A future release that genuinely needs a Compose-structure change must provide an explicit one-time migration instruction. The updater never silently replaces Compose files.

## UAT behavior

UAT runs the updater with its own Docker state volume, isolated UAT backend, UAT frontend, UAT environment file, and UAT Compose file. It has Docker control only because this is where the real snapshot, pull, recreate, and health-check behavior is tested.

UAT uses the prerelease feed. A release test deliberately starts the isolated frontend and backend on an earlier published release candidate, then lets the updater pull the next published candidate. This mirrors the production image-update path without touching production data or containers.

## Operational troubleshooting

| Home message | Likely cause | Action |
| --- | --- | --- |
| `The Grovely Update Service is not configured` | The updater is absent, cannot read its local credential, or the installation uses an older Compose file. | Apply the documented Compose migration or verify the updater state volume mount. |
| `The Grovely Update Service is unavailable` | Backend cannot reach the internal updater service. | Check the updater container and internal port `3003`. |
| `Could not check for updates` | DNS, firewall, proxy, Worker, or GitHub release metadata problem. | Use `Check now`, verify `grovely.org/releases/stable.json`, and check outgoing access. |
| `Update stopped safely` | Snapshot, pull, recreate, or health check failed. | Review local container logs and keep the preserved pre-update snapshot available for recovery. |

For air-gapped systems, disable scheduled checks and update from an explicitly trusted local image source using the normal Docker Compose process.

### Local diagnostics

The updater writes phase-specific diagnostics only to the installation's local container logs. They cover release-feed checks, snapshot creation, version-file changes, image pulls, Compose recreation, health waits, and internal backend-to-updater requests. They never include updater credentials, environment values, household data, request bodies, or snapshot paths.

For a failed update, inspect the local logs:

```text
docker compose logs --tail 200 updater backend
```

Events are prefixed with `[updater]` or `[system-update]` and identify the failed phase without sending diagnostics anywhere.

## Validation expectations

Changes to the updater should cover updater credential rejection and generation, malformed feed metadata, both household roles, internal route protection, snapshot-first ordering, direct and proxy Compose configuration, failure preservation, and UAT behavior. Run the relevant backend and updater tests, frontend checks, Compose validation, and isolated UAT verification before release.
