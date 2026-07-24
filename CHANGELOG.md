# Changelog

All notable changes to Grovely are documented here. This file is the complete
record; the in-app "What's New" panel shows a short summary of major releases only.

---

## v0.14.1-rc.3 - updater completion fixes
*July 24, 2026*

- Pre-update snapshots now authenticate with the private updater token before the normal household API authentication layer
- The updater image includes its Compose command helper, and UAT port overrides replace base port bindings cleanly
- Only stable version tags now publish the `latest` image tag; prerelease tags remain opt-in

---

## v0.14.1-rc.2 - UAT update correction
*July 24, 2026*

- UAT updates now pass `.env.uat` to Compose and combine the base and UAT Compose files before pulling images
- Release candidate versions are accepted and ordered correctly, so UAT can offer a newer candidate

---

## v0.14.1-rc.1 - system updates release candidate
*July 24, 2026*

- Version-aware home status lets either household member see when a Grovely release is available
- Optional, anonymous release checks use public cached metadata only and can be disabled by the server administrator
- Confirmed in-app updates create a local pre-update snapshot, pull the published frontend and backend images, and preserve local Compose and proxy configuration

---

## v0.14.0 - live in-browser demo
*June 30, 2026*

- Live in-browser demo - try the full app, with premium unlocked, right in the browser with no install or signup
- The demo runs entirely client-side, isolated per visitor and reset on refresh, so nothing ever leaves your browser
- Fertile window and ovulation predictions now match across the calendar, the PeriodDetail card, and notification emails
- Notification startup catch-up is no longer skipped when a license is added or notifications enabled mid-day and the app restarts

---

## v0.13.0 - live updates between partners and launch prep
*June 23, 2026*

- Live activity - when one partner makes a change the other partner sees it instantly with a brief bubble showing who did what. Bulk moves show a single counted bubble. Can be disabled per account in Settings
- Current Phase card accuracy improved - active cycle takes priority over stale gap predictions, confidence badge correctly shows Logged or Calculated when a period is active
- Predictions now advance when a period is not logged - missed predictions persist on the calendar with fertile windows and ovulation markers
- Private period notes encrypted at rest - partner cannot read them even from an exported backup
- Easy install scripts for Linux, Mac, and Windows - guided interactive setup, no manual config file editing needed
- Version-pinned release assets - every GitHub release now includes a docker-compose.yml and .env stamped with that version so installs are reproducible
- Backend refuses to start if placeholder credentials are still set in .env, preventing accidental insecure deployments
- Partner read-only notice moved to calendar info section, all write attempts now show a clear read-only bubble

---

## v0.12.13 - README update
*June 16, 2026*

- Expanded the README with the free and premium feature breakdown
- Added license and support links (Ko-fi and GitHub Sponsors)

---

## v0.12.12 - Screenshots gallery
*June 16, 2026*

- Added a screenshots gallery under docs/screenshots with the app's main views and the period tracker and shopping list demo clips
- Added a Screenshots section to the README (desktop, mobile, and demos) embedding them inline

---

## v0.12.11 - Partner UX and mobile browser hub fix
*June 15, 2026*

- Partner read-only notice moved to the calendar view, visible before any interaction
- All calendar write attempts as partner now show a 'Period logging is read-only' bubble instead of silently doing nothing
- Hub premium thanks bubble no longer squished into the app grid on mobile browser (non-PWA)

---

## v0.12.10 - README and LICENSE cleanup
*June 11, 2026*

- Added project copyright notice to LICENSE file
- Centered personal intro paragraph on README
- Added Current Phase card (premium) and delete cycle (free) to README feature list
- Consolidated Smart Autofill as a named premium feature in README
- Corrected notification count to 18 in README
- Roadmap dates updated to Q3/Q4 2026
- Added multi-language support (Q4) and themes (Future) to roadmap
- Updated period tracker screenshot

---

## v0.12.9 - Prediction stability, mobile polish, install docs
*June 9, 2026*

- Fertile window predictions on past cycles no longer depend on prediction error correction - stored predictions are now deterministic so deleting and recreating a period produces identical fertile windows
- Prediction recompute now runs synchronously before the API response so the frontend always reads up-to-date predictions, and end-date changes also trigger a recompute (previously skipped)
- Hub view locks to viewport height on mobile - gaps and padding shrink on short phones so the full page fits without scrolling
- Hold-to-reorder on hub app tiles no longer triggers pull-to-refresh on Android phones
- Backup restore file picker uses the File System Access API on Android so the OS opens the file manager instead of the photo gallery
- Text selection disabled on scrollable lists in the backup destinations and notification type panels so dragging scrolls instead of highlighting
- Phase card teaser for free users now shows a sample "Ends in 6 days" label matching the premium layout
- Free users who log today no longer see a leaked Menstrual phase card - the locked teaser is shown regardless of phase confidence
- INSTALL.md Caddy snippet aligned with Caddyfile.example - uses `handle /api/*` instead of `handle_path` with rewrite
- INSTALL.md now links to Caddyfile.example with a curl command for users who want the full config with security headers and gzip
- Added Caddy HTTPS certificate troubleshooting to INSTALL.md (port 80/443 forwarding for Let's Encrypt)
- Caddyfile.example now references both compose overlay filenames, includes start and reload commands for Linux and Windows, and removes the `--build` flag from the compose commands
- docker-compose.proxy-host.yml Caddy snippet updated to match Caddyfile.example, with health route added

## v0.12.8 - Timezone display, phase card fix, log cleanup
*June 9, 2026*

- Backup and notification time pickers now show the server timezone so users know what timezone the cron runs in
- Current Phase card no longer blanks when missed predictions exist from historical cycle gaps (#173)
- Removed repetitive period calculation log that spammed docker logs on every page load

## v0.12.7 - Responsive layout rework
*June 9, 2026*

- AppLayout reworked to three responsive tiers accounting for DesktopShell's 350px nav: phone (<1024px) swipes all 3 panels, tablet (1024-1439px) shows 2-column grid with inner swipe, desktop (>=1440px) shows full 3-column proportional grid (7fr 8fr 8fr)
- Period calendar uses container query units (cqi) for badges and text so everything scales proportionally with column width instead of staying fixed-size
- Login sign-in panel spacer now shrinks on short viewports instead of pushing the form off-screen
- Pantry inventory item borders use inset box-shadow for consistent rendering at all zoom levels
- Column root height fixed in PantryInventory, PeriodDetail, PeriodCalendar, PantryShoppingList, and both premium panels so panels size correctly inside the layout grid

## v0.12.6 - Cold-install dry run fixes
*June 8, 2026*

- Period detail panel no longer crashes when logging a day - a missing `todayStr` variable threw a ReferenceError that broke the entire Cycle Details column
- Prediction chain now advances correctly on the day a predicted period starts - the predicted start becomes a missed prediction and the next future prediction generates automatically, instead of stalling on the current one
- "Ends in X days" label on the Current Phase card no longer shows for free users - it was leaking premium phase data
- Backup restore now re-fetches settings and preferences immediately so the UI reflects restored values without a page refresh
- Login page and desktop column layout fit small laptop screens (768p) - root locks to viewport height, panels scroll internally
- Removed unnecessary 1.12x calendar scale-up on desktop that caused overflow on smaller displays
- Desktop AppLayout panels now stretch to equal height with internal scroll instead of growing past the viewport
- Docker images now build with `npm ci` instead of `npm install` for reproducible installs; regenerated both lockfiles
- README quick start now shows the URL after `docker compose up -d` with a note about custom ports
- Backend startup log now includes `Open Grovely at http://localhost:5173`

## v0.12.5 - Private note encryption, prediction and UI fixes
*June 6, 2026*

- Private period notes are now encrypted at rest and stay private to the account that wrote them, even inside a backup file. The partner only sees them when note sharing is turned on.
- Predictions now advance when a period is not logged - missed predictions and their fertile windows persist on the calendar, and the predictions card shows the next upcoming fertile window.
- Phase monitor now aligns with the calendar, deriving the ovulatory day from saved predictions. Prediction health "Review" jumps to the calendar on mobile, and warning badges render correctly inside calendar cells.
- Irregular cycles notification no longer repeats for naturally irregular cycles - it fires only on the transition into irregularity and respects the Period Settings toggle.
- Shopping list search is now a display filter only - cart total, selected total, and move actions always act on the full list, and the action bar no longer disappears on an empty search.
- Login page redesigned with feature cards, premium lock indicators, and privacy messaging.
- **Premium** - Notifications and Backups settings now use a flat drill-in list with an "X of Y active" header instead of a dropdown selector.
- Internal: the app version is now sourced from `package.json` at build time so the in-app version can no longer drift, and backups stamp the correct app version.

## v0.12.4 - Environment consolidation
*May 30, 2026*

- Moved `.env.example`, `.env.dev.example`, and `.env.uat.example` to the repo root (out of `grovely-backend/`); updated compose `env_file` paths to match
- Added `validate-env.sh`: a premium-aware `.env` sanity check that flags leftover placeholders, missing required values, TZ, SMTP, and partial S3/WebDAV configs
- Replaced placeholder license URLs with the live storefront `https://grovely.lemonsqueezy.com` across `PremiumGate.vue`, `INSTALL.md`, `README`, and all `.env` examples

## v0.12.3 - Reverse-proxy overlay for host-installed proxies
*May 29, 2026*

- Added `docker-compose.proxy-host.yml` for users running Caddy, Nginx, Apache, or HAProxy directly on the host rather than in Docker
- Binds frontend and backend to `127.0.0.1` only so they are not exposed publicly, and pulls `grovely-frontend:latest-proxy` so no local build is required
- Ships ready-to-paste Caddyfile and Nginx snippets; `docker-compose.proxy-docker.yml` now cross-references the host variant so you can pick the right overlay at a glance (#161)

## v0.12.2 - Compose pulls from GHCR by default
*May 29, 2026*

- Flipped `docker-compose.yml` from `build:` to `image: ghcr.io/moriyarnn/grovely-{frontend,backend}:latest` so Grovely runs without cloning the repo; `build:` stays defined so `--build` still works
- Backend `env_file` moved from `./grovely-backend/.env` to `.env` so a single compose file plus a `.env` next to it is enough to boot
- Added a CI matrix entry that publishes `grovely-frontend:latest-proxy`, built with `VITE_BACKEND_PORT=""` so the bundle issues same-origin API calls; the dockerized-proxy overlay pulls that tag directly and no longer needs `--build` (#161)

## v0.12.1 - Backend data directory fix
*May 29, 2026*

- Fixed an EACCES crash when running the backend image via `docker run` without a volume mount: the entrypoint dropped from root to PUID:PGID before Node started, and Node's `mkdirSync('/app/data')` failed inside the root-owned `/app/`. `mkdir -p /app/data` now runs while still root, ahead of the chown (#161)

## v0.12.0 - Grovely + PWA + Notifications + Pantry Smart Autofill + Backups
*May 29, 2026*

### App rename
- Renamed from Tenderly to Grovely (name clear on USPTO, EUIPO, UK IPO in Class 42)
- Brand color updated to sage-mint green across the desktop shell and hub header
- Directories, Docker Compose configs, package names, and GitHub repo renamed to match

### PWA - install to home screen
- Installable on iOS (Safari, Add to Home Screen) and Android (browser, Install app)
- Manifest with standalone display, theme color, 192x192 and 512x512 icons
- Full iOS/Android compatibility pass: 100dvh layout, viewport-fit=cover, keyboard zoom prevention, pull-to-refresh guard, uniform field heights, notes overflow fix, swipe action flash fix

### Notifications overhaul
- **Premium** - Generic SMTP via MAIL_HOST/PORT/USER/PASSWORD, no longer locked to Gmail
- **Premium** - Env vars renamed: GMAIL_* / RECIPIENT_EMAIL to MAIL_* / ACCOUNT1_EMAIL / ACCOUNT2_EMAIL
- **Premium** - Three new partner notification types: period starting in 3 days, fertile window today, period ended
- **Premium** - Full 15-type system (including partner) is now premium

### Notification customisation
- **Premium** - Per-type message editing with inline panels; custom body in notification_type_settings
- **Premium** - Per-type on/off toggles; Enable all button
- **Premium** - Email personalisation: greeting, sign-off, sender display name with live preview
- **Premium** - Configuration warnings for SMTP misconfig and missing recipients

### Account roles
- Roles renamed owner to owner1, partner to owner2 across codebase, env files, and database
- Migration 026 recreates the users table to drop the stale CHECK constraint safely

### Period tracker polish
- Predictions card always shows Next period / Fertile window / Ovulation / Avg cycle rows
- Calendar dashed cells fill the gap between last logged day and predicted period end
- Predicted completion cells persist until the next period is logged
- Calculated vs Predicted confidence pills (desktop tooltips, mobile long-press info)
- Phase indicator triangle walks day by day, adapts to the user's avg cycle length
- review_state filtering consistent across the full prediction pipeline
- Locked Current Phase card for free users redesigned as a sample teaser
- Tutorial sequencing fixed; calendar resets to current month on logout
- Many fixes: cycleDayNum from real start date, while-loop overshoot, fertile window cycle

### Reusable tutorial component
- Generic FeatureTutorial shell: normal/premium variants, rose/mint themes, configurable slides
- Period tracker: existing 3-slide intro plus a new premium phase explainer
- Pantry: 3-slide normal intro plus a 1-slide premium Smart Autofill walkthrough

### Pantry Smart Autofill (#156)
- Intelligent autocomplete on the shopping list Add item field, backed by full purchase and consumption history
- Free: catalog name search; recent items on focus; fills name only
- **Premium** - History grouped by name+amount+unit+pieces+store; autofills all fields with a green/red price delta vs your usual; store shown inline as Milk (Costco)
- Three new tables: pantry_item_catalog, pantry_purchase_history, pantry_consume_history
- Pantry items use soft delete; shopping list gains a store field
- Inventory merge fix: amount-type items merge on name + unit (no more duplicates as totals change)
- Expiry-aware merge: same date sums, different dates stay separate
- Suggested expiry on move-to-pantry via GET /api/pantry/suggest-expiry
- Move-to-pantry hint: Adds 500 ml to existing

### Scheduled automatic backups
- **Premium** - Daily cron, user-configurable time (default 03:00); startup catch-up if the cron was missed
- **Premium** - Local retention: keep N snapshots, prune older
- **Premium** - S3-compatible push via BACKUP_S3_* (AWS, B2, R2, Wasabi, MinIO, Hetzner)
- **Premium** - WebDAV push via BACKUP_WEBDAV_* (Nextcloud, ownCloud, Synology, QNAP, TrueNAS, mod_dav)
- **Premium** - Remote push is best-effort; local is the source of truth; SDKs lazy-required
- **Premium** - Full Settings panel: status, next-run, schedule, retention, per-destination cards, run-now, verify, expandable history
- **Premium** - Per-destination history table (log_system_backup_destinations)

### Pantry and shopping list fixes
- Diagonal column grid consistent across view/edit; tighter gaps; mobile alignment
- Legacy pcs-unit items auto-convert to pieces on edit
- Price: total vs per-unit entry when pieces > 1; clears on zero; currency-aware placeholder
- Multi-select shows a live selected total in a redesigned two-row bottom bar
- Mobile polish: resized price field, sum toggle abbreviation, /pc suffix pushed right

### Settings and sheets polish
- Your Apps restructured into per-app drill-in sheets on the shared DetailSheet
- Notifications settings sheet migrated onto the shared DetailSheet
- Per-app rows show an at-a-glance preview (flow color + fertile state, expiry days + currency)
- Flow color is a full-spectrum picker; only hue stored
- Notes field: fixed stable size, no layout jump on view/edit, content scrolls inside

### Reverse proxy support (#160)
- docker-compose.proxy.yml (host-installed proxy, binds 127.0.0.1)
- docker-compose.proxy-docker.yml (dockerized proxy on external proxy network)
- Caddyfile.example with IPv4 upstreams, optional email block, dual-OS reload notes

## v0.11.0 - Settings + Pantry + Period tracker polish
*May 12, 2026*

### Backup and restore
- Full JSON export of all app data downloadable on demand from Settings, Data & Backups
- Versioned backup format: each file embeds schema version, app version, compatibility floor, and timestamp
- Compatibility checks before restore: hard block if app or backup is too old, soft warning if backup is from a newer version
- Pre-restore snapshot saved automatically to /data/pre-restore-snapshots/ before any data is overwritten - last 5 kept, older pruned
- Restore guards: only columns present in the current schema are inserted; unknown columns and missing tables are skipped with warnings
- Both partners can export and restore

### Settings fully wired
- Notification send time, period notifications toggle, and pantry notifications toggle now save to the database and take effect immediately - no restart required
- Pantry expiry warning window connected end-to-end: inventory colour coding, expiring-soon badge, daily email, hub card subtitle, and summary strip all use the saved value
- Custom option added for the expiry warning days with a free number input (1-60)
- Hub cards and summary strip update live when settings change - no page refresh needed
- Pantry currency preference added to Settings; all shopping list prices and totals reflect the selected currency with immediate UI update
- Pantry currency moved from per-user preferences to global household settings so owner and partner always see the same currency

### Pantry search, filter, and sort
- Real-time search on both the shopping list and pantry inventory - filters by item name as you type, no backend round-trip
- Shopping list: category groups collapse automatically when no items in that category match the search
- Pantry inventory: category filter chips let you narrow to a single category; chips are dynamic - only categories present in the current inventory are shown
- Pantry inventory: four sort options - Expiry (default, soonest first, nulls always last), Name, Category, Added - each with a direction toggle arrow
- Reusable ListControls UI component wires up search, filter, and sort for any list view

### Pantry improvements
- Expiry warning window respected everywhere including the new daily expiry email notification
- Shopping list and inventory prices respect the selected currency's decimal rules (CLP, JPY show whole numbers)
- Beverages added as a category across shopping list and inventory
- Density field greyed out for piece-counted items across all forms and the consume dialog
- Pieces system: quantity displays and consume/waste logic now account for multiple pieces per item
- Pieces system redesigned: inventory uses mutually exclusive modes (measured or counted, never both); shopping list retains pieces as a free multiplier; move-to-pantry flattens to a clean unambiguous record; consume dialog handles counted items with a live partial-count input
- Hub app cards now show live context (active period day, days until next period, pantry item count) instead of static "Tap to open"; stats refresh automatically after any period or pantry mutation

### Period tracker
- Summary strip surfaces pantry expiry alerts alongside period alerts with role-aware onboarding
- Gap day logs: log symptoms and notes on days between periods; visible on the period calendar
- Alert days (impossibly short cycle gaps) now properly excluded as prediction anchor points - the flagged cycle is bridged over entirely, not just its preceding gap dropped; users can confirm unusual cycles as real or mark them as data entry mistakes without losing data

### Migrations
- 021: gap_day_logs, gap_day_symptoms
- 022: notification_settings
- 023: pieces
- 024: pantry_currency_to_settings
- 025: cycle_review_state

### New components
- ListControls.vue - reusable search, filter, and sort for any list view with theme and layout props
- WarningReviewActions.vue - review action controls for period data warnings
- useAppStats.ts - composable for hub card live stats with automatic invalidation

### Issues closed
- #32 Data safety: backup and restore
- #46 Symptoms & notes on inter-cycle gap days
- #56 Alert days contribute to predictions when they shouldn't
- #69 Pantry: search and filter on shopping list and inventory
- #70 Pantry: sort options for inventory
- #73 Wire up notification time of day setting
- #74 Wire up period notifications toggle
- #75 Wire up pantry notifications toggle
- #81 Wire up pantry expiry warning threshold setting
- #89 Pantry: surface expiry counts in the summary strip
- #97 Settings: pantry currency preference
- #118 Pantry: grey out density field for piece-counted items
- #119 Pantry: currency-aware price decimals in forms and displays
- #120 Pantry: add Beverages category
- #122 Hub cards: show live context instead of Tap to open
- #123 Pantry: pieces system
- #124 Pantry: pieces system redesign
- #127 Pantry currency moved to global settings

## v0.10.0 - Pantry polish + Reverse proxy support
*May 7, 2026*

### Pantry - shopping list
- #95: expiry date stored per item, editable in item detail sheet, carried through automatically to pantry inventory on move
- #65: tap any item to view or edit - name, price, quantity + unit, category, expiry, notes
- #99: price shown inline on each row; cart total pill in action bar below "Move all to pantry"
- #100: detail sheet view/edit mode visual consistency
- #113: quantity spinners, name overflow, move sheet qty, swipe action style polish
- #109: add form price field added; category moved to its own row to fix mobile overflow; unified move-to-pantry sheet with scrollable item list, per-item expiry pre-filled, Cancel + "Move X item(s)" footer; centered modal on desktop
- #68: swipe-to-delete on shopping list and inventory items (useSwipeGroup composable)

### Pantry - inventory
- #61: expiry visual states - color-coded cards, relative labels (fresh / expiring soon / very soon / today / expired), actual expiry date per item
- #62: expiring soon banner in inventory view
- #63: item categories - Produce, Dairy, Meat, Bakery, Frozen, Dry Goods, Other; chip on each inventory item, grouped headers on shopping list
- #64: scale-up entrance animations on new items
- #88: Pantry Summary and Current Phase card heights matched; layout and header labels aligned with period tracker; phase bar graph added to Current Phase card; expired items card uses amber palette; inventory items wrapped in a bordered card matching the Predictions card style
- #107: pull-to-refresh no longer blocked on summary and expiry cards on mobile
- #108: card height normalization, edit mode spin buttons, unit select width, DetailSheet layout consistency
- #114: expiry-matched swipe action borders; Mark all used / Mark all wasted confirm labels
- Tap any inventory item to view, edit, mark as used, or mark as wasted
- Price field with currency symbol prefix; notes field grows with content
- Estimated total bar shows running sum of priced unchecked items
- Currency setting in Pantry preferences - 11 currencies plus Other with custom symbol and name
- Deleting an inventory item now requires confirmation via modal; shopping list items still delete instantly
- Removed bulk "Add items" button and overlay - the correct entry point is the shopping list (#110 tracks a guided wizard)

### Reverse proxy support
- #116: same-origin API routing - frontend resolves the API base URL from the current origin when no backend port is set at build time
- Caddyfile.example at repo root - proxies /api/* and /health to the backend, everything else to the SPA; HTTPS via Let's Encrypt; sensible security headers
- docker-compose.proxy.yml override builds the frontend in proxy mode
- vite.config.ts: preview server now accepts arbitrary hostnames so reverse-proxied requests are not rejected; direct-port access unchanged

### Period calendar
- #101: tapping outside the highlighted cycle in adjust mode no longer logs a period day - adjust mode cancels cleanly on mobile
- #102: adjusting a cycle down to a single day now automatically exits adjust mode
- #96: tapping a period day on Android now opens the panel immediately - fixed ghost click on DetailSheet backdrop by switching from @click to @pointerdown
- #112: saving in edit mode stays open; delete day tooltip for non-edge days; IconAction hoverMessage prop with viewport-aware bubble
- Horizontal drag on the calendar grid no longer scrolls between layout panels

### Shared components
- #104: ConfirmDialog shared component; delete confirmation on pantry inventory items; PeriodCalendar inline confirm dialogs (delete cycle, long cycle warning, short gap warning) migrated to the shared component
- #93: ComingSoonBadge and PremiumBadge canonical badge components
- #111: NotesField component rolled out to pantry inventory and shopping list item sheets; theme prop supports green palette
- #115: AppScroller component - custom pill scrollbar across all desktop scroll areas
- #29: day-view editing panel design review complete

### Migrations
- 015: shopping_list_expiry
- 016: shopping_list_price
- 017: shopping_list_notes
- 018: pantry_price
- 019: pantry_quantity_structured
- 020: pantry_density

## v0.9.0 - Settings + Mobile Polish
*April 28, 2026*

- Settings page - full routed page with iOS-style layout, replaces the old settings sheet
- Notification messages now open as a modal inside Settings
- Mobile UI polish - consistent headers and back navigation across all feature views
- Period calendar no longer zoomed on mobile - scale is now desktop-only
- Mobile swipe panels - horizontal and vertical scroll no longer conflict
- Issues closed: #49, #50, #51, #83, #84, #85

## v0.8.0 - Desktop Shell + Pantry
*April 26, 2026*

### Desktop shell
- DesktopShell.vue: persistent left nav panel on desktop (>=768px) with header, summary strip, app grid, and footer. Mobile unaffected.
- SummaryStrip.vue: live period status carousel shared between mobile hub and desktop shell
- Draggable app grid (#41): hold 500ms to reorder tiles on mobile and desktop; order saved to the app_grid_order user preference

### Pantry
- Shopping list (#59): add items with name/quantity/category, check off, bulk-clear; owner and partner full read/write
- Inventory: active items sorted by expiry; visual freshness states (fresh/expiring soon/expires today/expired); expiring-soon banner; mark as used or wasted
- 3-column layout via AppLayout; premium analytics panel (col 3) locked placeholder

### AppLayout + architecture
- AppLayout.vue: reusable multi-column wrapper for all feature views (2-col >=1280px, 3-col >=1600px)
- PeriodHome.vue refactored to a thin wrapper; PeriodColumn extracted as a standalone component
- All feature views stripped of nested v-app/v-main - App.vue is the single owner
- useApps.ts, usePeriodData.ts: shared composables extracted from HubView
- Migrations: 013_cycle_predictions, 014_pantry

### MainScreen
- App info panel with version badge, live data stats, and scrollable changelog (#44)

### Period tracker
- #71: nextFertileWindow and nextOvulationDate added to summary API, always future-bound; calendar paints future fertile window and ovulation tint from summary data
- #57: delete animation - cells fade out 200ms individually or staggered across full-cycle deletes
- #58: prediction recompute deferred via setImmediate and wrapped in db.transaction - ~660ms to ~50ms
- #52 / #55: calendar and predictions panel always agree regardless of logging method

### Fixes
- #42: HubView desktop layout - left panel fills full column at >=1280px; breakpoint raised from 768px to 1280px
- #54: login no longer triggers a refresh loop on logout - DesktopShell excluded on the login route
- #53: dev role-switch reloads the app cleanly after writing a new token
- #72: MainScreen changelog items, fixes chips, and Premium tag all render correctly after a full page reload

## v0.7.0 - Authentication
*April 21, 2026*

### Authentication
- Two-account model: owner (full read/write) and partner (read-only on period data)
- POST /api/auth/login returns a 30-day HS256 JWT; all routes except login require a Bearer token
- Auto-generated 96-char secret saved to data/secret.key; overridable via JWT_SECRET env var
- bcrypt passwords at cost 10; credentials seeded from .env on first run only
- Rate limiting: 10 login attempts per 15 minutes per IP (429 after)
- GET /api/auth/me returns { id, username, role } for session restore on page load
- requireOwner middleware applied to all period write routes (POST/PATCH/DELETE)
- Dev role switcher available in dev mode for testing without re-login

### Frontend
- LoginView at /login; redirects to hub on success
- apiFetch in api.ts intercepts 401 responses and redirects to /login automatically
- Write controls (log day, delete cycle, adjust cycle, remove day) hidden entirely for the partner role
- Passive read-only notice shown at the top of PeriodHome for the partner

### Per-user settings
- Migrations 008-012: users table, user_id on cycles, settings, preferences, defaults
- /api/settings and /api/preferences replace localStorage so both partners share a device cleanly
- #21: SettingsSheet fully wired - notifications toggle, reminder days, greeting/sign-off/sender name, partner notes (owner only), flow hue slider

### Period tracker fixes
- #35: Short gap warning when starting a new cycle within 7 days of an existing one; shows the exact gap, warning-only
- #31: Predicted ovulation tint suppressed when a manual ovulation_date is set; long-press (500ms) on an empty past day opens the panel to mark/unmark ovulation
- #34: Hint bubble x position clamped to .period-wrapper bounds; no longer clips on edge cells
- #45: Phantom boundary day delete now retracts end_date/start_date by exactly 1 day instead of jumping to the nearest logged day
- #36: Auto end_date on every cycle_days write; active cycle detection switched to end_date >= yesterday; Remove this day added for edge trimming
- #25: Pulse-highlight now covers out-of-month calendar cells; animation restarts cleanly on repeated clicks

## v0.6.0 - Period Tracking Polish
*April 18, 2026*

### Period tracker
- #28: Fixed adjacent cycles rendering with overlapping caps; same-cycle check was missing from the non-faded branch of getCellClass()
- #22: Replaced start/middle/end icons with clearer cycle icons; OnboardingTutorial slides 1-2 updated to match
- #24: Flow intensity tinting on calendar cells - 4 levels (spotting/light/medium/heavy) driven by a --flow-hue CSS variable; hue slider in SettingsSheet; default 340, persisted and restored on mount
- **Premium** - #26: Adjust Cycle - hold any period cell 500ms to enter adjust mode, drag the start/end cap to resize without delete/recreate; orphaned days preserved with a badge; gap-fill logic removed
- #26 follow-up: Fixed guardLongCycle silently dropping further extends after a warning was confirmed once
- Tutorial slide 2 redesigned: two-row 14-cell grid, two-phase animation matching the real hold+drag UX
- Adjust handles now animate with handle-pulse keyframes instead of a static outline

### Database
- Migration 007: added 'spotting' to the flow_intensity CHECK constraint on cycle_days via table recreation

### Docker
- VITE_BACKEND_PORT build arg threaded through docker-compose and the frontend Dockerfile
- Backend restart policy changed to 'always'

### Docs
- Added backend reference docs: period-tracker, pantry, sleep-tracker
- Added frontend feature docs: exercise, sleep-tracker
- Updated existing docs: api, pantry, period-tracker, recipes, smart-gap-filling

## v0.5.0 - Period Tracker (initial public release)
*April 16, 2026*

- Period tracker - calendar view, day logging, cycle history, and cycle predictions
- Log periods day by day while active, or all at once after the fact
- Email notifications for period due, fertile window, and overdue alerts
- Onboarding tutorial walking through all three logging flows
