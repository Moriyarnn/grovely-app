# Backups

Manual export and restore of all app data as a versioned JSON file.

---

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/backup/export` | owner | Download a JSON backup file |
| `POST` | `/api/backup/restore` | owner | Restore from a JSON backup |

Both endpoints require the owner role. Partners cannot trigger backups or restores.

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
| `users` | Credentials — never exported |
| `migrations` | System table — managed by the app |
| `log_*` | Diagnostic logs — not user data |
| `cycle_predictions` | Derived — recomputed automatically after restore |
| `push_subscriptions` | Ephemeral browser state |

---

## Versioning and compatibility

### Schema version

`schema_version` reflects how many migration files had been applied when the backup was created. The app derives this from `SELECT COUNT(*) FROM migrations`.

### Compatibility floor

`min_compatible_schema` is the minimum schema version the restoring app must be at for the restore to proceed. Currently set to **8** (the migration that introduced multi-user support — backups from before this point have incompatible `user_id` associations).

### Restore compatibility checks

| Condition | Result |
|---|---|
| `current_schema < backup.min_compatible_schema` | **Hard block** — app is too old; update the app first |
| `backup.schema_version < MIN_COMPATIBLE_SCHEMA (8)` | **Hard block** — backup is too old; not supported |
| `backup.schema_version > current_schema` | **Soft warning** — backup from a newer app; unknown columns are skipped, all known data is restored |
| Otherwise | **Full restore** — proceeds without warnings |

The response body always indicates warnings even on success:

```json
{ "success": true, "warnings": ["Backup was made on a newer version..."] }
```

---

## Restore behaviour

1. Compatibility checks run first — any hard block returns a `422` with a human-readable `error` message.
2. All included tables are cleared, then re-populated from the backup inside a single SQLite transaction. If anything fails, the entire restore rolls back.
3. Only columns present in both the backup row and the current schema are inserted — unknown columns from a newer backup are silently skipped.
4. Tables present in the backup but not in the current schema are skipped with a warning.
5. After restore, `recomputeAllPredictions` runs to rebuild `cycle_predictions` from the restored cycle data.

---

## Premium extension (not yet built)

Scheduled automatic backups are tracked in GitHub issue #125. The free tier ships manual export and restore only. The premium extension adds:

- Cron-based backup on a user-configured interval (daily / weekly / monthly)
- Configurable target: local path, S3-compatible bucket, or Backblaze B2
- Retention policy: keep last N backups, auto-prune older ones
- Backup history UI in Settings

When implemented, automatic backups use the same JSON format and versioning rules as manual backups.
