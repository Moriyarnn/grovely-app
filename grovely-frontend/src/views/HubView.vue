<template>
  <div class="hub-root">

        <!-- Desktop home panel -->
        <div class="hub-desktop-panel">
          <MainScreen />
        </div>

        <!-- Main panel -->
        <div class="hub-main">

          <!-- Mobile-only header -->
          <div class="hub-header mobile-only">
            <div class="hub-header-top">
              <img :src="logoSide" alt="Grovely" class="hub-logo" />
              <div class="header-actions">
                <div v-if="currentUser" class="user-avatar-wrap">
                  <div
                    class="user-avatar"
                    :class="{ 'user-avatar--dev': isDev }"
                    :title="currentUser.username"
                    @click="isDev && (showSwitcher = !showSwitcher)"
                  >
                    {{ currentUser.username[0].toUpperCase() }}
                  </div>
                  <div v-if="isDev && showSwitcher" class="dev-switcher">
                    <p class="dev-switcher-label">Switch user</p>
                    <div class="dev-switcher-btns">
                      <button
                        class="dev-switch-btn"
                        :class="{ 'dev-switch-btn--pressed': currentUser.role === 'owner1' }"
                        @click="switchUser('owner1')"
                      >owner1</button>
                      <button
                        class="dev-switch-btn"
                        :class="{ 'dev-switch-btn--pressed': currentUser.role === 'owner2' }"
                        @click="switchUser('owner2')"
                      >owner2</button>
                    </div>
                  </div>
                </div>
                <button class="settings-icon-btn" @click="router.push('/info')">
                  <v-icon size="18" color="grey-darken-1">mdi-home-outline</v-icon>
                </button>
                <button class="settings-icon-btn" @click="router.push('/settings')">
                  <v-icon size="18" color="grey-darken-1">mdi-cog-outline</v-icon>
                </button>
              </div>
            </div>
            <p class="hub-date">{{ todayLabel }}</p>
            <p class="hub-subtitle">{{ greeting }}{{ currentUser ? ', ' + currentUser.username : '' }}</p>
          </div>

          <!-- Mobile-only status strip — wrapper reserves fixed height so the
               app grid below doesn't jump when strip data loads in -->
          <div class="strip-slot mobile-only">
            <SummaryStrip />
          </div>

          <!-- Desktop-only mini-header -->
          <div class="hub-desktop-header desktop-only">
            <p class="section-label-top">Your apps</p>
            <div class="header-actions">
              <div v-if="currentUser" class="user-avatar-wrap">
                <div
                  class="user-avatar"
                  :class="{ 'user-avatar--dev': isDev }"
                  :title="currentUser.username"
                  @click="isDev && (showSwitcher = !showSwitcher)"
                >
                  {{ currentUser.username[0].toUpperCase() }}
                </div>
                <div v-if="isDev && showSwitcher" class="dev-switcher">
                  <p class="dev-switcher-label">Switch user</p>
                  <div class="dev-switcher-btns">
                    <button
                      class="dev-switch-btn"
                      :class="{ 'dev-switch-btn--pressed': currentUser.role === 'owner1' }"
                      @click="switchUser('owner1')"
                    >owner1</button>
                    <button
                      class="dev-switch-btn"
                      :class="{ 'dev-switch-btn--pressed': currentUser.role === 'owner2' }"
                      @click="switchUser('owner2')"
                    >owner2</button>
                  </div>
                </div>
              </div>
              <button class="settings-icon-btn" @click="router.push('/settings')">
                <v-icon size="18" color="grey-darken-1">mdi-cog-outline</v-icon>
              </button>
            </div>
          </div>

          <!-- App grid -->
          <p class="section-label mobile-only">Your apps</p>
          <TransitionGroup tag="div" class="app-grid" :name="transitionReady ? 'tile' : ''" ref="gridRef">
            <div
              v-for="app in displayApps"
              :key="app.name"
              :data-app="app.name"
              class="app-card"
              :class="{
                inactive: !app.active,
                'app-card--placeholder': dragState?.appName === app.name,
                'app-card--reorderable': reorderEnabled,
              }"
              :style="{ background: app.bg, borderColor: app.border }"
              @pointerdown="onCardPointerDown($event, app.name)"
              @touchmove="onCardTouchMove"
              @click="onCardClick(app)"
            >
              <span class="app-badge" :style="{ background: app.border, color: app.badgeText }">
                {{ app.active ? 'Active' : 'Soon' }}
              </span>
              <div class="app-icon" :style="{ background: app.border }">
                <v-icon size="18" :color="app.iconColor">{{ app.icon }}</v-icon>
              </div>
              <p class="app-name" :style="{ color: app.titleColor }">{{ app.name }}</p>
              <p class="app-sub" :style="{ color: app.subColor }">
                {{ app.sub ?? dynamicSubs[app.name] ?? (app.active ? 'Tap to open' : 'Coming soon') }}
              </p>
            </div>
          </TransitionGroup>

          <!-- Drag ghost -->
          <Teleport to="body">
            <div v-if="ghostApp && dragState" class="drag-ghost" :style="ghostStyle">
              <span class="app-badge" :style="{ background: ghostApp.border, color: ghostApp.badgeText }">
                {{ ghostApp.active ? 'Active' : 'Soon' }}
              </span>
              <div class="app-icon" :style="{ background: ghostApp.border }">
                <v-icon size="18" :color="ghostApp.iconColor">{{ ghostApp.icon }}</v-icon>
              </div>
              <p class="app-name" :style="{ color: ghostApp.titleColor }">{{ ghostApp.name }}</p>
              <p class="app-sub" :style="{ color: ghostApp.subColor }">
                {{ ghostApp.sub ?? dynamicSubs[ghostApp.name] ?? (ghostApp.active ? 'Tap to open' : 'Coming soon') }}
              </p>
            </div>
          </Teleport>

          <!-- Mobile-only sign out -->
          <div class="hub-footer mobile-only">
            <div v-if="licenseActive" class="hub-premium-thanks">
              <v-icon size="16" color="#993556">mdi-heart</v-icon>
              <span>Thanks for supporting Grovely.<br>Your license keeps this project going.</span>
            </div>
            <button class="hub-logout-btn" @click="logout">Sign out</button>
          </div>

          <!-- Floating reorder hint (mobile only, first visit) -->
          <AppToast
            :model-value="reorderHintVisible ? 'Hold a tile to reorder' : null"
            tone="info"
            icon="mdi-gesture-tap-hold"
            icon-color="rgba(255,255,255,0.9)"
            :closeable="true"
            :duration="9000"
            @update:model-value="dismissReorderHint"
          />

        </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted, onMounted } from 'vue'
import AppToast from '../components/ui/AppToast.vue'
import logoSide from '../assets/Logo Side Hub.png'
import { useRouter } from 'vue-router'
import SummaryStrip from '../components/SummaryStrip.vue'
import MainScreen from '../components/MainScreen.vue'
import { API, apiFetch, getUser, clearToken, clearUser, setToken, setUser } from '../api'
import { usePreferences } from '../composables/usePreferences'
import { apps } from '../composables/useApps'
import { useAppStats } from '../composables/useAppStats'
import { usePeriodData } from '../composables/usePeriodData'
import { useLicense } from '../composables/useLicense'

const router = useRouter()
const { preferences, fetchPreferences, updatePreference, resetCache: resetPreferences } = usePreferences()
const { dynamicSubs, fetchAppStats } = useAppStats()
const { licenseActive, fetchLicenseStatus } = useLicense()
const currentUser = ref(getUser())
const isDev = import.meta.env.DEV
const showSwitcher = ref(false)

onMounted(() => { fetchAppStats(); fetchLicenseStatus() })

// Refresh on tab focus so a hub left open across midnight still shows
// today's date and the right greeting on the next look.
const now = ref(new Date())
const todayLabel = computed(() =>
  now.value.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
)
const greeting = computed(() => {
  const h = now.value.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})
function onVisibility() { if (!document.hidden) now.value = new Date() }
onMounted(() => document.addEventListener('visibilitychange', onVisibility))
onUnmounted(() => document.removeEventListener('visibilitychange', onVisibility))

function logout() {
  clearToken()
  clearUser()
  resetPreferences()
  usePeriodData().resetView()
  router.push('/login')
}

async function switchUser(role) {
  try {
    const res = await apiFetch(`${API}/auth/dev-switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    })
    if (!res.ok) return
    const data = await res.json()
    setToken(data.token)
    setUser({ username: data.username, role: data.role })
    window.location.reload()
  } catch {}
}

// --- Drag to reorder ---
const gridRef = ref(null)
const holdTimer = ref(null)
const pointerOrigin = ref(null)
let dragOccurred = false
let lastHoverApp = null
let insertDebounceTimer = null

const dragState = ref(null)
const localApps = ref([...apps])

// Reorder is always on — the 500ms hold is enough accident protection,
// and gating it behind a preference made it undiscoverable. A floating
// hint surfaces the feature once per user (localStorage flag).
const reorderEnabled = computed(() => true)
const reorderHintVisible = ref(false)
onMounted(() => {
  if (!localStorage.getItem('grovely_reorder_hint_dismissed') && window.innerWidth < 768) {
    setTimeout(() => { reorderHintVisible.value = true }, 1200)
  }
})
function dismissReorderHint() {
  reorderHintVisible.value = false
  localStorage.setItem('grovely_reorder_hint_dismissed', '1')
}

// Disable tile transitions until:
// (a) preferences have landed (prevents "slide into place" on cold load), AND
// (b) the page-slide transition (130ms) has finished (prevents FLIP firing while
//     the parent translateX is mid-animation, which makes tiles appear to shake in).
const transitionReady = ref(false)
onMounted(() => {
  const enable = async () => { await nextTick(); transitionReady.value = true }
  if (Object.keys(preferences.value).length > 0) {
    setTimeout(enable, 200)
  } else {
    const unwatch = watch(preferences, () => { setTimeout(enable, 200); unwatch() })
  }
})

watch(() => preferences.value.app_grid_order, (val) => {
  if (val) localStorage.setItem('app_grid_order', val)
})

const displayApps = computed(() => {
  if (dragState.value) return localApps.value
  const raw = preferences.value.app_grid_order ?? localStorage.getItem('app_grid_order')
  if (!raw) return apps
  try {
    const order = JSON.parse(raw)
    return [...apps].sort((a, b) => {
      const ai = order.indexOf(a.name)
      const bi = order.indexOf(b.name)
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
    })
  } catch { return apps }
})

const ghostApp = computed(() =>
  dragState.value ? apps.find(a => a.name === dragState.value.appName) ?? null : null
)

const ghostStyle = computed(() => {
  if (!dragState.value || !ghostApp.value) return {}
  return {
    left: dragState.value.ghostX + 'px',
    top: dragState.value.ghostY + 'px',
    width: dragState.value.tileWidth + 'px',
    height: dragState.value.tileHeight + 'px',
    background: ghostApp.value.bg,
    borderColor: ghostApp.value.border,
  }
})

function onCardTouchMove(e) {
  if (holdTimer.value || dragState.value) e.preventDefault()
}

function onCardPointerDown(e, appName) {
  if (!reorderEnabled.value) return
  pointerOrigin.value = { x: e.clientX, y: e.clientY }
  holdTimer.value = setTimeout(() => beginDrag(appName), 500)
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)
}

function beginDrag(appName) {
  const grid = gridRef.value?.$el ?? gridRef.value
  const card = grid?.querySelector(`[data-app="${appName}"]`)
  if (!card || !pointerOrigin.value) return
  const rect = card.getBoundingClientRect()
  localApps.value = [...displayApps.value]
  lastHoverApp = null
  clearTimeout(insertDebounceTimer)
  dragState.value = {
    appName,
    ghostX: rect.left, ghostY: rect.top,
    offsetX: pointerOrigin.value.x - rect.left,
    offsetY: pointerOrigin.value.y - rect.top,
    tileWidth: rect.width, tileHeight: rect.height,
  }
}

function onWindowPointerMove(e) {
  if (!dragState.value) {
    if (holdTimer.value && pointerOrigin.value) {
      const dx = e.clientX - pointerOrigin.value.x
      const dy = e.clientY - pointerOrigin.value.y
      if (dx * dx + dy * dy > 64) clearHold()
    }
    return
  }
  e.preventDefault()
  dragState.value.ghostX = e.clientX - dragState.value.offsetX
  dragState.value.ghostY = e.clientY - dragState.value.offsetY
  updateInsertPosition(e.clientX, e.clientY)
}

function updateInsertPosition(x, y) {
  const grid = gridRef.value?.$el ?? gridRef.value
  if (!grid || !dragState.value) return
  const { appName } = dragState.value
  const cards = Array.from(grid.querySelectorAll('[data-app]'))

  let cursorOverApp = null
  for (const card of cards) {
    if (card.dataset.app === appName) continue
    const rect = card.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      cursorOverApp = card.dataset.app
      break
    }
  }

  clearTimeout(insertDebounceTimer)
  if (!cursorOverApp || cursorOverApp === lastHoverApp) return
  insertDebounceTimer = setTimeout(() => {
    if (!dragState.value) return
    const currentIdx = localApps.value.findIndex(a => a.name === appName)
    const targetIdx = localApps.value.findIndex(a => a.name === cursorOverApp)
    if (currentIdx === targetIdx) return
    const newOrder = [...localApps.value]
    const [dragged] = newOrder.splice(currentIdx, 1)
    newOrder.splice(targetIdx, 0, dragged)
    localApps.value = newOrder
    lastHoverApp = null
  }, 80)
}

function onWindowPointerUp() {
  clearTimeout(insertDebounceTimer)
  if (dragState.value) {
    dragOccurred = true
    const orderJson = JSON.stringify(localApps.value.map(a => a.name))
    localStorage.setItem('app_grid_order', orderJson)
    updatePreference('app_grid_order', orderJson)
    dragState.value = null
    if (reorderHintVisible.value) dismissReorderHint()
  }
  clearHold()
  removeWindowListeners()
}

function onCardClick(app) {
  if (dragOccurred) { dragOccurred = false; return }
  if (app.active && app.route) router.push(app.route)
}

function clearHold() {
  if (holdTimer.value) { clearTimeout(holdTimer.value); holdTimer.value = null }
  pointerOrigin.value = null
}

function removeWindowListeners() {
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
}

onUnmounted(removeWindowListeners)
</script>

<style scoped>
/* ── Root layout ──────────────────────────────────────────────── */
.hub-root {
  display: flex;
  height: 100dvh;
  overflow: hidden;
  background: #fafafa;
}

/* ── Show/hide helpers ────────────────────────────────────────── */
.mobile-only { display: block; }

/* Reserves strip height before data loads — prevents the app grid jumping down */
.strip-slot { min-height: 88px; flex-shrink: 0; }

@media (max-width: 1023px) {
  .desktop-only { display: none !important; }
}

@media (min-width: 1024px) {
  .mobile-only { display: none !important; }
}

/* ── Desktop home panel ───────────────────────────────────────── */
.hub-desktop-panel {
  display: none;
}

@media (min-width: 1024px) {
  .hub-root {
    display: block;
    height: auto;
    min-height: 100dvh;
    overflow: visible;
    background: transparent;
  }

  .hub-desktop-panel {
    display: block;
  }

  .hub-main {
    display: none !important;
  }
}

/* ── Main panel ───────────────────────────────────────────────── */
.hub-main {
  flex: 1;
  min-width: 0;
  padding: 1.25rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Mobile header ────────────────────────────────────────────── */
.hub-header {
  margin-bottom: 1rem;
  flex-shrink: 0;
}
.hub-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hub-date { font-size: 12px; color: #888; margin: 4px 0 2px; }
.hub-logo { height: 70px; width: auto; object-fit: contain; margin: -7px 0 -5px -7px; }
.hub-subtitle { font-size: 13px; color: #aaa; margin: 0; font-style: italic; }
.settings-icon-btn { width: 34px; height: 34px; border-radius: 50%; border: 1px solid #e0e0e0; background: #f5f5f5; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.header-actions { display: flex; gap: 8px; align-items: center; }
.user-avatar-wrap { position: relative; flex-shrink: 0; }
.user-avatar { width: 28px; height: 28px; border-radius: 50%; background: #FBEAF0; border: 1.5px solid #F4C0D1; color: #993556; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.user-avatar--dev { cursor: pointer; }
.user-avatar--dev:hover { background: #f7dae6; }

.dev-switcher {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: #fff;
  border: 1px solid #f0e0e8;
  border-radius: 12px;
  padding: 10px 12px;
  box-shadow: 0 4px 16px rgba(153, 53, 86, 0.12);
  z-index: 100;
  min-width: 140px;
}
.dev-switcher-label { font-size: 10px; font-weight: 600; color: #bbb; letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 8px; }
.dev-switcher-btns { display: flex; gap: 6px; }
.dev-switch-btn {
  flex: 1; padding: 6px 0; font-size: 12px; font-weight: 600;
  color: #993556; background: #FBEAF0; border: 1.5px solid #F4C0D1;
  border-radius: 8px; cursor: pointer;
  box-shadow: 0 2px 0 #F4C0D1;
  transform: translateY(0);
  transition: box-shadow 0.1s, transform 0.1s, background 0.1s;
}
.dev-switch-btn:hover:not(.dev-switch-btn--pressed) { background: #f7dae6; }
.dev-switch-btn--pressed { background: #f0c8d8; box-shadow: inset 0 2px 3px rgba(153, 53, 86, 0.2); transform: translateY(1px); }


/* ── App grid ─────────────────────────────────────────────────── */
.section-label { font-size: 10px; font-weight: 600; color: #bbb; letter-spacing: 0.07em; text-transform: uppercase; margin: 0 0 10px; flex-shrink: 0; }
.app-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; flex: 1; min-height: 0; align-content: start; }
.app-card { border: 1px solid; border-radius: 12px; padding: 14px 12px; cursor: pointer; position: relative; transition: opacity 0.2s; }
.app-card.inactive { opacity: 0.55; cursor: default; }
.app-badge { position: absolute; top: 10px; right: 10px; border-radius: 20px; padding: 2px 7px; font-size: 9px; font-weight: 600; }
.app-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
.app-name { font-size: 13px; font-weight: 500; margin: 0 0 2px; }
.app-sub { font-size: 11px; margin: 0; }

/* ── Mobile footer / sign out ─────────────────────────────────── */
.hub-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: auto;
  padding-top: 0.75rem;
  padding-bottom: 0.5rem;
  flex-shrink: 0;
}
.hub-premium-thanks {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #993556;
  line-height: 1.4;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1.5px solid #F4C0D1;
  border-radius: 10px;
  background: #FDF6F9;
  justify-content: flex-start;
  width: 100%;
  text-align: left;
}

.hub-logout-btn {
  font-size: 12px;
  color: #bbb;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.hub-logout-btn:hover { color: #D4537E; }


/* ── Small-height phones — shrink gaps to fit without scroll ── */
@media (max-height: 700px) and (max-width: 1023px) {
  .hub-main { padding: 0.75rem; }
  .hub-header { margin-bottom: 0.5rem; }
  .hub-logo { height: 54px; margin: -5px 0 -3px -5px; }
  .hub-date { margin: 2px 0 1px; }
  .strip-slot { min-height: 72px; }
  .section-label { margin: 0 0 6px; }
  .app-grid { gap: 6px; }
  .app-card { padding: 10px 10px; }
  .app-icon { width: 28px; height: 28px; margin-bottom: 6px; }
  .hub-footer { padding-top: 0.5rem; padding-bottom: 0.25rem; }
}

@media (max-height: 600px) and (max-width: 1023px) {
  .hub-main { padding: 0.5rem; }
  .hub-header { margin-bottom: 0.25rem; }
  .hub-logo { height: 44px; margin: -4px 0 -2px -4px; }
  .hub-subtitle { display: none; }
  .strip-slot { min-height: 60px; }
  .section-label { margin: 0 0 4px; }
  .app-grid { gap: 4px; }
  .app-card { padding: 8px 8px; border-radius: 10px; }
  .app-icon { width: 24px; height: 24px; margin-bottom: 4px; }
  .app-name { font-size: 12px; }
  .app-sub { font-size: 10px; }
  .app-badge { font-size: 8px; padding: 1px 5px; }
  .hub-footer { padding-top: 0.25rem; padding-bottom: 0.25rem; }
  .hub-premium-thanks { padding: 6px 8px; font-size: 10px; }
}

/* ── Drag to reorder ──────────────────────────────────────────── */
.app-card--reorderable { cursor: grab; user-select: none; touch-action: none; }
.app-card--placeholder { opacity: 0 !important; pointer-events: none; }

.tile-move { transition: transform 180ms ease-out; }

.drag-ghost {
  position: fixed;
  border: 1px solid;
  border-radius: 12px;
  padding: 14px 12px;
  pointer-events: none;
  z-index: 1000;
  transform: scale(1.04);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.13);
  box-sizing: border-box;
}
</style>
