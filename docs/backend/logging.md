# Backend Logging

Structured, persistent logging to the database. Every meaningful action is queryable. Stdout mirrors DB writes for real-time visibility via `docker logs`.

## Naming convention

`log_<feature>_<entity>` — each domain gets its own table with typed columns. No generic JSON blobs.

## Implementation

- `backend/logger.js` — one function per table (e.g. `logPeriodEvent`, `logSystemError`)
- Each function writes to the DB table and most also call `console.log` for real-time visibility via `docker logs`. High-frequency logs (e.g. `logPeriodCalculation`) write to the DB only to avoid spamming container output.
- All routes already receive `db`, so the logger just needs `db` passed in
- Do **not** log personal health content (notes text, symptom names) — log only IDs, dates, and computed metadata
- `notification_log` (migration 003) is a deduplication guard, not an audit trail — it stays separate

---

## System / General

### `log_system_errors`
Any error that should not go unnoticed — email failures, unhandled exceptions, bad API inputs.

| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| source | TEXT | `'cron'` \| `'api'` \| `'startup'` \| `'notification'` |
| message | TEXT | |
| stack | TEXT | nullable |
| logged_at | DATETIME | default CURRENT_TIMESTAMP |

### `log_system_notification_runs`
One row per time the notification checker runs (scheduled or startup catch-up).

| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| trigger | TEXT | `'scheduled'` \| `'startup_catchup'` |
| run_date | DATE | |
| total_checked | INTEGER | |
| total_sent | INTEGER | |
| total_skipped | INTEGER | |
| total_errors | INTEGER | |
| logged_at | DATETIME | default CURRENT_TIMESTAMP |

### `log_system_notification_sends`
One row per notification type successfully sent. References its run.

| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| run_id | INTEGER | FK → `log_system_notification_runs.id` |
| type_id | TEXT | e.g. `'period_due_3d'`, `'ovulation_today'` |
| logged_at | DATETIME | default CURRENT_TIMESTAMP |

---

## Period Tracker

### `log_period_events`
Every create, update, or delete on cycles and cycle_days.

| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| entity | TEXT | `'cycle'` \| `'cycle_day'` |
| entity_id | INTEGER | |
| action | TEXT | `'create'` \| `'update'` \| `'delete'` |
| cycle_id | INTEGER | always set; for cycle_day rows this is the parent cycle |
| date | DATE | start_date for cycles, date for cycle_days |
| logged_at | DATETIME | default CURRENT_TIMESTAMP |

### `log_period_calculations`
Every time the period summary is computed (API or cron).

| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| source | TEXT | `'api'` \| `'cron'` |
| avg_cycle_length | INTEGER | nullable |
| avg_period_length | INTEGER | nullable |
| next_period_date | DATE | nullable |
| ovulation_date | DATE | nullable |
| fertile_window_start | DATE | nullable |
| fertile_window_end | DATE | nullable |
| is_irregular | INTEGER | 0 \| 1 |
| cycle_std_dev | INTEGER | nullable |
| data_warnings_count | INTEGER | |
| total_cycles_tracked | INTEGER | nullable |
| logged_at | DATETIME | default CURRENT_TIMESTAMP |

---

## Events _(future feature)_

Tables to be created in a dedicated migration when the feature is built.

- **`log_event_events`** — create / update / delete on event entries
- **`log_event_notifications`** — event reminder sends (linked to `log_system_notification_runs`)

---

## Shopping List _(future feature)_

- **`log_shopping_events`** — create / update / delete / check-off on shopping list items

---

## Recipes _(future feature)_

- **`log_recipe_events`** — create / update / delete on recipes and ingredients

---

## Dashboard

A frontend view (`LogsDashboard.vue`) surfaces all active log tables with Vuetify tabs — one per category, newest first. New tabs are added as features ship.

**This view is not linked from the hub** — it's a private maintenance screen.

Access it directly at: `http://localhost:5173/logs` (or the app's IP in production)

API endpoint: `GET /api/logs` — returns all active tables in one payload.

---

## Useful queries

```sql
-- All errors ever
SELECT * FROM log_system_errors ORDER BY logged_at DESC;

-- Catch-up runs (computer was off at 08:00)
SELECT * FROM log_system_notification_runs WHERE trigger = 'startup_catchup';

-- How many times each notification type has fired
SELECT type_id, COUNT(*) FROM log_system_notification_sends GROUP BY type_id;

-- Days where notifications errored
SELECT * FROM log_system_notification_runs WHERE total_errors > 0;

-- Full history for a cycle
SELECT * FROM log_period_events WHERE cycle_id = ? ORDER BY logged_at;

-- All deletes
SELECT * FROM log_period_events WHERE action = 'delete';

-- How predictions have shifted over time
SELECT logged_at, next_period_date, avg_cycle_length FROM log_period_calculations ORDER BY logged_at;
```
