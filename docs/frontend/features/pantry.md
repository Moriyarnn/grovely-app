# Pantry — Frontend

## Overview

Two-layer household food system: a **Shopping List** tab (what needs to be bought) and a **Pantry** tab (what's in the house, with expiry tracking). Checking off a shopping item moves it into the pantry. The pantry drives expiry notifications and eventual recipe integration.

## Planned Views

- `src/views/PantryHome.vue` — main screen, tabbed: Shopping List / Pantry
- `src/views/PantryItemDetail.vue` — detail/edit for a single pantry item (expiry, quantity, notes)

## Shopping List Tab

The default tab. Shows items to buy, grouped by category.

**Item fields:**
- Name (required)
- Quantity + unit (optional — "2 kg", "1 bunch", "3")
- Category (produce / dairy / meat / bakery / frozen / dry goods / other) — auto-suggested, editable
- Added by (shown as avatar/initial for partner awareness)

**Interactions:**
- Tap item → toggle checked (grey out, move to bottom)
- Long-press → edit name, quantity, category
- Swipe left → delete without buying
- Tap checked item → prompt: "Add to pantry?" with optional expiry date entry → moves to Pantry tab
- "Clear checked" button — bulk-remove all checked items without moving to pantry (for items that were already home)

**Search:** A search bar above the item list filters across both unchecked and checked sections in real time. Category groups that have no matching items collapse automatically. Uses the `ListControls` component with `layout="expanded"` (search only — no filter chips or sort row).

**Category grouping:**
Items grouped by category with collapsible headers. Order: produce → dairy → meat → bakery → frozen → dry goods → beverages → other. Checked items sink to a "Done" section at the bottom regardless of category.

## Pantry Tab

Inventory of what's currently in the house. Items here have been bought and may have an expiry date.

**Item fields:**
- Name
- Quantity remaining (decrements as used)
- Category
- Bought date (auto-set to today when moved from shopping list)
- Expiry date (optional — prompted when item arrives from shopping list)
- Opened date (optional — some items have shorter life once opened)
- Notes (e.g. "half used", "in freezer")

**Visual expiry states:**

| State | Condition | Color |
|-------|-----------|-------|
| Fresh | >7 days to expiry | default |
| Expiring soon | 4–7 days | amber |
| Expiring very soon | 1–3 days | orange |
| Expires today | 0 days | red pulse |
| Expired | past expiry | grey strikethrough |

Items with no expiry date set are shown normally with no color state applied.

**Interactions:**
- Tap item → PantryItemDetail (edit expiry, quantity, notes; mark as used/wasted)
- Swipe left → mark as used (removes from pantry)
- Swipe right → add back to shopping list (replenish flow)
- "Add to pantry" FAB — add items directly without going through shopping list

**Search and filter:**
- A search bar embedded in the inventory card filters items by name in real time (client-side, no API call)
- Category filter chips below the search bar narrow to a single category; chips are dynamic — only categories present in the current inventory are shown
- Controls use the `ListControls` component (`src/components/ui/ListControls.vue`) with `layout="compact"` and `theme="green"`

**Sorting options:** Expiry (default — soonest first, no-expiry items always last), Name (A → Z), Category (A → Z, then by name within group), Added (newest first). A direction arrow toggles ascending/descending for the active sort. Sort state is session-only and resets to Expiry on reload.

**Empty state:** First-time empty pantry shows a friendly prompt: "Nothing here yet — check items off your shopping list to stock it up, or tap + to add directly."

## Pantry Stats Bar (free)

A compact summary row pinned below the tab bar on the Pantry tab:
> "12 items · 2 expiring soon"

Updates live. Tapping the "expiring soon" segment scrolls to / highlights those items.

## Expiry Nudge (free)

A persistent banner at the top of the Pantry tab when items are expiring within 3 days:
> "3 items expiring soon — tap to see"

Tapping scrolls to / highlights the expiring items.

## Shopping Wizard (free)

A "just got home" bulk-add mode accessible from a FAB or prominent button on the Pantry tab. Designed for speed — the whole flow stays on one screen.

**Flow:**
1. Tap "I just got home" → wizard opens
2. Type item name (autosuggest from past items) → set quantity → set expiry date or skip → tap "Next"
3. Repeat for each item
4. "Batch expiry" shortcut: if several items share the same date, set it once and apply to the last N items
5. Tap "Done" → all items written to pantry at once, wizard closes

The wizard does not require items to exist on the shopping list first — it's a standalone entry point.

**Premium wizard extensions:**
- Saved templates: save the current wizard session as a named template (e.g. "weekly staples") for one-tap reuse
- Repeat last shop: pre-fills the wizard with the previous session
- Barcode scanner (mobile): scan item barcode to auto-fill name and category

## Recipe Crossover (premium — Phase 7+)

When recipes are implemented, the pantry unlocks a "What can I cook?" flow:
- Recipes are scored by how many pantry ingredients they use, weighted toward expiring items
- Items marked as the recipe's ingredients are decremented from pantry quantities on confirm
- Missing ingredients from a chosen recipe are added to the shopping list in one tap

## Hub Card

The hub card shows a live summary:
- X items on the shopping list
- X items in the pantry
- If any pantry items expiring in ≤3 days: amber warning dot

## Role Access

| Action | Owner | Partner |
|--------|-------|---------|
| View shopping list | ✓ | ✓ |
| Add / edit / remove list items | ✓ | ✓ |
| Check off and move to pantry | ✓ | ✓ |
| View pantry | ✓ | ✓ |
| Add / edit pantry items | ✓ | ✓ |
| Mark used / wasted | ✓ | ✓ |

Both roles have full access — Pantry is a shared household feature.

## Status

Shopping list live. Inventory live. Search, filter, and sort live. Move-to-pantry flow live. Backend spec: [Pantry — Backend](../../backend/pantry.md)
