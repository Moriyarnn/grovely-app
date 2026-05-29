-- Per-destination result log for scheduled backups (issue #136).
--
-- One row per destination per backup run. destination is a plain string
-- ('local', 's3', 'webdav') so future named targets like 's3:archive' or
-- 'webdav:nextcloud' slot in without a schema change.

CREATE TABLE IF NOT EXISTS log_system_backup_destinations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      INTEGER NOT NULL REFERENCES log_system_backups(id) ON DELETE CASCADE,
  destination TEXT    NOT NULL,
  status      TEXT    NOT NULL,
  error       TEXT,
  logged_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_dest_run_id ON log_system_backup_destinations(run_id);
