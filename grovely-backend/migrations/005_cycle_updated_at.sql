-- Add updated_at to cycles so the notification system can enforce a stability window
-- before sending period-end summary emails (prevents duplicate sends during delete/recreate troubleshooting)
ALTER TABLE cycles ADD COLUMN updated_at DATETIME;
UPDATE cycles SET updated_at = COALESCE(created_at, datetime('now')) WHERE updated_at IS NULL;
