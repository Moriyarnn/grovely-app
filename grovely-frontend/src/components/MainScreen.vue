<template>
  <div class="ms-root">

    <!-- Brand -->
    <div class="ms-brand">
      <div class="ms-brand-body">
        <h1 class="ms-brand-title">Grovely</h1>
        <p class="ms-brand-date">{{ todayLabel }}</p>
      </div>
      <button v-if="showBack" class="ms-back-chip" @click="router.back()">
        <v-icon size="14" color="#993556">mdi-chevron-left</v-icon>
        Hub
      </button>
    </div>

    <!-- Instance info -->
    <div class="ms-instance">
      <span class="ms-version-badge">{{ APP_VERSION }}</span>
      <span class="ms-sep">·</span>
      <v-icon size="11" color="#ccc">mdi-clock-outline</v-icon>
      <span class="ms-instance-text">{{ daysRunning !== null ? `${daysRunning} days running` : '— days running' }}</span>
      <span class="ms-sep">·</span>
      <v-icon size="11" color="#ccc">mdi-database-outline</v-icon>
      <span class="ms-instance-text">{{ dbSizeLabel }}</span>
    </div>

    <!-- Privacy badge -->
    <div class="ms-privacy">
      <v-icon size="13" color="#4ADE80">mdi-lock-outline</v-icon>
      <span>No telemetry. Your data stays on your server.</span>
    </div>

    <div class="ms-divider" />

    <!-- App stats -->
    <div class="ms-section">
      <p class="ms-section-label">Your data</p>
      <div class="ms-stats">
        <div
          v-for="stat in stats"
          :key="stat.key"
          class="ms-stat"
          :class="{ 'ms-stat--stub': stat.stub }"
        >
          <div class="ms-stat-icon-wrap" :style="{ background: stat.stub ? '#f5f5f5' : stat.bg }">
            <v-icon size="16" :color="stat.stub ? '#ddd' : stat.iconColor">{{ stat.icon }}</v-icon>
          </div>
          <p class="ms-stat-value">{{ stat.value }}</p>
          <p class="ms-stat-label">{{ stat.label }}</p>
        </div>
      </div>
    </div>

    <div class="ms-divider" />

    <!-- Changelog -->
    <div class="ms-section">
      <p class="ms-section-label">
        What's new
        <span v-if="hasUnread" class="ms-unread-dot" />
      </p>
      <AppScroller class="ms-changelog" theme="pink">
        <div v-for="entry in CHANGELOG" :key="entry.version" class="ms-cl-entry">
          <div class="ms-cl-head">
            <div class="ms-cl-head-left">
              <span class="ms-cl-version">{{ entry.version }}</span>
              <span v-if="entry.title" class="ms-cl-title">{{ entry.title }}</span>
            </div>
            <span class="ms-cl-date">{{ entry.date }}</span>
          </div>

          <!-- Desktop: full descriptions -->
          <div class="ms-cl-desktop-items">
            <div v-for="(item, i) in entry.items" :key="i" class="ms-cl-row">
              <span class="ms-tag" :class="`ms-tag--${item.plan.toLowerCase()}`">{{ item.plan }}</span>
              <span class="ms-cl-text">{{ item.text }}</span>
            </div>
          </div>

          <!-- Mobile: one-liners -->
          <div class="ms-cl-mobile-items">
            <div v-for="(item, i) in entry.mobile" :key="i" class="ms-cl-row ms-cl-row--oneliner" @touchstart.passive="onRowTouchStart" @touchend.passive="onRowTouchEnd">
              <span class="ms-tag" :class="`ms-tag--${item.plan.toLowerCase()}`">{{ item.plan }}</span>
              <span class="ms-cl-text">{{ item.text }}</span>
            </div>
          </div>

          <div v-if="entry.fixes?.length" class="ms-cl-fixes">
            <span class="ms-cl-fixes-label">Closes</span>
            <a
              v-for="n in entry.fixes"
              :key="n"
              class="ms-issue-chip"
              :href="`https://github.com/Moriyarnn/grovely-app/issues/${n}`"
              target="_blank"
              rel="noopener"
            >#{{ n }}</a>
          </div>
        </div>
      </AppScroller>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppScroller from '@/components/ui/AppScroller.vue'
import { useRouter } from 'vue-router'
import { API, apiFetch } from '../api'

const props = defineProps({
  showBack: { type: Boolean, default: false }
})

const router = useRouter()

const APP_VERSION = 'v' + __APP_VERSION__
const LAST_SEEN_KEY = 'changelog_last_seen_version'

const cycleCount = ref(null)
const pantryCount = ref(null)
const daysRunning = ref(null)
const dbSizeLabel = ref('— MB')

const hasUnread = ref(localStorage.getItem(LAST_SEEN_KEY) !== APP_VERSION)

onMounted(async () => {
  localStorage.setItem(LAST_SEEN_KEY, APP_VERSION)
  hasUnread.value = false

  try {
    const r = await apiFetch(`${API}/period/cycles`)
    if (r.ok) cycleCount.value = (await r.json()).length
  } catch {}

  try {
    const r = await apiFetch(`${API}/pantry`)
    if (r.ok) pantryCount.value = (await r.json()).length
  } catch {}

  try {
    const r = await apiFetch(`${API}/instance`)
    if (r.ok) {
      const data = await r.json()
      daysRunning.value = data.daysRunning
      dbSizeLabel.value = `${data.dbSizeMB} MB`
    }
  } catch {}
})

const rowScrollTimers = new WeakMap()

function onRowTouchStart(e) {
  const el = e.currentTarget
  clearTimeout(rowScrollTimers.get(el))
}

function onRowTouchEnd(e) {
  const el = e.currentTarget
  clearTimeout(rowScrollTimers.get(el))
  rowScrollTimers.set(el, setTimeout(() => {
    el.scrollTo({ left: 0, behavior: 'smooth' })
  }, 600))
}

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning, my love'
  if (h < 18) return 'Good afternoon, my love'
  return 'Good evening, my love'
})

const todayLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
})

const stats = computed(() => [
  {
    key: 'period',
    icon: 'mdi-heart-pulse',
    bg: '#FBEAF0', iconColor: '#993556',
    value: cycleCount.value !== null ? String(cycleCount.value) : '—',
    label: 'cycles',
    stub: cycleCount.value === null,
  },
  {
    key: 'pantry',
    icon: 'mdi-fridge-outline',
    bg: '#EAF7F0', iconColor: '#2E7D52',
    value: pantryCount.value !== null ? String(pantryCount.value) : '—',
    label: 'pantry items',
    stub: pantryCount.value === null,
  },
  {
    key: 'recipes',
    icon: 'mdi-silverware-fork-knife',
    bg: '#EAF3DE', iconColor: '#3B6D11',
    value: '—',
    label: 'recipes',
    stub: true,
  },
  {
    key: 'sleep',
    icon: 'mdi-sleep',
    bg: '#EDF0FB', iconColor: '#3D52A0',
    value: '—',
    label: 'sleep logs',
    stub: true,
  },
  {
    key: 'exercise',
    icon: 'mdi-run',
    bg: '#FEF0E6', iconColor: '#C45B1A',
    value: '—',
    label: 'workouts',
    stub: true,
  },
  {
    key: 'events',
    icon: 'mdi-star-four-points',
    bg: '#FAEEDA', iconColor: '#854F0B',
    value: '—',
    label: 'events',
    stub: true,
  },
])

// Changelog rule:
//   items  — full descriptions shown on desktop (can be as long as needed)
//   mobile — one-liner per item shown on mobile (must fit a single line)
// Both arrays are required on every entry.
const CHANGELOG = [
  {
    version: 'v0.12.0',
    title: 'Grovely + PWA + Notifications + Backups',
    date: 'May 21, 2026',
    fixes: [48, 60, 86, 94, 121, 128, 129, 131, 132, 133, 136, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 156, 158, 160],
    items: [
      { plan: 'Free',    text: 'App renamed to Grovely with a new mint-green brand color - installable on iOS and Android as a PWA with standalone display mode and full mobile compatibility fixes' },
      { plan: 'Premium', text: 'Notifications overhauled - any SMTP provider supported, three new partner notification types, and the full 15-type system is now a premium feature' },
      { plan: 'Premium', text: 'Per-notification message editing, on/off toggles, email personalisation with live preview, and inline config warnings all added to Settings' },
      { plan: 'Premium', text: 'Predictions card always visible, predicted calendar tail, phase marker with confidence labels. Smart Autofill on the shopping list backed by your full purchase history' },
      { plan: 'Premium', text: 'Scheduled automatic backups - daily cron with startup catch-up, local retention and auto-prune, S3 and WebDAV remote push, full status panel in Settings' },
    ],
    mobile: [
      { plan: 'Free',    text: 'App renamed to Grovely - installable on iOS and Android as a PWA' },
      { plan: 'Premium', text: 'Notifications overhauled - any SMTP provider, 15 types, now premium' },
      { plan: 'Premium', text: 'Per-notification message editing and toggles in Settings' },
      { plan: 'Premium', text: 'Period predictions card always visible, pantry Smart Autofill with price history' },
      { plan: 'Premium', text: 'Automatic backups with S3/WebDAV push and status panel' },
    ],
  },
  {
    version: 'v0.11.0',
    title: 'Settings + Pantry + Period polish',
    date: 'May 12, 2026',
    fixes: [32, 46, 56, 69, 70, 73, 74, 75, 81, 89, 97, 118, 119, 120, 122, 123, 124, 127],
    items: [
      { plan: 'Free', text: 'Data backup and restore - full JSON export and one-tap restore from Settings, with automatic pre-restore snapshot before any overwrite' },
      { plan: 'Free', text: 'Settings fully wired - notification time, period and pantry toggles, and expiry warning window now save to the database and take effect immediately' },
      { plan: 'Free', text: 'Pantry search, filter, and sort - real-time search on both lists, dynamic category filter chips, and four sort options with direction toggle' },
      { plan: 'Free', text: 'Gap day logs - log symptoms and notes on days between periods, visible on the period calendar' },
      { plan: 'Free', text: 'Hub cards show live context - active period day, time until next period, and pantry item count update automatically' },
    ],
    mobile: [
      { plan: 'Free', text: 'Data backup and restore from Settings with auto pre-restore snapshot' },
      { plan: 'Free', text: 'Settings fully wired - all toggles and windows save immediately' },
      { plan: 'Free', text: 'Pantry search, filter chips, and sort with direction toggle' },
      { plan: 'Free', text: 'Gap day logs - symptoms on off-days, visible on calendar' },
      { plan: 'Free', text: 'Hub cards show live period and pantry context' },
    ],
  },
  {
    version: 'v0.10.0',
    title: 'Pantry Polish + Reverse Proxy',
    date: 'May 7, 2026',
    fixes: [29, 61, 62, 63, 64, 65, 68, 88, 93, 95, 96, 99, 100, 101, 102, 104, 107, 108, 109, 111, 112, 113, 114, 115, 116],
    items: [
      { plan: 'Free', text: 'Pantry inventory - tap any item to view, edit, mark as used, or mark as wasted' },
      { plan: 'Free', text: 'Shopping list - edit name, price, quantity, category, expiry, and notes; cart total pill shows the running sum of priced items' },
      { plan: 'Free', text: 'Move to pantry - unified sheet for single and bulk moves with per-item expiry; renders as a centered modal on desktop' },
      { plan: 'Free', text: 'Item categories on shopping list and inventory - Produce, Dairy, Meat, Bakery, Frozen, Dry Goods, Other' },
      { plan: 'Free', text: 'Reverse proxy support - serve the app under one hostname via reference Caddyfile and a single docker compose override' },
    ],
    mobile: [
      { plan: 'Free', text: 'Pantry inventory - view, edit, mark as used or wasted' },
      { plan: 'Free', text: 'Shopping list - edit all fields, cart total pill' },
      { plan: 'Free', text: 'Move to pantry with per-item expiry dates' },
      { plan: 'Free', text: 'Item categories - Produce, Dairy, Meat, Bakery, and more' },
      { plan: 'Free', text: 'Reverse proxy support via Caddyfile and compose override' },
    ],
  },
  {
    version: 'v0.9.0',
    title: 'Settings + Mobile Polish',
    date: 'April 28, 2026',
    fixes: [49, 50, 51, 83, 84, 85],
    items: [
      { plan: 'Free', text: 'Settings page - full routed page with iOS-style layout, replaces the old settings sheet' },
      { plan: 'Free', text: 'Notification messages now open as a modal inside Settings' },
      { plan: 'Free', text: 'Mobile UI polish - consistent headers and back navigation across all feature views' },
      { plan: 'Free', text: 'Period calendar no longer zoomed on mobile - scale is now desktop-only' },
      { plan: 'Free', text: 'Mobile swipe panels - horizontal and vertical scroll no longer conflict' },
    ],
    mobile: [
      { plan: 'Free', text: 'Settings is now a full routed page' },
      { plan: 'Free', text: 'Notification messages open as a modal in Settings' },
      { plan: 'Free', text: 'Consistent headers and back nav across all views' },
      { plan: 'Free', text: 'Period calendar zoom removed on mobile' },
      { plan: 'Free', text: 'Swipe panel scroll conflicts fixed' },
    ],
  },
  {
    version: 'v0.8.0',
    title: 'Desktop Shell + Pantry',
    date: 'April 26, 2026',
    fixes: [38, 40, 41, 42, 43, 45, 52, 53, 54, 55, 57, 59, 71, 72],
    items: [
      { plan: 'Free', text: 'Desktop shell - persistent left nav with your apps, a status strip, and your profile' },
      { plan: 'Free', text: 'App grid reordering - hold any app tile to drag and rearrange, saves across devices' },
      { plan: 'Free', text: 'Pantry shopping list - add items by category, check them off, clear when done' },
      { plan: 'Free', text: 'Pantry inventory - track what you have with expiry dates and visual freshness states' },
      { plan: 'Free', text: 'Period predictions improved - fertile window and ovulation date always show a future date' },
    ],
    mobile: [
      { plan: 'Free', text: 'Desktop shell with persistent left nav and status strip' },
      { plan: 'Free', text: 'App grid reordering - hold to drag, saves across devices' },
      { plan: 'Free', text: 'Pantry shopping list - add by category, check off, clear' },
      { plan: 'Free', text: 'Pantry inventory with expiry dates and freshness states' },
      { plan: 'Free', text: 'Period predictions always show a future date' },
    ],
  },
  {
    version: 'v0.7.0',
    title: 'Authentication',
    date: 'April 20, 2026',
    fixes: [21, 25, 31, 34, 35, 45, 36],
    items: [
      { plan: 'Free', text: 'Two accounts - owner and partner can log in separately with their own settings' },
      { plan: 'Free', text: 'Per-user preferences saved to the database and synced across devices' },
      { plan: 'Free', text: 'Period end date now updates correctly every time you log a new day' },
      { plan: 'Free', text: 'Adjust cycle works correctly on mobile' },
      { plan: 'Free', text: 'Switching roles now reloads the app cleanly with no leftover state' },
    ],
    mobile: [
      { plan: 'Free', text: 'Owner and partner accounts with separate settings' },
      { plan: 'Free', text: 'Per-user preferences synced across devices' },
      { plan: 'Free', text: 'Period end date updates correctly on new day log' },
      { plan: 'Free', text: 'Adjust cycle fixed on mobile' },
      { plan: 'Free', text: 'Role switch reloads cleanly with no leftover state' },
    ],
  },
  {
    version: 'v0.6.0',
    title: 'Period Tracking Polish',
    date: 'April 17, 2026',
    fixes: [22, 24, 26, 28, 24, 33, 25, 35, 27, 35, 37, 44],
    items: [
      { plan: 'Free',    text: 'Flow intensity tinting on the calendar - four levels from spotting to heavy' },
      { plan: 'Premium', text: 'Cycle smart editing - adjust start or end date without deleting logged days' },
      { plan: 'Free',    text: 'Consecutive cycle days now merge into a single visual band on the calendar' },
      { plan: 'Free',    text: 'Days created by dragging now open the log form correctly' },
      { plan: 'Free',    text: 'Calendar badge icons centered correctly on iOS Safari' },
    ],
    mobile: [
      { plan: 'Free',    text: 'Flow intensity tinting - four levels on the calendar' },
      { plan: 'Premium', text: 'Cycle smart editing - adjust dates without deleting days' },
      { plan: 'Free',    text: 'Consecutive days merge into a single band on calendar' },
      { plan: 'Free',    text: 'Drag-created days open the log form correctly' },
      { plan: 'Free',    text: 'Calendar badges centered correctly on iOS Safari' },
    ],
  },
  {
    version: 'v0.5.0',
    title: 'Period Tracker',
    date: 'April 16, 2026',
    fixes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    items: [
      { plan: 'Free', text: 'Period tracker - calendar view, day logging, cycle history, and cycle predictions' },
      { plan: 'Free', text: 'Log periods day by day while active, or all at once after the fact' },
      { plan: 'Free', text: 'Email notifications for period due, fertile window, and overdue alerts' },
      { plan: 'Free', text: 'Onboarding tutorial walking through all three logging flows' },
    ],
    mobile: [
      { plan: 'Free', text: 'Period tracker - calendar, day log, history, and predictions' },
      { plan: 'Free', text: 'Log day-by-day or all at once after the fact' },
      { plan: 'Free', text: 'Email notifications for period due and fertile window' },
      { plan: 'Free', text: 'Onboarding tutorial for all three logging flows' },
    ],
  },
]
</script>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────── */
.ms-root {
  padding: 1.5rem 1.25rem 1.5rem;
  background: linear-gradient(160deg, #fff5f8 0%, #fdf0f5 40%, #f5f0fe 100%);
  height: 100dvh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (min-width: 1280px) {
  .ms-root {
    padding: 2.5rem 3rem 2.5rem;
  }
}

/* ── Brand ────────────────────────────────────────────────────── */
.ms-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 1rem;
}

.ms-back-chip {
  margin-left: auto;
  display: inline-flex; align-items: center; gap: 1px;
  background: #fff; color: #993556;
  border: 1px solid #F4C0D1; border-radius: 99px;
  padding: 5px 12px 5px 8px;
  font-size: 12px; font-weight: 600;
  cursor: pointer; flex-shrink: 0;
  transition: background 0.15s;
}
.ms-back-chip:hover { background: #FBEAF0; }

@media (min-width: 1280px) {
  .ms-back-chip { display: none; }
}


.ms-brand-title {
  font-size: 22px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 3px;
  letter-spacing: -0.01em;
}

.ms-brand-greeting {
  font-size: 13px;
  color: #aaa;
  margin: 0 0 2px;
  font-style: italic;
}

.ms-brand-date {
  font-size: 12px;
  color: #ccc;
  margin: 0;
}

/* ── Instance info ────────────────────────────────────────────── */
.ms-instance {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.ms-version-badge {
  background: #FBEAF0;
  color: #993556;
  border: 1px solid #F4C0D1;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
}

.ms-sep {
  color: #ddd;
  font-size: 12px;
}

.ms-instance-text {
  font-size: 11px;
  color: #bbb;
}

/* ── Privacy badge ────────────────────────────────────────────── */
.ms-privacy {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #aaa;
  margin-bottom: 0.25rem;
}

/* ── Divider ──────────────────────────────────────────────────── */
.ms-divider {
  height: 1px;
  background: #f0e8ec;
  margin: 1.25rem 0;
}

/* ── Section ──────────────────────────────────────────────────── */
.ms-section {
  margin-bottom: 0.25rem;
}

.ms-section-label {
  font-size: 10px;
  font-weight: 600;
  color: #bbb;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  margin: 0 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ms-unread-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #D4537E;
  flex-shrink: 0;
}

/* ── Stats grid ───────────────────────────────────────────────── */
.ms-stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

@media (max-width: 1279px) {
  .ms-stat { grid-column: span 2; }
}

@media (min-width: 1280px) {
  .ms-stats {
    grid-template-columns: repeat(6, 1fr);
  }
}

.ms-stat {
  background: #fff;
  border: 1px solid #f0e8ec;
  border-radius: 12px;
  padding: 14px 10px 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}

.ms-stat--stub {
  background: #fafafa;
  border-color: #f0f0f0;
}

.ms-stat-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ms-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  line-height: 1;
}

.ms-stat--stub .ms-stat-value {
  color: #ddd;
}

.ms-stat-label {
  font-size: 10px;
  color: #bbb;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  line-height: 1.3;
}

/* ── Changelog ────────────────────────────────────────────────── */
.ms-section:last-child {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ms-changelog {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-right: 4px;
  flex: 1;
  min-height: 0;
  overflow-y: scroll;
}

.ms-cl-entry {
  background: #fff;
  border: 1px solid #f0e8ec;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}

.ms-cl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #fdf5f8;
  border-bottom: 1px solid #f0e8ec;
  gap: 8px;
  min-width: 0;
}

.ms-cl-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.ms-cl-version {
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
  flex-shrink: 0;
}

.ms-cl-title {
  font-size: 12px;
  font-weight: 500;
  color: #aaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.ms-cl-date {
  font-size: 11px;
  color: #bbb;
  flex-shrink: 0;
}

/* ── Desktop items — full descriptions, shown ≥1280px ────────── */
.ms-cl-desktop-items { display: none; }

@media (min-width: 1280px) {
  .ms-cl-desktop-items { display: block; }
  .ms-cl-mobile-items  { display: none; }
}

/* ── Rows ─────────────────────────────────────────────────────── */
.ms-cl-row {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 5px 14px;
  border-top: 1px solid #f8f0f4;
}

.ms-cl-row:first-child {
  border-top: none;
}

.ms-cl-text {
  font-size: 12px;
  color: #555;
  flex: 1;
  min-width: 0;
}

/* ── Plan tags ────────────────────────────────────────────────── */
.ms-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  flex-shrink: 0;
  line-height: 1.5;
  min-width: 58px;
  box-sizing: border-box;
}

.ms-tag--free    { background: #F3F4F6; color: #6B7280; }
.ms-tag--premium { background: #FFFBEB; color: #92400E; }

/* Mobile one-liners scroll horizontally instead of truncating */
.ms-cl-row--oneliner {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.ms-cl-row--oneliner::-webkit-scrollbar {
  display: none;
}

.ms-cl-row--oneliner .ms-cl-text {
  white-space: nowrap;
  flex: none;
  min-width: max-content;
}

/* ── Fixes row ────────────────────────────────────────────────── */
.ms-cl-fixes {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  padding: 7px 14px 9px;
  border-top: 1px solid #f8f0f4;
}

.ms-cl-fixes-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #ccc;
  margin-right: 2px;
}

.ms-issue-chip {
  display: inline-block;
  background: #f5f5f5;
  color: #888;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}

.ms-issue-chip:hover {
  background: #FBEAF0;
  color: #993556;
  border-color: #F4C0D1;
}
</style>
