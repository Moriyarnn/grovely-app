# User Preferences

## Overview

User preferences are per-user visual and behavioural settings stored in the database, keyed to a user ID. They are distinct from **app-level settings** (the `settings` table), which are global and owner-managed.

| Table | Scope | Examples |
|---|---|---|
| `settings` | Global (app-level) | `partner_can_read_notes` |
| `user_preferences` | Per-user | `flow_hue`, `theme` |

**Rule:** No new preference may use `localStorage`. All user preferences go to `user_preferences` via `GET /api/preferences` and `PATCH /api/preferences/:key`.

> `partner_can_read_notes` (in `settings`) is owner-managed and enforced on the backend: it controls whether the partner may read the owner's private period notes, which are encrypted at rest. See [Authentication](authentication.md#private-notes-partner-visibility).

---

## Database - Migration 011

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, key)
);
```

Seed defaults on first write (upsert), not at migration time - each user gets defaults on their first preference change.

---

## API Endpoints

Both endpoints require a valid JWT (`requireAuth` middleware).

### `GET /api/preferences`

Returns all preferences for the authenticated user as a flat object.

```json
{ "flow_hue": "340", "theme": "Rose" }
```

Missing keys are omitted - the frontend applies its own defaults.

### `PATCH /api/preferences/:key`

Updates a single preference for the authenticated user.

Request body:
```json
{ "value": "360" }
```

Response: `{ "success": true }`

---

## Frontend Contract

### `usePreferences` composable

A new `src/composables/usePreferences.ts` owns all user preferences (separate from `useSettings`, which handles app-level settings).

- `preferences` - reactive ref, flat `Record<string, string>`
- `fetchPreferences()` - called once after login, populates the store
- `updatePreference(key, value)` - optimistic update + PATCH to API
- On fetch: applies all preferences to the DOM (e.g. sets `--flow-hue` CSS var)

### Loading order

1. User logs in → JWT stored
2. `fetchPreferences()` is called immediately after successful login
3. Preferences hydrate the store and are applied to the DOM
4. `SettingsSheet` reads from the store, not from `localStorage`

### Migrating `flow_hue`

`SettingsSheet.vue` currently reads and writes `flow-hue` via `localStorage` (lines 99 and 111). Migration steps:

1. On `fetchPreferences()`, check if `flow_hue` is absent in the API response **and** present in `localStorage` - if so, write it to the API and clear `localStorage`
2. Remove the `localStorage.getItem` / `localStorage.setItem` calls from `SettingsSheet.vue`
3. Bind the slider to `preferences.value.flow_hue` instead

---

## Going-Forward Rule

> **Every new user preference uses `user_preferences` via the `/api/preferences` endpoints. `localStorage` is never used for preferences.**

When adding a new preference:
1. Pick a `snake_case` key (e.g. `cycle_reminder_days`)
2. Document its default value here (see table below)
3. Add `PATCH /api/preferences/:key` call in `updatePreference()`
4. Role access: both owner and partner can manage their own preferences independently

---

## Preference Registry

| Key | Type | Default | Description |
|---|---|---|---|
| `flow_hue` | integer (290–380) | `340` | HSL hue for flow intensity tinting |
| `theme` | string | `Rose` | UI colour theme |

_Add new preferences to this table when implementing them._

---

## Related

- [Authentication](authentication.md) - JWT, roles, middleware
- [API Endpoints](api.md) - full endpoint list
- [Database Schema](schema.md) - full schema
