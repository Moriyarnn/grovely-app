# Live Activity (real-time sync)

Real-time sync between household accounts. When one account changes period or
pantry data, every other connected session reflects it immediately - with a
brief activity bubble and (on the relevant page) an in-place animation. Free
feature. Implements issue #178.

## Transport

Server-Sent Events (SSE). One-way push, server → client, over plain HTTP. No
WebSockets, no external dependency, no message broker.

- **Endpoint:** `GET /api/events`
- **Auth:** the `EventSource` browser API cannot send an `Authorization` header,
  so the JWT is passed as `?token=<jwt>` and verified the same way as a Bearer
  token. Acceptable behind HTTPS on a self-hosted box.
- **Heartbeat:** a `: ping` comment frame every 25s keeps the connection alive
  through reverse-proxy idle timeouts. `X-Accel-Buffering: no` disables nginx
  buffering.
- **Reconnect:** the server sends `retry: 3000`; the browser auto-reconnects.

## Ephemeral by design

Pure live push. There is **no replay, no backfill, no persistence** - no events
table, no "since" cursor, no startup catch-up. An event fired while a session is
not connected is simply lost for that session. On reconnect the client fires a
local `grovely:resync` so mounted views reload current state; it does **not**
replay missed bubbles.

## Broadcast model (`realtime/index.js`)

An in-memory registry maps connection id → `{ userId, res }`. Multiple
concurrent sessions per user are supported (phone + laptop).

```
broadcast(actorId, data)  // send to every connection whose userId !== actorId
```

> **Targeting rule:** broadcast goes to **every connected client except those
> belonging to the actor** - never filtered by role. Today that resolves to the
> other of `owner1`/`owner2`; under the future multi-account model (#137) it
> already means "everyone in the household except the person who made the
> change". Do not add role-based filtering here.

### `emitActivity(req, event)`

The route-facing helper. It:
1. Reads the actor's `live_activity_broadcast` preference (default **on** when
   the row is absent) and returns early if broadcasting is disabled.
2. Resolves the actor's display name (`username` for now; per-account display
   names arrive with #137).
3. Calls `broadcast(actorId, { ...event, actorId, actorName, ts })`.

It never throws into the request path.

## Preferences

Two **per-user** preferences (`user_preferences`, keyed by `user_id`), each
defaulting **on** via a frontend fallback (`?? '1'` - per-user rows cannot be
seeded by a static migration, same pattern as `flow_hue`):

| Key | Meaning | Gate location |
|---|---|---|
| `live_activity_broadcast` | "Broadcast my activity" - send my changes | Server (`emitActivity`) |
| `live_activity_receive` | "Show live activity" - see bubbles + live updates | Client (`useRealtime`) |

Each account chooses independently. This is also the #137-safe choice: every
future account gets its own pair automatically.

## Events emitted

`emitActivity` is wired into every period and pantry write route. The `type`
field selects the bubble and the client merge behaviour.

| `type` | Emitted by | Payload | Bubble |
|---|---|---|---|
| `period.change` | all cycle / cycle-day / gap-day writes | `action`, `dates[]` | "{Name} made changes on the period tracker" |
| `pantry.list.add` | `POST /pantry/list` | `item`, `row` | "{Name} added {item} to the shopping list" |
| `pantry.list.modify` | `PATCH /pantry/list/:id`, `DELETE /:id`, `DELETE /checked` | `action` (`check`/`edit`/`delete`/`clear`), `id`/`ids`, `row?` | "{Name} modified the shopping list" |
| `pantry.inv.add` | `POST /pantry` | `item`, `row` | "{Name} moved {item}/{X items} to the pantry inventory" |
| `pantry.inv.modify` | `PATCH /pantry/:id`, `/consume`, `/status`, `DELETE /:id` | `action`, `id`, `removed`, `row?` | "{Name} updated the pantry inventory" |

`period.change` is a trigger, not data - the receiver refetches the whole
calendar rather than merging the payload (`dates[]` is carried but currently
unused; the receiver does not pulse, since for cycle-level edits the changed date
isn't necessarily where the user is looking). The single generic period bubble
never leaks whether a gap day, period day, or cycle was changed, which keeps
private notes private.

## Private-field exception (`visibleChange`)

Some data has fields one account cannot see - e.g. period **notes** are private
to owner1 unless `partner_can_read_notes` is on (enforced by `revealPrivateFields`).
A naive broadcast would notify the partner whenever owner1 edits a note, even
though the partner cannot see it. That is both a UX wart (a bubble for a change
they can't observe) and a metadata leak (it signals that private notes were
written).

**Rule:** broadcast a change only when something the recipient can actually see
changed - or when the hidden field is, for them, not hidden.

**Mechanism:** the writing client sends a boolean `visibleChange` in the request
body = "did any partner-visible field change in *this* write". The route emits:

```js
if (visibleChange !== false || partnerSettingEnabled(db, '<visibility_setting>')) {
  emitActivity(req, { ... })
}
```

- `visibleChange === false` → the only change was a hidden field → suppress,
  unless the visibility setting makes it visible to the recipient.
- Flag **absent** → defaults to emitting (safe; never silently drops a change).
- The visibility **setting** is checked server-side (authoritative); the client
  never decides policy, only reports what the user touched.

**Why trusting the client here is safe:** this is *not* an authorization
boundary. Field-content confidentiality is enforced separately and unconditionally
by `revealPrivateFields` - it is never weakened by this flag. `visibleChange` only
gates a **content-free** "something changed" ping about the actor's *own* action.
A wrong/forged flag can at most drop a bubble or show a generic bubble carrying no
private content. (Contrast with access control, which must never trust the client.)

**Each route judges only its own fields.** Period example:

| Write | Partner-visible fields | `visibleChange` is… |
|---|---|---|
| `cycle_days` PATCH | `flow_intensity`, `symptoms` | flow or symptoms changed |
| `cycle_days` POST | (new day = new marker / range) | always visible - flag omitted |
| `gap_days` PATCH | `symptoms` (marker already exists) | symptoms changed |
| `gap_days` POST | (new gap day = new `cal-gap-logged` marker) | always visible - flag omitted |
| `gap_days` DELETE | (marker removed) | always visible - emits unconditionally |
| `cycles/:id/ovulation` | ovulation marker | always visible - separate route, always emits |

`notes` never appears in the "visible" column, so a notes-only edit is the one
case that gets suppressed when notes are hidden.

### Adding a private-field exception to a future feature

When a new shared feature has a field gated from some accounts:

1. Decide which fields are **partner-visible** vs hidden for that feature.
2. Have the writing client send `visibleChange` = did any *visible* field change.
3. In the route, gate `emitActivity` with
   `visibleChange !== false || partnerSettingEnabled(db, '<setting>')`.
4. Keep content confidentiality in `revealPrivateFields` (or the feature's
   equivalent) - the flag is only a notification gate, never the access gate.
5. Creates/deletes that add or remove a visible marker should notify regardless
   (omit the flag or emit unconditionally).

## Frontend

See [Frontend - Live Activity](../frontend/features/live-activity.md) for the
SSE client, the coalescing bubble queue, the desktop toast, and the
page-conditional surgical-merge animations.
