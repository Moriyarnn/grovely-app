# Feature - Live Activity (real-time sync)

Frontend half of issue #178. See [Backend - Live Activity](../../backend/live-activity.md)
for the SSE transport and broadcast model.

## Pieces

| File | Role |
|---|---|
| `composables/useRealtime.ts` | SSE client (singleton); bubble queue + coalescing; dispatches `grovely:activity` / `grovely:resync` |
| `components/ActivityToast.vue` | Owns the connection for the session; renders the current bubble. Mounted in `App.vue` when logged in |
| `components/ui/AppToast.vue` | The bubble visual (reused from the HubView reorder hint), with a `placement` prop for the desktop corner variant |

## Connection lifecycle

`ActivityToast` is mounted in `App.vue` only when `showShell` is true (logged
in, not on `/login`). On mount it loads preferences and calls `connect()`; on
unmount (logout / redirect to login) it calls `disconnect()`. After re-login it
remounts and reconnects with the fresh token.

## Receive gate

Every incoming event is dropped unless the user's `live_activity_receive`
preference is on (default on). When off: no bubble **and** no live page update -
the page refreshes normally on next navigation. The connection stays open so the
toggle takes effect immediately without a reconnect.

## Bubble queue + coalescing

One `AppToast` shows at a time. Bubbles enqueue and display sequentially, each
for `DISPLAY_MS` (3.5s). Coalescing: a new event whose key (`actorId` is implied
by the connection; key is the bubble type) matches a bubble shown/queued within
`COALESCE_MS` (1.5s) merges instead of enqueueing a second, incrementing a
count. This is what turns the N requests of a bulk move-to-pantry into a single
"moved X items to the pantry inventory" bubble.

The actions themselves apply immediately - the queue only paces the bubbles.

## Desktop toast

`AppToast` takes `placement="corner"`: bottom-center pill on phone, anchored to
the bottom-right corner on desktop (≥1024px, clear of the DesktopShell nav).
Same component, same queue - only the CSS placement switches by breakpoint.

## Page-conditional animation

`useRealtime` re-dispatches each event as a `grovely:activity` window event.
Views listen **only while mounted**, so animations play only if the receiver is
on the page that changed (mobile or desktop). `AppLayout` keeps all panels of a
feature mounted at every breakpoint, so e.g. both pantry panels animate even
when only one is visible on mobile.

| View | Behaviour on event |
|---|---|
| `PantryShoppingList.vue` | Surgical merge into `items` (push / replace by id / filter) - the existing `item-scale` TransitionGroup animates. Edits use a separate sheet, so an open editor is never clobbered |
| `PantryInventory.vue` | Same surgical merge; an add may be a backend merge into an existing row, so replace-by-id-else-insert |
| `PeriodCalendar.vue` | Refetch via `usePeriodData.loadData()` - no cell pulse (for cycle-level edits the changed date isn't where the user is looking, so a highlight reads as arbitrary). Refetch (not surgical insert) so gap days vs period days render as their true type |

Because `PeriodDetail.vue` reads the same `usePeriodData` singleton refs,
`loadData()` updates its values live too - no separate wiring (no animation
there, just refreshed numbers).

On `grovely:resync` (SSE reconnect) each mounted view reloads from scratch; no
bubbles are replayed.

## Wiring a new feature into live activity

When a new feature has writes both household accounts can see (shopping-list
style shared data), wire it in:

1. **Backend:** call `emitActivity(req, { type, ...payload })` after each
   successful write, including the changed entity for surgical merge.
2. **Bubble:** add a `case` to `describe()` in `useRealtime.ts` with the bubble
   key, icon, and text (counted form if the action can be bulk).
3. **Animation:** in the feature's view, add `grovely:activity` / `grovely:resync`
   listeners in `onMounted` / `onUnmounted` that surgically merge the payload (or
   refetch + pulse for calendar-like views).

### Private fields (`visibleChange`)

If the feature has fields hidden from some accounts (like period **notes**), the
writing call must send `visibleChange` = "did any *partner-visible* field change
in this write", so the partner isn't notified of a change they can't see. The
period day/gap-day saves in `PeriodCalendar.vue` are the reference: the edit
(PATCH) computes `visibleChange` from flow/symptoms (not notes); creates and
deletes that add/remove a visible marker omit the flag (always notify). The
visibility setting itself is checked on the backend. Full rationale and the
"why trusting the client is safe here" note: [Backend - Private-field exception](../../backend/live-activity.md#private-field-exception-visiblechange).
