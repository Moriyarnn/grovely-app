-- Scheduled automatic backups (premium feature — issue #136)
--
-- Settings rows: opt-in by default. Daily at HH:MM, mirrors notification_time pattern.
-- Runtime state (last_run_at, last_run_status) is derived from log_system_backups, not stored here.

INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_schedule_enabled', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_schedule_time', '03:00');
INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_retention_count', '7');

-- One row per scheduled / startup-catchup / manual backup run.
-- Phase A populates local fields; remote_* / error_message used by Phase B (S3 / WebDAV push).
CREATE TABLE IF NOT EXISTS log_system_backups (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger         TEXT NOT NULL,           -- 'scheduled' | 'startup_catchup' | 'manual'
  status          TEXT NOT NULL,           -- 'ok' | 'error'
  file_path       TEXT,                    -- absolute path to snapshot; NULL on early failure
  size_bytes      INTEGER,
  duration_ms     INTEGER,
  table_count     INTEGER,
  row_count       INTEGER,
  remote_target   TEXT,                    -- 's3' | 'webdav' | NULL
  remote_status   TEXT,                    -- 'ok' | 'error' | 'skipped' | NULL
  error_message   TEXT,
  logged_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
