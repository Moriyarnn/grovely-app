-- Tracks whether the period-end summary email has been sent for each cycle.
-- Stored on the cycle row rather than in notification_log so it survives
-- start_date edits (issue #27) without creating a new dedup key.
ALTER TABLE cycles ADD COLUMN period_ended_notified INTEGER NOT NULL DEFAULT 0;
