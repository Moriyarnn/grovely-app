<template>
  <div class="period-detail-root">

    <p class="col-label">Cycle Details</p>

    <!-- Phase card -->
    <div v-if="currentPhase" class="phase-card">
      <div class="phase-header">
        <v-icon size="15" :color="currentPhase.color">{{ currentPhase.icon }}</v-icon>
        <span class="phase-name">{{ currentPhase.name }} phase</span>
      </div>
      <p class="phase-note">{{ currentPhase.note }}</p>
    </div>

    <!-- Predictions — fills remaining vertical space -->
    <div v-if="summary" class="predictions-card">
      <p class="predictions-title">Predictions</p>

      <div v-if="summary.currentCycle" class="prediction-row">
        <span class="prediction-label">Period</span>
        <span class="prediction-value prediction-value--active">Active now</span>
      </div>
      <div v-if="summary.nextPeriodDate && !summary.currentCycle" class="prediction-row">
        <span class="prediction-label">Next period</span>
        <span class="prediction-value">
          {{ formatDate(summary.nextPeriodDate) }}
          <span v-if="summary.confidenceWindow" class="prediction-confidence">±{{ summary.confidenceWindow }}d</span>
        </span>
      </div>
      <div v-if="summary.nextFertileWindow && !summary.currentCycle" class="prediction-row">
        <span class="prediction-label">Next fertile window</span>
        <span class="prediction-value">{{ formatDate(summary.nextFertileWindow.start) }}–{{ formatDateShort(summary.nextFertileWindow.end) }}</span>
      </div>
      <div v-if="summary.nextOvulationDate && !summary.currentCycle" class="prediction-row">
        <span class="prediction-label">Ovulation</span>
        <span class="prediction-value">{{ formatDate(summary.nextOvulationDate) }}</span>
      </div>
      <div v-if="summary.avgCycleLength" class="prediction-row">
        <span class="prediction-label">Avg cycle</span>
        <span class="prediction-value">{{ summary.avgCycleLength }} days</span>
      </div>

      <div v-if="summary.isIrregular" class="predictions-irregular">
        <v-icon size="12" color="#993556">mdi-chart-bell-curve</v-icon>
        Irregular cycles — predictions may shift as more data is recorded
      </div>

      <!-- Lock overlay: shown until 3 cycles are tracked -->
      <div v-if="predictionsLocked" class="predictions-lock">
        <v-icon size="20" color="#b0788e">mdi-lock-outline</v-icon>
        <p class="lock-msg">Track {{ 3 - summary.totalCyclesTracked }} more cycle{{ 3 - summary.totalCyclesTracked === 1 ? '' : 's' }} to unlock predictions</p>
      </div>
    </div>

    <!-- Partner read-only notice -->
    <div v-if="isPartner" class="notice-card">
      <v-icon size="14" color="#993556">mdi-eye-outline</v-icon>
      <span class="notice-text">You're viewing as partner — period data is read-only</span>
    </div>

    <!-- Prediction health — always visible -->
    <div class="warnings-card" :class="{ 'warnings-card--clean': !allWarnings.length }">
      <template v-if="allWarnings.length">
        <button class="warnings-header" @click="warningsOpen = !warningsOpen">
          <v-icon size="14" color="#b45309">mdi-alert-outline</v-icon>
          <span class="warnings-title">{{ allWarnings.length }} data issue{{ allWarnings.length > 1 ? 's' : '' }} affecting predictions</span>
          <v-icon size="14" color="#b45309" :style="{ transform: warningsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }">mdi-chevron-down</v-icon>
        </button>
        <ul v-if="warningsOpen" class="warnings-list">
          <li
            v-for="(w, i) in allWarnings"
            :key="i"
            class="warning-item"
            :class="{ 'warning-item-orphan': w.isOrphaned }"
            @click="goToWarning(w)"
          >
            <v-icon v-if="w.isOrphaned" size="11" color="#f97316" style="margin-right:4px;vertical-align:middle">mdi-link-off</v-icon>
            {{ w.message }}
          </li>
        </ul>
      </template>
      <template v-else>
        <div class="warnings-clean">
          <v-icon size="14" color="#16a34a">mdi-check-circle-outline</v-icon>
          <span class="warnings-clean-text">No issues detected — predictions look healthy</span>
        </div>
      </template>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getUser } from '../../api'
import { usePeriodData } from '../../composables/usePeriodData'

const { summary, allWarnings, goToWarning } = usePeriodData()

const currentUser = ref(getUser())
const isPartner = computed(() => currentUser.value?.role === 'partner')

const warningsOpen = ref(false)

const predictionsLocked = computed(() =>
  summary.value !== null && (summary.value.totalCyclesTracked ?? 0) < 3
)

const cycleDayNum = computed(() => {
  if (!summary.value) return null
  const s = summary.value
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let lastStart = null
  if (s.currentCycle) {
    lastStart = new Date(s.currentCycle.start_date + 'T00:00:00')
  } else if (s.nextPeriodDate && s.avgCycleLength) {
    lastStart = new Date(s.nextPeriodDate + 'T00:00:00')
    lastStart.setDate(lastStart.getDate() - s.avgCycleLength)
  }
  if (!lastStart) return null
  const dayNum = Math.floor((today - lastStart) / 86400000) + 1
  const maxDay = (s.avgCycleLength || 35) + 14
  return (dayNum >= 1 && dayNum <= maxDay) ? dayNum : null
})

const currentPhase = computed(() => {
  if (!summary.value || cycleDayNum.value === null) return null
  const s = summary.value
  const day = cycleDayNum.value
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  if (s.currentCycle && day >= 1 && day <= 7) {
    return { name: 'Menstrual', note: 'Rest and warmth. Energy is lower — that\'s normal.', icon: 'mdi-water', color: '#993556' }
  }
  if (!s.currentCycle && s.ovulationDate === todayStr) {
    return { name: 'Ovulatory', note: 'Peak energy and confidence. Great day to be social.', icon: 'mdi-brightness-5', color: '#d4537e' }
  }
  if (!s.currentCycle && s.fertileWindow) {
    const fStart = new Date(s.fertileWindow.start + 'T00:00:00')
    const fEnd   = new Date(s.fertileWindow.end   + 'T00:00:00')
    if (today >= fStart && today <= fEnd) {
      return { name: 'Ovulatory', note: 'Peak energy and confidence. Great day to be social.', icon: 'mdi-brightness-5', color: '#d4537e' }
    }
  }
  if (day >= 6 && day <= 13) {
    return { name: 'Follicular', note: 'Energy builds. Good time to start new things.', icon: 'mdi-flower-tulip', color: '#c084c6' }
  }
  if (day >= 15) {
    return { name: 'Luteal', note: 'Wind down. Comfort and reflection.', icon: 'mdi-moon-waning-crescent', color: '#7c6fcd' }
  }
  return null
})

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric' })
}
</script>

<style scoped>
.period-detail-root {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: calc(100vh - 2.5rem);
  box-sizing: border-box;
}

@media (max-width: 1279px) {
  .period-detail-root { height: 100%; overflow-y: auto; min-height: unset; }
}

.col-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #b0788e;
  margin: 0;
  flex-shrink: 0;
}

/* Phase card */
.phase-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 14px 16px;
  flex-shrink: 0;
}
.phase-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.phase-name {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #993556;
}
.phase-note {
  font-size: 13px;
  color: #72243E;
  margin: 0;
  line-height: 1.5;
}

/* Predictions — expands to fill available space */
.predictions-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 18px 20px;
  flex: 1;
  position: relative;
  overflow: hidden;
}
.predictions-lock {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(253, 245, 248, 0.88);
  backdrop-filter: blur(3px);
  border-radius: 14px;
}
.lock-msg {
  font-size: 12px;
  color: #b0788e;
  text-align: center;
  margin: 0;
  padding: 0 24px;
  line-height: 1.5;
}
.predictions-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #993556;
  margin: 0 0 14px;
}
.prediction-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 8px 0;
  border-bottom: 1px solid var(--panel-border);
}
.prediction-row:last-of-type {
  border-bottom: none;
}
.prediction-label {
  font-size: 12px;
  color: #b0788e;
}
.prediction-value {
  font-size: 13px;
  font-weight: 500;
  color: #72243E;
}
.prediction-value--active {
  color: #993556;
}
.prediction-confidence {
  font-size: 11px;
  color: #b0788e;
  margin-left: 3px;
}
.predictions-irregular {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #993556;
  margin-top: 14px;
  line-height: 1.4;
}

/* Partner notice */
.notice-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #FDF2F5;
  border: 1px solid #F4C0D1;
  border-radius: 12px;
  padding: 10px 12px;
  flex-shrink: 0;
}
.notice-text { font-size: 12px; color: #72243E; line-height: 1.4; }

/* Prediction health card */
.warnings-card {
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}
.warnings-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}
.warnings-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
}
.warnings-list {
  margin: 0;
  padding: 0 12px 10px 12px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}
.warning-item {
  font-size: 11px;
  color: #92400e;
  line-height: 1.5;
  padding: 6px 8px;
  border-left: 2px solid #fcd34d;
  cursor: pointer;
  border-radius: 0 4px 4px 0;
  transition: background 0.15s;
}
.warning-item:hover {
  background: #fef3c7;
}
.warning-item-orphan {
  border-left-color: #fb923c;
  color: #9a3412;
}
.warnings-card--clean {
  background: #f0fdf4;
  border-color: #86efac;
}
.warnings-clean {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
}
.warnings-clean-text {
  font-size: 12px;
  font-weight: 600;
  color: #16a34a;
}
</style>
