-- Tracks whether an expired pantry item has already triggered a pantry_expired notification.
-- Set to 1 by the notification's onSent hook after the email is sent.
-- Dedup is stored on the row (not in notification_log) so it survives expiry_date edits
-- without creating a stale dedup key. Pattern mirrors 006_cycle_period_ended_notified.sql.
ALTER TABLE pantry ADD COLUMN expiry_notified INTEGER NOT NULL DEFAULT 0;
