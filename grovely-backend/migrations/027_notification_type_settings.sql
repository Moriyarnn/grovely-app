CREATE TABLE IF NOT EXISTS notification_type_settings (
  type_id       TEXT    PRIMARY KEY,
  enabled       INTEGER NOT NULL DEFAULT 1,
  custom_message TEXT
);
