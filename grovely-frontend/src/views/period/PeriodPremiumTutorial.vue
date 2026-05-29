<template>
  <FeatureTutorial
    storage-key="grovely_premium_phase_intro_done"
    :force-open="forceOpen"
    :slide-count="2"
    variant="premium"
    theme="rose"
    :auto-show-first-time="autoShow"
    @close="$emit('close')"
    @slide-change="onSlideChange"
  >
    <template #default="{ slide }">

      <!-- Slide 1: phase card (Calculated ↔ Predicted) -->
      <template v-if="slide === 1">
        <div class="anim-area">
          <div class="mock-card">
            <div class="mock-title-row">
              <span class="mock-section-title">Current Phase</span>
              <Transition name="pill-fx" mode="out-in">
                <span :key="phaseState.kind" class="mock-pill">{{ phaseState.kind === 'predicted' ? 'Predicted' : 'Calculated' }}</span>
              </Transition>
            </div>

            <div class="mock-bar">
              <div class="mock-seg mock-seg--m" :class="{ on: phaseState.phase === 'Menstrual' }" />
              <div class="mock-seg mock-seg--f" :class="{ on: phaseState.phase === 'Follicular' }" />
              <div class="mock-seg mock-seg--o" :class="{ on: phaseState.phase === 'Ovulatory' }" />
              <div class="mock-seg mock-seg--l" :class="{ on: phaseState.phase === 'Luteal' }" />
            </div>

            <Transition name="phase-fx" mode="out-in">
              <div :key="phaseState.phase" class="mock-phase-row">
                <v-icon size="15" :color="phaseColor">{{ phaseIcon }}</v-icon>
                <span class="mock-phase-name" :style="{ color: phaseColor }">{{ phaseState.phase }} phase</span>
              </div>
            </Transition>

            <Transition name="phase-fx" mode="out-in">
              <p :key="phaseState.body" class="mock-phase-body">{{ phaseState.body }}</p>
            </Transition>
          </div>
        </div>

        <p class="slide-title">Know what your phase card is telling you</p>
        <p class="slide-body">
          When the card has data to work from it's marked Calculated. When it's forecasting from your history it's marked Predicted. The pill always tells you which.
        </p>
      </template>

      <!-- Slide 2: adjust cycle -->
      <template v-else-if="slide === 2">
        <div class="anim-area anim-area--adj">
          <div class="cal-wrap">
            <div class="mini-cal">
              <div
                v-for="i in 7" :key="i"
                class="mc-cell"
                :class="getAdjClass(i)"
              >
                <span class="mc-num">{{ i }}</span>
              </div>
            </div>
            <div
              class="finger-wrap"
              :style="{ left: acX + 'px', top: acY + 'px', opacity: acVisible ? 1 : 0 }"
            >
              <div class="finger-dot" :class="{ pressing: acPressing }" />
              <div v-if="acHolding" class="hold-ring" />
            </div>
          </div>
        </div>

        <p class="slide-title">Adjust any cycle</p>
        <p class="slide-body">
          Hold any period group day to enter adjust mode. Drag either handle to extend or shrink the cycle — useful when you log early and need to refine the dates.
        </p>
      </template>

    </template>
  </FeatureTutorial>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import FeatureTutorial from '@/components/ui/FeatureTutorial.vue'

defineProps({
  forceOpen: { type: Boolean, default: false },
  autoShow:  { type: Boolean, default: false },
})
defineEmits(['close'])

// ══════════════════════════════════════════════════════════════════
// Slide 1 — phase card
// ══════════════════════════════════════════════════════════════════

const PHASE_STATES = [
  {
    kind:  'calculated',
    phase: 'Follicular',
    body:  'Calculated from your logged cycle start using average phase lengths.',
  },
  {
    kind:  'predicted',
    phase: 'Menstrual',
    body:  'Predicted from your historical pattern because no period is logged yet for this cycle.',
  },
]

const phaseIdx   = ref(0)
const phaseState = computed(() => PHASE_STATES[phaseIdx.value])
const phaseColor = computed(() => ({
  Menstrual:  '#993556',
  Follicular: '#c084c6',
  Ovulatory:  '#d4537e',
  Luteal:     '#7c6fcd',
}[phaseState.value.phase]))
const phaseIcon = computed(() => ({
  Menstrual:  'mdi-water',
  Follicular: 'mdi-flower-tulip',
  Ovulatory:  'mdi-brightness-5',
  Luteal:     'mdi-moon-waning-crescent',
}[phaseState.value.phase]))

let phaseTimer = null
function startPhaseLoop() {
  stopPhaseLoop()
  phaseTimer = setInterval(() => { phaseIdx.value = (phaseIdx.value + 1) % PHASE_STATES.length }, 3500)
}
function stopPhaseLoop() { if (phaseTimer) { clearInterval(phaseTimer); phaseTimer = null } }

// ══════════════════════════════════════════════════════════════════
// Slide 2 — adjust cycle
// ══════════════════════════════════════════════════════════════════

// Cell geometry — mirrors CSS clamp() so JS positions match rendered cells
function getCS() {
  const cardWidth = Math.min(window.innerWidth * 0.9, 480)
  return Math.min(52, Math.max(24, (cardWidth - 74) / 7))
}
function cx(i)  { const cs = getCS(); return (i - 1) * (cs + 3) + cs / 2 }
function adjCy() { return getCS() / 2 - 10 }

const adjStart   = ref(2)
const adjEnd     = ref(6)
const adjHandles = ref(new Set())
const acX        = ref(0)
const acY        = ref(0)
const acVisible  = ref(false)
const acPressing = ref(false)
const acHolding  = ref(false)

const adjTimers = []
const as = (fn, ms) => adjTimers.push(setTimeout(fn, ms))
function clearAdjTimers() { adjTimers.forEach(clearTimeout); adjTimers.length = 0 }

function getAdjClass(i) {
  const classes = []
  const s = adjStart.value
  const e = adjEnd.value
  if (i < s || i > e) return classes
  classes.push('band-filled')
  if (i === s) classes.push('band-left')
  if (i === e) classes.push('band-right')
  if (adjHandles.value.has(i)) classes.push('adjust-handle')
  return classes
}

function resetAdjState() {
  adjStart.value   = 2
  adjEnd.value     = 6
  adjHandles.value = new Set()
  acX.value        = 0
  acY.value        = 0
  acVisible.value  = false
  acPressing.value = false
  acHolding.value  = false
}

function startAdjust() {
  clearAdjTimers()
  resetAdjState()

  function loop() {
    // Reset to base cycle (2–6)
    adjStart.value   = 2
    adjEnd.value     = 6
    adjHandles.value = new Set()
    acX.value        = cx(4)
    acY.value        = adjCy()
    acVisible.value  = false
    acPressing.value = false
    acHolding.value  = false

    // 1. Pointer appears and holds on a period cell
    as(() => { acVisible.value = true }, 400)
    as(() => { acPressing.value = true; acHolding.value = true }, 650)

    // 2. Hold resolves — handles pop on at start and end of cycle
    as(() => {
      acHolding.value  = false
      acPressing.value = false
      adjHandles.value = new Set([adjStart.value, adjEnd.value])
    }, 1400)

    // 3. Pointer moves to the end handle
    as(() => { acX.value = cx(6) }, 1700)

    // 4. Press the handle and extend step-by-step (pointer + cell in sync)
    as(() => { acPressing.value = true }, 2000)
    as(() => {
      acX.value        = cx(7)
      adjEnd.value     = 7
      adjHandles.value = new Set([adjStart.value, 7])
    }, 2300)

    // 5. Release, pause to show the extended cycle
    as(() => { acPressing.value = false }, 2600)
    as(() => { acVisible.value = false },  2800)

    // 6. Pointer reappears on the extended handle and drags it back
    as(() => { acX.value = cx(7); acVisible.value = true }, 3600)
    as(() => { acPressing.value = true }, 3850)
    as(() => {
      acX.value        = cx(6)
      adjEnd.value     = 6
      adjHandles.value = new Set([adjStart.value, 6])
    }, 4150)

    // 7. Release, hide, handles fade — then loop
    as(() => { acPressing.value = false }, 4400)
    as(() => { acVisible.value = false; adjHandles.value = new Set() }, 4650)
    as(loop, 5500)
  }

  loop()
}

// ══════════════════════════════════════════════════════════════════
// Lifecycle
// ══════════════════════════════════════════════════════════════════

function onSlideChange(n) {
  if (n === 1) { startPhaseLoop(); clearAdjTimers(); resetAdjState() }
  else         { stopPhaseLoop();  startAdjust() }
}

onMounted(startPhaseLoop)
onUnmounted(() => { stopPhaseLoop(); clearAdjTimers() })
</script>

<style scoped>
/* ── Shared anim area ────────────────────────────────────────────── */
.anim-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 4px 0 8px;
}
.anim-area--adj {
  align-items: flex-start;
  padding-top: 14px;
  min-height: 80px;
}

/* ── Slide 1: phase card ─────────────────────────────────────────── */
.mock-card {
  width: 100%;
  max-width: 320px;
  background: #fff;
  border: 1px solid #f0d0dc;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 4px 14px rgba(180, 40, 80, 0.10);
}

.mock-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.mock-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #993556;
}
.mock-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid #d4879e;
  background: #fbeaf0;
  color: #993556;
}

.mock-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}
.mock-seg { opacity: 0.18; transition: opacity 0.4s; }
.mock-seg.on { opacity: 1; }
.mock-seg--m { flex: 5;  background: #993556; }
.mock-seg--f { flex: 8;  background: #c084c6; }
.mock-seg--o { flex: 2;  background: #d4537e; }
.mock-seg--l { flex: 13; background: #7c6fcd; }

.mock-phase-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.mock-phase-name {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.mock-phase-body {
  font-size: 12.5px;
  color: #72243E;
  margin: 0;
  line-height: 1.5;
}

.pill-fx-enter-active,  .pill-fx-leave-active  { transition: opacity 0.30s ease, transform 0.30s ease; }
.pill-fx-enter-from,    .pill-fx-leave-to      { opacity: 0; transform: scale(0.85); }
.phase-fx-enter-active, .phase-fx-leave-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.phase-fx-enter-from,   .phase-fx-leave-to     { opacity: 0; transform: translateY(4px); }

/* ── Slide 2: adjust cycle mini-cal ─────────────────────────────── */
.cal-wrap { position: relative; }

.mini-cal {
  display: flex;
  gap: 3px;
  --cell: clamp(24px, calc((min(90vw, 480px) - 74px) / 7), 52px);
}

.mc-cell {
  width: var(--cell);
  height: var(--cell);
  border-radius: clamp(6px, calc(var(--cell) * 0.22), 12px);
  border: 1.5px solid #e8c8d4;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease, border-color 0.18s ease;
}
.mc-num {
  font-size: clamp(9px, calc((min(90vw, 480px) - 74px) / 7 * 0.33), 17px);
  color: #c0899b;
  line-height: 1;
  user-select: none;
  transition: color 0.18s ease;
}

/* Band — filled period cells */
@keyframes band-pop {
  0%   { transform: scale(0.82); }
  60%  { transform: scale(1.08); }
  100% { transform: scale(1); }
}
.mc-cell.band-filled {
  background: #F5A0BC;
  border-color: #D4537E;
  border-radius: 0;
  animation: band-pop 0.22s ease-out;
}
.mc-cell.band-filled .mc-num { color: #993556; }
.mc-cell.band-left  { border-top-left-radius: clamp(6px, calc(var(--cell) * 0.22), 12px); border-bottom-left-radius: clamp(6px, calc(var(--cell) * 0.22), 12px); }
.mc-cell.band-right { border-top-right-radius: clamp(6px, calc(var(--cell) * 0.22), 12px); border-bottom-right-radius: clamp(6px, calc(var(--cell) * 0.22), 12px); }

/* Handles — pulsing outline on drag targets */
@keyframes handle-pulse {
  0%, 100% { outline-color: #993556; outline-offset: 2px; }
  50%       { outline-color: #D4537E; outline-offset: 4px; }
}
.mc-cell.adjust-handle {
  outline: 2.5px solid #993556;
  outline-offset: 2px;
  animation: handle-pulse 1s ease-in-out infinite;
}

/* Pointer */
.finger-wrap {
  position: absolute;
  pointer-events: none;
  transform: translateX(-50%);
  z-index: 3;
  transition: left 0.20s ease-out, opacity 0.30s ease;
}
.finger-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(212, 83, 126, 0.82);
  border: 2px solid #D4537E;
  box-shadow: 0 2px 12px rgba(212, 83, 126, 0.50);
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
  top: 0;
  left: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2.5px solid #D4537E;
  animation: hold-expand 0.72s ease-out forwards;
  pointer-events: none;
}

/* ── Shared text ─────────────────────────────────────────────────── */
.slide-title { font-size: 20px; font-weight: 700; color: #72243E; margin: 0; text-align: center; }
.slide-body  { font-size: 14.5px; color: #a06070; margin: 0; text-align: center; line-height: 1.65; }
</style>
