# Period Tracker — Backend

## Overview

Core feature of the app. Tracks menstrual cycles and logged days, computes summary predictions, and drives the notification system. Schema and full endpoint list live in [schema.md](schema.md) and [api.md](api.md) — this doc covers behavior and business logic.

## Data Model Summary

**`cycles`** — one row per menstrual cycle. `start_date` is always set; `end_date` is set when the period ends or auto-updated as days are logged. `predicted_start_date` and `ovulation_date` are computed and stored for notification use.

**`cycle_days`** — one row per logged day within a cycle. Holds `flow_intensity`, `notes`, and links to `symptoms`. A cycle can have days logged without all dates in the range being present (sparse logging is valid).

**`symptoms`** — one row per symptom tag per cycle day.

## Two Logging Models

The API supports two coexisting workflows:

**1. Retrospective range** — user logs a complete period after it ends by providing `start_date` + `end_date`. `end_date` is set at creation time. `currentCycle` is immediately queryable.

**2. Day-by-day (active)** — user logs each day as it happens. `end_date` is auto-set to the latest logged day on every `POST` or `DELETE` to `cycle_days`. An active period has `end_date` = today or yesterday. Do not treat a recent `end_date` as meaning the period has ended.

Both flows write to the same tables and produce the same shape of data.

## Key Behaviors

**Auto end_date (#36):** Every write to `cycle_days` updates the parent cycle's `end_date` to `MAX(date)` for that cycle. Deletions recalculate downward. This replaced the earlier manual-end flow and the `end_date IS NULL` active-cycle check.

**Adjust cycle (#26):** `PATCH /api/period/cycles/:id/adjust` updates `start_date` and/or `end_date` without touching `cycle_days` rows. Days that fall outside the new range become "orphaned" — they are preserved in the DB and returned with a flag so the UI can badge them.

**12h stability window:** The `period_ended` notification requires `updated_at` on the cycle to be at least 12 hours old before firing, to avoid sending a "period ended" email on a cycle that is still being edited.

**Dedup guard:** All notifications check `notification_log` before sending. The `period_ended` notification additionally checks `period_ended_notified` on the cycle row, which survives `start_date` edits (unlike a `notification_log` key derived from the date).

## Calculations (`GET /api/period/calculations/summary`)

Returns the following for the frontend summary strip. The notification cron has its own `getSummary()` in `notifications/index.js` that *mirrors* this logic as a simpler variant: it computes `nextPeriodDate` inline (same `avgPredictionError` correction) and reads the fertile window and ovulation from the stored predictions via the shared `upcomingFertileWindow` helper, so notification emails, this endpoint, and the calendar always agree. This endpoint is the authoritative one.

| Field | Description |
|-------|-------------|
| `avgCycleLength` | Recency-weighted EMA (`ALPHA = 0.3`) over start-to-start cycle gaps. Gaps below `MIN_CYCLE_GAP` (21d) are filtered as data-entry noise. Optional `period_cycle_seed` preference overrides when fewer than 3 gaps exist. Fallback `28` only with no measurable history. |
| `avgPeriodLength` | Mean start-to-end period length over valid cycles, excluding entries longer than `MAX_PERIOD_LENGTH` (10d). Fallback `5`. |
| `nextPeriodDate` | Most recent cycle's `start_date` + `avgCycleLength` + `avgPredictionError` (EMA of stored-prediction vs actual error), rolled forward until it is a future date. |
| `ovulationDate` / `fertileWindow` | Read from the stored predictions on the most recent cycle (`ovulation_date` / `predicted_fertile_start`/`_end`), so the strip and calendar always agree. |
| `nextOvulationDate` / `nextFertileWindow` | Future window bound to `nextPeriodDate`, derived via `avgLutealPhase` (EMA over recorded ovulation-to-next-period history, fallback `14`). |
| `cycleStdDev` / `isIrregular` / `confidenceWindow` | Variability of cycle gaps; `isIrregular` when the user flagged it or stddev > 7. Confidence window widens to ±7 when flagged irregular. |
| `currentCycle` | Most recent cycle where `start_date` ≤ today and `end_date` ≥ yesterday, else `null`. |
| `totalCyclesTracked` | Count of all past cycles with data. |
| `dataWarnings` | Future-dated cycles, sub-21-day gaps, and over-10-day period entries are surfaced (and excluded from averages) here. |

Predictions unlock once there are ≥2 measurable cycle gaps (or 1 cycle when a `period_cycle_seed` is set, `minCyclesRequired` = 1). Below that, prediction fields return `null` and `note` explains the threshold.

**Prediction-accuracy correction.** `avgPredictionError` is a recency-weighted EMA of how far past predictions landed from actual cycle starts (pairs more than ±14 days apart are excluded as artifacts such as backlogged history or skipped cycles; excluded means *not counted*, not counted as zero). It is applied to `nextPeriodDate` and, via `recomputeAllPredictions` in `_calcHelpers.js`, baked into the stored fertile-window and ovulation predictions - so the calendar, PeriodDetail, and notification emails shift together instead of disagreeing. **Known limitation:** the correction is currently one-sided. Because `predicted_start_date` is frozen at log time and is always a future-dated projection, a logged cycle's error (`actual − predicted`) is effectively always ≤ 0, so the correction can pull predictions earlier but never later. Tracked in issue #183.

**Lead-up reminder suppression.** The notification cron's "X days before period" reminders are gated on `!currentCycle` *and* an exactly-N-day prediction distance. Logging a period — day-by-day or as a retrospective range — stops them on the next daily run, both because `currentCycle` becomes non-null and because the prediction recalculates forward by ~one cycle. An email already sent earlier the same day is not retracted. Full contract in [notifications.md](notifications.md#days-before-period-reminder-suppression-contract).

## File Locations

```
grovely-backend/
├── routes/period/
│   ├── cycles.js        # cycle CRUD + adjust
│   ├── cycle_days.js    # day CRUD
│   └── calculations.js  # summary endpoint
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_ovulation_predictions.sql
    ├── 005_cycle_updated_at.sql
    ├── 006_cycle_period_ended_notified.sql
    └── 007_flow_intensity_spotting.sql
```

## Status

- Core feature: complete
- Flow intensity (`spotting` level): complete (#24)
- Adjust cycle: complete (#26)
- Auto end_date (#36): complete
- Period end UI wiring: complete (#36) — "End Period" button removed; cycles auto-close
