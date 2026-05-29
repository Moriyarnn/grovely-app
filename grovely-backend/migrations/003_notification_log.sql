-- Tracks which notifications have been sent, preventing duplicate sends
-- type_id + date_key is unique so the same notification can never fire twice on the same day
CREATE TABLE IF NOT EXISTS notification_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type_id    TEXT NOT NULL,
  date_key   TEXT NOT NULL,  -- YYYY-MM-DD, usually today's date; weekly types use Monday of the week
  sent_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_log_type_date
  ON notification_log(type_id, date_key);
