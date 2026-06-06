# Pantry — Backend

## Overview

The pantry feature is two surfaces backed by five tables. `shopping_list` holds items to buy; `pantry` holds items in the house. Checking off a shopping list item moves it to the pantry. Every pantry add also writes to a **catalog** (`pantry_item_catalog`) and **purchase history** (`pantry_purchase_history`); every use/waste event writes to **consume history** (`pantry_consume_history`). The notification cron polls `pantry` daily for expiring items.

## Data Model

### `shopping_list`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT | Required |
| `quantity` | TEXT | Legacy free-form ("2 kg", "1 bunch") — superseded by structured `amount`/`unit`/`pieces` |
| `category` | TEXT | produce / dairy / meat / bakery / frozen / dry_goods / beverages / other |
| `added_by` | INTEGER | FK to `users.id` — nullable |
| `checked` | INTEGER | 0 = to buy, 1 = checked off |
| `checked_at` | TEXT | Set when checked — used to sort checked items to bottom |
| `created_at` | TEXT | |
| `expiry_date` | TEXT | YYYY-MM-DD — carried into the move-to-pantry sheet |
| `price` | REAL | nullable |
| `notes` | TEXT | nullable |
| `amount` | REAL | Structured quantity value (with `unit`) |
| `unit` | TEXT | g, kg, ml, L, etc. |
| `density` / `density_unit` | REAL / TEXT | For mass↔volume conversion (`g/ml`, `g/L`, `kg/L`) |
| `pieces` | INTEGER | Count for piece-type items (eggs, cans) |
| `store` | TEXT | Where it's bought — feeds premium price analytics |

### `pantry`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT | |
| `quantity` | TEXT | Legacy free-form remaining amount |
| `category` | TEXT | Same values as `shopping_list.category` |
| `bought_date` | TEXT | YYYY-MM-DD — auto-set to today when moved from shopping list |
| `expiry_date` | TEXT | YYYY-MM-DD — nullable. Part of the merge key (see below) |
| `opened_date` | TEXT | YYYY-MM-DD — nullable |
| `notes` | TEXT | nullable |
| `status` | TEXT | active / used / wasted — only `active` rows show in pantry view |
| `from_list_id` | INTEGER | FK to `shopping_list.id` when moved from list, nullable for direct adds |
| `created_at` / `updated_at` | TEXT | |
| `price` | REAL | nullable |
| `amount` / `unit` | REAL / TEXT | Structured quantity |
| `density` / `density_unit` | REAL / TEXT | For unit conversion on partial consume |
| `pieces` | INTEGER | Count for piece-type items |
| `deleted_at` | TEXT | Soft-delete timestamp — nullable. Rows with `deleted_at` set are hidden everywhere but preserved so history references stay valid |

**`status` values:**
- `active` — in the house, available
- `used` — consumed normally
- `wasted` — thrown out (feeds waste-tracking analytics)

### `pantry_item_catalog`

One row per unique item **name** (case-insensitive unique index). A snapshot of that item's most recent values — last-writer-wins on every add. Powers autocomplete. Free API exposes `name` + `last_added_at`; premium API exposes the full row.

Columns: `name`, `amount`, `unit`, `density`, `density_unit`, `pieces`, `price`, `store`, `use_count`, `last_added_at`, `created_at`.

### `pantry_purchase_history`

One row appended on **every** pantry add (whether or not autocomplete was used, whether or not a merge occurred). Full per-purchase record for premium analytics. Columns: `catalog_id`, `name`, `amount`, `unit`, `density`, `density_unit`, `pieces`, `price`, `store`, `pantry_item_id`, `added_at`.

### `pantry_consume_history`

One row per use/waste event (full or partial). `amount`/`pieces` reflect what was actually consumed, not the item total; `price` is copied from the pantry row at the moment of the event. Columns: `catalog_id`, `name`, `amount`, `unit`, `pieces`, `price`, `event` (`used`/`wasted`), `pantry_item_id`, `consumed_at`.

## Inventory Merge

`POST /api/pantry` (used by both move-to-pantry and direct add) merges into an existing **active, non-deleted** row instead of inserting a duplicate, when:

- **Amount-type** (`amount` + `unit` present): same `name` (case-insensitive) **+ same `unit` + same `expiry_date`** → amounts are summed.
- **Pieces-type** (`pieces` present): same `name` (case-insensitive) **+ same `expiry_date`** → pieces are summed.

**Expiry is part of the merge key.** `expiry_date IS ?` is null-safe: a no-date add merges with an existing no-date row, a dated add merges only with the same date, and a date never merges into a no-date row. **Different expiry dates stay as separate rows** so each batch keeps its real date and expiry notifications stay correct.

On merge, only `amount`/`pieces` and `updated_at` change — the existing row keeps its `category`, `price`, and other fields (a re-add does not reclassify or reprice an item already in the pantry).

Every add — merged or not — still upserts the catalog and appends a purchase-history row.

## Suggested Expiry

`GET /api/pantry/suggest-expiry?name=` helps users avoid guessing dates. It finds the most recent past entry for that name with **both** a `bought_date` and `expiry_date`, derives its shelf life (`expiry − bought`), and returns that span applied forward from today:

```json
{ "suggested_expiry_date": "2026-06-01", "shelf_life_days": 7 }
```

Returns `null`s when there's no dated history. Free endpoint, computed on the fly — no shelf-life value is stored. The move-to-pantry sheet uses it to pre-fill the date field for items the user hasn't dated, shown as an overridable "Suggested" label.

## API Endpoints

### Shopping List (`/api/pantry/list`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | All items, checked sorted to bottom |
| POST | `/` | Add item |
| PATCH | `/:id` | Update fields or toggle `checked` |
| DELETE | `/:id` | Remove without buying |
| DELETE | `/checked` | Bulk-clear checked items |

> Move-to-pantry is not a dedicated endpoint. The frontend collects item data from the shopping list and calls `POST /api/pantry` directly, which handles the add/merge logic.

### Pantry (`/api/pantry`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Active items, expiry ASC (nulls last), then name |
| GET | `/expiring?days=N` | Active items expiring within N days (default 7) — used by cron |
| GET | `/suggest-expiry?name=` | Suggested expiry from past shelf life (see above) |
| POST | `/` | Add/merge item (see Inventory Merge) |
| PATCH | `/:id` | Update any fields |
| PATCH | `/:id/consume` | Partial or full consume (`use`/`waste`/`mark_one`); unit conversion via density |
| PATCH | `/:id/status` | Set `used` / `wasted` |
| DELETE | `/:id` | Soft delete (sets `deleted_at`) |

### Catalog (`/api/pantry/catalog`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search?q=` | **Free** — name + `last_added_at`, limit 30; empty `q` returns 30 most recent (for on-focus dropdown) |

Premium autocomplete uses `GET /api/premium/pantry/catalog/search` (full row + purchase-history grouping). Enforced by `requireLicense` on the `/api/premium` prefix.

## Notifications

Integrated into the daily cron:

| Type | Condition | Tier |
|------|-----------|------|
| `pantry_expiry_today` | `expiry_date` = today | Premium |
| `pantry_expiry_soon` | within 3 days | Premium |
| `pantry_expiry_week` | within 7 days | Premium |
| `pantry_waste_tip` | within 2 days + matching recipe exists | Premium |

`pantry_waste_tip` fires only once recipe integration is live.

## Migrations

- `014_pantry.sql` — `shopping_list` + `pantry`
- `018`–`020` — pantry price, structured quantity, density
- `023_pieces.sql` — pieces system
- `024_pantry_currency_to_settings.sql`
- `031_pantry_item_catalog.sql`
- `032_pantry_purchase_history.sql`
- `033_pantry_consume_history.sql`
- `034_pantry_soft_delete.sql` — `deleted_at`
- `035_shopping_list_store.sql` — `store`
- `036_pantry_expiry_notified.sql` — `expiry_notified` flag on `pantry` (deduplicates expiry notifications)
- `037_pantry_currency_custom_decimals.sql` — seeds `pantry_currency_decimals` setting

## File Locations

```
grovely-backend/routes/pantry/
├── list.js       # shopping list CRUD
├── pantry.js     # pantry CRUD, merge, suggest-expiry, consume, catalog/history writes
└── catalog.js    # free autocomplete search
```

## Status

Live. Frontend spec: [Pantry — Frontend](../frontend/features/pantry.md)
</content>
</invoke>
