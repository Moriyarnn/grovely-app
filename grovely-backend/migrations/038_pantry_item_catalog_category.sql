-- The most recently used shopping category for each item name. This is kept
-- independently of store, quantity, and price so autocomplete can reuse it.
ALTER TABLE pantry_item_catalog ADD COLUMN category TEXT NOT NULL DEFAULT 'other';
