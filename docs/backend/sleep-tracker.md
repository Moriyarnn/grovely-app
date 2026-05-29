# Sleep Tracker — Backend

## Overview

Stores manual sleep log entries per user, exposes CRUD endpoints, and serves pre-computed insight summaries. Pattern recognition runs server-side using aggregates over the log history — no external ML service required.

## Data Model

### `sleep_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | TEXT | Defaults to `'default'`; reserved for future multi-user support |
| `date` | TEXT | YYYY-MM-DD — the calendar date the user *woke up* |
| `bedtime` | TEXT | HH:MM 24h — if after 20:00 and wake_time is before 12:00, bedtime is treated as the previous day |
| `wake_time` | TEXT | HH:MM 24h |
| `duration_min` | INTEGER | Computed on insert/update from bedtime → wake_time |
| `quality` | INTEGER | 1–5 — the primary signal for pattern recognition |
| `notes` | TEXT | Optional free-form |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

Unique constraint on `(user_id, date)` — one entry per user per day.

### `sleep_insights_cache` (planned optimisation)

Stores pre-computed insight values per user, refreshed on each new log entry or nightly. Avoids re-aggregating the full history on every insights request.

| Column | Notes |
|--------|-------|
| `optimal_duration` | Rolling average duration of quality ≥4 nights (last 60 days) |
| `optimal_bed_from/to` | Bedtime range correlated with good wake scores |
| `debt_7d` | Cumulative shortfall vs. optimal duration over the past 7 days |
| `weekday_avg_bed` / `weekend_avg_bed` | Average bedtime split by weekday/weekend |

## API Endpoints (planned)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sleep/logs` | All logs for current user, newest first |
| GET | `/api/sleep/logs/:date` | Single day entry |
| POST | `/api/sleep/logs` | Create entry — computes `duration_min` server-side |
| PATCH | `/api/sleep/logs/:date` | Update entry — recomputes `duration_min` |
| DELETE | `/api/sleep/logs/:date` | Delete entry |
| GET | `/api/sleep/insights` | Insight summary for current user |
| GET | `/api/sleep/partner-overlap` | Shared sleep window + divergence score (both partners must opt in) |

## Insight Logic (plain English)

**Optimal duration** — average of `duration_min` for nights rated ≥4, rolling 60-day window. Requires at least 5 qualifying nights before surfacing a recommendation.

**Sleep debt** — sum of shortfall (optimal − actual, floored at 0) across the last 7 days. Displayed as hours/minutes, not a percentage.

**Optimal bedtime window** — bedtimes on quality ≥4 nights, bucketed into 30-minute slots; the two highest-frequency adjacent slots form the recommended window.

**Partner overlap** — for a given date, the overlap is the intersection of both partners' sleep windows (later bedtime → earlier wake time). Overlap < 3h is flagged as divergent.

## Notifications

New notification type: `SLEEP_MORNING_PROMPT`
- Fires at a configurable time (default 08:30) if no sleep entry exists for today
- Deeplinks to `/sleep/log` with today's date pre-filled
- Integrated into the existing daily cron in `notifications/index.js`

## Migrations

Planned: `008_sleep_logs.sql`

## File Locations (planned)

```
grovely-backend/
├── routes/sleep/
│   ├── logs.js       # CRUD for sleep_logs
│   └── insights.js   # insight summary + partner overlap
└── migrations/
    └── 008_sleep_logs.sql
```

## Status

Planned — not yet implemented. Frontend spec: [Sleep Tracker — Frontend](../frontend/features/sleep-tracker.md)
