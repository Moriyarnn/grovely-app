-- Structured application logging tables
-- All log tables follow the log_<feature>_<entity> naming convention

-- System: unhandled errors from any source
CREATE TABLE IF NOT EXISTS log_system_errors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source     TEXT NOT NULL,  -- 'cron' | 'api' | 'startup' | 'notification'
  message    TEXT NOT NULL,
  stack      TEXT,
  logged_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System: one row per notification checker run
CREATE TABLE IF NOT EXISTS log_system_notification_runs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger        TEXT NOT NULL,  -- 'scheduled' | 'startup_catchup'
  run_date       DATE NOT NULL,
  total_checked  INTEGER NOT NULL DEFAULT 0,
  total_sent     INTEGER NOT NULL DEFAULT 0,
  total_skipped  INTEGER NOT NULL DEFAULT 0,
  total_errors   INTEGER NOT NULL DEFAULT 0,
  logged_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System: one row per notification type successfully sent, linked to its run
CREATE TABLE IF NOT EXISTS log_system_notification_sends (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id     INTEGER NOT NULL REFERENCES log_system_notification_runs(id),
  type_id    TEXT NOT NULL,
  logged_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Period: every create / update / delete on cycles and cycle_days
CREATE TABLE IF NOT EXISTS log_period_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entity     TEXT NOT NULL,  -- 'cycle' | 'cycle_day'
  entity_id  INTEGER NOT NULL,
  action     TEXT NOT NULL,  -- 'create' | 'update' | 'delete'
  cycle_id   INTEGER NOT NULL,
  date       DATE NOT NULL,
  logged_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Period: every time the period summary is computed
CREATE TABLE IF NOT EXISTS log_period_calculations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  source                TEXT NOT NULL,  -- 'api' | 'cron'
  avg_cycle_length      INTEGER,
  avg_period_length     INTEGER,
  next_period_date      DATE,
  ovulation_date        DATE,
  fertile_window_start  DATE,
  fertile_window_end    DATE,
  is_irregular          INTEGER NOT NULL DEFAULT 0,  -- 0 | 1
  cycle_std_dev         INTEGER,
  data_warnings_count   INTEGER NOT NULL DEFAULT 0,
  total_cycles_tracked  INTEGER,
  logged_at             DATETIME DEFAULT CURRENT_TIMESTAMP
);
