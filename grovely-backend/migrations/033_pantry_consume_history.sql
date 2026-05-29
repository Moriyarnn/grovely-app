-- Pantry consume history: one row per used or wasted event.
-- Written when a pantry item is fully consumed, partially consumed, or marked wasted.
-- amount/unit/pieces reflect what was actually consumed (not the original item total).
-- price is copied from the pantry row at time of event for waste cost analytics.
-- name is denormalized so history survives catalog and pantry row deletion.
CREATE TABLE IF NOT EXISTS pantry_consume_history (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  catalog_id     INTEGER REFERENCES pantry_item_catalog(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  amount         REAL,
  unit           TEXT,
  pieces         INTEGER,
  price          REAL,
  event          TEXT NOT NULL CHECK(event IN ('used', 'wasted')),
  pantry_item_id INTEGER REFERENCES pantry(id) ON DELETE SET NULL,
  consumed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pantry_consume_catalog
  ON pantry_consume_history(catalog_id);

CREATE INDEX IF NOT EXISTS idx_pantry_consume_name
  ON pantry_consume_history(name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_pantry_consume_event
  ON pantry_consume_history(event);

CREATE INDEX IF NOT EXISTS idx_pantry_consume_consumed
  ON pantry_consume_history(consumed_at DESC);
