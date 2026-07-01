# Notifications

## Strategy
- **Method:** Email via any SMTP provider + Nodemailer (all platforms — iPhone, Android, desktop)
- **Rationale:** iOS does not support background push for PWAs; email is the universal fallback that works everywhere with no native app or developer account required
- **Auth:** SMTP credentials stored in `grovely-backend/.env` — `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`, `ACCOUNT1_EMAIL`, `ACCOUNT2_EMAIL` (optional, for partner notifications)
- **Delivery:** Daily cron at 08:00 + startup catch-up (fires immediately on start if the computer was off at cron time)
- **Kill switch:** Set `DISABLE_EMAIL=true` in the env file to disable all email sending and skip cron startup entirely. Set to `false` (or remove the var) to re-enable. Default in `.env.dev`; commented out in `.env.uat`.
- **Design:** Registered list in `notifications/index.js` — each type has an id, condition fn, and email template. Add new types by registering a new entry, no structural changes needed.
- **Deduplication:** `notification_log` table (migration 003) — `(type_id, date_key)` unique index prevents double sends
- **Tone:** Cute and affectionate. Owner1 types addressed to the period tracker user; partner types addressed to the partner.
- **Premium:** All notifications are a premium feature. `runNotifications` returns early if no valid license is present (`licensePayload` from `middleware/license.js`).

## Active Types (15)
See `grovely-backend/notifications/index.js` for full condition logic and email templates.

| id | Recipient | Trigger | Repeats? |
|----|-----------|---------|----------|
| `period_due_3d` | ACCOUNT1_EMAIL | 3 days before next period | Once |
| `period_due_2d` | ACCOUNT1_EMAIL | 2 days before next period | Once |
| `period_due_1d` | ACCOUNT1_EMAIL | 1 day before next period | Once |
| `period_overdue_3d` | ACCOUNT1_EMAIL | Period 3 days late | Once |
| `irregular_cycle` | ACCOUNT1_EMAIL | Cycle length deviates significantly | Weekly (Mondays) |
| `fertile_window_tomorrow` | ACCOUNT1_EMAIL | Day before fertile window starts | Once |
| `fertile_window_start` | ACCOUNT1_EMAIL | Fertile window begins today | Once |
| `ovulation_today` | ACCOUNT1_EMAIL | Ovulation day | Once |
| `fertile_window_ending` | ACCOUNT1_EMAIL | Last day of fertile window | Once |
| `pms_window` | ACCOUNT1_EMAIL | 5 days before next period | Once |
| `period_ended` | ACCOUNT1_EMAIL | Period ended (3-day lookback) | Once per cycle |
| `pantry_expiry_today` | ACCOUNT1_EMAIL | Pantry items expiring today | Once |
| `pantry_expiry_soon` | ACCOUNT1_EMAIL | Pantry items expiring within warning window | Once |
| `cycle_summary` | ACCOUNT1_EMAIL | New period logged (previous cycle complete) | Once |
| `partner_period_starting` | ACCOUNT2_EMAIL | 3 days before next period | Once |
| `partner_fertile_window` | ACCOUNT2_EMAIL | Fertile window begins today | Once |
| `partner_period_ended` | ACCOUNT2_EMAIL | Period ended (3-day lookback) | Once per cycle |

Partner types (`partner_*`) only fire when `ACCOUNT2_EMAIL` is set in the env. They share the same conditions as their owner1 counterparts but send a partner-facing message.

## "Days before period" reminder suppression contract

This covers the five lead-up reminders — `pms_window` (5d), `period_due_3d`, `period_due_2d`, `period_due_1d`, and the partner-facing `partner_period_starting` (3d).

**Send condition.** Each of these only sends when **all three** hold:

```js
!currentCycle && !!nextPeriodDate && daysBetween(nextPeriodDate, today) === N
```

i.e. there is **no active cycle**, a prediction exists, and the predicted next-period date is still *exactly* N days away.

**What happens when a period is logged near the prediction.** As soon as a period is logged — whether day-by-day or as a retrospective start+end range — the lead-up reminders stop on the next daily run. Two independent mechanisms enforce this; either alone is sufficient:

1. **Active-cycle gate.** Logging a period day attaches a `cycle_days` row, so `getSummary()`'s `currentCycle` is no longer `null`. `!currentCycle` becomes false and every lead-up check fails.
2. **Forward-recalculated prediction.** `nextPeriodDate` is derived from the most recent cycle's `start_date + avgCycleLength`. The newly logged period becomes the most recent cycle, so the prediction jumps ~one cycle into the future and `daysBetween(nextPeriodDate, today)` is no longer 1/2/3/5. This also covers the retrospective-range case where the logged period already ended before today (so `currentCycle` stays `null` but the prediction still moves).

**Timing caveat (expected, not a bug).** Notifications run once per day (cron at the configured time, default 08:00, plus the startup catch-up), and each type is deduped per day via `notification_log` (`type_id` + `date_key`). If today's reminder already went out this morning and the period is logged later the same day, **that already-sent email is not retracted** — emails cannot be un-sent. From the next daily run onward, all further lead-up reminders are suppressed. No duplicate or contradictory reminders are sent on subsequent days.

**Prediction basis — history-driven, not a fixed 28.** `avgCycleLength` is a recency-weighted exponential moving average (`ALPHA = 0.3`) over the user's own start-to-start cycle gaps, with sub-`MIN_CYCLE_GAP` (21-day) gaps filtered out as data-entry noise. The literal `28` is only a **cold-start fallback** used when there are fewer than two recorded cycles (no gap to measure yet). Similarly the cron's fertile/ovulation predictions use `avgLutealPhase`, an EMA over the user's recorded ovulation-to-next-period history (fallback `14`). The notification cron's `getSummary()` mirrors `routes/period/calculations.js` but is a simpler variant: `nextPeriodDate` (the basis for these lead-up reminders) is computed inline with the same `avgPredictionError` correction, while the fertile window and ovulation are read from the stored predictions via the shared `upcomingFertileWindow` helper in `routes/period/_calcHelpers.js`, so the emails always agree with the calendar and PeriodDetail. See [period-tracker.md](period-tracker.md#calculations-get-apiperiodcalculationssummary) for the authoritative endpoint logic.

## period_ended dedup contract

`period_ended` uses a two-layer guard to guarantee exactly one summary email per cycle, regardless of edits:

**Layer 1 — row flag (`cycles.period_ended_notified`)**
The flag is set to `1` via `onSent` immediately after the email is sent. `check` always queries `period_ended_notified = 0`, so the notification can never fire twice for the same cycle row — even if `start_date`, `end_date`, or any other field is later changed (issue #27).

Delete + recreate produces a new row with `period_ended_notified = 0`, so a fresh email fires after the stability window. This is intentional: a recreated cycle is treated as a new cycle.

**Layer 2 — stability window (`updated_at`, 12h)**
Both `check` and `onSent` require `updated_at < datetime('now', '-12 hours')`. This prevents the notification from firing while the user is still actively editing. Safe for cron and future live/push delivery alike — a blocked check gets a second chance via the 3-day lookback window (`end_date BETWEEN 3 days ago AND yesterday`).

**Constraint for cycle editing UI (issue #27)**
Any route that writes `start_date` or `end_date` — including the smart editing controls — **must** also set `updated_at = CURRENT_TIMESTAMP`. Without this, the stability window does not reset and an already-stable cycle could be notified mid-edit.

## Future
- Public version will use configurable templates with `{{name}}`, `{{days_until_period}}` placeholders.
- Move to a 24/7 server so startup catch-up pattern can be retired.
