<template>
  <div class="shell-root">

    <!-- Left nav: app grid, always visible on desktop -->
    <div class="shell-nav">

      <div class="shell-header">
        <div class="shell-header-left">
          <span class="shell-header-title">House App</span>
          <span class="shell-header-greeting">{{ greeting }}</span>
        </div>
        <div class="shell-header-right">
          <div class="user-avatar-wrap">
            <div
              class="user-avatar"
              :class="{ 'user-avatar--dev': isDev }"
              :title="currentUser?.username"
              @click="isDev && (showSwitcher = !showSwitcher)"
            >
              {{ currentUser?.username?.[0]?.toUpperCase() }}
            </div>
            <div v-if="isDev && showSwitcher" class="dev-switcher">
              <p class="dev-switcher-label">Switch user</p>
              <div class="dev-switcher-btns">
                <button
                  class="dev-switch-btn"
                  :class="{ 'dev-switch-btn--pressed': currentUser?.role === 'owner' }"
                  @click="switchUser('owner')"
                >owner</button>
                <button
                  class="dev-switch-btn"
                  :class="{ 'dev-switch-btn--pressed': currentUser?.role === 'partner' }"
                  @click="switchUser('partner')"
                >partner</button>
              </div>
            </div>
          </div>
          <button class="shell-icon-btn" title="Home" @click="router.push('/')">
            <v-icon size="18" color="grey-darken-1">mdi-home-outline</v-icon>
          </button>
          <button class="shell-icon-btn" title="Settings" @click="router.push('/settings')">
            <v-icon size="18" color="grey-darken-1">mdi-cog-outline</v-icon>
          </button>
        </div>
      </div>

      <div class="shell-header-divider" />

      <SummaryStrip />

      <p class="shell-apps-label">Your apps</p>

      <TransitionGroup tag="div" class="shell-app-grid" :name="transitionReady ? 'tile' : ''" ref="gridRef">
        <div
          v-for="app in displayApps"
          :key="app.name"
          :data-app="app.name"
          class="shell-app-card"
          :class="{
            'shell-app-card--inactive': !app.active,
            'shell-app-card--placeholder': dragState?.appName === app.name,
            'shell-app-card--reorderable': reorderEnabled,
          }"
          :style="{ background: app.bg, borderColor: app.border, boxShadow: isActive(app) ? `0 0 0 2px ${app.border}` : 'none' }"
          @pointerdown="onCardPointerDown($event, app.name)"
          @click="onCardClick(app)"
        >
          <span class="shell-app-badge" :style="{ background: app.border, color: app.badgeText }">
            {{ app.active ? 'Active' : 'Soon' }}
          </span>
          <div class="shell-app-icon" :style="{ background: app.border }">
            <v-icon size="18" :color="app.iconColor">{{ app.icon }}</v-icon>
          </div>
          <p class="shell-app-name" :style="{ color: app.titleColor }">{{ app.name }}</p>
          <p class="shell-app-sub" :style="{ color: app.subColor }">
            {{ app.sub ?? (app.active ? 'Tap to open' : 'Coming soon') }}
          </p>
        </div>
      </TransitionGroup>

      <!-- Drag ghost: follows cursor while dragging -->
      <Teleport to="body">
        <div v-if="ghostApp && dragState" class="drag-ghost" :style="ghostStyle">
          <span class="shell-app-badge" :style="{ background: ghostApp.border, color: ghostApp.badgeText }">
            {{ ghostApp.active ? 'Active' : 'Soon' }}
          </span>
          <div class="shell-app-icon" :style="{ background: ghostApp.border }">
            <v-icon size="18" :color="ghostApp.iconColor">{{ ghostApp.icon }}</v-icon>
          </div>
          <p class="shell-app-name" :style="{ color: ghostApp.titleColor }">{{ ghostApp.name }}</p>
          <p class="shell-app-sub" :style="{ color: ghostApp.subColor }">
            {{ ghostApp.sub ?? (ghostApp.active ? 'Tap to open' : 'Coming soon') }}
          </p>
        </div>
      </Teleport>

      <div class="shell-footer">
        <button class="shell-logout-btn" @click="logout">Sign out</button>
      </div>

    </div>

    <!-- Right: feature content -->
    <div class="shell-content">
      <slot />
    </div>

  </div>

</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SummaryStrip from './SummaryStrip.vue'
import { apps } from '../composables/useApps'
import { API, getToken, getUser, clearToken, clearUser, setToken, setUser } from '../api'
import { usePreferences } from '../composables/usePreferences'

const route = useRoute()
const router = useRouter()
const { preferences, fetchPreferences, updatePreference, resetCache: resetPreferences } = usePreferences()
if (getToken()) fetchPreferences()

const currentUser = ref(getUser())

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning, my love'
  if (h < 18) return 'Good afternoon, my love'
  return 'Good evening, my love'
})
const isDev = import.meta.env.DEV
const showSwitcher = ref(false)
function isActive(app) {
  if (!app.active || !app.route) return false
  return route.path === app.route || route.path.startsWith(app.route + '/')
}

function logout() {
  clearToken()
  clearUser()
  resetPreferences()
  router.push('/login')
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
</script>

<style scoped>
/* ── Shell root ───────────────────────────────────────────────── */
.shell-root {
  display: flex;
  min-height: 100vh;
  background: #fafafa;
}

/* ── Left nav ─────────────────────────────────────────────────── */
.shell-nav {
  width: 350px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  background: #fff;
  border-right: 1px solid #f0e8ec;
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  box-sizing: border-box;
  transition: width 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
}

/* collapse on mobile + tablet */
@media (max-width: 1279px) {
  .shell-nav {
    width: 0;
    opacity: 0;
    padding: 0;
    pointer-events: none;
    border-right: none;
  }
  .shell-root {
    background: #fff;
  }
}

/* ── Right content ────────────────────────────────────────────── */
.shell-content {
  flex: 1;
  min-width: 0;
  height: 100vh;
  overflow-y: auto;
}

@media (max-width: 1279px) {
  .shell-content {
    height: auto;
    overflow-y: visible;
  }
}

/* ── Header ───────────────────────────────────────────────────── */
.shell-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0.25rem 0 1.1rem;
  gap: 8px;
}

.shell-header-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.shell-header-title {
  font-size: 22px;
  font-weight: 500;
  color: #1a1a1a;
  letter-spacing: -0.01em;
  margin: 0 0 2px;
  line-height: 1;
}

.shell-header-greeting {
  font-size: 13px;
  color: #aaa;
  margin: 0;
  line-height: 1;
}

.shell-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.shell-header-divider {
  height: 1px;
  background: #f0e8ec;
  margin-bottom: 1rem;
}

/* ── Apps label ───────────────────────────────────────────────── */
.shell-apps-label {
  font-size: 10px;
  font-weight: 600;
  color: #bbb;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  margin: 0 0 10px;
}

/* ── App grid ─────────────────────────────────────────────────── */
.shell-app-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  align-content: start;
}

.shell-app-card {
  border: 1px solid;
  border-radius: 12px;
  padding: 14px 12px;
  cursor: pointer;
  position: relative;
  transition: opacity 0.2s, box-shadow 0.15s;
}

.shell-app-card--inactive {
  opacity: 0.55;
  cursor: default;
}

.shell-app-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  border-radius: 20px;
  padding: 2px 7px;
  font-size: 9px;
  font-weight: 600;
}

.shell-app-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.shell-app-name {
  font-size: 13px;
  font-weight: 500;
  margin: 0 0 2px;
}

.shell-app-sub {
  font-size: 11px;
  margin: 0;
}

/* ── Footer ───────────────────────────────────────────────────── */
.shell-footer {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid #f0e8ec;
}

.shell-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid #e0e0e0;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.shell-logout-btn {
  font-size: 12px;
  color: #bbb;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.shell-logout-btn:hover { color: #D4537E; }

/* ── User avatar / dev switcher ───────────────────────────────── */
.user-avatar-wrap { position: relative; flex-shrink: 0; }
.user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: #FBEAF0; border: 1.5px solid #F4C0D1;
  color: #993556; font-size: 12px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
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
  transition: box-shadow 0.1s, transform 0.1s, background 0.1s;
}
.dev-switch-btn:hover:not(.dev-switch-btn--pressed) { background: #f7dae6; }
.dev-switch-btn--pressed { background: #f0c8d8; box-shadow: inset 0 2px 3px rgba(153, 53, 86, 0.2); transform: translateY(1px); }

/* ── Drag to reorder ──────────────────────────────────────────── */
.shell-app-card--reorderable { cursor: grab; user-select: none; touch-action: none; }
.shell-app-card--placeholder { opacity: 0 !important; pointer-events: none; }

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
