INSERT OR IGNORE INTO settings (key, value)
SELECT 'pantry_currency', COALESCE((SELECT value FROM user_preferences WHERE key = 'pantry_currency' LIMIT 1), 'USD');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'pantry_currency_custom_symbol', COALESCE((SELECT value FROM user_preferences WHERE key = 'pantry_currency_custom_symbol' LIMIT 1), '');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'pantry_currency_custom_label', COALESCE((SELECT value FROM user_preferences WHERE key = 'pantry_currency_custom_label' LIMIT 1), '');

DELETE FROM user_preferences WHERE key IN ('pantry_currency', 'pantry_currency_custom_symbol', 'pantry_currency_custom_label');
