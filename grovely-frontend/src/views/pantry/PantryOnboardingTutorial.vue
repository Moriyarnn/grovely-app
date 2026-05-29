<template>
  <FeatureTutorial
    storage-key="grovely_pantry_onboarding_done"
    :force-open="forceOpen"
    :slide-count="3"
    variant="normal"
    theme="mint"
    @close="onClose"
    @slide-change="onSlideChange"
  >
    <template #default="{ slide }">

      <!-- Slide 1: Add items -->
      <template v-if="slide === 1">
        <div class="mock-panel">

          <!-- Add form -->
          <div class="mock-add-form">
            <div class="mock-add-row">
              <div class="mock-input">
                <span v-if="typedText.length === 0" class="mock-placeholder">Add item…</span>
                <template v-else>
                  <span class="mock-typed">{{ typedText }}</span><span class="mock-cursor" :class="{ hidden: !cursorVisible }">|</span>
                </template>
              </div>
              <div class="mock-add-btn" :class="{ 'mock-add-btn--active': typedText.length > 0 }">
                <v-icon size="18" color="#fff">mdi-plus</v-icon>
              </div>
            </div>
          </div>

          <!-- Tap finger on the + button -->
          <div
            class="finger-wrap"
            :style="{ left: '281px', top: '31px', opacity: fingerVisible ? 1 : 0 }"
          >
            <div class="finger-dot" :class="{ pressing: fingerPressing }" />
          </div>

          <!-- Separator dots: hint that quantity / price fields sit between the add bar and the list -->
          <div class="mock-dots-sep">• • •</div>

          <!-- List area -->
          <div class="mock-list-area">
            <!-- Existing category + items -->
            <div class="mock-cat-header">
              <span class="mock-cat-dot" style="background:#4caf7d" />
              Produce
            </div>
            <div class="mock-list-item" v-for="item in slide1Items" :key="item.name">
              <v-icon size="18" color="#a8c5b0">mdi-checkbox-blank-circle-outline</v-icon>
              <span class="mock-item-name">{{ item.name }}</span>
              <span class="mock-item-qty">{{ item.qty }}</span>
              <v-icon size="15" color="#c4b8bc" style="opacity:0.5">mdi-close</v-icon>
            </div>

            <!-- Dairy + Milk — always in DOM so panel height is stable; opacity fades in -->
            <div class="mock-dairy-section" :class="{ 'mock-dairy-section--visible': newItemVisible }">
              <div class="mock-cat-header">
                <span class="mock-cat-dot" style="background:#42a5d6" />
                Dairy
              </div>
              <div class="mock-list-item" :class="{ 'mock-list-item--new': newItemVisible }">
                <v-icon size="18" color="#a8c5b0">mdi-checkbox-blank-circle-outline</v-icon>
                <span class="mock-item-name">Milk</span>
                <span class="mock-item-price">$ 2.50</span>
                <v-icon size="15" color="#c4b8bc" style="opacity:0.5">mdi-close</v-icon>
              </div>
            </div>
          </div>

        </div>
        <p class="slide-title">Build your shopping list</p>
        <p class="slide-body">Add items with a name, quantity, and price. Items are grouped by category automatically.</p>
      </template>

      <!-- Slide 2: Long-press multi-select -->
      <template v-else-if="slide === 2">
        <div class="mock-panel">

          <!-- Produce group -->
          <div class="mock-cat-header">
            <span class="mock-cat-dot" style="background:#4caf7d" />
            Produce
          </div>
          <div
            class="mock-list-item"
            :class="{ 'mock-list-item--selected': checkedRows.has(0) }"
          >
            <div class="mock-icon-slot">
              <div v-if="checkboxVisible" class="mock-checkbox" :class="{ 'mock-checkbox--checked': checkedRows.has(0) }">
                <v-icon v-if="checkedRows.has(0)" size="14" color="#fff">mdi-check</v-icon>
              </div>
              <v-icon v-else size="20" color="#a8c5b0">mdi-checkbox-blank-circle-outline</v-icon>
            </div>
            <span class="mock-item-name">Eggs</span>
            <v-icon size="15" color="#c4b8bc" style="opacity:0.5">mdi-close</v-icon>
          </div>

          <!-- Dairy group -->
          <div class="mock-cat-header">
            <span class="mock-cat-dot" style="background:#42a5d6" />
            Dairy
          </div>
          <div
            class="mock-list-item"
            :class="{ 'mock-list-item--selected': checkedRows.has(1) }"
          >
            <div class="mock-icon-slot">
              <div v-if="checkboxVisible" class="mock-checkbox" :class="{ 'mock-checkbox--checked': checkedRows.has(1) }">
                <v-icon v-if="checkedRows.has(1)" size="14" color="#fff">mdi-check</v-icon>
              </div>
              <v-icon v-else size="20" color="#a8c5b0">mdi-checkbox-blank-circle-outline</v-icon>
            </div>
            <span class="mock-item-name">Milk</span>
            <span class="mock-item-price">$ 2.50</span>
            <v-icon size="15" color="#c4b8bc" style="opacity:0.5">mdi-close</v-icon>
          </div>

          <!-- Bakery group -->
          <div class="mock-cat-header">
            <span class="mock-cat-dot" style="background:#d4914a" />
            Bakery
          </div>
          <div
            class="mock-list-item"
            :class="{ 'mock-list-item--selected': checkedRows.has(2) }"
          >
            <div class="mock-icon-slot">
              <div v-if="checkboxVisible" class="mock-checkbox" :class="{ 'mock-checkbox--checked': checkedRows.has(2) }">
                <v-icon v-if="checkedRows.has(2)" size="14" color="#fff">mdi-check</v-icon>
              </div>
              <v-icon v-else size="20" color="#a8c5b0">mdi-checkbox-blank-circle-outline</v-icon>
            </div>
            <span class="mock-item-name">Bread</span>
            <v-icon size="15" color="#c4b8bc" style="opacity:0.5">mdi-close</v-icon>
          </div>

          <!-- Animated finger — positioned over the list -->
          <div
            class="finger-wrap"
            :style="{ left: fingerX + 'px', top: fingerY + 'px', opacity: fingerVisible ? 1 : 0 }"
          >
            <div class="finger-dot" :class="{ pressing: fingerPressing }" />
            <div v-if="fingerHolding" class="hold-ring" />
          </div>

          <!-- Action bar — always in DOM so panel height never changes -->
          <div class="mock-action-bar">
            <Transition name="bar-switch" mode="out-in">
              <button v-if="!checkboxVisible" key="default" class="mock-bar-btn mock-bar-btn--primary mock-bar-btn--full">
                Move all to pantry
              </button>
              <div v-else key="select" class="mock-bar-select-btns">
                <button class="mock-bar-btn mock-bar-btn--danger">Delete ({{ checkedRows.size }})</button>
                <button class="mock-bar-btn mock-bar-btn--primary">Move ({{ checkedRows.size }})</button>
              </div>
            </Transition>
          </div>

        </div>
        <p class="slide-title">Bulk move &amp; delete</p>
        <p class="slide-body">Hold any item to enter multi-select mode. Tick what you need then move or delete in one tap.</p>
      </template>

      <!-- Slide 3: Expiry tracking -->
      <template v-else>
        <div class="mock-panel mock-panel--inv">
          <p class="mock-inv-title">Inventory</p>
          <div class="mock-inv-list">
            <div
              v-for="(inv, i) in invItems"
              :key="inv.name"
              class="mock-inv-item"
              :style="{ background: inv.bg, borderColor: inv.border }"
            >
              <div class="mock-inv-main">
                <span class="mock-inv-name" :style="{ textDecoration: inv.strikethrough ? 'line-through' : 'none', color: inv.nameColor }">{{ inv.name }}</span>
                <span class="mock-cat-chip" :style="{ background: inv.chipBg, color: inv.chipColor }">{{ inv.cat }}</span>
                <span class="mock-inv-qty" :style="{ color: inv.qtyColor }">{{ inv.qty }}</span>
              </div>
              <div class="mock-inv-meta">
                <v-icon size="11" :color="inv.iconColor">mdi-calendar-clock</v-icon>
                <span class="mock-expiry-label" :style="{ color: inv.labelColor }">{{ inv.expiryLabel }}</span>
                <span class="mock-expiry-date" :style="{ color: inv.labelColor, opacity: 0.7 }">{{ inv.expiryDate }}</span>
              </div>
            </div>
          </div>
        </div>
        <p class="slide-title">Expiry tracking</p>
        <p class="slide-body">Grovely colour-codes your inventory so you always know what needs using first.</p>
      </template>

    </template>
  </FeatureTutorial>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import FeatureTutorial from '@/components/ui/FeatureTutorial.vue'

defineProps({ forceOpen: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

// ── Timer helpers ──────────────────────────────────────────────────
const timers = []
const s = (fn, ms) => timers.push(setTimeout(fn, ms))
function clearTimers() { timers.forEach(clearTimeout); timers.length = 0 }

// ══════════════════════════════════════════════════════════════════
// Slide 1 — Add item
// ══════════════════════════════════════════════════════════════════
const WORD         = 'Milk'
const typedText    = ref('')
const cursorVisible = ref(true)
const newItemVisible = ref(false)

const slide1Items = [
  { name: 'Apples', qty: '1 kg' },
  { name: 'Spinach', qty: '200 g' },
]

function startTyping() {
  function loop() {
    typedText.value      = ''
    newItemVisible.value = false
    cursorVisible.value  = true
    fingerVisible.value  = false
    fingerPressing.value = false

    WORD.split('').forEach((_, i) => {
      s(() => { typedText.value = WORD.slice(0, i + 1) }, 500 + i * 220)
    })

    // Cursor hides, finger appears on + button
    s(() => { cursorVisible.value = false },              1600)
    s(() => { fingerVisible.value = true },               1700)
    // Tap press
    s(() => { fingerPressing.value = true },              1900)
    // Release + item pops in
    s(() => { fingerPressing.value = false; newItemVisible.value = true }, 2050)
    // Finger fades out
    s(() => { fingerVisible.value = false },              2250)

    s(() => { newItemVisible.value = false; typedText.value = '' }, 3900)
    s(() => { cursorVisible.value = true },               4000)
    s(loop,                                               4700)
  }
  loop()
}

// ══════════════════════════════════════════════════════════════════
// Slide 2 — Multi-select
// ══════════════════════════════════════════════════════════════════
const checkboxVisible  = ref(false)
const checkedRows      = ref(new Set())
const fingerVisible    = ref(false)
const fingerPressing   = ref(false)
const fingerHolding    = ref(false)
const fingerX          = ref(0)
const fingerY          = ref(0)

// Finger X: ~55% of 288px inner width = 158px
const FINGER_X_CONST = 158

// Finger Y — accounting for panel top-padding (12px), flex gap (6px between children),
// cat-header height (~20px), list-item height (~38px), item margin-bottom (5px):
//
// Eggs  : 12 (pad) + 20 (Produce hdr) + 6 (gap) + 38/2 - 10 = 47
// Dairy hdr starts at: 12 + 20 + 6 + 38 + 5 (margin) + 6 (gap) = 87
// Milk  : 87 + 20 (Dairy hdr) + 6 (gap) + 38/2 - 10 = 122
const EGGS_Y = 47
const MILK_Y = 122

function startMultiSelect() {
  function loop() {
    checkboxVisible.value = false
    checkedRows.value     = new Set()
    fingerVisible.value   = false
    fingerPressing.value  = false
    fingerHolding.value   = false
    fingerX.value         = FINGER_X_CONST
    fingerY.value         = MILK_Y      // start on Milk

    // Finger appears over Milk
    s(() => { fingerVisible.value = true },                                400)
    // Hold press — ring expands
    s(() => { fingerPressing.value = true; fingerHolding.value = true },   700)
    // Hold resolves — checkboxes pop in, Milk auto-selected → bar switches to Move (1)
    s(() => {
      fingerHolding.value   = false
      fingerPressing.value  = false
      checkboxVisible.value = true
      checkedRows.value     = new Set([1])
    }, 1500)
    // Move up to Eggs
    s(() => { fingerY.value = EGGS_Y },          1800)
    s(() => { fingerPressing.value = true },      2050)
    // Tap: Eggs selected → bar updates to Move (2)
    s(() => { fingerPressing.value = false; checkedRows.value = new Set([0, 1]) }, 2300)
    s(() => { fingerVisible.value = false },      2550)
    // Clear — bar reverts to "Move all to pantry"
    s(() => { checkboxVisible.value = false; checkedRows.value = new Set() }, 4300)
    s(loop, 5000)
  }
  loop()
}

// ══════════════════════════════════════════════════════════════════
// Slide 3 — Expiry tracking (static — states speak for themselves)
// ══════════════════════════════════════════════════════════════════
const invItems = [
  {
    name: 'Spinach', cat: 'Produce', qty: '100 g',
    bg: '#f9f9f9', border: '#e0e0e0',
    nameColor: '#9e9e9e', qtyColor: '#b0b0b0',
    chipBg: '#eeeeee', chipColor: '#aaaaaa',
    iconColor: '#9e9e9e', labelColor: '#9e9e9e',
    expiryLabel: 'Expired', expiryDate: '1 day ago',
    strikethrough: true,
  },
  {
    name: 'Yoghurt', cat: 'Dairy', qty: '500 g',
    bg: '#fffdf0', border: '#fbbf24',
    nameColor: '#1A4D35', qtyColor: '#6BA888',
    chipBg: '#e3f1fb', chipColor: '#42a5d6',
    iconColor: '#b45309', labelColor: '#b45309',
    expiryLabel: 'Expires in', expiryDate: '2 days',
    strikethrough: false,
  },
  {
    name: 'Oat Milk', cat: 'Dairy', qty: '1 L',
    bg: '#EAF7F0', border: '#C8E8D8',
    nameColor: '#1A4D35', qtyColor: '#6BA888',
    chipBg: '#e3f1fb', chipColor: '#42a5d6',
    iconColor: '#6BA888', labelColor: '#6BA888',
    expiryLabel: 'Expires in', expiryDate: '14 days',
    strikethrough: false,
  },
]

// ══════════════════════════════════════════════════════════════════
// Lifecycle
// ══════════════════════════════════════════════════════════════════
function resetAll() {
  typedText.value       = ''
  cursorVisible.value   = true
  newItemVisible.value  = false
  checkboxVisible.value = false
  checkedRows.value     = new Set()
  fingerVisible.value   = false
  fingerPressing.value  = false
  fingerHolding.value   = false
}

function startSlideAnim(n) {
  clearTimers()
  resetAll()
  if (n === 1) startTyping()
  else if (n === 2) startMultiSelect()
  // Slide 3: static, no animation needed
}

function onSlideChange(n) { startSlideAnim(n) }
function onClose() { clearTimers(); emit('close') }

onMounted(() => startSlideAnim(1))
onUnmounted(clearTimers)
</script>

<style scoped>
/* ── Mock panel — matches the real EAF7F0 panel feel ────────────── */
.mock-panel {
  position: relative;
  width: 100%;
  max-width: 320px;
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 4px 14px rgba(40, 110, 70, 0.10);
  box-sizing: border-box;
}
.mock-panel--inv { gap: 8px; }

/* ── Add form ───────────────────────────────────────────────────── */
.mock-add-form {
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  border-radius: 10px;
  padding: 10px 8px;
  flex-shrink: 0;
}
.mock-add-row {
  display: flex;
  gap: 5px;
  align-items: center;
}
.mock-input {
  flex: 1;
  background: #fff;
  border: 1.5px solid #B8E6D0;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 14px;
  color: #1a1a1a;
  height: 38px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
}
.mock-typed { color: #1A4D35; font-weight: 500; }
.mock-cursor {
  display: inline-block;
  color: #2E7D52;
  font-weight: 300;
  margin-left: 1px;
  animation: blink 1s step-end infinite;
}
.mock-cursor.hidden { opacity: 0; animation: none; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.mock-placeholder {
  color: #6BA888;
  opacity: 0.7;
  font-size: 14px;
  pointer-events: none;
  user-select: none;
}
.mock-add-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #6BA888;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.22s ease;
}
.mock-add-btn--active { background: #2E7D52; }

/* ── Dots separator ─────────────────────────────────────────────── */
.mock-dots-sep {
  font-size: 11px;
  font-weight: 800;
  color: #B8E6D0;
  letter-spacing: 5px;
  text-align: center;
  padding: 1px 0;
  user-select: none;
}

/* ── List area (items container) ────────────────────────────────── */
.mock-list-area {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Category header ────────────────────────────────────────────── */
.mock-cat-header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6BA888;
  padding: 2px 4px 5px;
}
.mock-cat-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── List item — mirrors .list-item exactly ─────────────────────── */
.mock-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  border-radius: 10px;
  margin-bottom: 5px;
  transition: background 0.18s ease, border-color 0.18s ease;
}
.mock-list-item--selected {
  background: #d4f0e4;
  border-color: #2E7D52;
}
.mock-list-item--new { animation: item-pop 0.28s ease; }
@keyframes item-pop {
  from { opacity: 0; transform: translateY(-5px); }
  to   { opacity: 1; transform: translateY(0); }
}

.mock-item-name {
  flex: 1;
  font-size: 14px;
  color: #1A4D35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mock-item-qty {
  font-size: 12px;
  color: #6BA888;
  white-space: nowrap;
  flex-shrink: 0;
}
.mock-item-price {
  font-size: 12px;
  font-weight: 700;
  color: #2E7D52;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Dairy section — always in DOM, opacity fades in ────────────── */
.mock-dairy-section {
  opacity: 0;
  transition: opacity 0.28s ease;
  pointer-events: none;
}
.mock-dairy-section--visible {
  opacity: 1;
  pointer-events: auto;
}

/* ── Icon slot — fixed size prevents row height jumping ─────────── */
.mock-icon-slot {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── AppCheckbox replica ─────────────────────────────────────────── */
.mock-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid #B8E6D0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.mock-checkbox--checked {
  background: #2E7D52;
  border-color: #2E7D52;
}



/* ── Animated finger ─────────────────────────────────────────────── */
.finger-wrap {
  position: absolute;
  pointer-events: none;
  transform: translateX(-50%);
  z-index: 3;
  transition: left 0.20s ease-out, top 0.20s ease-out, opacity 0.28s ease;
}
.finger-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(46, 125, 82, 0.78);
  border: 2px solid #2E7D52;
  box-shadow: 0 2px 12px rgba(46, 125, 82, 0.45);
  transition: transform 0.28s ease;
}
.finger-dot.pressing { transform: scale(0.78); }

@keyframes hold-expand {
  0%   { transform: scale(0.5); opacity: 0.9; }
  70%  { opacity: 0.6; }
  100% { transform: scale(3.2); opacity: 0; }
}
.hold-ring {
  position: absolute;
  top: 0; left: 0;
  width: 20px; height: 20px;
  border-radius: 50%;
  border: 2.5px solid #2E7D52;
  animation: hold-expand 0.72s ease-out forwards;
  pointer-events: none;
}

/* ── Action bar — always in DOM, content switches ───────────────── */
.mock-action-bar {
  display: flex;
  gap: 8px;
  margin-top: 2px;
  min-height: 42px;   /* locks panel height regardless of button content */
  align-items: stretch;
}
.mock-bar-select-btns {
  display: flex;
  gap: 8px;
  width: 100%;
}
.mock-bar-btn {
  flex: 1;
  padding: 10px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: default;
}
.mock-bar-btn--full { width: 100%; }
.mock-bar-btn--primary {
  background: #EAF7F0;
  color: #2E7D52;
  border: 1px solid #B8E6D0;
}
.mock-bar-btn--danger {
  background: #fbeaea;
  color: #c0392b;
  border: 1px solid #f0c5c5;
}

/* Bar content cross-fade */
.bar-switch-enter-active { transition: opacity 0.18s ease; }
.bar-switch-leave-active { transition: opacity 0.12s ease; }
.bar-switch-enter-from   { opacity: 0; }
.bar-switch-leave-to     { opacity: 0; }

/* ── Inventory (Slide 3) — mirrors .pantry-item ─────────────────── */
.mock-inv-title {
  font-size: 12px;
  font-weight: 700;
  color: #3a7d5e;
  margin: 0 0 4px;
}
.mock-inv-list { display: flex; flex-direction: column; gap: 6px; }

.mock-inv-item {
  border-radius: 8px;
  padding: 8px 10px;
  border: 1px solid;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.mock-inv-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mock-inv-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mock-cat-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 99px;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}
.mock-inv-qty {
  font-size: 12px;
  flex-shrink: 0;
  text-align: right;
  min-width: 36px;
}
.mock-inv-meta {
  display: flex;
  align-items: center;
  gap: 4px;
}
.mock-expiry-label {
  font-size: 11px;
}
.mock-expiry-date {
  font-size: 11px;
  margin-left: 2px;
}

/* ── Shared text ─────────────────────────────────────────────────── */
.slide-title { font-size: 20px; font-weight: 700; color: #1f3d2e; margin: 0; text-align: center; }
.slide-body  { font-size: 14.5px; color: #6f8a7a; margin: 0; text-align: center; line-height: 1.65; }
</style>
