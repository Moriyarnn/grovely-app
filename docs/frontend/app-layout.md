# AppLayout — Column Layout System

`AppLayout.vue` is the multi-column layout wrapper used by every feature view. It provides a responsive column grid: side-by-side on desktop, and horizontally swipeable on mobile. The columns are the same everywhere — only the navigation pattern changes per breakpoint.

---

## Breakpoints

| Breakpoint | Layout |
|---|---|
| <1024px (phone) | Full-height swipe track - all 3 columns are swipeable panels with dot indicators. DesktopShell nav hidden. |
| 1024-1439px (tablet) | 2-col grid. Col 1 is fixed, cols 2 and 3 share the right side with inner swipe and dots. DesktopShell nav visible (350px). |
| >=1440px (desktop) | 3-col grid: `7fr 8fr 8fr`. All columns visible, no swipe. DesktopShell nav visible (350px). |

The breakpoints account for DesktopShell's 350px nav panel which appears at 1024px+. At 1440px the content area is ~1090px, giving each of the 3 proportional columns enough breathing room. The `7fr 8fr 8fr` ratio gives col 1 (calendar, list) slightly less space than cols 2 and 3 (detail, analytics).

---

## Column Intent

Each feature maps its content to columns using the same pattern:

| Column | Role | Tier |
|---|---|---|
| **Col 1** | Primary visual / browse / active task | Free |
| **Col 2** | Detail, context, stats, predictions | Free |
| **Col 3** | Advanced analytics, correlations, exports | Premium |

Col 3 is the natural home for premium content. On phone and tablet, it's accessed via swipe. On desktop, premium subscribers get a visible third panel.

---

## Feature Column Map

### Period Tracker
| Col 1 | Col 2 | Col 3 |
|---|---|---|
| Calendar — the visual anchor | Phase card, predictions, symptom summary, data quality warnings | Cycle correlation trends, export, copy/paste day data (premium) |

### Pantry
| Col 1 | Col 2 | Col 3 |
|---|---|---|
| Shopping list — the active task | Pantry inventory with expiry states, "expiring soon" banner | Waste tracking, reorder suggestions, recipe crossover (premium) |

### Recipes
| Col 1 | Col 2 | Col 3 |
|---|---|---|
| Recipe card grid, phase-matched surfacing | Selected recipe detail (ingredients, steps) | Pantry crossover score, symptom-triggered suggestions (premium) |

### Exercise
| Col 1 | Col 2 | Col 3 |
|---|---|---|
| Log workout + weekly activity strip | Phase-aware suggestion, workout history | Cycle correlation, partner visibility (premium) |

### Sleep Tracker
| Col 1 | Col 2 | Col 3 |
|---|---|---|
| Log sleep + weekly duration chart | Sleep debt, basic insight, optimal duration | Partner sync overlay, cycle correlation (premium) |

---

## Component API

```vue
<AppLayout>
  <FeatureCol1 />
  <template #col2>
    <FeatureCol2 />
  </template>
  <template #col3>
    <FeatureCol3 />
  </template>
</AppLayout>
```

**Slots**

| Slot | Renders in | Notes |
|---|---|---|
| default | Col 1 (`.app-main-panel`) | Card styling on desktop, transparent pass-through on mobile |
| `col2` | Col 2 (`.app-side-panel`) | Visible alongside col 1 at >=1024px. Panel div not rendered if slot is empty. |
| `col3` | Col 3 (`.app-side-panel--third`) | Visible at >=1440px, swipeable with col 2 at 1024-1439px. Panel div not rendered if slot is empty. |

If a feature has no col 3 content yet, omit `#col3` — the panel won't appear.

---

## Wiring Up a New Feature

1. Create `FeatureHome.vue` — thin wrapper, owns `AppLayout`:

```vue
<template>
  <AppLayout>
    <FeatureCol1 />
    <template #col2>
      <FeatureCol2 />
    </template>
    <template #col3>
      <FeatureCol3 />
    </template>
  </AppLayout>
</template>

<script setup>
import AppLayout from '../../components/AppLayout.vue'
import FeatureCol1 from './FeatureCol1.vue'
import FeatureCol2 from './FeatureCol2.vue'
import FeatureCol3 from './FeatureCol3.vue'
</script>
```

2. Create separate column components (`FeatureCol1.vue`, `FeatureCol2.vue`, `FeatureCol3.vue`). No shell dependencies. During early development you can pass the same placeholder component to all three slots and split them out when the desktop view is ready for polish.

3. Register the route pointing at `FeatureHome.vue`.

HubView and LogsDashboard are full-width single-column views — they do not use `AppLayout`.

---

## Mobile Swipe Behavior

On phone (<1024px), `AppLayout` renders a horizontal `swipe-track` that snaps between all three columns. Each column becomes a `swipe-panel` that fills the full viewport height. A dot indicator row at the bottom shows position and allows tap-to-jump. On tablet (1024-1439px), col 1 is fixed and cols 2+3 share a right-side swipe track with inner dots.

**Height:** Driven by `window.visualViewport.height` (updated via `visualViewport resize` events) rather than `100dvh` or `100svh`, so the layout follows the browser URL bar smoothly during scroll. A `touchend` handler briefly enables a CSS height transition to smooth the final compositor-thread catch-up jump.

**Swipe track touch handling:** The swipe track declares `touch-action: pan-x`. This tells the browser the track only claims horizontal gestures — vertical touches fall through to the column root's scroll container. Without this, the `scroll-snap-type: x mandatory` on the track intercepts vertical swipes and jumps columns instead of scrolling.

**Column component contract on mobile:**
- Root element must use `height: 100%; overflow-y: auto; min-height: unset` inside a `@media (max-width: 1439px)` override. This applies to both phone and tablet tiers. The swipe-panel is `height: 100%; overflow: hidden` - the component root is the scroll container, not the panel.
- Do not set a fixed height on the root. Do not use `100vh`-based or `min-height: calc(...)` values on mobile.

See [UI Patterns](ui-patterns.md) for the canonical header and panel root structure every column component must follow.
