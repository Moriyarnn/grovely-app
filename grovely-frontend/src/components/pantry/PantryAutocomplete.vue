<template>
  <div class="pac-root" ref="rootEl">
    <div class="pac-input-row">
      <input
        ref="inputEl"
        class="pac-input"
        :class="`pac-input--${theme}`"
        :value="modelValue"
        placeholder="Add item…"
        maxlength="120"
        autocomplete="off"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.escape="close"
        @keydown.down.prevent="moveFocus(1)"
        @keydown.up.prevent="moveFocus(-1)"
        @keydown.enter.prevent="confirmFocused"
      />
    </div>

    <Transition name="pac-drop">
      <div v-if="open && (pageRows.length || loading)" class="pac-dropdown" :class="`pac-dropdown--${theme}`">

        <!-- Loading shimmer — only shown on first open before any results exist -->
        <div v-if="loading && results.length === 0" class="pac-shimmer-list">
          <div v-for="n in 3" :key="n" class="pac-shimmer-row" />
        </div>

        <template v-else>
          <!-- Recent header — only shown when results are from empty-query focus -->
          <div v-if="isRecent && pageRows.length" class="pac-section-header">Recent</div>

          <!-- Results -->
          <button
            v-for="(row, i) in pageRows"
            :key="rowKey(row)"
            :ref="el => setRowRef(el, i)"
            class="pac-row"
            :class="[`pac-row--${theme}`, { 'pac-row--focused': focusedIdx === i }]"
            type="button"
            @mousedown.prevent
            @click="selectRow(row)"
          >
            <span class="pac-row-name">
              <span class="pac-row-name-text">{{ row.name }}</span>
              <span v-if="isPremium && row.store" class="pac-row-name-store">&nbsp;(<span class="pac-row-store-text">{{ row.store }}</span>)</span>
            </span>
            <!-- Premium: qty + price only (store is shown inline with name) -->
            <span v-if="isPremium" class="pac-row-meta">
              <span v-if="row.amount != null && row.unit" class="pac-row-qty">{{ fmtQty(row) }}</span>
              <span v-else-if="row.pieces != null"        class="pac-row-qty">{{ fmtPieces(row.pieces) }}</span>
              <span v-if="row.price != null"              class="pac-row-price">{{ pantrySymbol }}&nbsp;{{ fmtPrice(row.price) }}</span>
            </span>
          </button>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pac-pages">
            <button
              class="pac-page-btn"
              :class="`pac-page-btn--${theme}`"
              type="button"
              :disabled="page === 0"
              @mousedown.prevent
              @click="page--"
            >
              <v-icon size="12">mdi-chevron-left</v-icon>
            </button>
            <span class="pac-page-label">{{ page + 1 }} / {{ totalPages }}</span>
            <button
              class="pac-page-btn"
              :class="`pac-page-btn--${theme}`"
              type="button"
              :disabled="page >= totalPages - 1"
              @mousedown.prevent
              @click="page++"
            >
              <v-icon size="12">mdi-chevron-right</v-icon>
            </button>
          </div>

          <!-- Premium gate row — always pinned last, only shown to free users -->
          <button
            v-if="!isPremium"
            class="pac-row pac-row--gate"
            type="button"
            @mousedown.prevent
            @click="close(); $emit('openPremiumGate')"
          >
            <span class="pac-gate-text">Unlock Smart Autofill: store, size &amp; price from your history</span>
            <PremiumBadge theme="green" class="pac-gate-badge" />
          </button>

          <!-- Smart Autofill active badge — always pinned last, only shown to premium users -->
          <div v-if="isPremium" class="pac-row pac-row--active">
            <v-icon size="13" color="#2E7D52">mdi-check-circle-outline</v-icon>
            <span class="pac-active-text">Smart Autofill active: store, size &amp; price filled from your purchase history</span>
          </div>
        </template>

      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { API, apiFetch } from '../../api'
import { clampPrice, clampQty } from '../../constants/format'
import PremiumBadge from '../ui/PremiumBadge.vue'

const props = defineProps({
  modelValue:    { type: String,  default: '' },
  theme:         { type: String,  default: 'green' },
  isPremium:     { type: Boolean, default: false },
  pantrySymbol:  { type: String,  default: '$' },
  pantryDecimals:{ type: Number,  default: 2 },
})

const emit = defineEmits(['update:modelValue', 'select', 'openPremiumGate'])

// ── State ─────────────────────────────────────────────────────────────────────

const rootEl   = ref(null)
const inputEl  = ref(null)
const open      = ref(false)
const loading   = ref(false)
const results   = ref([])   // up to 30 from API
const isRecent  = ref(false) // true when results are from empty-query (on-focus)
const page      = ref(0)
const focusedIdx = ref(-1)
const rowRefs   = []

const PAGE_SIZE = 10
const endpoint  = computed(() =>
  props.isPremium
    ? `${API}/premium/pantry/catalog/search`
    : `${API}/pantry/catalog/search`
)

// ── Pagination ─────────────────────────────────────────────────────────────────

const totalPages = computed(() => Math.max(1, Math.ceil(results.value.length / PAGE_SIZE)))
const pageRows   = computed(() => {
  const start = page.value * PAGE_SIZE
  return results.value.slice(start, start + PAGE_SIZE)
})

watch(results, () => { page.value = 0; focusedIdx.value = -1 })

// ── Fetch ─────────────────────────────────────────────────────────────────────

let debounceTimer = null

async function fetch(q) {
  loading.value = true
  const empty = q === ''
  try {
    const url = `${endpoint.value}?q=${encodeURIComponent(q)}`
    const res = await apiFetch(url)
    if (res.ok) {
      results.value = await res.json()
      isRecent.value = empty
    }
  } catch {
    results.value = []
    isRecent.value = false
  } finally {
    loading.value = false
  }
}

function scheduleFetch(q) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetch(q), 300)
}

// ── Events ─────────────────────────────────────────────────────────────────────

function onInput(e) {
  const val = e.target.value
  emit('update:modelValue', val)
  if (val.trim()) {
    scheduleFetch(val.trim())
  } else {
    // Cleared — switch back to recent
    clearTimeout(debounceTimer)
    fetch('')
  }
  open.value = true
  focusedIdx.value = -1
}

function onFocus() {
  open.value = true
  if (results.value.length === 0 || isRecent.value) {
    fetch(props.modelValue?.trim() ?? '')
  }
}

function onBlur() {
  // Delay so mousedown on a row fires before dropdown closes
  setTimeout(() => { open.value = false }, 150)
}

function close() {
  open.value = false
  focusedIdx.value = -1
  inputEl.value?.blur()
}

// ── Row selection ─────────────────────────────────────────────────────────────

function selectRow(row) {
  emit('update:modelValue', row.name)
  emit('select', row)
  close()
}

function rowKey(row) {
  return props.isPremium
    ? `${row.name}|${row.amount ?? ''}|${row.unit ?? ''}|${row.pieces ?? ''}|${row.store ?? ''}`
    : row.id ?? row.name
}

// ── Keyboard navigation ───────────────────────────────────────────────────────

function setRowRef(el, i) { rowRefs[i] = el }

function moveFocus(dir) {
  if (!open.value) { open.value = true; return }
  const max = pageRows.value.length - 1
  focusedIdx.value = Math.max(0, Math.min(max, focusedIdx.value + dir))
}

function confirmFocused() {
  if (focusedIdx.value >= 0 && focusedIdx.value < pageRows.value.length) {
    selectRow(pageRows.value[focusedIdx.value])
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(val) { return clampPrice(val, 7, props.pantryDecimals) }
function fmtQty(row)   { return clampQty(row.amount, row.unit, 8) }
function fmtPieces(n)  { return '×' + String(n) }

// Close on click outside
function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  clearTimeout(debounceTimer)
})
</script>

<style scoped>
.pac-root {
  position: relative;
  min-width: 0;
}

.pac-input {
  width: 100%;
  box-sizing: border-box;
  background: #fff;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 15px;
  font-family: inherit;
  color: #1a1a1a;
  height: 41px;
  outline: none;
  transition: border-color 0.15s;
}
.pac-input--green          { border-color: #B8E6D0; }
.pac-input--green:focus    { border-color: #2E7D52; }
.pac-input--green::placeholder { color: #6BA888; }
.pac-input--pink           { border-color: #f0d8e4; }
.pac-input--pink:focus     { border-color: #993556; }
.pac-input--pink::placeholder  { color: #b0788e; }

/* Dropdown */
.pac-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  border-radius: 12px;
  overflow: hidden;
  z-index: 200;
  border: 1.5px solid #f0f0f0;
}
.pac-dropdown--green {
  background: #fff;
  border-color: #B8E6D0;
  box-shadow: 0 4px 20px rgba(46,125,82,0.10);
}
.pac-dropdown--pink {
  background: #fff;
  border-color: #f0d8e4;
  box-shadow: 0 4px 20px rgba(0,0,0,0.10);
}

/* Section header */
.pac-section-header {
  padding: 6px 14px 3px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.pac-dropdown--green .pac-section-header { color: #6BA888; }
.pac-dropdown--pink  .pac-section-header { color: #b0788e; }

/* Rows */
.pac-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  color: #1a1a1a;
  transition: background 0.1s;
  border-bottom: 1px solid rgba(46,125,82,0.08);
}
.pac-row:last-child { border-bottom: none; }

.pac-row--green:hover,
.pac-row--green.pac-row--focused { background: #f0faf4; }
.pac-row--pink:hover,
.pac-row--pink.pac-row--focused  { background: #fdf0f4; }

.pac-row-name {
  display: flex;
  align-items: baseline;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.pac-row-name-text {
  font-weight: 500;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pac-row-name-store {
  flex-shrink: 0;
  font-weight: 400;
  font-size: 12px;
  color: #6BA888;
  font-style: italic;
  white-space: nowrap;
  display: inline-flex;
  align-items: baseline;
}
.pac-row-store-text {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pac-row-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding-left: 8px;
}
.pac-row-qty   { font-size: 12px; color: #5a9a72; white-space: nowrap; }
.pac-row-price { font-size: 12px; color: #2E7D52; font-weight: 600; white-space: nowrap; }

/* Premium gate row */
.pac-row--gate {
  background: #f4fbf7;
  border-top: 1px solid #d0ead8;
  color: #2E7D52;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  padding: 9px 14px;
}
.pac-row--gate:hover { background: #e8f5ed; }
.pac-gate-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pac-gate-badge { flex-shrink: 0; }
.pac-gate-badge :deep(.premium-badge) { font-size: 9px; padding: 2px 6px 2px 5px; gap: 3px; }

/* Smart Autofill active row */
.pac-row--active {
  background: #f4fbf7;
  border-top: 1px solid #d0ead8;
  color: #2E7D52;
  font-size: 11px;
  font-weight: 500;
  gap: 6px;
  padding: 7px 14px;
  cursor: default;
}
.pac-active-text { flex: 1; }

/* Pagination */
.pac-pages {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 14px;
  border-top: 1px solid #f4f4f4;
}
.pac-page-btn {
  display: flex;
  align-items: center;
  background: none;
  border: 1.5px solid #e0e0e0;
  border-radius: 6px;
  padding: 2px 6px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.pac-page-btn:disabled { opacity: 0.35; cursor: default; }
.pac-page-btn--green:not(:disabled):hover { border-color: #2E7D52; background: #d0ecdc; }
.pac-page-btn--pink:not(:disabled):hover  { border-color: #993556; background: #fdf0f4; }
.pac-page-label { font-size: 11px; color: #6BA888; min-width: 32px; text-align: center; }

/* Shimmer */
.pac-shimmer-list { padding: 8px 0; }
.pac-shimmer-row {
  height: 36px;
  margin: 4px 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: pac-shimmer 1.2s infinite;
}
@keyframes pac-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Transition */
.pac-drop-enter-active,
.pac-drop-leave-active { transition: opacity 0.12s, transform 0.12s; }
.pac-drop-enter-from,
.pac-drop-leave-to    { opacity: 0; transform: translateY(-4px); }
</style>
