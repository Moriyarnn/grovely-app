# Period Tracker — Frontend

## Views
- `src/views/period/PeriodHome.vue` — thin route wrapper; applies `AppLayout` with `PeriodColumn` as both slot content and panel prop
- `src/views/period/PeriodColumn.vue` — full period tracker content; no shell dependencies; used as column 1 and in side panels on desktop
- `src/views/period/PeriodLog.vue` — log entry view
- `src/views/period/CycleDetail.vue` — single cycle detail

## PeriodColumn Layout
1. **Header** — back button (hidden at ≥1280px), today's date label, settings icon (opens SettingsSheet)
2. **Status strip** — three tiles: Next period / Cycle day / Fertile window
3. **Month navigation** — prev/next arrows + month label
4. **Calendar grid** — days colored by period/fertile/ovulation status; tap a day to open the log panel
5. **Day panel** — log, edit, or delete an entry for the selected day; shows flow intensity + notes + symptoms

## Period Logging Model
Two methods are supported and coexist in the UI:

**1. Retrospective range** — user selects a start + end date as a complete range after the period is done. `end_date` is set at log time. `currentCycle` is populated immediately.

**2. Day-by-day (active)** — user taps each day as it happens. `end_date` is auto-set to `MAX(date)` of logged days on every add or delete (#36). A cycle is considered active if `end_date` is today or yesterday. `currentCycle` is populated as long as logging is recent.

## PeriodDetail — Display Modes

`PeriodDetail.vue` adapts its output based on where in the cycle the user currently is. Two surface areas change: the **Current Phase card** and the **Predictions card**.

### Current mode (period is active or recent)

Triggered when `summary.currentCycle` is set **or** when the most recent logged cycle's `start_date + avgPeriodLength - 1` is today or later (i.e. the predicted period end hasn't passed yet). This covers both fully logged retrospective ranges and day-by-day active periods (where `currentCycle` can briefly go null on a missed logging day).

| Surface | What it shows |
|---------|---------------|
| Phase card | Real phase derived from `phaseAnchorDate` → day number. Days 1–7 Menstrual, 8–13 Follicular, 14 Ovulatory, 15+ Luteal. No badge. |
| Predictions card | **Ends around** *(italic, muted)* — predicted end of current period. **Fertile window** — this cycle's `predicted_fertile_start/end`. **Ovulation** — this cycle's `predicted_ovulation_date`. **Next period** — the period after the current one. |

### Prediction mode (between periods)

Triggered when `currentCycle` is null and today is past the predicted period end. Phase still derives from `phaseAnchorDate` — once today passes `summary.nextPeriodDate`, the anchor rolls over to that date and the phase cycles back through Menstrual → Follicular → Ovulatory → Luteal as days pass. Fertile window and ovulation come from the next-period prediction.

| Surface | What it shows |
|---------|---------------|
| Phase card | Estimated phase from `cycleDayNum`. Premium users see the phase + "Prediction" badge. Free users with history see a lock pill. Users with no history see "Start logging". |
| Predictions card | **Fertile window** — next cycle's predicted window (`summary.nextFertileWindow`). **Ovulation** — next cycle's predicted ovulation. **Next period** — upcoming predicted period date ± confidence window. **Ends around** is hidden (past predicted end). |

### Key computed properties

- `phaseAnchorDate` — date of day 1 of the cycle today belongs to. Picked in priority order: (1) `summary.nextPeriodDate` if today has reached it (rollover into the next predicted cycle), (2) `summary.currentCycle.start_date` if logging is active, (3) the most recent row from `allCycles` by raw `start_date`. Reads raw cycle rows directly — phase classification is discrete, so the anchor cannot lean on smoothed values without flipping the phase across day boundaries (issue #146).
- `cycleDayNum` — `today − phaseAnchorDate + 1`, capped at `avgCycleLength + 14`. Pure subtraction, no branching.
- `currentPhase` — bucket of `cycleDayNum`: 1–7 Menstrual, 8–13 Follicular, 14 Ovulatory, 15+ Luteal. No special cases for `currentCycle`, fertile window, or predicted Menstrual — they're all consequences of the anchor picking the right date.
- `recentCycle` — most recent cycle by `start_date` from `allCycles`. Used by the **approximate** prediction computeds below; not used as a phase input.
- `predictedCurrentPeriodEnd` — `recentCycle.start_date + avgPeriodLength - 1`, shown only when today ≤ that date.
- `displayFertileWindow` / `displayOvulationDate` — prefer the recent cycle's stored predicted values when not yet passed; fall back to `summary.nextFertileWindow` / `summary.nextOvulationDate` (which always point to the next-next cycle when a period is active).

## Key Logic
- Summary data fetched from `GET /api/period/calculations/summary`
- All cycle days fetched from `GET /api/period/cycle-days/all` for calendar coloring
- `justSaved` ref drives save-confirmation animation — **known bug #1**: needs to be a Set to support concurrent animations
- Period end flow (`PATCH /api/period/cycles/:id/end`) exists in the API but is not yet wired in the UI

## Calendar Badge Sizing
Badge icons in calendar day cells use `clamp()` to scale proportionally with the cell size across all screen sizes:
- Badge: `clamp(12px, calc((100vw - 76px) / 7 * 0.35), 20px)`
- Icon: `clamp(10px, calc((100vw - 76px) / 7 * 0.30), 18px)`

The 76px accounts for: wrapper padding (40px) + calendar padding (24px) + grid gaps (12px). This ensures badges never overlap the day number on small mobile screens while staying capped at 20px on desktop.

## Tutorials

The period tracker exposes two tutorials, both built on the shared `components/ui/FeatureTutorial.vue` shell. The shell handles backdrop, card, dots, transitions, navigation, persistence, and themeing; each feature provides its own slide content via a scoped default slot.

`FeatureTutorial` props: `storageKey`, `forceOpen`, `slideCount`, `variant` (`'normal' | 'premium'`), `theme` (`'rose' | 'mint'` preset or a custom token object), `autoShowFirstTime`. The premium variant renders a small "🔓 Premium feature" chip above the dots and a subtle accent ring around the card — direct signalling, no celebratory styling, intended to read as honest on r/selfhosted.

### Normal — Period Onboarding (`PeriodOnboardingTutorial.vue`)

A 3-slide animated modal shown once on first visit (keyed to `localStorage: grovely_onboarding_done`). Teleported to `<body>`, dismissible via Skip, Got it, or the X button (X skips localStorage so it re-shows next visit). Triggered by the first `?` button in the period header.

| Slide | Title | Animation |
|-------|-------|-----------|
| 1 | Log a past period | Finger dot drags across 5 mini-calendar cells using an asymmetric bezier sweep (`cubic-bezier(0.9,0,0.8,1)`, 1.6s). Anchor cells scale up; filled cells highlight in pink. |
| 2 | Adjust a cycle | A 14-cell two-row grid (7×2) shows a pre-filled cycle (cells 3–10). **Phase A:** finger lands on an interior cell, a hold-ring ripple expands (0.72s, scale 3.2×), then mode activates — pulsing handles appear on both caps and finger lifts. **Phase B:** finger moves to the end handle, presses, slow-drags 2 cells right (1.3s ease-in-out), cells fill one by one, finger releases. Loop ~6s. |
| 3 | Make predictions smarter | A day bubble pulses, then symptom chips (Cramps, Fatigue, Mood swings) animate in one by one. |

### Premium — Phase explainer (`PeriodPremiumTutorial.vue`)

A single-slide modal shown once on first license activation (keyed to `localStorage: grovely_premium_phase_intro_done`). Also openable from the second `?` button in the period header, which is rendered only when `licenseActive === true` and carries a small unlocked-lock corner badge to mark it as premium content.

| Slide | Title | Animation |
|-------|-------|-----------|
| 1 | Know what your phase card is telling you | A mock phase card loops between two states (Follicular + Calculated pill ↔ Menstrual + Predicted pill) every 3.5s with cross-fade transitions on the pill, phase name, and body copy. |

Both pills share the same `phase-pill--prediction` styling on the real phase card — only the text and tooltip body differ — so the tutorial mock matches the live UI exactly.

**Pointer positioning:** The finger dot (`z-index: 3`) uses `pointerY` (JS-driven, no CSS transition on `top`) so row-jumps snap instantly while the pointer is hidden. `pointerX` transitions for visible drags only.

**Cell sizing:** `cx()`/`cxAdj()`/`cyAdj()` JS helpers and the CSS `--cell` variable on `.mini-cal` use the same `clamp()` formula so pointer positions always align with rendered cells at any screen width.

**Adjust mode handles:** `.adjust-handle` cells in the tutorial use `handle-pulse` — the same `@keyframes` animation used on `.cal-adjust-handle-start/end` in the real calendar.

**`forceOpen` prop:** Allows the tutorial to be re-opened externally (e.g. from a help button) without clearing the localStorage flag.

**Pending (#22):** Once period start/middle/end icons are improved, update slides 1–2 to reflect the new icons in the mini-calendar cells.

## Logging Hints (`LoggingHints.vue`)

A compact, always-visible hint strip (no modal) showing two looping mini-calendar animations and a static ovulation hint. Intended as an in-context reminder of the two logging methods. Runs its own independent animation timers (`runDrag`, `runTap`) on mount.

## Flow Intensity Colors (#24 — complete)

Calendar cells are tinted by logged flow intensity using HSL CSS variables. The hue is driven by `--flow-hue` (default 340), settable via the hue slider in SettingsSheet. All five states respond to the slider:

| State       | CSS class            | HSL                                   | Text   |
|-------------|----------------------|---------------------------------------|--------|
| Default     | `.cal-period`        | `hsl(--flow-hue, 60%, 65%)`           | white  |
| Spotting    | `.cal-flow-spotting` | `hsl(--flow-hue, 50%, 80%)`           | white  |
| Light       | `.cal-flow-light`    | `hsl(--flow-hue, 55%, 74%)`           | white  |
| Medium      | `.cal-flow-medium`   | `hsl(--flow-hue, 65%, 58%)`           | white  |
| Heavy       | `.cal-flow-heavy`    | `hsl(--flow-hue, 80%, 42%)`           | white  |

`--flow-hue` is initialized from `localStorage` in `App.vue` on mount and updated live by the slider in `SettingsSheet.vue`. The Settings hue slider preview swatches use the same HSL formulas via Vue `computed`.

## Adjust Cycle (#26 — complete)

Users can resize an existing cycle's date range without delete/recreate using a hold+drag interaction:

1. **Hold** any period cell for 500ms → enters adjust mode; movement before 500ms proceeds with normal drag-create
2. **Handles** appear on the start and end cap cells (`cal-adjust-handle-start` / `cal-adjust-handle-end`, `ew-resize` cursor)
3. **Drag** a handle left or right to extend or shrink the cycle
4. **Release** → `PATCH /api/period/cycles/:id/adjust` updates start/end without deleting cycle_days
5. **Escape** or clicking off a period cell exits adjust mode

**>10-day guard:** Dragging a cycle past 10 days shows a confirmation dialog. Once confirmed, `longCycleWarnedIds` records the cycle ID so further extends in the same session skip the dialog and apply immediately.

**Orphaned days:** When a cycle is shrunk, logged days that fall outside the new range are preserved and badged with an orange `mdi-link-off` icon. Tapping an orphaned day opens a panel explaining the situation and offering a "Delete entry" button.

Gap-fill logic (`fillGapDays`) was removed as part of this work — the `small-gap` tap context is gone.

## Status
- UI complete
- Flow intensity colors: complete (#24)
- Adjust Cycle: complete (#26) — hold+drag resize, orphaned day badge
- Period end wiring: complete (#36) — cycles auto-close; "End Period" button removed
- Auto end_date + edge-day removal: complete (#36)
- Bug #1 (justSaved): pending
- Tutorials: complete (normal + premium, both on the shared `FeatureTutorial` shell)
