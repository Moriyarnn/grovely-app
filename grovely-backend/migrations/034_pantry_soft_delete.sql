-- Soft delete for pantry items.
-- deleted_at is set when the user removes an item from view.
-- status (active/used/wasted) is preserved so history tables retain meaningful context.
-- All active-item queries must add: WHERE deleted_at IS NULL
ALTER TABLE pantry ADD COLUMN deleted_at TEXT DEFAULT NULL;
