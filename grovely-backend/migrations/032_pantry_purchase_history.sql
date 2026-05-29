-- Pantry purchase history: one row per move-to-pantry event.
-- Written when a shopping list item is confirmed into inventory.
-- Powers premium analytics: repurchase intervals, price trends, spend per category.
-- name is denormalized so history survives catalog row deletion.
CREATE TABLE IF NOT EXISTS pantry_purchase_history (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  catalog_id     INTEGER REFERENCES pantry_item_catalog(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  amount         REAL,
  unit           TEXT,
  density        REAL,
  density_unit   TEXT,
  pieces         INTEGER,
  price          REAL,
  store          TEXT,
  pantry_item_id INTEGER REFERENCES pantry(id) ON DELETE SET NULL,
  added_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pantry_purchase_catalog
  ON pantry_purchase_history(catalog_id);

CREATE INDEX IF NOT EXISTS idx_pantry_purchase_name
  ON pantry_purchase_history(name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_pantry_purchase_added
  ON pantry_purchase_history(added_at DESC);
