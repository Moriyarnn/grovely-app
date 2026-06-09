<template>
  <div class="period-detail-root">

    <p class="col-label">Cycle Details</p>

    <!-- Phase card — always visible -->
    <!-- // PREMIUM GATE (frontend) — free users with cycle data see a sample teaser (no real phase leaked); CTA opens PremiumGate. -->
    <div class="phase-card" :class="{ 'phase-card--empty': !currentPhase }">
      <div class="phase-title-row">
        <div class="phase-title-left">
          <p class="phase-section-title">Current Phase</p>
          <span v-if="periodEndsLabel && isPremium" class="phase-ends-label">{{ periodEndsLabel }}</span>
        </div>
        <!-- Locked teaser: Example pill + Premium pill, matching the PeriodPremiumPanel badge convention -->
        <template v-if="isLockedTeaserShown">
          <div class="phase-pill-group">
            <span class="phase-pill phase-pill--example">Example</span>
            <span class="phase-pill phase-pill--locked">
              <v-icon size="9" color="#b0788e">mdi-lock-outline</v-icon>
              Premium
            </span>
          </div>
        </template>
        <!-- Premium user, anchored on logged data but phase is modelled (not directly observed) -->
        <span
          v-else-if="phaseConfidence === 'calculated' && isPremium"
          class="phase-pill phase-pill--prediction phase-pill--has-tip"
          @touchstart.passive="onBadgeTouchStart('calculated')"
          @touchend.passive="onBadgeTouchEnd"
        >
          Calculated
          <span class="phase-pill-tip">Calculated from your logged cycle start using average phase lengths. Treat as a guide, real ovulation timing varies.</span>
        </span>
        <!-- Premium user: anchor itself is forecasted from history -->
        <span
          v-else-if="phaseConfidence === 'predicted' && isPremium"
          class="phase-pill phase-pill--prediction phase-pill--has-tip"
          @touchstart.passive="onBadgeTouchStart('predicted')"
          @touchend.passive="onBadgeTouchEnd"
        >
          Predicted
          <span class="phase-pill-tip">Predicted from your historical pattern because no period is logged yet for this cycle. Updates as soon as you log a day.</span>
        </span>
      </div>

      <!-- Locked teaser: sample Follicular phase, no real data leaked, single CTA -->
      <div v-if="isLockedTeaserShown" class="phase-locked-teaser" @click="premiumGateOpen = true">
        <!-- Sample illustration — dimmed so it reads as a demo, not live data -->
        <div class="phase-locked-sample">
          <div class="phase-bar-wrap">
            <div class="phase-bar">
              <div class="phase-seg phase-seg--menstrual"></div>
              <div class="phase-seg phase-seg--follicular phase-seg--active"></div>
              <div class="phase-seg phase-seg--ovulatory"></div>
              <div class="phase-seg phase-seg--luteal"></div>
            </div>
            <div class="phase-bar-labels">
              <span class="pbl pbl--menstrual" style="flex:5">Men.</span>
              <span class="pbl pbl--follicular" style="flex:8">Follicular</span>
              <span class="pbl pbl--ovulatory" style="flex:2">Ov.</span>
              <span class="pbl pbl--luteal" style="flex:13">Luteal</span>
            </div>
          </div>
          <div class="phase-header">
            <v-icon size="15" color="#c084c6">mdi-flower-tulip</v-icon>
            <span class="phase-name" style="color:#c084c6">Follicular phase</span>
          </div>
          <p class="phase-note">Energy builds. Good time to start new things.</p>
        </div>

        <p class="phase-locked-pitch">Daily phase guidance, with honest confidence labels for what's calculated and what's predicted.</p>
        <p class="phase-locked-hint">Tap to see what's included <span aria-hidden="true">›</span></p>
      </div>

      <!-- Real phase content (premium users, logged Menstrual, or empty state for new users) -->
      <div v-else class="phase-content-wrap">
        <div class="phase-bar-wrap">
          <div class="phase-bar">
            <div class="phase-seg phase-seg--menstrual" :class="{ 'phase-seg--active': currentPhase?.name === 'Menstrual' }"></div>
            <div class="phase-seg phase-seg--follicular" :class="{ 'phase-seg--active': currentPhase?.name === 'Follicular' }"></div>
            <div class="phase-seg phase-seg--ovulatory" :class="{ 'phase-seg--active': currentPhase?.name === 'Ovulatory' }"></div>
            <div class="phase-seg phase-seg--luteal" :class="{ 'phase-seg--active': currentPhase?.name === 'Luteal' }"></div>
          </div>
          <div v-if="currentPhase" class="phase-indicator" :style="{ left: phaseMarkerLeft, borderBottomColor: currentPhase.color }"></div>
          <div class="phase-bar-labels">
            <span class="pbl pbl--menstrual" style="flex:5">Men.</span>
            <span class="pbl pbl--follicular" style="flex:8">Follicular</span>
            <span class="pbl pbl--ovulatory" style="flex:2">Ov.</span>
            <span class="pbl pbl--luteal" style="flex:13">Luteal</span>
          </div>
        </div>

        <template v-if="currentPhase">
          <div class="phase-header">
            <v-icon size="15" :color="currentPhase.color">{{ currentPhase.icon }}</v-icon>
            <span class="phase-name">{{ currentPhase.name }} phase</span>
          </div>
          <p class="phase-note">{{ currentPhase.note }}</p>
        </template>
        <template v-else>
          <div class="phase-empty">
            <v-icon size="14" color="#b0788e">mdi-moon-waning-crescent</v-icon>
            <span class="phase-empty-text">Start logging to see your current phase</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Mobile long-press dialog — info for the Calculated / Predicted badges (premium only) -->
    <v-dialog v-model="predictionDialogOpen" max-width="320">
      <v-card class="prediction-dialog">
        <v-card-text>
          <p class="prediction-dialog-title">{{ predictionDialogKind === 'predicted' ? 'Predicted phase' : 'Calculated phase' }}</p>
          <p class="prediction-dialog-body">
            <template v-if="predictionDialogKind === 'predicted'">
              Predicted from your historical pattern because no period is logged yet for this cycle. Updates as soon as you log a day.
            </template>
            <template v-else>
              Calculated from your logged cycle start using average phase lengths. Treat as a guide, real ovulation timing varies.
            </template>
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" color="#993556" @click="predictionDialogOpen = false">Got it</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <PremiumGate :open="premiumGateOpen" theme="pink" @update:open="premiumGateOpen = $event" />

    <!-- Predictions — fills remaining vertical space -->
    <div v-if="summary" class="predictions-card">
      <p class="predictions-title">Predictions</p>

      <div v-if="summary.nextPeriodDate" class="prediction-row">
        <span class="prediction-label">Next period</span>
        <span class="prediction-value">
          {{ formatDate(summary.nextPeriodDate) }}
          <span v-if="summary.confidenceWindow" class="prediction-confidence">±{{ summary.confidenceWindow }}d</span>
        </span>
      </div>
      <div v-if="displayFertileWindow" class="prediction-row">
        <span class="prediction-label">Fertile window</span>
        <span class="prediction-value">{{ formatDate(displayFertileWindow.start) }}–{{ formatDateShort(displayFertileWindow.end) }}</span>
      </div>
      <div v-if="displayOvulationDate" class="prediction-row">
        <span class="prediction-label">Ovulation</span>
        <span class="prediction-value">{{ formatDate(displayOvulationDate) }}</span>
      </div>
      <div v-if="summary.avgCycleLength" class="prediction-row">
        <span class="prediction-label">Avg cycle</span>
        <span class="prediction-value">{{ summary.avgCycleLength }} days</span>
      </div>

      <div v-if="summary.isIrregular" class="predictions-irregular">
        <v-icon size="12" color="#993556">mdi-chart-bell-curve</v-icon>
        Irregular cycles — predictions may shift as more data is recorded
      </div>

      <!-- Lock overlay: shown until minCyclesRequired cycles are tracked -->
      <div v-if="predictionsLocked" class="predictions-lock">
        <v-icon size="20" color="#b0788e">mdi-lock-outline</v-icon>
        <p class="lock-msg">Track {{ (summary.minCyclesRequired ?? 3) - summary.totalCyclesTracked }} more cycle{{ (summary.minCyclesRequired ?? 3) - summary.totalCyclesTracked === 1 ? '' : 's' }} to unlock predictions</p>
      </div>
    </div>

    <!-- Partner read-only notice -->
    <div v-if="isPartner" class="notice-card">
      <v-icon size="14" color="#993556">mdi-eye-outline</v-icon>
      <span class="notice-text">You're viewing as partner — period data is read-only</span>
    </div>

    <!-- Prediction health — always visible -->
    <div class="warnings-card" :class="{ 'warnings-card--clean': !activeWarnings.length }">
      <p class="warnings-section-title">Prediction Health</p>
      <template v-if="activeWarnings.length">
        <button class="warnings-header" @click="warningsOpen = !warningsOpen">
          <v-icon size="14" color="#b45309">mdi-alert-outline</v-icon>
          <span class="warnings-title">{{ activeWarnings.length }} data issue{{ activeWarnings.length > 1 ? 's' : '' }} affecting predictions</span>
          <v-icon size="14" color="#b45309" :style="{ transform: warningsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }">mdi-chevron-down</v-icon>
        </button>
        <AppScroller v-if="warningsOpen" theme="pink" class="warnings-list">
          <li
            v-for="(w, i) in activeWarnings"
            :key="i"
            class="warning-item"
            :class="{ 'warning-item-orphan': w.isOrphaned }"
            @click="onWarningClick(w)"
          >
            <v-icon v-if="w.isOrphaned" size="11" color="#f97316" style="margin-right:4px;vertical-align:middle">mdi-link-off</v-icon>
            {{ w.message }}
            <span class="warning-item-review">Review →</span>
          </li>
        </AppScroller>
        <p v-if="warningsOpen && activeWarnings.some(w => w.cycleId)" class="warnings-tap-hint">
          <v-icon size="11" color="#b45309">mdi-gesture-tap</v-icon>
          Tap the highlighted cycle on the calendar to resolve
        </p>
      </template>
      <template v-else>
        <div class="warnings-clean">
          <v-icon size="14" color="#16a34a">mdi-check-circle-outline</v-icon>
          <span class="warnings-clean-text">No issues detected — predictions look healthy</span>
        </div>
      </template>
      <!-- Acknowledged warnings — audit trail, always collapsed -->
      <template v-if="acknowledgedWarnings.length">
        <button class="warnings-header warnings-header--ack" @click="acknowledgedOpen = !acknowledgedOpen">
          <v-icon size="13" color="#94a3b8">mdi-eye-outline</v-icon>
          <span class="warnings-title warnings-title--ack">{{ acknowledgedWarnings.length }} acknowledged</span>
          <v-icon size="13" color="#94a3b8" :style="{ transform: acknowledgedOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }">mdi-chevron-down</v-icon>
        </button>
        <AppScroller v-if="acknowledgedOpen" theme="pink" class="warnings-list">
          <li
            v-for="(w, i) in acknowledgedWarnings"
            :key="i"
            class="warning-item warning-item--ack"
            @click="onWarningClick(w)"
          >
            <span class="warning-ack-badge">{{ w.reviewState === 'confirmed' ? 'Confirmed' : 'Excluded' }}</span>
            {{ w.message }}
          </li>
        </AppScroller>
      </template>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import AppScroller from '@/components/ui/AppScroller.vue'
import PremiumGate from '@/components/PremiumGate.vue'
import { getUser } from '../../api'
import { usePeriodData } from '../../composables/usePeriodData'
import { useLicense } from '../../composables/useLicense'

const { summary, allCycles, allWarnings, goToWarning } = usePeriodData()
const layoutGoTo = inject('appLayoutGoTo', null)

function onWarningClick(w) {
  goToWarning(w)
  if (layoutGoTo) layoutGoTo(0)
}
const { licenseActive, fetchLicenseStatus } = useLicense()
const isPremium = computed(() => licenseActive.value === true)

onMounted(() => { fetchLicenseStatus() })

const activeWarnings = computed(() => allWarnings.value.filter(w => !w.reviewState))
const acknowledgedWarnings = computed(() => allWarnings.value.filter(w => w.reviewState))

const todayStr = new Date().toISOString().split('T')[0]
const currentUser = ref(getUser())
const isPartner = computed(() => currentUser.value?.role === 'owner2')

const warningsOpen = ref(false)
const acknowledgedOpen = ref(false)
const premiumGateOpen = ref(false)
const predictionDialogOpen = ref(false)
const predictionDialogKind = ref('calculated')   // 'calculated' | 'predicted' — drives the long-press dialog body

let longPressTimer = null
function onBadgeTouchStart(kind = 'calculated') {
  predictionDialogKind.value = kind
  longPressTimer = setTimeout(() => { predictionDialogOpen.value = true }, 700)
}
function onBadgeTouchEnd() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
}

const predictionsLocked = computed(() =>
  summary.value !== null && (summary.value.totalCyclesTracked ?? 0) < (summary.value.minCyclesRequired ?? 3)
)

// Non-premium user with cycle data → show the sample teaser instead of the real phase content.
// Gate on !isPremium (not licenseActive === false) so that while the license status is still
// loading (licenseActive === null) or the status fetch fails, we treat the user as locked and
// never leak the real calculated/predicted phase. New users (no anchor yet) keep the empty state.
const isLockedTeaserShown = computed(() =>
  phaseConfidence.value !== null &&
  phaseConfidence.value !== 'logged' &&
  !isPremium.value
)

// Most recent cycle by start_date — used as the authoritative cycle start for phase/prediction logic
// even when currentCycle is null (e.g. gap in day-by-day logging)
const recentCycle = computed(() => {
  if (!allCycles.value.length) return null
  return allCycles.value
    .filter(c => c.review_state !== 'excluded')
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null
})

// Day 1 of the cycle today belongs to.
// Three cases, in priority order:
//   1. There's an actively logged cycle → its raw start_date (always wins over predictions).
//   2. A missed prediction exists (predicted period passed without being logged) → anchor to the most recent one.
//   3. Otherwise → the most recent logged cycle's raw start_date (Luteal tail of the previous one).
const phaseAnchorDate = computed(() => {
  const s = summary.value
  if (!s) return null
  if (s.currentCycle) return s.currentCycle.start_date
  const maxDay = (s.avgCycleLength || 35) + 14
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const recent = (s.missedPredictions ?? [])
    .filter(m => {
      const d = new Date(m.startDate + 'T00:00:00')
      return Math.floor((today - d) / 86400000) < maxDay
    })
  if (recent.length) return recent[recent.length - 1].startDate
  const latest = allCycles.value.length
    ? allCycles.value.reduce((a, b) => (a.start_date > b.start_date ? a : b))
    : null
  return latest?.start_date ?? null
})

// Source of the displayed phase:
//   'predicted' — anchor came from summary.nextPeriodDate (no log yet for this cycle)
//   'calculated' — anchor is a real logged start, but the bucket model is averaged (not directly observed)
//   'logged' — Menstrual on a day the user actually logged (the only directly observed phase)
const phaseConfidence = computed(() => {
  const s = summary.value
  if (!s || cycleDayNum.value === null) return null
  const cc = s.currentCycle
  if (cc) {
    if (cc.start_date <= todayStr && (cc.end_date ?? cc.start_date) >= todayStr && currentPhase.value?.name === 'Menstrual') {
      return 'logged'
    }
    return 'calculated'
  }
  const maxDay = (s.avgCycleLength || 35) + 14
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const hasRecentMissed = (s.missedPredictions ?? []).some(m =>
    Math.floor((now - new Date(m.startDate + 'T00:00:00')) / 86400000) < maxDay
  )
  if (hasRecentMissed) return 'predicted'
  return 'calculated'
})

const cycleDayNum = computed(() => {
  if (!phaseAnchorDate.value) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(phaseAnchorDate.value + 'T00:00:00')
  const dayNum = Math.floor((today - start) / 86400000) + 1
  const maxDay = (summary.value?.avgCycleLength || 35) + 14
  return (dayNum >= 1 && dayNum <= maxDay) ? dayNum : null
})

const currentPhase = computed(() => {
  if (cycleDayNum.value === null) return null
  const cc = summary.value?.currentCycle
  if (cc && (cc.end_date ?? cc.start_date) >= todayStr) {
    return { name: 'Menstrual', note: 'Rest and warmth. Energy is lower — that\'s normal.', icon: 'mdi-water', color: '#993556' }
  }
  const day = cycleDayNum.value
  const [men, fol, ov] = phaseSegments.value
  if (day <= men.endDay) return { name: 'Menstrual',  note: 'Rest and warmth. Energy is lower — that\'s normal.',    icon: 'mdi-water',                color: '#993556' }
  if (day <= fol.endDay) return { name: 'Follicular', note: 'Energy builds. Good time to start new things.',          icon: 'mdi-flower-tulip',         color: '#c084c6' }
  if (day <= ov.endDay)  return { name: 'Ovulatory',  note: 'Peak energy and confidence. Great day to be social.',    icon: 'mdi-brightness-5',         color: '#d4537e' }
  return                        { name: 'Luteal',      note: 'Wind down. Comfort and reflection.',                     icon: 'mdi-moon-waning-crescent', color: '#7c6fcd' }
})


const displayFertileWindow = computed(() => {
  const s = summary.value
  const todayStr = new Date().toISOString().split('T')[0]
  const rc = recentCycle.value
  if (rc?.predicted_fertile_start && rc?.predicted_fertile_end) {
    if (rc.predicted_fertile_end >= todayStr) {
      return { start: rc.predicted_fertile_start, end: rc.predicted_fertile_end }
    }
  }
  const upcoming = (s?.missedPredictions ?? []).find(m => m.fertileWindow.end >= todayStr)
  if (upcoming) return upcoming.fertileWindow
  return s?.nextFertileWindow ?? null
})

const displayOvulationDate = computed(() => {
  const s = summary.value
  const todayStr = new Date().toISOString().split('T')[0]
  const rc = recentCycle.value
  if (rc?.predicted_ovulation_date) {
    if (rc.predicted_ovulation_date >= todayStr) return rc.predicted_ovulation_date
  }
  const upcoming = (s?.missedPredictions ?? []).find(m => m.ovulationDate >= todayStr)
  if (upcoming) return upcoming.ovulationDate
  return s?.nextOvulationDate ?? null
})

const predictedCurrentPeriodEnd = computed(() => {
  const s = summary.value
  if (!s?.avgPeriodLength || !recentCycle.value) return null
  const cycle = s?.currentCycle
    ? allCycles.value.find(c => c.id === s.currentCycle.id) ?? recentCycle.value
    : recentCycle.value
  const end = new Date(cycle.start_date + 'T00:00:00')
  end.setDate(end.getDate() + s.avgPeriodLength - 1)
  const todayStr = new Date().toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]
  return endStr >= todayStr ? endStr : null
})

// Inline "ends in X days" label shown next to Current Phase title.
// Menstrual uses the date-anchored predictedCurrentPeriodEnd (avgPeriodLength — most accurate).
// All other phases derive remaining days from the phaseSegments day boundaries.
const periodEndsLabel = computed(() => {
  const phase = currentPhase.value
  if (!phase || cycleDayNum.value === null) return null

  let daysRemaining = null

  if (phase.name === 'Menstrual') {
    const s = summary.value
    if (!s?.avgPeriodLength || !phaseAnchorDate.value) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const end = new Date(phaseAnchorDate.value + 'T00:00:00')
    end.setDate(end.getDate() + s.avgPeriodLength - 1)
    daysRemaining = Math.round((end.getTime() - today.getTime()) / 86400000)
  } else {
    const seg = phaseSegments.value.find(s => s.name === phase.name)
    if (!seg) return null
    daysRemaining = seg.endDay - cycleDayNum.value
  }

  if (daysRemaining === null) return null
  if (daysRemaining <= 0) return '~ ends today.'
  if (daysRemaining === 1) return '~ ends in 1 day.'
  return `~ ends in ${daysRemaining} days.`
})

// Phase day boundaries derived from the user's actual averages.
// The bar's visual flex weights (5/8/2/13) stay fixed — only the day→position mapping inside
// each zone is personalized. Ovulatory day = avgCycleLength − avgLutealPhase.
// When an active period exceeds avgPeriodLength the Menstrual marker clamps at the zone edge,
// communicating "period running longer than expected" without distorting the bar geometry.
const phaseSegments = computed(() => {
  const s = summary.value
  const menstrualEnd  = Math.max(1, s?.avgPeriodLength  ?? 5)
  const avgCycle      = Math.max(20, s?.avgCycleLength  ?? 28)
  const avgLuteal     = Math.max(7,  s?.avgLutealPhase  ?? 14)
  // Derive ovulatory day from the same source the calendar uses:
  // the cycle's stored predicted_ovulation_date, or summary.nextOvulationDate
  // for predicted cycles with no DB row yet.
  let ovulatoryDay = Math.max(menstrualEnd + 2, avgCycle - avgLuteal)
  const anchor = phaseAnchorDate.value
  if (anchor) {
    const missed = s?.missedPredictions ?? []
    const ovDate = missed.length
      ? missed[missed.length - 1].ovulationDate
      : (recentCycle.value?.ovulation_date ?? recentCycle.value?.predicted_ovulation_date)
    if (ovDate) {
      const anchorMs = new Date(anchor + 'T00:00:00').getTime()
      const ovMs = new Date(ovDate + 'T00:00:00').getTime()
      const derived = Math.round((ovMs - anchorMs) / 86400000) + 1
      if (derived > menstrualEnd + 1) ovulatoryDay = derived
    }
  }
  return [
    { name: 'Menstrual',  startPct: 0,          endPct: 5/28*100,   startDay: 1,                endDay: menstrualEnd      },
    { name: 'Follicular', startPct: 5/28*100,   endPct: 13/28*100,  startDay: menstrualEnd + 1, endDay: ovulatoryDay - 1  },
    { name: 'Ovulatory',  startPct: 13/28*100,  endPct: 15/28*100,  startDay: ovulatoryDay,     endDay: ovulatoryDay      },
    { name: 'Luteal',     startPct: 15/28*100,  endPct: 100,        startDay: ovulatoryDay + 1, endDay: avgCycle          },
  ]
})

const phaseMarkerLeft = computed(() => {
  if (!currentPhase.value || cycleDayNum.value === null) return '0%'
  const day = cycleDayNum.value
  const seg = phaseSegments.value.find(s => s.name === currentPhase.value.name)
  if (!seg) return '50%'
  const phaseDays  = Math.max(1, seg.endDay - seg.startDay + 1)
  const dayInPhase = Math.min(Math.max(0, day - seg.startDay), phaseDays - 1)
  const dayWidth   = (seg.endPct - seg.startPct) / phaseDays
  const pct        = seg.startPct + dayWidth * (dayInPhase + 0.5)
  return pct.toFixed(2) + '%'
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
  min-height: calc(100dvh - 2.5rem);
  box-sizing: border-box;
}

@media (max-width: 1439px) {
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
  position: relative;
}

@media (min-width: 1024px) {
  .phase-card { min-height: 160px; }
}
.phase-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 20px;
  margin-bottom: 10px;
}
.phase-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #993556;
  margin: 0;
}
.phase-title-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.phase-ends-label {
  font-size: 10px;
  font-weight: 500;
  color: #b0788e;
}
/* Locked teaser — entire card is the affordance; pitch + hint match the card's typography. */
.phase-locked-teaser {
  cursor: pointer;
}
/* Sample illustration: full vibrance — pills and hint do the "this isn't yours" framing.
   pointer-events:none so the inner bar doesn't intercept the card-level click target. */
.phase-locked-sample {
  pointer-events: none;
}
.phase-locked-pitch {
  font-size: 13px;
  font-style: italic;
  color: #a06070;
  line-height: 1.5;
  margin: 12px 0 6px;
}
.phase-locked-hint {
  font-size: 11.5px;
  font-weight: 600;
  color: #993556;
  letter-spacing: 0.02em;
  margin: 0;
  text-align: right;
  opacity: 0.85;
}
.phase-locked-hint span {
  display: inline-block;
  transform: translateY(-0.5px);
  margin-left: 2px;
  font-weight: 700;
}
.phase-pill-group {
  display: inline-flex;
  gap: 4px;
}
.phase-pill--example {
  background: #f7eaef;
  border-color: #e1c1cc;
  color: #b0788e;
  font-style: italic;
  letter-spacing: 0.04em;
}
.phase-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  border: 1px solid;
}
.phase-pill--locked {
  background: #fdf5f7;
  border-color: #e8c4cf;
  color: #b0788e;
}
.phase-pill--prediction {
  background: #fbeaf0;
  border-color: #d4879e;
  color: #993556;
  cursor: default;
}
.phase-pill--has-tip {
  position: relative;
}
.phase-pill-tip {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 200px;
  background: rgba(94, 28, 52, 0.92);
  color: #fbeaf0;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  padding: 8px 11px;
  border-radius: 14px;
  pointer-events: none;
  white-space: normal;
  z-index: 10;
  letter-spacing: 0.01em;
  text-transform: none;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px) scale(0.93);
  transform-origin: top right;
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.2s;
}
.phase-pill-tip::before {
  content: '';
  position: absolute;
  top: -5px;
  right: 14px;
  border: 5px solid transparent;
  border-bottom-color: rgba(94, 28, 52, 0.92);
  border-top: none;
}
.phase-pill--has-tip:hover .phase-pill-tip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
}
.prediction-dialog-title {
  font-size: 14px;
  font-weight: 700;
  color: #993556;
  margin: 0 0 8px;
}
.prediction-dialog-body {
  font-size: 13px;
  color: #72243E;
  line-height: 1.5;
  margin: 0;
}
/* Phase bar */
.phase-bar-wrap {
  position: relative;
  padding-bottom: 22px;
  margin-bottom: 10px;
}
.phase-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
}
.phase-seg {
  opacity: 0.18;
  transition: opacity 0.3s;
}
.phase-seg--active { opacity: 1; }
.phase-seg--menstrual  { flex: 5;  background: #993556; }
.phase-seg--follicular { flex: 8;  background: #c084c6; }
.phase-seg--ovulatory  { flex: 2;  background: #d4537e; }
.phase-seg--luteal     { flex: 13; background: #7c6fcd; }
.phase-indicator {
  position: absolute;
  top: 10px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 6px solid #993556;
  transform: translateX(-50%);
  transition: left 0.45s cubic-bezier(0.22, 1, 0.36, 1), border-bottom-color 0.45s ease;
}
.phase-bar-labels {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
}
.pbl {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.35;
  overflow: hidden;
  white-space: nowrap;
}
.pbl--menstrual  { color: #993556; }
.pbl--follicular { color: #c084c6; }
.pbl--ovulatory  { color: #d4537e; text-align: center; }
.pbl--luteal     { color: #7c6fcd; }

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
.phase-empty {
  display: flex;
  align-items: center;
  gap: 6px;
}
.phase-empty-text {
  font-size: 12px;
  color: #b0788e;
}
.phase-card--empty {
  opacity: 0.75;
}

/* Predictions — expands to fill available space */
.predictions-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 14px 16px;
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
.prediction-value--predicted {
  color: #b0788e;
  font-style: italic;
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
.warnings-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #b45309;
  margin: 0;
  padding: 10px 12px 0;
}
.warnings-card--clean .warnings-section-title {
  color: #16a34a;
}
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
.warning-item-review {
  display: inline-block;
  margin-left: 6px;
  font-size: 10px;
  font-weight: 600;
  color: #993556;
  opacity: 0.7;
}
.warnings-tap-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #b45309;
  opacity: 0.7;
  margin: 0;
  padding: 0 12px 10px;
}
.warnings-header--ack {
  border-top: 1px solid #fcd34d;
  margin-top: 2px;
}
.warnings-card--clean .warnings-header--ack {
  border-top-color: #86efac;
}
.warnings-title--ack {
  color: #94a3b8;
}
.warning-item--ack {
  opacity: 0.5;
  border-left-color: #cbd5e1;
  color: #64748b;
  cursor: pointer;
}
.warning-item--ack:hover {
  background: #f8fafc;
}
.warning-ack-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #92400e;
  background: #fef3c7;
  border-radius: 4px;
  padding: 1px 5px;
  margin-right: 5px;
  vertical-align: middle;
}
</style>
