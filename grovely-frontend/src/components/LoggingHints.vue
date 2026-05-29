<template>
  <div class="logging-hints">
    <!-- Animation 1: drag to log -->
    <div class="hint-row">
      <div class="mini-cal">
        <div
          v-for="i in 7"
          :key="`d${i}`"
          class="mc-cell"
          :class="{ 'drag-filled': dragFilled.has(i) }"
        >
          <span class="mc-num">{{ i }}</span>
        </div>
      </div>
      <p class="hint-label">
        <v-icon size="11" color="#D4537E">mdi-gesture-swipe-horizontal</v-icon>
        Drag to log a completed period
      </p>
    </div>

    <!-- Animation 2: tap days + bookend close -->
    <div class="hint-row">
      <div class="mini-cal">
        <div
          v-for="i in 7"
          :key="`t${i}`"
          class="mc-cell"
          :class="{
            'tap-filled': tapFilled.has(i),
            'gap-filled': gapFilled.has(i)
          }"
        >
          <span class="mc-num">{{ i }}</span>
        </div>
      </div>
      <p class="hint-label">
        <v-icon size="11" color="#D4537E">mdi-gesture-tap</v-icon>
        Tap days as it happens, then set an end date
      </p>
    </div>

    <!-- Static: ovulation -->
    <p class="hint-label">
      <v-icon size="11" color="#D4537E">mdi-egg-outline</v-icon>
      Tap between cycles to mark ovulation (optional)
    </p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const dragFilled = ref(new Set())
const tapFilled  = ref(new Set())
const gapFilled  = ref(new Set())

const timers = []
const s = (fn, ms) => timers.push(setTimeout(fn, ms))

function runDrag() {
  s(() => { dragFilled.value = new Set([3]) },          400)
  s(() => { dragFilled.value = new Set([3, 4]) },       650)
  s(() => { dragFilled.value = new Set([3, 4, 5]) },    900)
  s(() => { dragFilled.value = new Set([3, 4, 5, 6]) }, 1150)
  s(() => { dragFilled.value = new Set() },             3200)
  s(runDrag,                                            3600)
}

function runTap() {
  s(() => { tapFilled.value = new Set([1]) },           300)
  s(() => { tapFilled.value = new Set([1, 2]) },        1000)
  s(() => { tapFilled.value = new Set([1, 2, 3]) },     1700)
  // user sets end date on day 6 — skipped days 4 & 5
  s(() => { tapFilled.value = new Set([1, 2, 3, 6]) },  2900)
  // gap fill: days 4 and 5 appear automatically
  s(() => { gapFilled.value = new Set([4]) },           3200)
  s(() => { gapFilled.value = new Set([4, 5]) },        3450)
  // reset
  s(() => { tapFilled.value = new Set(); gapFilled.value = new Set() }, 5300)
  s(runTap,                                             5700)
}

onMounted(() => {
  runDrag()
  runTap()
})

onUnmounted(() => timers.forEach(clearTimeout))
</script>

<style scoped>
.logging-hints {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.4rem;
}

.hint-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.mini-cal {
  display: flex;
  gap: 3px;
}

.mc-cell {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 1.5px solid #e8c8d4;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.mc-num {
  font-size: 8px;
  color: #c0899b;
  line-height: 1;
  user-select: none;
  transition: color 0.15s ease;
}

/* Drag fill: smooth sweep, no pulse */
.mc-cell.drag-filled {
  background: #F5A0BC;
  border-color: #D4537E;
}
.mc-cell.drag-filled .mc-num { color: #993556; }

/* Tap fill: pulse on entry */
@keyframes tap-pulse {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.28); }
  100% { transform: scale(1); }
}

.mc-cell.tap-filled {
  background: #F5A0BC;
  border-color: #D4537E;
  animation: tap-pulse 0.28s ease-out;
}
.mc-cell.tap-filled .mc-num { color: #993556; }

/* Gap fill: appear from small */
@keyframes gap-appear {
  0%   { opacity: 0; transform: scale(0.6); }
  100% { opacity: 1; transform: scale(1); }
}

.mc-cell.gap-filled {
  background: #F9D0DE;
  border-color: #D4537E;
  animation: gap-appear 0.22s ease-out;
}
.mc-cell.gap-filled .mc-num { color: #993556; }

.hint-label {
  font-size: 11px;
  color: #c0899b;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  letter-spacing: 0.02em;
}
</style>
