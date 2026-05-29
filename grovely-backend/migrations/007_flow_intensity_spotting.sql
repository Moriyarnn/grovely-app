-- SQLite can't ALTER a CHECK constraint directly, so recreate cycle_days with spotting added.
-- Wrapped in a transaction so a mid-migration crash leaves the DB unchanged and the
-- migration runner will retry cleanly on next startup.
-- DROP IF EXISTS handles the edge case where a pre-transaction partial run left a stale temp table.
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS cycle_days_new;

BEGIN;

CREATE TABLE cycle_days_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id       INTEGER NOT NULL REFERENCES cycles(id),
  date           DATE NOT NULL,
  flow_intensity TEXT CHECK(flow_intensity IN ('spotting', 'light', 'medium', 'heavy')),
  notes          TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cycle_days_new SELECT * FROM cycle_days;

DROP TABLE cycle_days;

ALTER TABLE cycle_days_new RENAME TO cycle_days;

COMMIT;

PRAGMA foreign_keys = ON;
