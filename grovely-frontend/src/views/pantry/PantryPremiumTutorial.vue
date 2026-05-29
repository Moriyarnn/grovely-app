<template>
  <FeatureTutorial
    storage-key="grovely_pantry_premium_autofill_done"
    :force-open="forceOpen"
    :slide-count="1"
    variant="premium"
    theme="mint"
    :auto-show-first-time="autoShow"
    @close="$emit('close')"
  >
    <template #default>
      <div class="mock-add-form">

        <!-- Add row: typing input + dropdown -->
        <div class="mock-add-row">
          <div class="mock-pac-wrap">
            <div class="mock-pac-input" :class="{ 'mock-pac-input--active': typedText.length > 0 }">
              <span class="mock-typed">{{ typedText }}</span><span class="mock-cursor" :class="{ hidden: !cursorVisible }">|</span>
            </div>
            <Transition name="drop-open">
              <div v-if="dropdownVisible" class="mock-pac-dropdown">
                <div class="mock-pac-section-header">Recent</div>
                <div class="mock-pac-row" :class="{ 'mock-pac-row--focused': focusedRow === 0 }">
                  <span class="mock-pac-row-name">Milk</span>
                  <span class="mock-pac-row-meta">
                    <span class="mock-pac-row-qty">2 L</span>
                    <span class="mock-pac-row-price">$ 2.50</span>
                  </span>
                </div>
                <div class="mock-pac-row">
                  <span class="mock-pac-row-name">Mango</span>
                  <span class="mock-pac-row-meta">
                    <span class="mock-pac-row-price">$ 1.80</span>
                  </span>
                </div>
              </div>
            </Transition>
          </div>
          <div class="mock-add-btn" :class="{ 'mock-add-btn--active': typedText.length > 0 }">
            <v-icon size="18" color="#fff">mdi-plus</v-icon>
          </div>
        </div>

        <!-- Row 1: Quantity | Density -->
        <div class="mock-meta-row">
          <div class="mock-meta-field">
            <span class="mock-meta-label">Quantity</span>
            <div class="mock-qty-row">
              <div class="mock-meta-input mock-meta-input--qty" :class="{ 'mock-meta-input--lit': filled }">
                <Transition name="val-pop" mode="out-in">
                  <span :key="qtyAmount" :style="{ color: qtyAmount === '0' ? '#6BA888' : '#1A4D35' }">{{ qtyAmount }}</span>
                </Transition>
              </div>
              <div class="mock-meta-select mock-meta-select--unit" :class="{ 'mock-meta-select--lit': filled }">
                <Transition name="val-pop" mode="out-in">
                  <span :key="qtyUnit">{{ qtyUnit }}</span>
                </Transition>
              </div>
            </div>
          </div>
          <div class="mock-meta-field">
            <span class="mock-meta-label">Density</span>
            <div class="mock-qty-row">
              <div class="mock-meta-input mock-meta-input--qty" :class="{ 'mock-meta-input--lit': filled }">
                <Transition name="val-pop" mode="out-in">
                  <span :key="densityAmount" :style="{ color: densityAmount === '0' ? '#6BA888' : '#1A4D35' }">{{ densityAmount }}</span>
                </Transition>
              </div>
              <div class="mock-meta-select mock-meta-select--unit" :class="{ 'mock-meta-select--lit': filled }">
                <span>g/ml</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Row 2: Price | Store | Category -->
        <div class="mock-meta-row">
          <div class="mock-meta-field">
            <span class="mock-meta-label">Price</span>
            <div class="mock-price-box" :class="{ 'mock-price-box--lit': filled }">
              <span class="mock-price-symbol">$</span>
              <Transition name="val-pop" mode="out-in">
                <span :key="priceValue" class="mock-price-val" :style="{ color: priceValue === '0.00' ? '#6BA888' : '#1A4D35' }">{{ priceValue }}</span>
              </Transition>
            </div>
          </div>
          <div class="mock-meta-field">
            <span class="mock-meta-label">Store</span>
            <div class="mock-meta-input mock-meta-input--store" :class="{ 'mock-meta-input--lit': filled }">
              <Transition name="val-pop" mode="out-in">
                <span :key="storeValue" :style="{ color: storeValue === 'Store…' ? '#6BA888' : '#1A4D35' }">{{ storeValue }}</span>
              </Transition>
            </div>
          </div>
          <div class="mock-meta-field mock-meta-field--cat">
            <span class="mock-meta-label">Category</span>
            <div class="mock-meta-select" :class="{ 'mock-meta-select--lit': filled }">
              <Transition name="val-pop" mode="out-in">
                <span :key="categoryValue">{{ categoryValue }}</span>
              </Transition>
            </div>
          </div>
        </div>

      </div>
      <p class="slide-title">Smart Autofill</p>
      <p class="slide-body">Start typing and Grovely suggests items from your history. Select one and quantity, price, store, and category all fill in at once.</p>
    </template>
  </FeatureTutorial>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import FeatureTutorial from '@/components/ui/FeatureTutorial.vue'

defineProps({
  forceOpen: { type: Boolean, default: false },
  autoShow:  { type: Boolean, default: false },
})
defineEmits(['close'])

const timers = []
const s = (fn, ms) => timers.push(setTimeout(fn, ms))
function clearTimers() { timers.forEach(clearTimeout); timers.length = 0 }

// ── State ──────────────────────────────────────────────────────────
const typedText      = ref('')
const cursorVisible  = ref(true)
const dropdownVisible = ref(false)
const focusedRow     = ref(-1)
const qtyAmount      = ref('0')
const qtyUnit        = ref('g')
const densityAmount  = ref('0')
const priceValue     = ref('0.00')
const storeValue     = ref('Store…')
const categoryValue  = ref('Other')
const filled         = ref(false)

function reset() {
  typedText.value      = ''
  cursorVisible.value  = true
  dropdownVisible.value = false
  focusedRow.value     = -1
  qtyAmount.value      = '0'
  qtyUnit.value        = 'g'
  densityAmount.value  = '0'
  priceValue.value     = '0.00'
  storeValue.value     = 'Store…'
  categoryValue.value  = 'Other'
  filled.value         = false
}

// ── Combined animation loop ────────────────────────────────────────
function startAnim() {
  function loop() {
    reset()

    // Type "Mi"
    s(() => { typedText.value = 'M'  },  500)
    s(() => { typedText.value = 'Mi' },  750)

    // Dropdown opens
    s(() => { dropdownVisible.value = true },  1000)

    // Milk row focuses
    s(() => { focusedRow.value = 0 },           1350)

    // Selection: complete the word, close dropdown, burst-fill all fields
    s(() => {
      typedText.value      = 'Milk'
      cursorVisible.value  = false
      dropdownVisible.value = false
      focusedRow.value     = -1
      filled.value         = true
      qtyAmount.value      = '2'
      qtyUnit.value        = 'L'
      densityAmount.value  = '1.03'
      priceValue.value     = '2.50'
      storeValue.value     = 'Store A'
      categoryValue.value  = 'Dairy'
    }, 1800)

    // Highlight flashes off
    s(() => { filled.value = false }, 2300)

    // Hold, then reset and loop
    s(reset, 4200)
    s(loop,  5000)
  }
  loop()
}

onMounted(startAnim)
onUnmounted(clearTimers)
</script>

<style scoped>
/* ── Add form outer — matches .add-form ─────────────────────────── */
.mock-add-form {
  width: 100%;
  max-width: 320px;
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  border-radius: 14px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
  box-shadow: 0 4px 14px rgba(40, 110, 70, 0.10);
}

/* ── Add row ────────────────────────────────────────────────────── */
.mock-add-row {
  display: flex;
  gap: 5px;
  align-items: flex-start;
}
.mock-pac-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
}

/* pac-input--green */
.mock-pac-input {
  width: 100%;
  box-sizing: border-box;
  background: #fff;
  border: 1.5px solid #B8E6D0;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 15px;
  color: #1A4D35;
  height: 41px;
  display: flex;
  align-items: center;
  transition: border-color 0.15s;
}
.mock-pac-input--active { border-color: #2E7D52; }

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

.mock-add-btn {
  width: 38px;
  height: 41px;
  border-radius: 10px;
  background: #6BA888;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.22s ease;
}
.mock-add-btn--active { background: #2E7D52; }

/* ── Dropdown — pac-dropdown--green ────────────────────────────── */
.mock-pac-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1.5px solid #B8E6D0;
  border-radius: 12px;
  overflow: hidden;
  z-index: 10;
  box-shadow: 0 4px 20px rgba(46, 125, 82, 0.10);
}
.mock-pac-section-header {
  padding: 6px 14px 3px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6BA888;
}
.mock-pac-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  transition: background 0.15s;
}
.mock-pac-row--focused { background: #f0faf4; }
.mock-pac-row-name  { flex: 1; font-size: 15px; color: #1A4D35; font-weight: 500; }
.mock-pac-row-meta  { display: flex; align-items: center; gap: 8px; }
.mock-pac-row-qty   { font-size: 12px; color: #5a9a72; white-space: nowrap; }
.mock-pac-row-price { font-size: 12px; color: #2E7D52; font-weight: 600; white-space: nowrap; }

.drop-open-enter-active { transition: opacity 0.20s ease, transform 0.20s ease; }
.drop-open-leave-active { transition: opacity 0.14s ease; }
.drop-open-enter-from   { opacity: 0; transform: translateY(-4px); }
.drop-open-leave-to     { opacity: 0; }

/* ── Meta rows — mirrors .add-meta ─────────────────────────────── */
.mock-meta-row {
  display: flex;
  gap: 5px;
  align-items: flex-start;
}
.mock-meta-field {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mock-meta-field--cat { flex: 2; }

/* .add-meta-label */
.mock-meta-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6BA888;
  padding-left: 2px;
}

/* .meta-qty-row */
.mock-qty-row {
  display: flex;
  gap: 5px;
  width: 100%;
}

/* .meta-input */
.mock-meta-input {
  flex: 1;
  border: 1.5px solid #B8E6D0;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: #6BA888;
  background: #fff;
  height: 36px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  transition: border-color 0.20s ease;
}
.mock-meta-input--qty   { flex: 1 0 52px; }
.mock-meta-input--store { flex: 1; }
.mock-meta-input--lit   { border-color: #2E7D52; }

/* .meta-select */
.mock-meta-select {
  border: 1.5px solid #B8E6D0;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: #1A4D35;
  background: #fff;
  height: 36px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  transition: border-color 0.20s ease;
}
.mock-meta-select--unit { flex: 0 1 48px; min-width: 44px; }
.mock-meta-select--lit  { border-color: #2E7D52; }

/* .meta-price-box */
.mock-price-box {
  display: flex;
  align-items: center;
  gap: 3px;
  width: 100%;
  height: 36px;
  box-sizing: border-box;
  border: 1.5px solid #B8E6D0;
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
  transition: border-color 0.20s ease;
}
.mock-price-box--lit { border-color: #2E7D52; }
.mock-price-symbol {
  font-size: 12px;
  font-weight: 600;
  color: #2E7D52;
  flex-shrink: 0;
}
.mock-price-val {
  flex: 1;
  font-size: 12px;
  min-width: 0;
}


/* Value pop transition */
.val-pop-enter-active { transition: opacity 0.20s ease, transform 0.20s ease; }
.val-pop-leave-active { transition: opacity 0.12s ease; }
.val-pop-enter-from   { opacity: 0; transform: translateY(4px); }
.val-pop-leave-to     { opacity: 0; }

/* ── Shared text ─────────────────────────────────────────────────── */
.slide-title { font-size: 20px; font-weight: 700; color: #1f3d2e; margin: 0; text-align: center; }
.slide-body  { font-size: 14.5px; color: #6f8a7a; margin: 0; text-align: center; line-height: 1.65; }
</style>
