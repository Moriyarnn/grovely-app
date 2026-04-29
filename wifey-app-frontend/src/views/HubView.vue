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
            <div>
              <p class="hub-date">{{ todayLabel }}</p>
              <h1 class="hub-title">House App</h1>
              <p class="hub-subtitle">Good morning, my love</p>
            </div>
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
                      :class="{ 'dev-switch-btn--pressed': currentUser.role === 'owner' }"
                      @click="switchUser('owner')"
                    >owner</button>
                    <button
                      class="dev-switch-btn"
                      :class="{ 'dev-switch-btn--pressed': currentUser.role === 'partner' }"
                      @click="switchUser('partner')"
                    >partner</button>
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

          <!-- Mobile-only status strip -->
          <SummaryStrip class="mobile-only" />

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
                      :class="{ 'dev-switch-btn--pressed': currentUser.role === 'owner' }"
                      @click="switchUser('owner')"
                    >owner</button>
                    <button
                      class="dev-switch-btn"
                      :class="{ 'dev-switch-btn--pressed': currentUser.role === 'partner' }"
                      @click="switchUser('partner')"
                    >partner</button>
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
                {{ app.sub ?? (app.active ? 'Tap to open' : 'Coming soon') }}
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
                {{ ghostApp.sub ?? (ghostApp.active ? 'Tap to open' : 'Coming soon') }}
              </p>
            </div>
          </Teleport>

        </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import SummaryStrip from '../components/SummaryStrip.vue'
import MainScreen from '../components/MainScreen.vue'
import { API, getUser, clearToken, clearUser, setToken, setUser, apiFetch } from '../api'
import { usePreferences } from '../composables/usePreferences'
import { apps } from '../composables/useApps'

const router = useRouter()
const { preferences, fetchPreferences, updatePreference, resetCache: resetPreferences } = usePreferences()
const currentUser = ref(getUser())
const isDev = import.meta.env.DEV
const showSwitcher = ref(false)

const pantryStats = ref(null)

onMounted(async () => {
  try {
    const res = await apiFetch(`${API}/pantry`)
    if (res.ok) {
      const pantryItems = await res.json()
      const today = new Date().toISOString().split('T')[0]
      const expiringSoon = pantryItems.filter(i => {
        if (!i.expiry_date) return false
        const days = Math.round((new Date(i.expiry_date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
        return days >= 0 && days <= 3
      }).length
      pantryStats.value = { count: pantryItems.length, expiringSoon }
    }
  } catch {}
})

const todayLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
})

function logout() {
  clearToken()
  clearUser()
  resetPreferences()
  router.push('/login')
}

async function switchUser(role) {
  try {
    const res = await fetch(`${API}/auth/dev-switch`, {
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

const reorderEnabled = computed(() => preferences.value.app_reorder_enabled === '1')

// Disable tile transitions until after the first preferences fetch lands and the
// DOM has painted the correct order — prevents the "slide into place" on refresh.
const transitionReady = ref(Object.keys(preferences.value).length > 0)
if (!transitionReady.value) {
  const unwatch = watch(preferences, async () => {
    await nextTick()
    transitionReady.value = true
    unwatch()
  })
}

watch(() => preferences.value.app_grid_order, (val) => {
  if (val) localStorage.setItem('app_grid_order', val)
})

function injectDynamicSubs(list) {
  return list.map(app => {
    if (app.name === 'Pantry' && pantryStats.value) {
      const { count, expiringSoon } = pantryStats.value
      const sub = count === 0
        ? 'Nothing in pantry yet'
        : expiringSoon > 0
          ? `${count} item${count !== 1 ? 's' : ''} · ${expiringSoon} expiring soon`
          : `${count} item${count !== 1 ? 's' : ''} in pantry`
      return { ...app, sub }
    }
    return app
  })
}

const displayApps = computed(() => {
  if (dragState.value) return injectDynamicSubs(localApps.value)
  const raw = preferences.value.app_grid_order ?? localStorage.getItem('app_grid_order')
  if (!raw) return injectDynamicSubs(apps)
  try {
    const order = JSON.parse(raw)
    const sorted = [...apps].sort((a, b) => {
      const ai = order.indexOf(a.name)
      const bi = order.indexOf(b.name)
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
    })
    return injectDynamicSubs(sorted)
  } catch { return injectDynamicSubs(apps) }
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
  min-height: 100vh;
  background: #fafafa;
}

/* ── Show/hide helpers ────────────────────────────────────────── */
.mobile-only { display: block; }

@media (max-width: 1279px) {
  .desktop-only { display: none !important; }
}

@media (min-width: 1280px) {
  .mobile-only { display: none !important; }
}

/* ── Desktop home panel ───────────────────────────────────────── */
.hub-desktop-panel {
  display: none;
}

@media (min-width: 1280px) {
  .hub-root {
    display: block;
    min-height: 100vh;
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
}

/* ── Mobile header ────────────────────────────────────────────── */
.hub-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.hub-date { font-size: 12px; color: #888; margin: 0 0 2px; }
.hub-title { font-size: 22px; font-weight: 500; margin: 0 0 2px; }
.hub-subtitle { font-size: 13px; color: #aaa; margin: 0; }
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
.section-label { font-size: 10px; font-weight: 600; color: #bbb; letter-spacing: 0.07em; text-transform: uppercase; margin: 0 0 10px; }
.app-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 1rem; }
.app-card { border: 1px solid; border-radius: 12px; padding: 14px 12px; cursor: pointer; position: relative; transition: opacity 0.2s; }
.app-card.inactive { opacity: 0.55; cursor: default; }
.app-badge { position: absolute; top: 10px; right: 10px; border-radius: 20px; padding: 2px 7px; font-size: 9px; font-weight: 600; }
.app-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
.app-name { font-size: 13px; font-weight: 500; margin: 0 0 2px; }
.app-sub { font-size: 11px; margin: 0; }

/* ── Privacy note (desktop) ───────────────────────────────────── */
.hub-privacy-note {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #ccc;
  margin: 1rem 0 0;
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
