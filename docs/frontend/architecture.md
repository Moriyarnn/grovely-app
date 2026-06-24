# Frontend Architecture

## Tech
- Vue 3 + TypeScript + Vuetify
- Port 5173 (Docker)

## State Management
No Pinia — local `ref`/`computed` in each view.

## API Communication
Native `fetch` with `window.location.hostname:3000/api` as the base URL.

## Styling
Vuetify components + scoped CSS. No Tailwind.

## Desktop Shell

On desktop (≥1280px) the entire app is wrapped in a persistent two-pane layout managed by `DesktopShell.vue`:

- **Left panel (440px)** — always-visible nav: header (title + greeting + user avatar + settings), `SummaryStrip`, app launcher grid, sign-out footer
- **Right panel** — active route rendered via `<slot />`; fills remaining width

On mobile and tablet (<1280px) the left panel is hidden (`display: none`) and the router-view fills the full screen. No JS detection — pure CSS media queries at 1279px.

`App.vue` wraps `<router-view />` inside `<DesktopShell>`. `App.vue` is the single owner of `<v-app><v-main>` — feature views must not nest their own. Feature views are unaware of the shell; they render the same whether standalone (mobile) or slot-embedded (desktop).

## Feature View Multi-Column Layout

Feature views (period tracker, pantry, sleep tracker, etc.) wrap their content in `AppLayout.vue` to get a multi-column grid on wide screens. The feature's content goes in the slot and occupies column 1. Side panels are populated via the optional `panel` prop — pass a component reference and `AppLayout` renders it in columns 2 and 3 using `<component :is>`.

| Breakpoint | Layout |
|---|---|
| <1280px | Transparent wrapper — no layout impact |
| ≥1280px | 2-col grid: `minmax(0, 560px)` + `1fr` |
| ≥1600px | 3-col grid: `minmax(0, 560px)` + `1fr` + `1fr` |

**Pattern** (see `PeriodHome.vue`):
```vue
<AppLayout :panel="FeatureColumn">
  <FeatureColumn />
</AppLayout>
```

Each feature is split into two files: a thin route-wrapper (`FeatureHome.vue`) that applies `AppLayout`, and a pure content component (`FeatureColumn.vue`) with no shell dependencies. `FeatureColumn` is used both as the main slot content and passed as the `panel` prop for side columns.

HubView and Settings are single full-width views — they do not use `AppLayout`.

## Live Activity (real-time sync)

`ActivityToast.vue` (mounted in `App.vue` when logged in) owns a single SSE
connection to `/api/events` via `useRealtime.ts`. Incoming events from other
household accounts drive a coalescing bubble queue (one `AppToast` at a time)
and a `grovely:activity` window event that mounted feature views listen to for
in-place, page-conditional animations. See
[Feature — Live Activity](features/live-activity.md).

## Views & Components
```
src/
├── views/
│   ├── HubView.vue              # Mobile hub; desktop: full-height branding panel (≥1280px)
│   ├── LogsDashboard.vue        # Admin log viewer at /logs
│   └── period/
│       ├── PeriodHome.vue       # Thin route wrapper: AppLayout + PeriodColumn
│       ├── PeriodColumn.vue     # Period tracker content (calendar, panels, strip)
│       ├── PeriodLog.vue
│       └── CycleDetail.vue
├── components/
│   ├── AppLayout.vue            # Multi-column desktop wrapper for feature views
│   ├── DesktopShell.vue         # Persistent two-pane shell wrapper (≥1280px)
│   ├── SummaryStrip.vue         # Auto-rotating status carousel; used by shell + HubView
│   ├── SettingsSheet.vue        # Bottom sheet — settings (wired in v0.7.0)
│   ├── ui/FeatureTutorial.vue   # Generic themed tutorial shell — normal/premium variants, rose/mint themes
│   └── LoggingHints.vue         # Compact always-visible hint strip with mini animations
└── composables/
    ├── useApps.ts               # Shared apps array (used by DesktopShell + HubView)
    └── usePreferences.ts        # Per-user preferences cache
```

## Feature Docs
- [Period Tracker](features/period-tracker.md)
- [Groceries](features/groceries.md)
- [Anniversaries](features/anniversaries.md)
- [Recipes](features/recipes.md)

## Layout
- [AppLayout — Column Layout System](app-layout.md)

## Theme
- Theme changer lives in `SettingsSheet.vue`
- Flow hue propagates via `--flow-hue` CSS custom property on `:root`
