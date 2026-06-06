# Backups

Manual export and restore of all app data as a versioned JSON file.

---

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/backup/export` | any account | Download a JSON backup file |
| `POST` | `/api/backup/restore` | any account | Restore from a JSON backup |

Both endpoints require a valid session (`requireAuth`); either household account can export or restore - backups are a shared safety-net feature, not owner-only. Private notes inside a backup are encrypted (see [Encrypted fields](#encrypted-fields)), so an export produced by the partner does not reveal the owner's notes.

---

## Backup format

```json
{
  "meta": {
    "app_version": "0.10.0",
    "schema_version": 23,
    "min_compatible_schema": 8,
    "created_at": "2026-05-10T08:00:00.000Z"
  },
  "data": {
    "settings": [...],
    "user_preferences": [...],
    "cycles": [...],
    "cycle_days": [...],
    "symptoms": [...],
    "gap_day_logs": [...],
    "gap_day_symptoms": [...],
    "shopping_list": [...],
    "pantry": [...]
  }
}
```

### `meta` fields

| Field | Type | Description |
|---|---|---|
| `app_version` | string | Semantic version of the app at backup time |
| `schema_version` | number | Number of migrations that had run at backup time |
| `min_compatible_schema` | number | Minimum schema version required to restore this backup |
| `created_at` | ISO 8601 string | UTC timestamp of when the backup was created |

### Tables included

All user-owned data tables are included. The following are intentionally excluded:

| Excluded | Reason |
|---|---|
| `users` | Credentials - never exported |
| `migrations` | System table - managed by the app |
| `log_*` | Diagnostic logs - not user data |
| `cycle_predictions` | Derived - recomputed automatically after restore |
| `push_subscriptions` | Ephemeral browser state |

---

## Encrypted fields

Private note columns - `cycle_days.notes` and `gap_day_logs.notes` - are stored encrypted at rest and appear in the backup as AES-256-GCM ciphertext (prefixed `enc:v1:`), never plaintext. This is what keeps the owner's notes private even though either account can export a backup.

The encryption key (`data/encryption.key`) is **not** included in the backup, so:

- Restoring onto the **same instance** decrypts normally - the key is already present.
- Restoring onto a **fresh server** requires copying `data/encryption.key` across first, exactly like `data/secret.key`. Without it, restored notes stay as unreadable ciphertext.

Restoring an older backup that still holds plaintext notes is handled automatically: a catch-up pass (`encryptExistingRows` in `utils/encryption.js`) encrypts them at rest immediately after the restore, so a subsequent re-export is never plaintext.

---

## Versioning and compatibility

### Schema version

`schema_version` reflects how many migration files had been applied when the backup was created. The app derives this from `SELECT COUNT(*) FROM migrations`.

### Compatibility floor

`min_compatible_schema` is the minimum schema version the restoring app must be at for the restore to proceed. Currently set to **8** (the migration that introduced multi-user support - backups from before this point have incompatible `user_id` associations).

### Restore compatibility checks

| Condition | Result |
|---|---|
| `current_schema < backup.min_compatible_schema` | **Hard block** - app is too old; update the app first |
| `backup.schema_version < MIN_COMPATIBLE_SCHEMA (8)` | **Hard block** - backup is too old; not supported |
| `backup.schema_version > current_schema` | **Soft warning** - backup from a newer app; unknown columns are skipped, all known data is restored |
| Otherwise | **Full restore** - proceeds without warnings |

The response body always indicates warnings even on success:

```json
{ "success": true, "warnings": ["Backup was made on a newer version..."] }
```

---

## Restore behaviour

1. Compatibility checks run first - any hard block returns a `422` with a human-readable `error` message.
2. All included tables are cleared, then re-populated from the backup inside a single SQLite transaction. If anything fails, the entire restore rolls back.
3. Only columns present in both the backup row and the current schema are inserted - unknown columns from a newer backup are silently skipped.
4. Tables present in the backup but not in the current schema are skipped with a warning.
5. After restore, `recomputeAllPredictions` runs to rebuild `cycle_predictions` from the restored cycle data.

---

## Scheduled automatic backups (premium)

Scheduled backups extend the manual export with a daily cron, on-disk retention, and optional remote push. The JSON format and versioning rules are identical to the manual flow - a snapshot written by the cron can be downloaded and fed straight into `/api/backup/restore`.

### How it runs

- A single cron job is registered at startup (`grovely-backend/backups/index.js → startBackups`). The expression is derived from `backup_schedule_time` (HH:MM in server-local time) and only registered if `backup_schedule_enabled = '1'` and a license is loaded.
- On startup, if no successful backup is logged for today the run is fired immediately (catch-up - covers the "computer was off at 03:00" case).
- Changing `backup_schedule_time` or `backup_schedule_enabled` via `PATCH /api/settings/:key` calls `rescheduleBackups(db)` automatically. No restart required.
- Each run writes a snapshot to `<BACKUP_DIR>/grovely-backup-<ISO>.json`, prunes the directory to the latest `backup_retention_count` files, then attempts to push to every configured remote. Local success is independent of remote success.

### Settings keys

| Key | Default | Description |
|---|---|---|
| `backup_schedule_enabled` | `'0'` | `'1'` activates the cron and catch-up |
| `backup_schedule_time` | `'03:00'` | HH:MM, server-local time |
| `backup_retention_count` | `'7'` | Local snapshots kept; older ones pruned |

All three are seeded by migration `028_scheduled_backups.sql` and editable from the in-app Backups sheet under Settings → Data & Backups → Automatic.

### Environment variables (optional)

All optional. With none set, scheduled backups stay local-only.

| Variable | Effect |
|---|---|
| `BACKUP_DIR` | Override the local snapshot directory (default: `data/backups` inside the data volume) |
| `BACKUP_S3_ENDPOINT` / `BACKUP_S3_BUCKET` / `BACKUP_S3_KEY` / `BACKUP_S3_SECRET` | Activate S3-compatible push (AWS S3, Backblaze B2, Cloudflare R2, Wasabi, MinIO, Hetzner, etc.). All four required together. |
| `BACKUP_S3_REGION` | S3 region (default `us-east-1`) |
| `BACKUP_S3_PREFIX` | Key prefix inside the bucket (optional) |
| `BACKUP_WEBDAV_URL` / `BACKUP_WEBDAV_USER` / `BACKUP_WEBDAV_PASS` | Activate WebDAV push (Nextcloud, ownCloud, Synology, QNAP, TrueNAS, Apache mod_dav). All three required together. |

Credentials live in environment variables only - never in the database, never in the UI, never in the backup file itself.

### Remote push semantics

- Best-effort. The local snapshot is the source of truth; remote failure is logged but does not mark the run as failed.
- Both S3 and WebDAV SDKs are lazily required - installs that don't use a given target never pay the require cost.
- When multiple remotes are configured, the per-run log row carries a comma-joined `remote_target` (e.g. `s3,webdav`) and an aggregate `remote_status`:
  - `ok` - every configured target succeeded
  - `partial` - at least one succeeded and at least one failed
  - `error` - every configured target failed
  - `skipped` - nothing configured

### Log table - `log_system_backups`

| Column | Description |
|---|---|
| `id`, `logged_at` | Standard log identifiers |
| `trigger` | `scheduled`, `startup_catchup`, or `manual` |
| `status` | `ok` or `error` (local snapshot outcome) |
| `file_path` | Full path to the snapshot on disk |
| `size_bytes`, `duration_ms`, `table_count`, `row_count` | Run stats |
| `remote_target` | Comma-joined list of attempted remotes (null if none configured) |
| `remote_status` | `ok` / `partial` / `error` / `skipped` |
| `error_message` | Per-target failures (format: `s3: ...; webdav: ...`) or local error |

The table is excluded from backups (see `EXCLUDED_TABLES` in `backups/index.js`).

### Premium endpoints

All mounted under `/api/premium/backups`. License + auth applied at the prefix.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/premium/backups/status` | Current schedule, last run row, computed next-run timestamp, configured target descriptions |
| `GET` | `/api/premium/backups/history?offset=&limit=` | Paginated `log_system_backups` rows, newest first |
| `POST` | `/api/premium/backups/run-now` | Fire a one-off run (`trigger='manual'`), return the inserted row |
| `POST` | `/api/premium/backups/verify/:id` | Re-read the snapshot referenced by a log row, parse it, count tables and rows |

The `verify` endpoint never touches the database - it's a read-only "can I trust this file?" check the UI exposes as a one-click button.
