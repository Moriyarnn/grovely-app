# API Endpoints

## Live Activity (SSE)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/events?token=<jwt>` | Server-Sent Events stream. Pushes live activity from other accounts. Token passed as a query param (EventSource cannot set headers). See [Live Activity](live-activity.md). |

## Cycles
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/period/cycles` | Get all cycles ordered by start_date DESC |
| GET | `/api/period/cycles/:id` | Get a single cycle by id |
| POST | `/api/period/cycles/start` | Start a new period `{ start_date }` |
| PATCH | `/api/period/cycles/:id/start` | Move period start to an earlier date `{ start_date }` |
| PATCH | `/api/period/cycles/:id/end` | End a period `{ end_date }` |
| PATCH | `/api/period/cycles/:id/adjust` | Adjust start and/or end date without deleting cycle_days `{ start_date?, end_date? }` |
| DELETE | `/api/period/cycles/:id` | Delete a cycle |

## Cycle Days
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/period/cycle-days/all` | Get all cycle days with cycle info (for calendar) |
| GET | `/api/period/cycle-days/cycle/:cycle_id` | Get all days for a specific cycle |
| GET | `/api/period/cycle-days/:id` | Get a single cycle day with symptoms |
| POST | `/api/period/cycle-days` | Log a day `{ cycle_id, date, flow_intensity?, notes?, symptoms? }` |
| PATCH | `/api/period/cycle-days/:id` | Update a day `{ flow_intensity?, notes?, symptoms? }` |
| DELETE | `/api/period/cycle-days/:id` | Delete a day (also deletes symptoms) |

> **Issue #42 (pending):** Once shipped, `POST /api/period/cycle-days` will also update the parent cycle's `end_date` to `MAX(date)` for that cycle. `DELETE /api/period/cycle-days/:id` will recalculate `end_date` to the new `MAX(date)` after deletion.

## Calculations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/period/calculations/summary` | Returns `avgCycleLength`, `avgPeriodLength`, `nextPeriodDate`, `ovulationDate`, `fertileWindow`, `currentCycle`, `totalCyclesTracked` |
