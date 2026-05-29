-- SQLite cannot drop or modify CHECK constraints — recreate the table without them.
-- The role column becomes a free-text field; permission logic lives in application code.
-- Wrapped in a transaction so a mid-migration crash leaves the DB unchanged and the
-- migration runner will retry cleanly on next startup.
PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE users_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (id, username, password_hash, role, created_at)
  SELECT id, username, password_hash,
    CASE role WHEN 'owner' THEN 'owner1' WHEN 'partner' THEN 'owner2' ELSE role END,
    created_at
  FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

COMMIT;

PRAGMA foreign_keys = ON;
