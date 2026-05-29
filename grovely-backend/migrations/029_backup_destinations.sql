-- Per-destination enable toggles for scheduled backups.
-- Local is always on (not toggleable). S3 and WebDAV default to enabled when the
-- env config is present; disabling skips pushing to that destination without
-- removing the credentials.

INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_dest_s3_enabled',     '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_dest_webdav_enabled', '1');
