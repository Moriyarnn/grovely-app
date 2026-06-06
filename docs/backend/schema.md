# Database Schema

## migrations/001_initial_schema.sql
```sql
CREATE TABLE IF NOT EXISTS cycles (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date           DATE NOT NULL,
  end_date             DATE,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
  -- predicted_start_date DATE  ← added by migration 002
  -- ovulation_date       DATE  ← added by migration 002
);

CREATE TABLE IF NOT EXISTS cycle_days (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id       INTEGER NOT NULL REFERENCES cycles(id),
  date           DATE NOT NULL,
  flow_intensity TEXT CHECK(flow_intensity IN ('light', 'medium', 'heavy')),  -- #25 pending: adds 'spotting'
  notes          TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS symptoms (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_day_id INTEGER NOT NULL REFERENCES cycle_days(id),
  symptom      TEXT NOT NULL
);
```

## migrations/002_ovulation_predictions.sql
Adds `predicted_start_date` and `ovulation_date` columns to `cycles`.

## migrations/003_notification_log.sql
Deduplication guard - prevents the same notification from being sent twice in a day.
```sql
CREATE TABLE IF NOT EXISTS notification_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type_id    TEXT NOT NULL,
  date_key   TEXT NOT NULL,  -- YYYY-MM-DD; weekly types use Monday of the week
  sent_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type_id, date_key)
);
```

## migrations/004_logging.sql
Creates the 5 structured log tables. Full column definitions are in [Logging](logging.md).

- `log_system_errors` - unhandled errors, email failures, bad API inputs
- `log_system_notification_runs` - one row per cron run (scheduled or startup catch-up)
- `log_system_notification_sends` - one row per notification type successfully sent, FK to runs
- `log_period_events` - every create/update/delete on `cycles` and `cycle_days`
- `log_period_calculations` - every time the period summary is computed (API or cron)

## migrations/005_cycle_updated_at.sql
Adds `updated_at DATETIME` to `cycles`. Backfilled from `created_at`. Stamped on every write to `cycles` so the notification system can enforce a 12h stability window before sending the period-end summary.

## migrations/006_cycle_period_ended_notified.sql
Adds `period_ended_notified INTEGER NOT NULL DEFAULT 0` to `cycles`. Set to `1` by the `period_ended` notification's `onSent` hook after the summary email is sent. Stored on the row (not in `notification_log`) so it survives `start_date` edits without creating a new dedup key.

## Notes
- `push_subscriptions`: legacy table, unused - notifications use email (nodemailer), not Web Push.
- **Private notes are encrypted at rest.** `cycle_days.notes` and `gap_day_logs.notes` are stored as AES-256-GCM ciphertext (prefixed `enc:v1:`), not plaintext. The column type is unchanged (`TEXT`) - encryption is applied in the application layer, not by a migration. The registry of encrypted/private columns, the encrypt/decrypt helpers, and the partner-visibility gate all live in `utils/encryption.js`. The key is at `data/encryption.key` and is excluded from backups. See [Authentication](authentication.md#private-notes-partner-visibility) and [Backups](backups.md#encrypted-fields).
