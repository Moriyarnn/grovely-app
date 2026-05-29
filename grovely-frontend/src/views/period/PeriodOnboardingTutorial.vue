<template>
  <FeatureTutorial
    storage-key="grovely_onboarding_done"
    :force-open="forceOpen"
    :slide-count="2"
    variant="normal"
    theme="rose"
    @close="onClose"
    @slide-change="onSlideChange"
  >
    <template #default="{ slide }">

      <!-- Slide 1: drag to log -->
      <template v-if="slide === 1">
        <div class="mock-card">
          <div class="mock-cal-header">
            <v-icon size="11" color="#993556">mdi-calendar-month</v-icon>
            <span class="mock-month">MAY 2025</span>
          </div>
          <div class="mock-weekdays">
            <span v-for="d in ['Su','Mo','Tu','We','Th','Fr','Sa']" :key="d" class="mock-wd">{{ d }}</span>
          </div>
          <div class="cal-wrap">
            <div class="mini-cal">
              <div
                v-for="i in 7" :key="i"
                class="mc-cell"
                :class="{
                  'drag-filled': dragFilled.has(i),
                  'drag-anchor': dragAnchorFirst === i || dragAnchorLast === i
                }"
              >
                <span class="mc-num">{{ i }}</span>
              </div>
            </div>
            <div
              class="finger-wrap"
              :style="{ left: pointerX + 'px', top: pointerY + 'px', opacity: pointerVisible ? 1 : 0 }"
            >
              <div class="finger-dot" :class="{ pressing: pointerPressing }" />
            </div>
          </div>
        </div>
        <p class="slide-title">Log a past period</p>
        <p class="slide-body">Drag across the calendar to mark the days of a completed period.</p>
      </template>

      <!-- Slide 2: day log sheet (matches real DetailSheet UI) -->
      <template v-else>
        <div class="mock-sheet">
          <div class="mock-handle" />
          <div class="mock-ds-header">
            <p class="mock-ds-title">Wednesday, May 14</p>
            <p class="mock-ds-subtitle">DAY 3 · PERIOD</p>
          </div>
          <div class="mock-form">
            <div class="mock-form-section">
              <p class="mock-form-label">Flow intensity</p>
              <div class="mock-flow-chips">
                <span
                  v-for="level in ['spotting','light','medium','heavy']" :key="level"
                  class="mock-flow-chip"
                  :class="{ active: flowActive === level }"
                >{{ level }}</span>
              </div>
            </div>
            <div class="mock-form-section">
              <p class="mock-form-label">Symptoms</p>
              <div class="mock-symptom-chips">
                <span
                  v-for="s in mockSymptoms" :key="s"
                  class="mock-symptom-chip"
                  :class="{ active: activeSymptoms.has(s) }"
                >{{ s }}</span>
              </div>
            </div>
          </div>
        </div>
        <p class="slide-title">Track as it happens</p>
        <p class="slide-body">Tap any day to log flow and symptoms. The more you record, the more accurate your predictions become.</p>
      </template>

    </template>
  </FeatureTutorial>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import FeatureTutorial from '@/components/ui/FeatureTutorial.vue'

defineProps({ forceOpen: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

// ── Slide 1 state ─────────────────────────────────────────────────
const dragFilled      = ref(new Set())
const dragAnchorFirst = ref(null)
const dragAnchorLast  = ref(null)
const pointerX        = ref(0)
const pointerY        = ref(0)
const pointerVisible  = ref(false)
const pointerPressing = ref(false)

// ── Slide 2 state ─────────────────────────────────────────────────
const mockSymptoms   = ['Cramps', 'Headache', 'Bloating', 'Mood swings', 'Fatigue', 'Back pain']
const flowActive     = ref(null)
const activeSymptoms = ref(new Set())

const timers = []
const s = (fn, ms) => timers.push(setTimeout(fn, ms))
function clearTimers() { timers.forEach(clearTimeout); timers.length = 0 }

// ── Cell geometry — accounts for mock-card padding inside tutorial card ────────
function getCS() {
  const screenW   = window.innerWidth
  const cardW     = Math.min(screenW * 0.9, 480)
  const hPad      = Math.min(Math.max(24, screenW * 0.06), 36)
  const tutInner  = cardW - hPad * 2
  const mockInner = Math.min(tutInner, 320) - 32   // mock-card: 16px padding each side
  return Math.max(20, (mockInner - 18) / 7)         // 18 = 6 gaps × 3px
}
function cx(i)   { const cs = getCS(); return (i - 1) * (cs + 3) + cs / 2 }
function calCy() { return getCS() / 2 - 10 }

// ── Slide 1: step-by-step drag — pointer and cell fills stay in sync ──────────
function startDrag() {
  function loop() {
    dragFilled.value      = new Set()
    dragAnchorFirst.value = null
    dragAnchorLast.value  = null
    pointerVisible.value  = false
    pointerPressing.value = false
    pointerX.value        = cx(2)
    pointerY.value        = calCy()

    s(() => { pointerVisible.value = true }, 500)
    s(() => {
      pointerPressing.value = true
      dragFilled.value      = new Set([2])
      dragAnchorFirst.value = 2
      dragAnchorLast.value  = 2
    }, 750)
    s(() => { pointerX.value = cx(3); dragFilled.value = new Set([2, 3]);          dragAnchorLast.value = 3 }, 1050)
    s(() => { pointerX.value = cx(4); dragFilled.value = new Set([2, 3, 4]);        dragAnchorLast.value = 4 }, 1350)
    s(() => { pointerX.value = cx(5); dragFilled.value = new Set([2, 3, 4, 5]);     dragAnchorLast.value = 5 }, 1650)
    s(() => { pointerX.value = cx(6); dragFilled.value = new Set([2, 3, 4, 5, 6]);  dragAnchorLast.value = 6 }, 1950)
    s(() => { pointerPressing.value = false },                                        2200)
    s(() => { pointerVisible.value = false },                                         2400)
    s(() => { dragFilled.value = new Set(); dragAnchorFirst.value = null; dragAnchorLast.value = null }, 3300)
    s(loop, 3900)
  }
  loop()
}

// ── Slide 2: select flow → activate symptoms ─────────────────────
function startDayLog() {
  function loop() {
    flowActive.value     = null
    activeSymptoms.value = new Set()

    // Flow chip lights up
    s(() => { flowActive.value = 'medium' },                             700)

    // Symptoms activate one by one
    s(() => { activeSymptoms.value = new Set(['Cramps']) },              1300)
    s(() => { activeSymptoms.value = new Set(['Cramps', 'Fatigue']) },   2100)
    s(() => { activeSymptoms.value = new Set(['Cramps', 'Fatigue', 'Mood swings']) }, 2900)

    // Hold, then clear and loop
    s(() => { flowActive.value = null; activeSymptoms.value = new Set() }, 4800)
    s(loop,                                                                  5600)
  }
  loop()
}

function resetState() {
  dragFilled.value      = new Set()
  dragAnchorFirst.value = null
  dragAnchorLast.value  = null
  pointerX.value        = 0
  pointerY.value        = 0
  pointerVisible.value  = false
  pointerPressing.value = false
  flowActive.value      = null
  activeSymptoms.value  = new Set()
}

function startSlideAnim(n) {
  clearTimers()
  resetState()
  if (n === 1) startDrag()
  else         startDayLog()
}

function onSlideChange(n) { startSlideAnim(n) }
function onClose() { clearTimers(); emit('close') }

onMounted(() => { startSlideAnim(1) })
onUnmounted(clearTimers)
</script>

<style scoped>
/* ── Slide 1: calendar mock card ─────────────────────────────────── */
.mock-card {
  width: 100%;
  max-width: 320px;
  background: #fff;
  border: 1px solid #f0d0dc;
  border-radius: 14px;
  padding: 12px 16px 14px;
  box-shadow: 0 4px 14px rgba(180, 40, 80, 0.10);
}
.mock-cal-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-bottom: 8px;
}
.mock-month {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #993556;
}
.mock-weekdays {
  display: flex;
  gap: 3px;
  width: 100%;
  margin-bottom: 4px;
}
.mock-wd {
  flex: 1;
  text-align: center;
  font-size: 9px;
  font-weight: 600;
  color: #c0899b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  user-select: none;
}
.cal-wrap { position: relative; }
.mini-cal {
  display: flex;
  gap: 3px;
  width: 100%;
}
.mc-cell {
  flex: 1;
  aspect-ratio: 1;
  min-width: 0;
  border-radius: 7px;
  border: 1.5px solid transparent;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease, border-color 0.18s ease;
}
.mc-num {
  font-size: clamp(9px, 2.2vw, 14px);
  color: #c0899b;
  line-height: 1;
  user-select: none;
  transition: color 0.18s ease;
}
.mc-cell.drag-filled { background: #F9D0DE; border-color: #D4537E; }
.mc-cell.drag-filled .mc-num { color: #993556; }
.mc-cell.drag-anchor {
  transform: scale(1.18);
  z-index: 2;
  transition: transform 0.12s cubic-bezier(.4, 0, .2, 1);
}
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

/* ── Slide 2: DetailSheet mock ───────────────────────────────────── */
.mock-sheet {
  width: 100%;
  max-width: 320px;
  background: #fff;
  border: 1px solid #f0d0dc;
  border-radius: 18px;
  box-shadow: 0 4px 14px rgba(180, 40, 80, 0.10);
  overflow: hidden;
}
.mock-handle {
  width: 38px;
  height: 4px;
  border-radius: 2px;
  background: #e8c8d4;
  margin: 10px auto 0;
}
.mock-ds-header {
  padding: 10px 16px 10px;
}
.mock-ds-title {
  font-size: 15px;
  font-weight: 600;
  color: #72243E;
  margin: 0 0 2px;
  line-height: 1.3;
}
.mock-ds-subtitle {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #993556;
  margin: 0;
}
.mock-form {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mock-form-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #993556;
  margin: 0 0 8px;
}

/* Flow chips — all always rendered; default tinted, active dark */
.mock-flow-chips { display: flex; gap: 5px; }
.mock-flow-chip {
  flex: 1;
  text-align: center;
  padding: 5px 0;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  background: #F4C0D1;
  color: #993556;
  text-transform: capitalize;
  transition: background 0.22s ease, color 0.22s ease;
}
.mock-flow-chip.active {
  background: #D4537E;
  color: #fff;
}

/* Symptom chips — all always rendered; default light, active dark */
.mock-symptom-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.mock-symptom-chip {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  background: #FBEAF0;
  color: #993556;
  border: 1px solid #F4C0D1;
  transition: background 0.22s ease, color 0.22s ease, border-color 0.22s ease;
}
.mock-symptom-chip.active {
  background: #D4537E;
  color: #fff;
  border-color: #D4537E;
}

/* ── Shared text ─────────────────────────────────────────────────── */
.slide-title { font-size: 20px; font-weight: 700; color: #72243E; margin: 0; text-align: center; }
.slide-body  { font-size: 14.5px; color: #a06070; margin: 0; text-align: center; line-height: 1.65; }
</style>
