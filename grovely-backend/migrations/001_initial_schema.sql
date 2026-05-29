CREATE TABLE IF NOT EXISTS cycles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date  DATE NOT NULL,
  end_date    DATE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cycle_days (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id       INTEGER NOT NULL REFERENCES cycles(id),
  date           DATE NOT NULL,
  flow_intensity TEXT CHECK(flow_intensity IN ('light', 'medium', 'heavy')),
  notes          TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS symptoms (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_day_id INTEGER NOT NULL REFERENCES cycle_days(id),
  symptom      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription TEXT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);