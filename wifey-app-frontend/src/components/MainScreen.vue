<template>
  <div class="ms-root">

    <!-- Brand -->
    <div class="ms-brand">
      <div class="ms-brand-icon">
        <v-icon size="22" color="#D4537E">mdi-home-heart</v-icon>
      </div>
      <div class="ms-brand-body">
        <h1 class="ms-brand-title">House App</h1>
        <p class="ms-brand-greeting">{{ greeting }}</p>
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
      <AppScroller class="ms-changelog">
        <div v-for="entry in CHANGELOG" :key="entry.version" class="ms-cl-entry">
          <div class="ms-cl-head">
            <div class="ms-cl-head-left">
              <span class="ms-cl-version">{{ entry.version }}</span>
              <span v-if="entry.title" class="ms-cl-title">{{ entry.title }}</span>
            </div>
            <span class="ms-cl-date">{{ entry.date }}</span>
          </div>
          <div v-for="(item, i) in entry.items" :key="i" class="ms-cl-row">
            <span class="ms-tag" :class="`ms-tag--${item.type.toLowerCase()}`">{{ item.type }}</span>
            <span class="ms-tag" :class="`ms-tag--${item.plan.toLowerCase()}`">{{ item.plan }}</span>
            <span class="ms-cl-text">{{ item.text }}</span>
          </div>
          <div v-if="entry.fixes?.length" class="ms-cl-fixes">
            <span class="ms-cl-fixes-label">Closes</span>
            <a
              v-for="n in entry.fixes"
              :key="n"
              class="ms-issue-chip"
              :href="`https://github.com/Moriyarnn/wifey-app-tbd/issues/${n}`"
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

const APP_VERSION = 'v0.10.0'
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
})

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
])

const CHANGELOG = [
  {
    version: 'v0.10.0',
    title: 'Pantry Polish + Reverse Proxy',
    date: 'May 7, 2026',
    fixes: [29, 61, 62, 63, 64, 65, 68, 88, 93, 95, 96, 99, 100, 101, 102, 104, 107, 108, 109, 111, 112, 113, 114, 115, 116],
    items: [
      { type: 'New', plan: 'Free', text: 'Pantry inventory - tap any item to view, edit, mark as used, or mark as wasted' },
      { type: 'New', plan: 'Free', text: 'Shopping list - edit name, price, quantity, category, expiry, and notes; cart total pill shows the running sum of priced items' },
      { type: 'New', plan: 'Free', text: 'Move to pantry - unified sheet for single and bulk moves with per-item expiry; renders as a centered modal on desktop' },
      { type: 'New', plan: 'Free', text: 'Item categories on shopping list and inventory - Produce, Dairy, Meat, Bakery, Frozen, Dry Goods, Other' },
      { type: 'New', plan: 'Free', text: 'Reverse proxy support - serve the app under one hostname via reference Caddyfile and a single docker compose override' },
    ]
  },
  {
    version: 'v0.9.0',
    title: 'Settings + Mobile Polish',
    date: 'April 28, 2026',
    fixes: [49, 50, 51, 83, 84, 85],
    items: [
      { type: 'New', plan: 'Free', text: 'Settings page - full routed page with iOS-style layout, replaces the old settings sheet' },
      { type: 'New', plan: 'Free', text: 'Notification messages now open as a modal inside Settings' },
      { type: 'New', plan: 'Free', text: 'Mobile UI polish - consistent headers and back navigation across all feature views' },
      { type: 'Fix', plan: 'Free', text: 'Period calendar no longer zoomed on mobile - scale is now desktop-only' },
      { type: 'Fix', plan: 'Free', text: 'Mobile swipe panels - horizontal and vertical scroll no longer conflict' },
    ]
  },
  {
    version: 'v0.8.0',
    title: 'Desktop Shell + Pantry',
    date: 'April 26, 2026',
    fixes: [38, 40, 41, 42, 43, 45, 52, 53, 54, 55, 57, 59, 71, 72],
    items: [
      { type: 'New', plan: 'Free', text: 'Desktop shell - persistent left nav with your apps, a status strip, and your profile' },
      { type: 'New', plan: 'Free', text: 'App grid reordering - hold any app tile to drag and rearrange, saves across devices' },
      { type: 'New', plan: 'Free', text: 'Pantry shopping list - add items by category, check them off, clear when done' },
      { type: 'New', plan: 'Free', text: 'Pantry inventory - track what you have with expiry dates and visual freshness states' },
      { type: 'New', plan: 'Free', text: 'Period predictions improved - fertile window and ovulation date always show a future date' },
    ]
  },
  {
    version: 'v0.7.0',
    title: 'Authentication',
    date: 'April 20, 2026',
    fixes: [21, 25, 31, 34, 35, 45, 36],
    items: [
      { type: 'New', plan: 'Free', text: 'Two accounts - owner and partner can log in separately with their own settings' },
      { type: 'New', plan: 'Free', text: 'Per-user preferences saved to the database and synced across devices' },
      { type: 'Fix', plan: 'Free', text: 'Period end date now updates correctly every time you log a new day' },
      { type: 'Fix', plan: 'Free', text: 'Adjust cycle works correctly on mobile' },
      { type: 'Fix', plan: 'Free', text: 'Switching roles now reloads the app cleanly with no leftover state' },
    ]
  },
  {
    version: 'v0.6.0',
    title: 'Period Tracking Polish',
    date: 'April 17, 2026',
    fixes: [22, 24, 26, 28, 24, 33, 25, 35, 27, 35, 37, 44],
    items: [
      { type: 'New', plan: 'Free', text: 'Flow intensity tinting on the calendar - four levels from spotting to heavy' },
      { type: 'New', plan: 'Premium', text: 'Cycle smart editing - adjust start or end date without deleting logged days' },
      { type: 'New', plan: 'Free', text: 'Consecutive cycle days now merge into a single visual band on the calendar' },
      { type: 'Fix', plan: 'Free', text: 'Days created by dragging now open the log form correctly' },
      { type: 'Fix', plan: 'Free', text: 'Calendar badge icons centered correctly on iOS Safari' },
    ]
  },
  {
    version: 'v0.5.0',
    title: 'Period Tracker',
    date: 'April 16, 2026',
    fixes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    items: [
      { type: 'New', plan: 'Free', text: 'Period tracker - calendar view, day logging, cycle history, and cycle predictions' },
      { type: 'New', plan: 'Free', text: 'Log periods day by day while active, or all at once after the fact' },
      { type: 'New', plan: 'Free', text: 'Email notifications for period due, fertile window, and overdue alerts' },
      { type: 'New', plan: 'Free', text: 'Onboarding tutorial walking through all three logging flows' },
    ]
  },
]
</script>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────── */
.ms-root {
  padding: 1.5rem 1.25rem 3rem;
  background: linear-gradient(160deg, #fff5f8 0%, #fdf0f5 40%, #f5f0fe 100%);
  min-height: 100vh;
  box-sizing: border-box;
}

@media (min-width: 1280px) {
  .ms-root {
    padding: 2.5rem 3rem 4rem;
    display: flex;
    flex-direction: column;
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

.ms-brand-icon {
  width: 48px;
  height: 48px;
  background: #fff;
  border: 1.5px solid #F4C0D1;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(212, 83, 126, 0.08);
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
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

@media (min-width: 1280px) {
  .ms-stats {
    grid-template-columns: repeat(5, 1fr);
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
.ms-changelog {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-right: 4px;
}

@media (min-width: 1280px) {
  .ms-section:last-child {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .ms-changelog {
    flex: 1;
  }
}

.ms-changelog::-webkit-scrollbar { width: 4px; }
.ms-changelog::-webkit-scrollbar-track { background: transparent; }
.ms-changelog::-webkit-scrollbar-thumb { background: #f0e0e8; border-radius: 4px; }

.ms-cl-entry {
  background: #fff;
  border: 1px solid #f0e8ec;
  border-radius: 12px;
  overflow: hidden;
}

.ms-cl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #fdf5f8;
  border-bottom: 1px solid #f0e8ec;
}

.ms-cl-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ms-cl-version {
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
}

.ms-cl-title {
  font-size: 12px;
  font-weight: 500;
  color: #aaa;
}

.ms-cl-date {
  font-size: 11px;
  color: #bbb;
}

.ms-cl-row {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 7px 14px;
  border-top: 1px solid #f8f0f4;
  flex-wrap: wrap;
}

.ms-cl-row:first-of-type {
  border-top: none;
}

.ms-cl-text {
  font-size: 12px;
  color: #555;
  flex: 1;
  min-width: 0;
}

/* ── Tags ─────────────────────────────────────────────────────── */
.ms-tag {
  display: inline-block;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  flex-shrink: 0;
  line-height: 1.5;
}

.ms-tag--new { background: #EFF6FF; color: #1D4ED8; }
.ms-tag--fix { background: #FFF7ED; color: #C2410C; }
.ms-tag--free { background: #F3F4F6; color: #6B7280; }
.ms-tag--premium { background: #FFFBEB; color: #92400E; }

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
