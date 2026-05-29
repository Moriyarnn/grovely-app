-- Store field on shopping list items.
-- Used by premium autocomplete to record and suggest per-store prices.
ALTER TABLE shopping_list ADD COLUMN store TEXT DEFAULT NULL;
