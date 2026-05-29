# Period Logging UX Redesign — Design Brief

## Status
Design finalized. Not yet implemented. Ready to code.

---

## Problem

The app has two logging methods with three different interaction contracts stitched together:

| | Start | Extend | End |
|---|---|---|---|
| **Drag** | visual preview → confirm dialog | n/a (complete at once) | n/a |
| **Tap** | tap cell → tap button in panel → close | silent ✓ (no panel) | gap dialog |

Drag feels deliberate and complete. Tap feels like three separate micro-UXes. Commercial trackers (Flo, Clue) have one consistent mental model — every interaction with a period day feels the same.

Additionally, there is a panel inconsistency between the two methods:
- Drag cycles have no `cycle_days` → tapping a period day shows "No data logged / Add entry"
- Tap cycles have null `cycle_days` → tapping a period day shows the logged-day view with empty fields + "Edit this day"

Same visual cell, different panel content depending on how the cycle was created.

---

## Design Philosophy

> **Friction that earns trust vs friction that feels like a bug.**

Every time the app interrupts the user, it should earn that interruption by showing something the user couldn't see themselves. If the app has nothing new to say, it should act silently. Each moment of deliberate friction is the app demonstrating its model of the user's body — that's what makes it feel like a health product instead of a calendar with a pink theme.

Examples of good friction in this redesign:
- "This will also fill April 6, 7, 8" — the app understands time continuity
- "This looks like a new cycle" (large gap) — the app understands menstrual biology
- Dynamic panel header — the app knows what you're trying to do before you say it

---

## Solution — Option B: One Mental Model

> **"Tap a day to log it. Drag to log a range. That's it."**

### Drag flow — unchanged
Drag creates a complete, closed cycle immediately (start_date + end_date). It is inherently retrospective — you know the full range when you gesture. The confirmation dialog stays. No open cycle is ever created by drag.

### Tap flow — redesigned
- Tapping any period-relevant day opens the log form directly
- Saving creates the cycle if none exists, or extends the open cycle
- **No "Start period from this day" button**
- **No silent consecutive-day logging** — every tap opens the panel
- Closing the cycle is always a separate, explicit action ("End period on this day")

---

## Edge Cases and Handling

### 1. Future dates
Log form does not open for dates after today. Panel shows prediction info only (unchanged behavior).

### 2. Consecutive day tap (diff = 1 from last logged)
Panel opens with log form. Header: "Period day — [date]". No warning needed — just a clean log form. Save extends the open cycle by one day.

Previously this logged silently with a ✓ animation. That behavior is removed.

### 3. Small gap tap (diff = 2–14 days from last logged)
Panel opens with log form. An inline warning appears above the form:
> "This will also fill [date] through [date]"

Save fills all gap days with null values, logs the tapped day, cycle stays open. The user can optionally tap "End period on this day" in the same panel if they want to close the cycle here.

This replaces the current blocking gap dialog. The user can log first, decide to end second — better order of operations since they may not know if their period is done yet.

### 4. Large gap tap (diff > 14 days from last logged)
14 days is the threshold (roughly half an average cycle length). A gap larger than this almost certainly means a new period, not an extension of the previous one.

Panel opens with a different header:
> "Start new period on [date]?"

Save creates a new separate cycle starting from the tapped day. The previous open cycle is automatically closed at its last logged day.

### 5. Panel header is context-aware
The log form looks the same in all cases, but the header communicates what saving will do:

| Situation | Panel header |
|---|---|
| No existing cycle | "Starting period on [date]" |
| Extending active cycle, consecutive day | "Period day — [date]" |
| Extending active cycle, small gap | "Period day — [date]" + inline gap warning |
| Large gap — new cycle | "Start new period on [date]?" |
| Tapping within a closed (drag) cycle | "Log details for [date]" |

### 6. "End period on this day" button
Currently only appears in view mode for logged days. In the new model, consecutive-day taps open the log form, not view mode — so the end button must also appear below the log form for open cycles. User can save details and end the period in one action.

### 7. Tapping an already-logged day
Behavior unchanged. Panel opens in view mode showing existing data. "Edit this day" switches to log form.

### 8. Ovulation days
Ovulation marking stays in the panel for clearly inter-cycle days (between two closed cycles). The log form only appears when there's an active cycle or when the day is near a predicted period window. Ovulation and period logging do not conflict.

### 9. Drag-created cycle with no cycle_days
Tapping any day inside a drag cycle opens the log form. Saving creates a cycle_day for that date. This already works mechanically — the panel content change is what's new.

---

## Unifying Drag and Tap Panel Behavior

After this redesign, both drag and tap cycles should show the same panel:
- Day with no logged data (or null values) → log form opens directly
- Day with meaningful data → view mode first, then edit

The distinction between "no cycle_days record" (drag) and "null cycle_days record" (tap) becomes invisible to the user.

---

## What Stays the Same

- Drag flow: completely unchanged
- "End period on this day" button: kept, also added to log form panel for open cycles
- Delete entire cycle: unchanged
- Ovulation marking: unchanged
- Predictions, summary strip, data warnings: unchanged

---

## What Changes

| | Before | After |
|---|---|---|
| Starting a period (tap) | Tap cell → panel → tap "Start period from this day" button → closes | Tap cell → log form opens → save |
| Extending a period (consecutive tap) | Silent ✓, no panel | Panel opens with log form |
| Gap handling | Blocking gap modal | Inline warning in log panel, cycle stays open |
| Large gap | Gap modal with fill + end | New cycle prompt |
| Panel for tap-cycle days | View mode showing null values | Same as drag cycle (log form if no meaningful data) |

---

## Files Affected

### Frontend
- `grovely-frontend/src/views/period/PeriodHome.vue`
  - Remove `startLegacyPeriod()` (the "Start period from this day" button and logic)
  - Remove `autoLogConsecutiveDay()` (silent logging — replaced by panel open)
  - Rewrite `onDayClick()` to route all period-relevant taps to the log panel
  - Rewrite gap detection: replace `showGapDialog` with inline panel warning
  - Add gap warning to the log form template (conditional on gap context)
  - Make panel header dynamic based on context
  - Add "End period on this day" button to the log form panel (for open cycles)
  - Remove or repurpose the gap dialog template

- `grovely-frontend/src/components/OnboardingTutorial.vue`
  - Slide 2 currently shows the silent ✓ animation for tap-to-extend
  - Must be updated to reflect the new tap → panel → save flow
  - Update after the main PeriodHome.vue changes are validated in UAT

### Backend
- `grovely-backend/routes/period/cycles.js`
  - `PATCH /:id/end` — add cascade delete of cycle_days after end_date (issue #35, should be done before or alongside this)

---

## Auto-Close for Open Cycles

Tap cycles are open by design — the user doesn't know when their period will end. But users who stop logging (because their period ended and they moved on) leave cycles permanently open, which silently breaks predictions and the summary strip.

### Rule

If an open tap cycle's `last_logged_day` is more than **5 days ago**, automatically close it at `last_logged_day`.

5 days is the threshold because a period that has gone unlogged for 5+ days has almost certainly ended. This is distinct from the 14-day gap threshold (which signals a new cycle, not just an ended one).

### Where it runs

Backend cron (`notifications/index.js`), which already executes daily at 08:00. Auto-close runs as a pre-step before notification checks — stale open cycles are closed before any notification logic reads cycle state.

### Drag cycles are unaffected

Drag always creates a closed cycle (start + end set immediately). Auto-close only applies to cycles with no `end_date`.

### Corrections

If the auto-close was wrong — period actually continued, or ended earlier — the user corrects the end date via cycle smart editing (#27). No data is lost, just an `end_date` adjustment.

### Threshold

Hardcoded at 5 days for now. Configurable later if needed.

---

## Open Issue Reference

- **#28** — Streamline day-by-day period start (this redesign fully supersedes it)
- **#35** — Orphaned cycle_days after end_date (backend fix, prerequisite or parallel)

---

## Implementation Order

1. ~~Fix #35 first (backend cascade delete)~~ — **done**
2. Add auto-close cron logic to `notifications/index.js`
3. Implement new tap flow in PeriodHome.vue
4. Validate in UAT
5. Update OnboardingTutorial slide 2
6. Update `docs/` to reflect shipped state
7. Close #28

---

## Notes

- The 14-day gap threshold (large gap = new cycle) and the 5-day auto-close threshold are separate concepts — do not conflate them
- The gap-fill behavior (filling intermediate days with null values) is unchanged — only the UX around it changes
- "Friction that earns trust": every panel interruption in this new design shows the user something they couldn't see themselves. No "are you sure?" dialogs with no additional information.
