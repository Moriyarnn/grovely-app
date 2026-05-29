-- Pantry item catalog: one row per unique item name.
-- Acts as a snapshot — fields are overwritten on every save with the most recent values.
-- Canonical name updates on every save (last writer wins, case-sensitively).
-- Free API returns name + last_added_at only. Premium API returns all columns.
CREATE TABLE IF NOT EXISTS pantry_item_catalog (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  -- Premium fields: current snapshot of this item's last recorded values.
  -- Exposed only via /api/premium/pantry/catalog/search.
  amount            REAL,
  unit              TEXT,
  density           REAL,
  density_unit      TEXT,
  pieces            INTEGER,
  price             REAL,
  store             TEXT,
  -- Metadata
  use_count         INTEGER NOT NULL DEFAULT 1,
  last_added_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Case-insensitive unique constraint: 'milk' and 'Milk' are the same entry.
-- ON CONFLICT updates canonical name to whatever was most recently saved.
-- Also covers prefix-search for autocomplete (LIKE 'query%').
CREATE UNIQUE INDEX IF NOT EXISTS idx_pantry_catalog_name
  ON pantry_item_catalog(name COLLATE NOCASE);

-- Pre-sorted structure for on-focus top 30 query (ORDER BY last_added_at DESC LIMIT 30).
CREATE INDEX IF NOT EXISTS idx_pantry_catalog_last_added
  ON pantry_item_catalog(last_added_at DESC);
