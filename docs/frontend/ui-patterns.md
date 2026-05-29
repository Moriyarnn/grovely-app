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

---

## DetailSheet

A reusable bottom sheet (mobile) / centered modal (desktop) for item detail, editing, and action panels. Lives in `src/components/ui/DetailSheet.vue`. Always use this for any "tap to see details" flow — never write one-off sheet CSS per feature.

**On mobile (< 1280px):** slides up from the bottom with a drag handle.  
**On desktop (≥ 1280px):** renders as a 480px centered modal with a scale-in animation and a backdrop blur.

```vue
<DetailSheet
  v-model:open="isOpen"
  title="Friday, April 25"
  subtitle="Period day"
  theme="pink"
>
  <!-- main content goes here -->
  <div>...</div>

  <!-- optional: extra element injected next to the title -->
  <template #header-extra>
    <span class="some-pill">Active</span>
  </template>
</DetailSheet>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `open` | `Boolean` | `false` | Sheet visibility (use with `v-model:open`) |
| `title` | `String` | `''` | Primary heading — date, item name, etc. |
| `subtitle` | `String` | `''` | Secondary line below title — shown uppercase, accented |
| `theme` | `String` | `'pink'` | `'pink'` for period tracker, `'green'` for pantry |
| `size` | `String` | `'default'` | `'large'` for content-heavy sheets. Opt-in; omitting leaves the original sizing untouched |
| `scroll` | `String` | `'sheet'` | `'sheet'` = whole sheet scrolls (default, required by sheets with no inner scroller). `'contained'` = sheet doesn't scroll; inner regions own their scroll |
| `subtitleStyle` | `String` | `'label'` | `'label'` = uppercase metadata; `'plain'` = normal-case sentence |
| `mobileHeight` | `String` | `''` | Opt-in. Any CSS length (e.g. `'80vh'`) → fixed sheet height on mobile (< 1280px) instead of sizing to content. Sheet-level scroll preserved. Use to make sibling sheets the same size |
| `hugContent` | `Boolean` | `false` | Opt-in. Desktop modal sizes to content (`height: auto`, capped 88vh, still scrolls past) instead of the fixed `min(640px, 88vh)`. Use for short sheets where the fixed height leaves an awkward empty band |

All sizing props are **strictly opt-in** — defaults reproduce the original behaviour exactly, so adding them never affects existing consumers.

**Stable-height Notes field:** Inside a `DetailSheet` that toggles a view/edit mode, give `NotesField` (`src/components/ui/NotesField.vue`) a `:fixed-height="<px>"`. This makes the field a fixed size (content scrolls inside instead of growing the sheet) and reserves the character-counter's space in **both** modes, so view↔edit never changes height. The counter expands into that reserved space using the same measure-the-target-height transition as the notification message editor — both entering edit and leaving it. For this to animate in *both* directions the `NotesField` instance must persist across the toggle (one instance whose `mode` prop flips), not be re-mounted by a `v-if`-swapped subtree; an ancestor swap suppresses the leave animation. Canonical: `PantryShoppingList.vue` (item sheet), `PeriodCalendar.vue` (day sheet).

**Slots:**

| Slot | Description |
|---|---|
| `default` | Main body content |
| `header-extra` | Optional element injected between the title block and the close button |

**Theme colors:**

| `theme` | Handle | Close border/bg | Title | Subtitle | Backdrop |
|---|---|---|---|---|---|
| `pink` | `#F4C0D1` | `#F4C0D1` / `#FBEAF0` | `#72243E` | `#993556` | `rgba(114,36,62,0.22)` |
| `green` | `#B8E6D0` | `#B8E6D0` / `#EAF7F0` | `#1A4D35` | `#2E7D52` | `rgba(26,77,53,0.22)` |

Future features must add their theme variant to `DetailSheet.vue` when they introduce a detail sheet.

**Canonical usage:** `PeriodCalendar.vue` (day detail/edit panel).

**Footer slot:** Use the `#footer` slot to inject action buttons. `DetailSheet` owns the footer chrome (border, spacing, flex row); the feature component owns all logic. The footer row uses `justify-content: space-between` — put icon actions on the left and primary action buttons (Save / Cancel) on the right.

```vue
<template #footer>
  <div class="my-icon-actions">
    <IconAction icon="mdi-trash-can-outline" label="Delete" color="#c0392b" @click="onDelete" />
  </div>
  <div class="my-form-actions">
    <button class="btn-cancel" @click="mode = 'view'">Cancel</button>
    <button class="btn-save" @click="onSave">Save</button>
  </div>
</template>
```

---

## IconAction

A reusable round icon button with a label beneath. Lives in `src/components/ui/IconAction.vue`. Use this for all icon-button-with-label patterns — never write the circle/label structure inline.

```vue
<IconAction
  icon="mdi-trash-can-outline"
  label="Remove this day"
  color="#c0392b"
  bg="#fff0ee"
  border="#f5c0b8"
  :disabled="false"
  :loading="saving ? 'Saving...' : ''"
  @click="onDelete"
/>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `icon` | `String` | required | MDI icon name |
| `label` | `String` | required | Text beneath the button |
| `color` | `String` | `'#993556'` | Icon color (and label color when enabled) |
| `bg` | `String` | `'#FBEAF0'` | Button background |
| `border` | `String` | `'#f1a1b0'` | Button border |
| `disabled` | `Boolean` | `false` | Grays out button and label, disables click |
| `loading` | `String` | `''` | When non-empty, replaces the label text (e.g. `'Saving...'`) |

**Rules:**
- Use filled MDI icons (e.g. `mdi-pencil`, `mdi-trash-can-outline`, `mdi-calendar-remove-outline`) — outline-only icons look too thin at 16px in a 36px circle.
- For destructive actions, use `color="#c0392b"` with a red-tinted `bg`/`border`. For neutral/edit actions, use the feature accent color.
- When an action is temporarily unavailable (not permanently hidden), use `disabled` rather than `v-if` so the button stays in the layout and communicates its intent.
- Group related `IconAction` components in a flex row (`gap: 20px; align-items: flex-start`).

**Canonical usage:** `PeriodCalendar.vue` `#footer` slot (Remove this day / Delete cycle / Edit this day).

---

## AppCheckbox

A styled checkbox for multi-select flows. Lives in `src/components/ui/AppCheckbox.vue`. Always use this — never write checkbox styles inline.

```vue
<AppCheckbox v-model="isSelected" theme="green" />
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `modelValue` | `Boolean` | `false` | Checked state (use with `v-model`) |
| `theme` | `String` | `'green'` | `'green'` for pantry, `'pink'` for period tracker |

**Themes:**

| `theme` | Unchecked border | Checked fill |
|---|---|---|
| `green` | `#B8E6D0` | `#2E7D52` |
| `pink` | `#f0c8d8` | `#993556` |

The checkmark icon is always white. The box is 20×20px with a 6px border-radius.

Future features must add their theme variant to `AppCheckbox.vue` when they introduce multi-select UI.

---

## AppFieldToggle

A compact labeled toggle for use in form field label rows (e.g. alongside a field label to switch an input mode). Lives in `src/components/ui/AppFieldToggle.vue`.

```vue
<AppFieldToggle v-model="isTotal" label="∑ tot." theme="green" />
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `modelValue` | `Boolean` | `false` | Checked state (use with `v-model`) |
| `label` | `String` | required | Text displayed to the left of the checkbox |
| `theme` | `String` | `'green'` | `'green'` for pantry, `'pink'` for period tracker |

**Themes:**

| `theme` | Unchecked border | Checked fill | Checked text |
|---|---|---|---|
| `green` | `#B8E6D0` | `#2E7D52` | `#2E7D52` |
| `pink` | `#f0c8d8` | `#993556` | `#993556` |

The unchecked border uses the theme's light tint (matching field borders in the same form). The theme's full accent color fills the box only when checked.

The box is 12×12px. The checkmark icon is always white. The label text matches the `add-meta-label` uppercase style so it integrates naturally alongside field labels.

Future features must add their theme variant to `AppFieldToggle.vue` when they introduce a field toggle.

**Canonical usage:** `PantryShoppingList.vue` — price field "∑ tot." toggle that switches between per-unit and total price input mode.

---

## AppScroller

A reusable scrollable container with a styled pill scrollbar that matches the app's rounded design. Lives in `src/components/ui/AppScroller.vue`. Use this everywhere you need `overflow-y: auto` on desktop — never write custom scrollbar CSS inline per feature.

```vue
<AppScroller theme="green" class="my-list">
  <!-- scrollable content -->
</AppScroller>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `theme` | `String` | `'neutral'` | `'pink'` for period tracker, `'green'` for pantry, `'neutral'` for general UI |

**Themes:**

| `theme` | Thumb color | Hover color |
|---|---|---|
| `neutral` | `#d4d4d4` | `#adadad` |
| `pink` | `#F4C0D1` | `#dfa0bb` |
| `green` | `#B8E6D0` | `#8eceb0` |

**Rules:**
- Remove `overflow-y: auto` from any CSS block you replace with `<AppScroller>` — the component owns it.
- When using `ref` on an `<AppScroller>`, access the underlying DOM node via `.$el` for native APIs: `itemsArea.value?.$el?.addEventListener(...)`.
- For scroll containers that cannot be wrapped (sheet `<div>`s with complex structure, `<pre>` elements, mobile-only overrides), add the scrollbar CSS directly — see `DetailSheet.vue`, `DesktopShell.vue`, `SettingsSheet.vue`, and `LogsDashboard.vue` for the pattern.
- On mobile, browsers render their own thin overlay scrollbar — `AppScroller` defers to that and does not override it with media queries.

**Canonical usage:** `PantryInventory.vue` (items list, expired items list), `PantryShoppingList.vue` (items area, move-to-pantry list).

---

## WarningReviewActions

A reusable inline action component for letting users resolve data warnings without deleting data. Lives in `src/components/ui/WarningReviewActions.vue`.

Drop it wherever a warning-flagged item can be actioned — today in the period cycle DetailSheet footer, and in pantry item sheets when expiry warnings are wired up.

### Behaviour

- **Unreviewed (`reviewState = null`):** renders two `IconAction` buttons — "Exclude" (amber) and "Confirm" (pink) — each gated by a `ConfirmDialog`. Selecting either PATCHes the item and emits `@reviewed`.
- **Reviewed (`reviewState = 'confirmed'` or `'excluded'`):** replaces the buttons with a small status chip ("Confirmed" / "Excluded") and an "Undo" link that clears the review state.

The component owns its own `ConfirmDialog` instances — no dialog wiring needed in the parent.

```vue
<WarningReviewActions
  :itemId="selectedCycle.id"
  :reviewState="selectedCycle.review_state ?? null"
  endpoint="period/cycles/5/review"
  itemLabel="Aug 8"
  @reviewed="loadData"
/>
```

**Props:**

| Prop | Type | Description |
|---|---|---|
| `itemId` | `Number` | ID of the item being reviewed (passed for context, not used in the request) |
| `reviewState` | `String \| null` | Current state: `'confirmed'`, `'excluded'`, or `null` |
| `endpoint` | `String` | Path after `/api/` for the PATCH request, e.g. `period/cycles/5/review`. The component prepends `API` automatically |
| `itemLabel` | `String` | Short label for the item used in dialog body text, e.g. `'Aug 8'` or `'Oat milk'` |

**Emits:**

| Event | When |
|---|---|
| `reviewed` | After any successful PATCH (confirm, exclude, or undo) — reload your data here |

**Expected backend contract:**

```
PATCH /api/<endpoint>
Body: { reviewState: 'confirmed' | 'excluded' | null }
Response: { success: true }
```

### Placement rules

- Place inside the `#footer` slot of a `DetailSheet`, within the left `cycle-icon-actions` flex group.
- Show only in **view mode** — hide when a form is open (check `mode === 'view'` or equivalent).
- Show only when the item actually has an actionable warning (`v-if="itemWarnings.length > 0"`).
- Never show for `FUTURE_CYCLE` warnings — those are always data entry mistakes, not reviewable.

### Period tracker wiring (current)

`PeriodCalendar.vue` exposes `selectedCycleWarnings` (computed from `cycleWarningMap` in `usePeriodData`) and passes them to the footer condition. After `@reviewed`, it calls `loadData()` which refreshes `allCycles` and `summary` in one shot — the warning card in `PeriodDetail.vue` updates automatically.

### Pantry wiring (planned)

When pantry expiry warnings are introduced, wire the same component into the pantry item `DetailSheet` footer:

```vue
<!-- inside the pantry item DetailSheet #footer, view mode only -->
<WarningReviewActions
  v-if="mode === 'view' && itemHasExpiryWarning"
  :itemId="sheetItem.id"
  :reviewState="sheetItem.review_state ?? null"
  :endpoint="`pantry/${sheetItem.id}/review`"
  :itemLabel="sheetItem.name"
  @reviewed="loadItems"
/>
```

The backend will need:
1. A `review_state` column on the `pantry` table (migration).
2. `PATCH /api/pantry/:id/review` with the same `{ reviewState }` contract.
3. Expiry warning logic to skip `review_state = 'excluded'` items and include `'confirmed'` ones.

The "Exclude" and "Confirm" dialog copy should be overridden for pantry context — pantry items do not currently support custom dialog labels, but if needed the component can be extended with `confirmCopy` / `excludeCopy` props.

### Future: replacing Mark as used / Mark as wasted

The `WarningReviewActions` binary (confirm vs exclude) maps directly onto the used/wasted pattern. When pantry consumption flows are unified, consider replacing the standalone "Mark used" / "Mark wasted" `IconAction` buttons with a variant of this component that fires the consume endpoint instead of the review endpoint — keeping the `ConfirmDialog`-gated pattern consistent.

---

## Premium & Coming Soon Badges

Two reusable Vue components in `src/components/ui/` for surfacing locked or upcoming features. Always import and use these — never write badge CSS inline.

### Components

**`ComingSoonBadge.vue`** — pill label, no icon. Use for features that aren't released yet, whether or not they are premium.

**`PremiumBadge.vue`** — pill label with lock icon. Use for features that require a license.

Both accept a `theme` prop:

| `theme` | Colors | Use in |
|---|---|---|
| `green` (default) | `#f4fbf7` / `#B8D8C8` / `#6BA888` | Pantry |
| `pink` | `#faf4f7` / `#d4c8d0` / `#b0a8b9` | Period tracker |

Future features must add their theme variant to both components when they introduce premium/coming-soon UI.

The two badges are independent — `ComingSoonBadge` is not always paired with `PremiumBadge`. Use whichever applies. When both apply, render "Coming soon" first, "Premium" second.

---

### Inline teaser row

Used inside a form or settings panel to show a feature that is locked/upcoming. Sits in the natural flow of the form as a non-interactive row.

**HTML:**
```html
<!-- PREMIUM GATE (frontend) -->
<div class="premium-teaser">
  <span class="premium-teaser-label">Feature name</span>
  <ComingSoonBadge />
  <PremiumBadge />
</div>
```

**CSS (local to the file — not in the components):**
```css
.premium-teaser {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  border-radius: 10px;
  cursor: default;
  opacity: 0.6;
}
.premium-teaser-label {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: #1A4D35;
}
```

Rules:
- The `<!-- PREMIUM GATE (frontend) -->` comment is required on the containing element so gates can be found with `grep -r "PREMIUM GATE" grovely-frontend/src`.
- This is UX only. Enforcement is always on the backend (`/api/premium/` routes + `requireLicense` middleware).

---

### Premium panel card (column 3)

Used to fill col 3 of a feature's desktop layout with a set of locked upcoming features. Each card is a standalone teaser. Canonical reference: `PantryPremiumPanel.vue`.

**HTML:**
```html
<div class="premium-panel">
  <p class="premium-panel-title">Coming Soon</p>

  <div class="premium-card">
    <div class="premium-badges">
      <ComingSoonBadge />
      <PremiumBadge />
    </div>
    <p class="premium-card-title">Feature Name</p>
    <p class="premium-card-desc">One or two sentences describing what the feature does.</p>
  </div>
</div>
```

Pass `theme="pink"` to both components inside period feature panels.

**CSS (local to the panel file):**
```css
.premium-panel {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: calc(100vh - 2.5rem);
  box-sizing: border-box;
}
@media (max-width: 1279px) {
  .premium-panel { height: 100%; overflow-y: auto; min-height: unset; }
}

.premium-panel-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: MUTED_ACCENT; /* e.g. #9ECDB6 pantry, #c8b8c5 period */
  margin: 0;
  flex-shrink: 0;
}

.premium-card {
  position: relative;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 20px 20px 18px;
  opacity: 0.55;
  flex: 1;
}

.premium-badges {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  gap: 4px;
}

.premium-card-title {
  font-size: 13px;
  font-weight: 600;
  color: TITLE_COLOR; /* feature title color */
  margin: 0 0 6px;
  padding-right: 150px; /* clear both badges */
}

.premium-card-desc {
  font-size: 12px;
  color: MUTED_ACCENT;
  margin: 0;
  line-height: 1.5;
}
```

Rules:
- Add one `premium-card` per locked feature — cards share space equally via `flex: 1`.
- Title clears both badges with `padding-right: 150px`.
- The panel itself follows the same root structure as other column components (see Column Panel Root above).
