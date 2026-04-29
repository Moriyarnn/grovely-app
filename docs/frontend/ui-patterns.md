# UI Patterns

Canonical patterns that must be consistent across all feature columns. Follow these exactly when building new views — do not invent per-feature variations.

---

## Theme System

Each feature has a color theme expressed via CSS custom properties set on the `AppLayout` root. Individual column components inherit them automatically.

| Property | Role |
|---|---|
| `--panel-bg` | Card/panel fill and back-button background |
| `--panel-border` | Card borders and back-button border |

Feature themes:

| Feature | `--panel-bg` | `--panel-border` | Title color | Accent | Muted accent |
|---|---|---|---|---|---|
| Period tracker | `#fdf5f8` | `#f0e8ec` | `#72243E` | `#993556` | `#b0788e` |
| Pantry | `#EAF7F0` | `#B8E6D0` | `#1A4D35` | `#2E7D52` | `#6BA888` |

**Muted accent** is used for secondary text (labels, prediction rows, col-2 section headers) and low-emphasis interactive elements (e.g. inline icon buttons). It must be clearly readable against `--panel-bg` — never so light that it blends in.

Future features must define both values in their `FeatureHome.vue` `<AppLayout>` call:

```vue
<AppLayout panel-bg="#…" panel-border="#…">
```

---

## Column Panel Root

Every column component (col 1, 2, and 3) must follow this root structure:

```css
.feature-root {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: calc(100vh - 2.5rem);
  box-sizing: border-box;
}

@media (max-width: 1279px) {
  .feature-root { min-height: 100%; }
}
```

**Why `min-height: 100%` on mobile:** the swipe-panel is `height: 100%; overflow-y: auto`. The component fills it and scrolls internally. Never use `calc(100vh - …)` or `100dvh` inside a column on mobile.

---

## Feature Header (Col 1)

The primary column (col 1) of every feature must use this header structure:

**HTML:**
```html
<div class="feature-header">
  <h1 class="feature-title">Feature Name</h1>
  <!-- optional: inline action button (e.g. tutorial trigger) sits here, before the chip -->
  <button class="back-chip back-chip--mobile-only" @click="$router.back()">
    <v-icon size="14" color="ACCENT_COLOR">mdi-chevron-left</v-icon>
    Hub
  </button>
</div>
```

**CSS:**
```css
.feature-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.feature-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  line-height: 1.2;
  color: TITLE_COLOR; /* feature-specific */
}

.back-chip {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 1px;
  background: #fff;
  color: ACCENT_COLOR; /* feature accent, e.g. #993556 / #2E7D52 */
  border: 1px solid BORDER_COLOR; /* light tint of accent, e.g. #F4C0D1 / #B8E6D0 */
  border-radius: 99px;
  padding: 5px 12px 5px 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.back-chip:hover { background: PANEL_BG; /* e.g. #fdf5f8 / #EAF7F0 */ }

@media (min-width: 1280px) {
  .back-chip--mobile-only { display: none; }
}
```

Rules:
- Chip icon is always **size 14** (`mdi-chevron-left`), color and border are feature-specific. Label is always `Hub`.
- `margin-left: auto` on the chip pushes it to the far right — no need for `flex: 1` on the title.
- Inline action buttons (e.g. a `?` tutorial trigger) sit immediately after the title, before the chip.
- `back-chip--mobile-only` hides on desktop (≥1280px) — back navigation is irrelevant in the multi-column view.
- Border color is a light tint of the feature accent (e.g. `#F4C0D1` for period, `#B8E6D0` for pantry), not the accent itself.

---

## Column 2/3 Label

The top label on non-primary columns uses a small uppercase style, not an `h1`:

```html
<p class="col-label">Section Name</p>
```

```css
.col-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: MUTED_ACCENT; /* e.g. #b0788e for period, #9ECDB6 for pantry */
  margin: 0;
  flex-shrink: 0;
}
```

Col 1 uses the large `h1` header (see above). Col 2 and col 3 use the small label. Never mix them.

---

## Back Button (Navigation Chip)

For views that are separate routes (not columns — e.g. a detail page), use the pill-chip back button pattern instead of the circle button above:

```css
.back-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px 6px 10px;
  border-radius: 999px;
  background: #fff;
  color: #993556;
  border: 1px solid #f0e8ec;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.back-chip:hover { background: #FBEAF0; }

@media (min-width: 768px) {
  .back-chip { display: none; }
}
```

Canonical references: `ms-back-chip` in `MainScreen.vue`, `sv-back-chip` in `SettingsView.vue`.

---

## Card / Panel

Cards inside a column (detail cards, prediction panels, etc.) share a consistent shape:

```css
.card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 18px 20px;
}
```

Use `flex: 1` on a card only when it should expand to fill remaining vertical space (e.g. a predictions card that anchors to the bottom of the column). Use `flex-shrink: 0` on cards that should stay a fixed height.
