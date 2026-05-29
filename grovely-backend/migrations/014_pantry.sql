CREATE TABLE IF NOT EXISTS shopping_list (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  quantity   TEXT,
  category   TEXT DEFAULT 'other',
  added_by   INTEGER REFERENCES users(id),
  checked    INTEGER DEFAULT 0,
  checked_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pantry (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  quantity     TEXT,
  category     TEXT DEFAULT 'other',
  bought_date  TEXT,
  expiry_date  TEXT,
  opened_date  TEXT,
  notes        TEXT,
  status       TEXT DEFAULT 'active' CHECK(status IN ('active', 'used', 'wasted')),
  from_list_id INTEGER REFERENCES shopping_list(id),
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
);
