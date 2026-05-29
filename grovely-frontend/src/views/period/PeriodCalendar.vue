<template>
  <div class="period-column-root">
    <div class="period-wrapper">

        <!-- Header -->
        <div class="period-header">
          <h1 class="period-title">Period Tracker</h1>
          <button class="settings-icon-btn" @click="tutorialOpen = true" aria-label="Open tutorial">
            <v-icon size="20" color="#993556">mdi-help-circle</v-icon>
          </button>
          <!-- Premium-only second help button — opens the phase explainer. Unlocked-lock corner badge signals premium content. -->
          <button
            v-if="isPremium"
            class="settings-icon-btn settings-icon-btn--premium"
            @click="premiumTutorialOpen = true"
            aria-label="Open premium features tutorial"
          >
            <v-icon size="20" color="#993556">mdi-help-circle</v-icon>
            <span class="premium-corner-badge">
              <v-icon size="9" color="#fff">mdi-lock-open-outline</v-icon>
            </span>
          </button>
          <button class="back-chip back-chip--mobile-only" @click="$router.push('/')">
            <v-icon size="14" color="#993556">mdi-chevron-left</v-icon>
            Hub
          </button>
        </div>

        <!-- Month navigation -->
        <div class="month-nav">
          <button class="month-btn" @click="prevMonth">
            <v-icon size="18" color="#993556">mdi-chevron-left</v-icon>
          </button>
          <p class="month-label">
            <v-icon size="14" color="#72243E">mdi-calendar-month</v-icon>
            {{ monthLabel }}
          </p>
          <button class="month-btn" @click="nextMonth">
            <v-icon size="18" color="#993556">mdi-chevron-right</v-icon>
          </button>
        </div>

        <!-- Calendar -->
        <div class="calendar">
          <!-- Day of week headers -->
          <div class="cal-header-row">
            <span v-for="d in ['Su','Mo','Tu','We','Th','Fr','Sa']" :key="d" class="cal-dow">{{ d }}</span>
          </div>

          <!-- Day cells -->
          <div class="cal-grid-wrap">
          <Transition :name="slideDirection">
          <div
            :key="viewYear + '-' + viewMonth"
            class="cal-grid"
            :class="{ 'cal-grid-dragging': isDragging }"
            @touchstart.prevent="onTouchStart"
            @touchmove.prevent="onTouchMove"
            @touchend="onTouchEnd"
          >
            <div
              v-for="(cell, i) in calendarCells"
              :key="i"
              class="cal-cell"
              :class="getCellClass(cell, i)"
:data-date="cell.dateStr"
              @mousedown="cell.day ? onCellMouseDown(cell, $event) : null"
              @mouseenter="onCellMouseEnter(cell)"
            >
              <span v-if="cell.day" class="cal-day-num">{{ cell.day }}</span>
              <span v-if="cell.dateStr && justSaved.has(cell.dateStr)" class="cal-saved-check">✓</span>
              <span v-if="cell.day && (hasDataWarning(cell) || hasOrphanedData(cell) || (hasInfo(cell) && (!isPartner || partnerCanReadNotes)))" class="cal-cell-badges">
                <span v-if="hasDataWarning(cell)" class="cal-cell-badge cal-cell-badge-warn">
                  <v-icon size="18" color="#f59e0b">mdi-alert</v-icon>
                </span>
                <span v-if="hasOrphanedData(cell)" class="cal-cell-badge cal-cell-badge-orphan">
                  <v-icon size="18" color="#f97316">mdi-link-off</v-icon>
                </span>
                <span v-if="hasInfo(cell) && (!isPartner || partnerCanReadNotes)" class="cal-cell-badge cal-cell-badge-note">
                  <v-icon size="18" color="#94a3b8">mdi-note-text</v-icon>
                </span>
              </span>
            </div>
          </div>
          </Transition>
          </div>
        </div>

        <!-- Legend -->
        <div class="legend">
          <div class="legend-item">
            <span class="legend-dot period-dot" />
            <span class="legend-text">Period</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot predicted-dot" />
            <span class="legend-text">Predicted</span>
          </div>
          <div v-if="preferences.period_show_fertile_window !== '0'" class="legend-item">
            <span class="legend-dot fertile-dot" />
            <span class="legend-text">Fertile</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot ovulation-dot" />
            <span class="legend-text">Ovulation</span>
          </div>
        </div>

        <!-- Medical disclaimer (all users) -->
        <p class="prediction-disclaimer">
          Calculated and predicted days, including the fertile window and ovulation, are estimates for personal planning, not medical or contraceptive advice.
        </p>

        <!-- How-to hints -->
        <template v-if="!isPartner">
          <div class="cal-hints">
            <p class="cal-hints-title">How to log</p>
            <p class="cal-hint">
              <v-icon size="14" color="#D4537E">mdi-gesture-swipe-horizontal</v-icon>
              <span>Drag to log a completed period</span>
            </p>
            <p class="cal-hint">
              <v-icon size="14" color="#D4537E">mdi-gesture-tap</v-icon>
              <span>Tap a day to log your period as it happens</span>
            </p>
            <p class="cal-hint">
              <v-icon size="14" color="#D4537E">mdi-gesture-tap-hold</v-icon>
              <span>Hold any empty day to mark ovulation or log notes</span>
            </p>
            <p class="cal-hint">
              <v-icon size="14" color="#D4537E">mdi-gesture-tap-hold</v-icon>
              <span>Hold a period group day to resize it with Adjust Cycle</span>
              <span class="drag-hint-badge-wrap">
                <PremiumBadge theme="pink" :unlocked="isPremium" />
              </span>
            </p>
          </div>
        </template>

      </div>

    <!-- First-launch tutorial (also triggered by ? button) -->
    <PeriodOnboardingTutorial :force-open="tutorialOpen" @close="onOnboardingClose" />
    <!-- Premium phase explainer — auto-shows once on first license unlock, also triggered by the premium ? button.
         auto-show is disabled when onboarding is also unseen; onOnboardingClose sequences it instead. -->
    <PeriodPremiumTutorial v-if="isPremium" :force-open="premiumTutorialOpen" :auto-show="onboardingSeenOnMount" @close="premiumTutorialOpen = false" />

    <!-- PREMIUM GATE (frontend) — Adjust Cycle hold-drag gesture -->
    <PremiumGate :open="adjustGateOpen" theme="pink" @update:open="adjustGateOpen = $event" />

    <!-- Delete cycle dialog -->
    <ConfirmDialog
      :open="showDeleteCycleDialog"
      @update:open="showDeleteCycleDialog = $event"
      icon="mdi-calendar-remove-outline"
      title="Delete this cycle?"
      :loading="deletingCycle"
      @confirm="deleteCycle"
    >{{ selectedCycleLabel }}<br><span style="font-size:11px;color:#c0392b;">All logged data for this cycle will be removed.</span></ConfirmDialog>

    <!-- Long cycle warning dialog -->
    <ConfirmDialog
      :open="showLongCycleDialog"
      @update:open="showLongCycleDialog = $event"
      icon="mdi-calendar-alert-outline"
      icon-color="#b45309"
      title="Unusually long cycle"
      confirm-label="Yes, apply"
      confirm-color="#b45309"
      @confirm="confirmLongCycleAdjust"
    >This would make the period <strong>{{ longCycleDays }} days</strong> long — most periods last 3–7 days.<br><span style="font-size:11px;color:#b45309;">Are you sure you want to apply this change?</span></ConfirmDialog>

    <!-- Short gap warning dialog -->
    <ConfirmDialog
      :open="showShortGapDialog"
      @update:open="val => { if (!val) cancelShortGap() }"
      icon="mdi-calendar-clock-outline"
      icon-color="#b45309"
      title="Short gap since last period"
      confirm-label="Continue anyway"
      confirm-color="#b45309"
      @confirm="confirmShortGap"
    >This new cycle is only <strong>{{ shortGapDays }} day{{ shortGapDays === 1 ? '' : 's' }}</strong> away from an existing one. Starting a cycle this close may affect your predictions.<br><span style="font-size:11px;color:#b45309;">Are you sure?</span></ConfirmDialog>

    <!-- Adjacency dialog — tapped date sits right next to an existing cycle (owner only) -->
    <div v-if="!isPartner" class="confirm-backdrop" :class="{ visible: adjacencyDialog.show }" @click="!adjacencyDialog.working && (adjacencyDialog.show = false)" />
    <div v-if="!isPartner" class="confirm-modal" :class="{ open: adjacencyDialog.show }">
      <div class="confirm-inner">
        <div class="confirm-icon">
          <v-icon size="28" color="#D4537E">mdi-calendar-arrow-right</v-icon>
        </div>
        <p class="confirm-title">Adjacent to an existing period</p>
        <p class="confirm-desc">This day is right next to a logged cycle. What would you like to do?</p>
        <div class="adj-actions">
          <button
            v-if="adjacencyDialog.prevCycle"
            class="adj-btn adj-btn-extend"
            :disabled="adjacencyDialog.working"
            @click="onAdjacencyExtendPrev"
          >
            <v-icon size="15" style="margin-right:5px">mdi-arrow-expand-right</v-icon>
            Extend {{ cycleRangeLabel(adjacencyDialog.prevCycle) }} to include this day
          </button>
          <button
            v-if="adjacencyDialog.nextCycle"
            class="adj-btn adj-btn-extend"
            :disabled="adjacencyDialog.working"
            @click="onAdjacencyExtendNext"
          >
            <v-icon size="15" style="margin-right:5px">mdi-arrow-expand-left</v-icon>
            Move start of {{ cycleRangeLabel(adjacencyDialog.nextCycle) }} to this day
          </button>
          <button
            class="adj-btn adj-btn-new"
            :disabled="adjacencyDialog.working"
            @click="onAdjacencyNewPeriod"
          >
            Start a new period on this day
          </button>
        </div>
      </div>
    </div>

    <!-- Day panel -->
    <DetailSheet
      :open="!!selectedCell"
      @update:open="closePanel"
      :title="selectedDateLabel"
      :subtitle="selectedDayType"
      theme="pink"
      hug-content
    >
      <div v-if="selectedCell" class="day-sheet-content">

        <!-- VIEW mode content -->
        <template v-if="mode === 'view'">
          <!-- Orphaned day: logged data outside cycle range -->
          <div v-if="tapContext === 'orphaned'" class="orphaned-notice">
            <v-icon size="36" color="#f97316">mdi-link-off</v-icon>
            <p>This day has logged data but is outside your cycle range.</p>
            <p>Delete this entry or adjust the cycle to include it.</p>
            <button v-if="!isPartner" class="delete-orphan-btn" @click="deleteOrphanedDay">
              <v-icon size="14" color="#c0392b">mdi-delete-outline</v-icon>
              Delete entry
            </button>
          </div>

          <div v-else-if="selectedLoggedDay || tapContext === 'open-cycle-day'" class="view-content">
            <!-- Flow intensity -->
            <div class="view-section">
              <p class="view-section-label">Flow intensity</p>
              <div class="flow-chips">
                <span
                  v-for="level in ['spotting','light','medium','heavy']"
                  :key="level"
                  class="flow-chip"
                  :class="{ 'flow-chip-active': selectedLoggedDay?.flow_intensity === level }"
                >{{ level }}</span>
              </div>
            </div>

            <!-- Symptoms -->
            <div class="view-section">
              <p class="view-section-label">Symptoms</p>
              <div class="symptom-chips">
                <span
                  v-for="s in symptomOptions"
                  :key="s"
                  class="symptom-chip"
                  :class="{ 'symptom-chip-active': selectedSymptoms.includes(s) }"
                >{{ s }}</span>
              </div>
            </div>

          </div>

          <!-- Gap day: view mode — same structure as period day view -->
          <div v-else-if="ovulationCycle && gapMode === 'view'" class="view-content">
            <div class="view-section">
              <p class="view-section-label">Ovulation</p>
              <span class="ovulation-status" :class="{ 'ovulation-status--active': isMarkedOvulation }">
                <v-icon size="13" :color="isMarkedOvulation ? '#854F0B' : '#aaa'">mdi-egg-outline</v-icon>
                {{ isMarkedOvulation ? 'Marked as ovulation day' : 'Not marked as ovulation day' }}
              </span>
            </div>
            <div class="view-section">
              <p class="view-section-label">Symptoms</p>
              <div class="symptom-chips">
                <span
                  v-for="s in symptomOptions"
                  :key="s"
                  class="symptom-chip"
                  :class="{ 'symptom-chip-active': gapSelectedSymptoms.includes(s) }"
                >{{ s }}</span>
              </div>
            </div>
          </div>

          <!-- Gap day: edit mode — same structure as period day log form -->
          <div v-else-if="ovulationCycle && gapMode === 'edit' && !isPartner" class="log-form">
            <div class="form-section">
              <p class="form-label">Ovulation</p>
              <button
                class="ovulation-btn"
                :class="{ 'ovulation-btn--active': gapForm.ovulation }"
                @click="gapForm.ovulation = !gapForm.ovulation"
              >
                <v-icon size="13" :color="gapForm.ovulation ? '#854F0B' : '#993556'">mdi-egg-outline</v-icon>
                {{ gapForm.ovulation ? 'Marked as ovulation day' : 'Mark as ovulation day' }}
              </button>
            </div>
            <div class="form-section">
              <p class="form-label">Symptoms</p>
              <div class="symptom-chips">
                <button
                  v-for="s in symptomOptions"
                  :key="s"
                  class="symptom-chip symptom-chip-btn"
                  :class="{ 'symptom-chip-active': gapForm.symptoms.includes(s) }"
                  @click="toggleGapSymptom(s)"
                >{{ s }}</button>
              </div>
            </div>
          </div>

          <!-- Empty: in a cycle but no data, or no cycle at all -->
          <div v-else class="view-empty">
            <v-icon size="36" color="#F4C0D1">mdi-calendar-blank-outline</v-icon>
            <template v-if="selectedCycle">
              <p>No data logged for this day.</p>
            </template>
            <template v-else-if="!ovulationCycle">
              <p>Not part of a cycle.</p>
              <p class="view-empty-hint">Drag on the calendar to log a completed period</p>
            </template>
          </div>
        </template>

        <!-- LOG mode content -->
        <template v-else-if="!isPartner">
          <div class="log-form">
            <!-- Flow intensity -->
            <div class="form-section">
              <p class="form-label">Flow intensity</p>
              <div class="flow-chips">
                <button
                  v-for="level in ['spotting','light','medium','heavy','none']"
                  :key="level"
                  class="flow-chip flow-chip-btn"
                  :class="{ 'flow-chip-active': level === 'none' ? form.flow_intensity === '' : form.flow_intensity === level }"
                  @click="form.flow_intensity = level === 'none' ? '' : (form.flow_intensity === level ? '' : level)"
                >{{ level }}</button>
              </div>
            </div>

            <!-- Symptoms -->
            <div class="form-section">
              <p class="form-label">Symptoms</p>
              <div class="symptom-chips">
                <button
                  v-for="s in symptomOptions"
                  :key="s"
                  class="symptom-chip symptom-chip-btn"
                  :class="{ 'symptom-chip-active': form.symptoms.includes(s) }"
                  @click="toggleSymptom(s)"
                >{{ s }}</button>
              </div>
            </div>

          </div>
        </template>

        <!-- Notes — persistent across view/edit (and gap view/edit) so the
             counter expand transition fires both entering AND leaving edit.
             An ancestor swap would suppress the leave animation. -->
        <div
          v-if="tapContext !== 'orphaned' && (selectedLoggedDay || tapContext === 'open-cycle-day' || mode === 'log')
                && (mode === 'log' ? !isPartner : (!isPartner || partnerCanReadNotes))"
          class="day-notes-section"
        >
          <p class="view-section-label">Notes</p>
          <NotesField
            :mode="mode === 'log' ? 'edit' : 'view'"
            :model-value="mode === 'log' ? form.notes : (selectedLoggedDay?.notes ?? '')"
            @update:model-value="form.notes = $event"
            :max="NOTES_MAX"
            placeholder="How are you feeling today?"
            :fixed-height="150"
          />
        </div>

        <div
          v-if="mode === 'view' && ovulationCycle && !selectedLoggedDay
                && tapContext !== 'open-cycle-day' && tapContext !== 'orphaned'
                && (gapMode === 'edit' ? !isPartner : (!isPartner || partnerCanReadNotes))"
          class="day-notes-section"
        >
          <p class="view-section-label">Notes</p>
          <NotesField
            :mode="gapMode === 'edit' ? 'edit' : 'view'"
            :model-value="gapMode === 'edit' ? gapForm.notes : (gapDayLog?.notes ?? '')"
            @update:model-value="gapForm.notes = $event"
            :max="NOTES_MAX"
            placeholder="How are you feeling today?"
            :fixed-height="150"
          />
        </div>

      </div>

      <template v-if="selectedCell && !isPartner && ((selectedCycle && tapContext !== 'orphaned') || ovulationCycle)" #footer>
        <!-- Period day footer -->
        <template v-if="selectedCycle && tapContext !== 'orphaned'">
          <!-- Icon actions (left) -->
          <div class="cycle-icon-actions">
            <IconAction
              icon="mdi-trash-can-outline"
              label="Delete day"
              color="#c0392b"
              :loading="removingDay ? 'Deleting...' : ''"
              :disabled="!isEdgeDay || removingDay"
              :hoverMessage="!isEdgeDay && !removingDay ? 'Only the first or last day of a period can be removed' : ''"
              @click="removeDay"
            />
            <IconAction
              icon="mdi-calendar-remove-outline"
              label="Delete cycle"
              color="#c0392b"
              @click="showDeleteCycleDialog = true"
            />
            <IconAction
              v-if="mode === 'view'"
              :icon="selectedLoggedDay || tapContext === 'open-cycle-day' ? 'mdi-pencil' : 'mdi-plus'"
              :label="selectedLoggedDay || tapContext === 'open-cycle-day' ? 'Edit day' : 'Log day'"
              color="#993556"
              @click="selectedLoggedDay || tapContext === 'open-cycle-day' ? switchToEdit() : mode = 'log'"
            />
            <WarningReviewActions
              v-if="mode === 'view' && selectedCycleWarnings.length > 0"
              :itemId="selectedCycle.id"
              :reviewState="selectedCycle.review_state ?? null"
              :endpoint="`period/cycles/${selectedCycle.id}/review`"
              :itemLabel="selectedCycleStartLabel"
              @reviewed="loadData"
            />
          </div>
          <!-- Save / Cancel (right, edit mode only) -->
          <div v-if="mode !== 'view'" class="form-actions">
            <button class="btn-cancel" @click="mode = 'view'">Cancel</button>
            <button class="btn-save" @click="saveDay" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </template>

        <!-- Gap day footer -->
        <template v-else-if="ovulationCycle">
          <div class="cycle-icon-actions">
            <IconAction
              v-if="gapMode === 'view' && (gapDayLog || isMarkedOvulation)"
              icon="mdi-trash-can-outline"
              label="Delete entry"
              color="#c0392b"
              :loading="deletingGapDay ? 'Deleting...' : ''"
              @click="deleteGapDay"
            />
            <IconAction
              v-if="gapMode === 'view'"
              :icon="gapDayLog ? 'mdi-pencil' : 'mdi-plus'"
              :label="gapDayLog ? 'Edit' : 'Log symptoms'"
              color="#993556"
              @click="gapMode = 'edit'; gapForm = { symptoms: [...gapSelectedSymptoms], notes: gapDayLog?.notes ?? '', ovulation: isMarkedOvulation }"
            />
          </div>
          <div v-if="gapMode === 'edit'" class="form-actions">
            <button class="btn-cancel" @click="gapMode = 'view'">Cancel</button>
            <button class="btn-save" @click="saveGapDay" :disabled="savingGap">
              {{ savingGap ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </template>
      </template>
    </DetailSheet>

    <!-- Future-date speech bubble -->
    <Transition name="hint-bubble-fade">
      <div
        v-if="hintBubble.visible"
        class="hint-bubble"
        :class="{ 'hint-bubble-success': hintBubble.variant === 'green' }"
        :style="{ left: hintBubble.x + 'px', top: hintBubble.y + 'px' }"
      >
        {{ hintBubble.message }}
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PeriodOnboardingTutorial from './PeriodOnboardingTutorial.vue'
import PeriodPremiumTutorial from './PeriodPremiumTutorial.vue'
import PremiumGate from '../../components/PremiumGate.vue'
import PremiumBadge from '../../components/ui/PremiumBadge.vue'
import { useLicense } from '../../composables/useLicense'
import DetailSheet from '../../components/ui/DetailSheet.vue'
import NotesField from '../../components/ui/NotesField.vue'
import IconAction from '../../components/ui/IconAction.vue'
import ConfirmDialog from '../../components/ui/ConfirmDialog.vue'
import WarningReviewActions from '../../components/ui/WarningReviewActions.vue'
import { API, apiFetch, getUser } from '../../api'
import { useSettings } from '../../composables/useSettings'
import { usePreferences } from '../../composables/usePreferences'
import { usePeriodData } from '../../composables/usePeriodData'

const { allCycleDays, allCycles, summary, gapDayLogs, viewYear, viewMonth, pulseDates, warningDateSet, orphanedDaySet, cycleWarningMap, loadData, resetView } = usePeriodData()

const currentUser = ref(getUser())
const isPartner = computed(() => currentUser.value?.role === 'owner2')
const { settings, fetchSettings } = useSettings()
const { preferences, fetchPreferences, resetCache: resetPreferences } = usePreferences()
const partnerCanReadNotes = computed(() => settings.value.partner_can_read_notes === '1')

const NOTES_MAX = 500

const tutorialOpen = ref(false)
const premiumTutorialOpen = ref(false)
// If onboarding was already done at mount time, the premium tutorial can auto-show immediately.
// If onboarding is also unseen (fresh install with premium), suppress the premium auto-show and
// instead sequence it: trigger the premium tutorial once the onboarding is dismissed.
const onboardingSeenOnMount = !!localStorage.getItem('grovely_onboarding_done')

function onOnboardingClose() {
  tutorialOpen.value = false
  // After onboarding ends, start the premium tutorial if the user has premium and hasn't seen it yet
  if (isPremium.value && !localStorage.getItem('grovely_premium_phase_intro_done')) {
    premiumTutorialOpen.value = true
  }
}
const adjustGateOpen = ref(false)
const { licenseActive, fetchLicenseStatus } = useLicense()
const isPremium = computed(() => licenseActive.value === true)
const mode = ref('view') // set automatically on day click
const saving = ref(false)
const justSaved = ref(new Set())
const fadingOut = ref(new Set())

function flashDeleteDates(dates) {
  const STAGGER = 30
  const timers = dates.map((d, i) =>
    setTimeout(() => { fadingOut.value = new Set([...fadingOut.value, d]) }, i * STAGGER)
  )
  return () => {
    timers.forEach(clearTimeout)
    fadingOut.value = new Set()
  }
}

function flashDates(dates) {
  for (const d of dates) {
    justSaved.value = new Set([...justSaved.value, d])
    setTimeout(() => {
      const next = new Set(justSaved.value)
      next.delete(d)
      justSaved.value = next
    }, 1200)
  }
}

// Month slide animation
const slideDirection = ref('left')

// Drag-to-select state
const isDragging = ref(false)
const dragStart = ref(null)
const dragEnd = ref(null)
const dragMoved = ref(false)



// Future-date speech bubble
const hintBubble = ref({ visible: false, x: 0, y: 0, message: '', variant: 'dark' })
let hintBubbleTimer = null
function showHintBubble(x, date, message = "Can't log future dates", variant = 'dark') {
  if (hintBubbleTimer) clearTimeout(hintBubbleTimer)
  const cellEl = document.querySelector(`[data-date="${date}"]`)
  const y = cellEl ? cellEl.getBoundingClientRect().top : hintBubble.value.y
  const wrapper = document.querySelector('.period-wrapper')
  const wRect = wrapper ? wrapper.getBoundingClientRect() : { left: 0, right: window.innerWidth }
  const clampedX = Math.max(wRect.left + 80, Math.min(x, wRect.right - 80))
  hintBubble.value = { visible: true, x: clampedX, y, message, variant }
  hintBubbleTimer = setTimeout(() => { hintBubble.value.visible = false }, 1500)
}

// Swipe-to-create state
const dragRange = ref(null)
const creating = ref(false)

// Delete cycle dialog
const showDeleteCycleDialog = ref(false)
const deletingCycle = ref(false)

// Long cycle warning dialog
const showLongCycleDialog = ref(false)
const longCycleDays = ref(0)
const longCyclePendingFn = ref(null)
const longCycleWarnedIds = new Set() // cycle IDs already warned this session

// Short gap warning dialog
const showShortGapDialog = ref(false)
const shortGapDays = ref(0)
const shortGapPendingFn = ref(null)

// Adjacency dialog — shown when a tapped date sits immediately next to an existing cycle
const adjacencyDialog = ref({ show: false, prevCycle: null, nextCycle: null, pendingCell: null, working: false })

function getAdjacentCycles(ds) {
  const prevDate = new Date(ds + 'T00:00:00')
  prevDate.setDate(prevDate.getDate() - 1)
  const prevDayStr = prevDate.toISOString().split('T')[0]

  const nextDate = new Date(ds + 'T00:00:00')
  nextDate.setDate(nextDate.getDate() + 1)
  const nextDayStr = nextDate.toISOString().split('T')[0]

  // prevCycle: a closed cycle whose end_date is the day before ds
  const prevCycle = allCycles.value.find(c => c.end_date === prevDayStr) ?? null
  // nextCycle: any cycle whose start_date is the day after ds
  const nextCycle = allCycles.value.find(c => c.start_date === nextDayStr) ?? null

  return { prevCycle, nextCycle }
}

function cycleRangeLabel(cycle) {
  if (!cycle) return ''
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = cycle.end_date || cycle.last_logged_day
  if (!end || end === cycle.start_date) return fmt(cycle.start_date)
  return `${fmt(cycle.start_date)} – ${fmt(end)}`
}

// Ovulation marking
const markingOvulation = ref(false)

// Day-by-day logging
const tapContext = ref(null) // 'no-cycle' | 'consecutive' | 'large-gap' | 'open-cycle-day' | 'orphaned'
const endingPeriod = ref(false)
const removingDay = ref(false)

// Adjust Cycle mode
const adjustingCycleId = ref(null)
const adjustHandle = ref(null)       // 'start' | 'end'
const adjustHoldTimer = ref(null)
const adjustVibrateTimer = ref(null)  // fires at 250ms to start vibrate feedback
const periodHoldTouchStart = ref(null) // {x, y} recorded when a period hold begins
const adjustDragActive = ref(false)
const adjustPreviewDate = ref(null)
const holdPendingCycleId = ref(null) // cycle being "charged" during a hold-to-adjust gesture
const gapHoldTimer = ref(null)
const gapVibrateTimer = ref(null)
const gapHoldPendingDate = ref(null)

// Calendar state (viewYear/viewMonth live in usePeriodData for cross-column sharing)

// Selected cell state
const selectedCell = ref(null)

// Form state
const form = ref({ flow_intensity: '', symptoms: [], notes: '' })

// Gap day state
const gapMode = ref('view') // 'view' | 'edit'
const gapForm = ref({ symptoms: [], notes: '', ovulation: false })
const savingGap = ref(false)
const deletingGapDay = ref(false)

const symptomOptions = ['Cramps', 'Headache', 'Bloating', 'Mood swings', 'Fatigue', 'Back pain', 'Nausea', 'Tender breasts']

// ── Computed labels ──────────────────────────────────────────
const todayLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
})

const monthLabel = computed(() => {
  return new Date(viewYear.value, viewMonth.value, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// ── Calendar cells ───────────────────────────────────────────
const calendarCells = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells = []

  // Leading days from previous month
  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrevMonth - firstDay + 1 + i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, dateStr, faded: true })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, dateStr })
  }

  // Trailing days from next month to fill 42 cells
  let nextDay = 1
  while (cells.length < 42) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`
    cells.push({ day: nextDay, dateStr, faded: true })
    nextDay++
  }

  return cells
})

// Build a quick lookup map: dateStr → logged day
const loggedDayMap = computed(() => {
  const map = {}
  allCycleDays.value.forEach(d => { map[d.date] = d })
  return map
})

// Sets of dates for coloring
// Fill the full range of each cycle (start → end_date or last_logged_day)
const periodDates = computed(() => {
  const set = new Set()
  allCycles.value.forEach(cycle => {
    const end = cycle.end_date || cycle.last_logged_day
    if (!cycle.start_date || !end) return
    let d = new Date(cycle.start_date + 'T00:00:00')
    const endDate = new Date(end + 'T00:00:00')
    while (d <= endDate) {
      set.add(d.toISOString().split('T')[0])
      d.setDate(d.getDate() + 1)
    }
  })
  return set
})

// Map each period date to its cycle ID so band logic can detect cycle boundaries
const dateToCycleId = computed(() => {
  const map = new Map()
  allCycles.value.forEach(cycle => {
    const end = cycle.end_date || cycle.last_logged_day
    if (!cycle.start_date || !end) return
    let d = new Date(cycle.start_date + 'T00:00:00')
    const endDate = new Date(end + 'T00:00:00')
    while (d <= endDate) {
      map.set(d.toISOString().split('T')[0], cycle.id)
      d.setDate(d.getDate() + 1)
    }
  })
  return map
})

// Dates highlighted during an active drag
const dragDates = computed(() => {
  if (!dragStart.value || !dragEnd.value) return new Set()
  const s = dragStart.value <= dragEnd.value ? dragStart.value : dragEnd.value
  const e = dragStart.value <= dragEnd.value ? dragEnd.value : dragStart.value
  const set = new Set()
  let d = new Date(s + 'T00:00:00')
  const endDate = new Date(e + 'T00:00:00')
  while (d <= endDate) {
    set.add(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return set
})

const dragRangeLabel = computed(() => {
  if (!dragRange.value) return ''
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  if (dragRange.value.start === dragRange.value.end) return fmt(dragRange.value.start)
  return `${fmt(dragRange.value.start)} → ${fmt(dragRange.value.end)}`
})

const PREDICT_CYCLES = 6

const predictedDates = computed(() => {
  const set = new Set()
  const s = summary.value
  if (!s?.nextPeriodDate || !s?.avgPeriodLength) return set
  const base = new Date(s.nextPeriodDate + 'T00:00:00')
  for (let d = 0; d < s.avgPeriodLength; d++) {
    const day = new Date(base)
    day.setDate(day.getDate() + d)
    set.add(day.toISOString().split('T')[0])
  }
  return set
})

// Predicted remaining days of the active period (from last logged day + 1 → start + avgPeriodLength - 1)
const predictedCurrentEndDates = computed(() => {
  const set = new Set()
  const s = summary.value
  if (!s?.avgPeriodLength || !allCycles.value.length) return set
  const mostRecentCycle = allCycles.value
    .slice()
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
  const activeCycle = s?.currentCycle
    ? allCycles.value.find(c => c.id === s.currentCycle.id) ?? mostRecentCycle
    : mostRecentCycle
  if (!activeCycle) return set
  const predictedEnd = new Date(activeCycle.start_date + 'T00:00:00')
  predictedEnd.setDate(predictedEnd.getDate() + s.avgPeriodLength - 1)
  const lastLogged = activeCycle.last_logged_day
    ? new Date(activeCycle.last_logged_day + 'T00:00:00')
    : new Date(activeCycle.start_date + 'T00:00:00')
  // Keep painting these predicted completion days even after today passes predictedEnd —
  // they persist until a new period is logged (which reassigns activeCycle and recomputes this set).
  let d = new Date(lastLogged)
  d.setDate(d.getDate() + 1)
  while (d <= predictedEnd) {
    set.add(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return set
})

const fertileDates = computed(() => {
  const set = new Set()
  if (preferences.value.period_show_fertile_window === '0') return set
  const s = summary.value
  if (!s) return set

  // Use targetDate only — affectedDates includes the "from" anchor of SHORT_CYCLE_GAP warnings,
  // which would incorrectly suppress the good cycle's fertile window
  const warnedDates = new Set(s.dataWarnings?.map(w => w.targetDate).filter(Boolean) ?? [])

  allCycles.value.forEach(cycle => {
    if (warnedDates.has(cycle.start_date)) return
    if (cycle.review_state === 'excluded') return
    if (!cycle.predicted_fertile_start || !cycle.predicted_fertile_end) return
    const cur = new Date(cycle.predicted_fertile_start + 'T00:00:00')
    const end = new Date(cycle.predicted_fertile_end   + 'T00:00:00')
    while (cur <= end) {
      set.add(cur.toISOString().split('T')[0])
      cur.setDate(cur.getDate() + 1)
    }
  })

  // Also paint the next fertile window — it belongs to a future cycle with no DB row yet
  if (s.nextFertileWindow) {
    const cur = new Date(s.nextFertileWindow.start + 'T00:00:00')
    const end = new Date(s.nextFertileWindow.end   + 'T00:00:00')
    while (cur <= end) {
      set.add(cur.toISOString().split('T')[0])
      cur.setDate(cur.getDate() + 1)
    }
  }

  return set
})

const predictedOvulationDates = computed(() => {
  const set = new Set()
  if (preferences.value.period_show_fertile_window === '0') return set
  const s = summary.value
  if (!s) return set

  const warnedDates = new Set(s.dataWarnings?.map(w => w.targetDate).filter(Boolean) ?? [])

  allCycles.value.forEach(cycle => {
    if (warnedDates.has(cycle.start_date)) return
    if (cycle.review_state === 'excluded') return
    if (cycle.ovulation_date) return // manual mark overrides predicted tint
    if (!cycle.predicted_ovulation_date) return
    set.add(cycle.predicted_ovulation_date)
  })

  if (s.nextOvulationDate) set.add(s.nextOvulationDate)

  return set
})

// Marked ovulation dates from actual cycle data (distinct from the predicted ovulationDate above)
const markedOvulationDates = computed(() => {
  const set = new Set()
  allCycles.value.forEach(c => { if (c.ovulation_date) set.add(c.ovulation_date) })
  return set
})

// The cycle a between-cycle day belongs to (last cycle that started before this day)
const ovulationCycle = computed(() => {
  if (!selectedCell.value || selectedCycle.value) return null
  const ds = selectedCell.value.dateStr
  return allCycles.value
    .filter(c => c.start_date <= ds && c.review_state !== 'excluded')
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null
})

const isMarkedOvulation = computed(() =>
  !!(selectedCell.value && ovulationCycle.value?.ovulation_date === selectedCell.value.dateStr)
)

const gapDayLogMap = computed(() => {
  const map = {}
  gapDayLogs.value.forEach(g => { map[g.date] = g })
  return map
})

const gapDayLog = computed(() =>
  selectedCell.value ? gapDayLogMap.value[selectedCell.value.dateStr] ?? null : null
)

const gapSelectedSymptoms = computed(() => {
  if (!gapDayLog.value?.symptoms) return []
  return gapDayLog.value.symptoms.split(',').map(s => s.trim()).filter(Boolean)
})

// Returns the active cycle relevant to a given date.
// A cycle is considered active if its end_date is today or yesterday (end_date always equals MAX logged day via #36).
function findRelevantOpenCycle(ds) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  return allCycles.value
    .filter(c => c.end_date && c.end_date >= yesterday && c.start_date <= ds && c.review_state !== 'excluded')
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null
}

// Reactive version for template and computed use (depends on selectedCell)
const relevantActiveCycle = computed(() => {
  const ds = selectedCell.value?.dateStr
  if (!ds) return null
  return findRelevantOpenCycle(ds)
})

const adjustCycle = computed(() =>
  adjustingCycleId.value
    ? allCycles.value.find(c => c.id === adjustingCycleId.value) ?? null
    : null
)

// Cells being added to the cycle during an active drag (ghost preview)
const adjustGhostDates = computed(() => {
  if (!adjustDragActive.value || !adjustPreviewDate.value || !adjustCycle.value) return new Set()
  const ac = adjustCycle.value
  const set = new Set()
  if (adjustHandle.value === 'end') {
    const current = ac.end_date || ac.last_logged_day
    if (!current || adjustPreviewDate.value <= current) return set
    let d = new Date(current + 'T00:00:00'); d.setDate(d.getDate() + 1)
    const end = new Date(adjustPreviewDate.value + 'T00:00:00')
    while (d <= end) { set.add(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1) }
  } else if (adjustHandle.value === 'start') {
    const current = ac.start_date
    if (adjustPreviewDate.value >= current) return set
    let d = new Date(adjustPreviewDate.value + 'T00:00:00')
    const end = new Date(current + 'T00:00:00'); end.setDate(end.getDate() - 1)
    while (d <= end) { set.add(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1) }
  }
  return set
})

// Cells being removed from the cycle during an active drag
const adjustRemovingDates = computed(() => {
  if (!adjustDragActive.value || !adjustPreviewDate.value || !adjustCycle.value) return new Set()
  const ac = adjustCycle.value
  const set = new Set()
  if (adjustHandle.value === 'end') {
    const current = ac.end_date || ac.last_logged_day
    if (!current || adjustPreviewDate.value >= current) return set
    let d = new Date(adjustPreviewDate.value + 'T00:00:00'); d.setDate(d.getDate() + 1)
    const end = new Date(current + 'T00:00:00')
    while (d <= end) { set.add(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1) }
  } else if (adjustHandle.value === 'start') {
    const current = ac.start_date
    if (adjustPreviewDate.value <= current) return set
    let d = new Date(current + 'T00:00:00')
    const end = new Date(adjustPreviewDate.value + 'T00:00:00'); end.setDate(end.getDate() - 1)
    while (d <= end) { set.add(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1) }
  }
  return set
})

// True when the current adjust drag preview would land on dates owned by another cycle
const adjustHasOverlap = computed(() => {
  if (!adjustDragActive.value || !adjustGhostDates.value.size) return false
  for (const date of adjustGhostDates.value) {
    const cycleId = dateToCycleId.value.get(date)
    if (cycleId && cycleId !== adjustingCycleId.value) return true
  }
  // Also check the landing cell itself
  if (adjustPreviewDate.value) {
    const cycleId = dateToCycleId.value.get(adjustPreviewDate.value)
    if (cycleId && cycleId !== adjustingCycleId.value) return true
  }
  return false
})

function hasInfo(cell) {
  if (!cell.dateStr) return false
  const pd = loggedDayMap.value[cell.dateStr]
  if (pd?.notes || (pd?.symptoms && pd.symptoms.trim())) return true
  const gd = gapDayLogMap.value[cell.dateStr]
  if (gd?.notes || (gd?.symptoms && gd.symptoms.trim())) return true
  return false
}

function hasDataWarning(cell) {
  return !!(cell.dateStr && warningDateSet.value.has(cell.dateStr))
}

function hasOrphanedData(cell) {
  return !!(cell.dateStr && orphanedDaySet.value.has(cell.dateStr))
}

const todayStr = new Date().toISOString().split('T')[0]

function getCellClass(cell, i) {
  if (!cell.dateStr) return ['cal-cell-empty']
  const classes = []

  // Drag anchor: scale up the first and last cell of the current drag range
  // Suppress when hold-pending is active on this cell — avoid competing border styles
  const isHoldPending = (holdPendingCycleId.value && dateToCycleId.value.get(cell.dateStr) === holdPendingCycleId.value) || gapHoldPendingDate.value === cell.dateStr
  if (!isHoldPending && !periodDates.value.has(cell.dateStr) && dragStart.value && dragEnd.value) {
    const ds = dragStart.value <= dragEnd.value ? dragStart.value : dragEnd.value
    const de = dragStart.value <= dragEnd.value ? dragEnd.value : dragStart.value
    if (cell.dateStr === ds || cell.dateStr === de) classes.push('cal-drag-anchor')
  }

  if (cell.faded) {
    classes.push('cal-cell-faded')
    if (dragDates.value.has(cell.dateStr)) classes.push('cal-dragging')
    else if (periodDates.value.has(cell.dateStr)) {
      classes.push('cal-period')
      const flowLevel = loggedDayMap.value[cell.dateStr]?.flow_intensity
      if (flowLevel) classes.push(`cal-flow-${flowLevel}`)
      const cells = calendarCells.value
      const thisCycleId = dateToCycleId.value.get(cell.dateStr)
      const prevIsPeriod = i > 0 && periodDates.value.has(cells[i - 1].dateStr) && dateToCycleId.value.get(cells[i - 1].dateStr) === thisCycleId && !fadingOut.value.has(cells[i - 1].dateStr)
      const nextIsPeriod = i < cells.length - 1 && periodDates.value.has(cells[i + 1].dateStr) && dateToCycleId.value.get(cells[i + 1].dateStr) === thisCycleId && !fadingOut.value.has(cells[i + 1].dateStr)
      if (!prevIsPeriod) classes.push('cal-period-row-start')
      if (!nextIsPeriod) classes.push('cal-period-row-end')
    }
    else if (predictedCurrentEndDates.value.has(cell.dateStr)) classes.push('cal-predicted')
    else if (predictedDates.value.has(cell.dateStr)) classes.push('cal-predicted')
    else if (markedOvulationDates.value.has(cell.dateStr)) classes.push('cal-ovulation')
    else if (predictedOvulationDates.value.has(cell.dateStr)) classes.push('cal-ovulation')
    else if (fertileDates.value.has(cell.dateStr)) classes.push('cal-fertile')
    if (gapDayLogMap.value[cell.dateStr]) classes.push('cal-gap-logged')
    if (adjustingCycleId.value && adjustDragActive.value && adjustPreviewDate.value) {
      const fadedCellCycleId = dateToCycleId.value.get(cell.dateStr)
      const fadedIsOverlap = fadedCellCycleId && fadedCellCycleId !== adjustingCycleId.value
      if (cell.dateStr === adjustPreviewDate.value) {
        classes.push(fadedIsOverlap ? 'cal-adjust-overlap' : 'cal-adjust-ghost')
      } else if (adjustGhostDates.value.has(cell.dateStr)) {
        classes.push(fadedIsOverlap ? 'cal-adjust-overlap' : 'cal-adjust-adding')
      } else if (adjustRemovingDates.value.has(cell.dateStr)) {
        classes.push('cal-adjust-removing')
      }
    }
    if (pulseDates.value.has(cell.dateStr)) classes.push('cal-cell-pulse')
    return classes
  }
  if (cell.dateStr === todayStr) classes.push('cal-today')
  if (dragDates.value.has(cell.dateStr)) classes.push('cal-dragging')
  else if (periodDates.value.has(cell.dateStr)) {
    classes.push('cal-period')
    const flowLevel = loggedDayMap.value[cell.dateStr]?.flow_intensity
    if (flowLevel) classes.push(`cal-flow-${flowLevel}`)
    // Determine continuous-band shape: round the visual start/end of each period run
    const cells = calendarCells.value
    const thisCycleId = dateToCycleId.value.get(cell.dateStr)
    const prevIsPeriod = i > 0 && periodDates.value.has(cells[i - 1].dateStr) && dateToCycleId.value.get(cells[i - 1].dateStr) === thisCycleId && !fadingOut.value.has(cells[i - 1].dateStr)
    const nextIsPeriod = i < cells.length - 1 && periodDates.value.has(cells[i + 1].dateStr) && dateToCycleId.value.get(cells[i + 1].dateStr) === thisCycleId && !fadingOut.value.has(cells[i + 1].dateStr)
    if (!prevIsPeriod) classes.push('cal-period-row-start')
    if (!nextIsPeriod) classes.push('cal-period-row-end')
  }
  else if (predictedCurrentEndDates.value.has(cell.dateStr)) classes.push('cal-predicted')
  else if (predictedDates.value.has(cell.dateStr)) classes.push('cal-predicted')
  else if (markedOvulationDates.value.has(cell.dateStr)) classes.push('cal-ovulation')
  else if (predictedOvulationDates.value.has(cell.dateStr)) classes.push('cal-ovulation')
  else if (fertileDates.value.has(cell.dateStr)) classes.push('cal-fertile')
  if (gapDayLogMap.value[cell.dateStr]) classes.push('cal-gap-logged')
  if (cell.day) classes.push('cal-cell-day')
  if (pulseDates.value.has(cell.dateStr)) classes.push('cal-cell-pulse')
  if (fadingOut.value.has(cell.dateStr) && !predictedCurrentEndDates.value.has(cell.dateStr)) classes.push('cal-cell-fading')
  if (holdPendingCycleId.value && dateToCycleId.value.get(cell.dateStr) === holdPendingCycleId.value) classes.push('cal-cell-hold-pending')
  if (gapHoldPendingDate.value === cell.dateStr) classes.push('cal-cell-hold-pending')

  // Adjust Cycle mode: highlight handles and dim other cycles
  if (adjustingCycleId.value) {
    const cellCycleId = dateToCycleId.value.get(cell.dateStr)
    if (cellCycleId === adjustingCycleId.value && adjustCycle.value) {
      const ac = adjustCycle.value
      const acEnd = ac.end_date || ac.last_logged_day
      if (cell.dateStr === ac.start_date) classes.push('cal-adjust-handle-start')
      else if (cell.dateStr === acEnd) classes.push('cal-adjust-handle-end')
      else classes.push('cal-adjust-active')
    } else if (periodDates.value.has(cell.dateStr)) {
      classes.push('cal-adjust-dimmed')
    }

    // Ghost preview while dragging
    if (adjustDragActive.value && adjustPreviewDate.value) {
      const isOverlapCell = (() => {
        const cid = dateToCycleId.value.get(cell.dateStr)
        return cid && cid !== adjustingCycleId.value
      })()
      if (cell.dateStr === adjustPreviewDate.value) {
        classes.push(isOverlapCell ? 'cal-adjust-overlap' : 'cal-adjust-ghost')
      } else if (adjustGhostDates.value.has(cell.dateStr)) {
        classes.push(isOverlapCell ? 'cal-adjust-overlap' : 'cal-adjust-adding')
      } else if (adjustRemovingDates.value.has(cell.dateStr)) {
        classes.push('cal-adjust-removing')
      }
    }
  }

  return classes
}


// ── Month nav ────────────────────────────────────────────────
function prevMonth() {
  slideDirection.value = 'right'
  if (adjustDragActive.value) { adjustDragActive.value = false; adjustHandle.value = null; adjustPreviewDate.value = null }
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  slideDirection.value = 'left'
  if (adjustDragActive.value) { adjustDragActive.value = false; adjustHandle.value = null; adjustPreviewDate.value = null }
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

// ── Day panel ────────────────────────────────────────────────
function onDayClick(cell) {
  const ds = cell.dateStr

  // Orphaned day: has logged data outside its cycle's range
  if (orphanedDaySet.value.has(ds)) {
    tapContext.value = 'orphaned'
    selectedCell.value = cell
    mode.value = 'view'
    form.value = { flow_intensity: '', symptoms: [], notes: '' }
    return
  }

  // Gap day with logged data: open panel directly, skip period creation flow
  if (gapDayLogMap.value[ds] && !periodDates.value.has(ds) && !orphanedDaySet.value.has(ds)) {
    tapContext.value = null
    gapMode.value = 'view'
    gapForm.value = { symptoms: [], notes: '', ovulation: false }
    selectedCell.value = cell
    mode.value = 'view'
    return
  }

  const logged = loggedDayMap.value[ds]
  const hasMeaningfulData = !!(logged?.flow_intensity || logged?.notes || logged?.symptoms)

  // Future dates: view mode only (predictions)
  if (ds > todayStr) {
    tapContext.value = null
    selectedCell.value = cell
    mode.value = 'view'
    form.value = { flow_intensity: '', symptoms: [], notes: '' }
    return
  }

  // Already has meaningful data: view mode first, edit via button
  if (hasMeaningfulData) {
    tapContext.value = null
    selectedCell.value = cell
    mode.value = 'view'
    form.value = {
      flow_intensity: logged.flow_intensity ?? '',
      symptoms: logged.symptoms ? logged.symptoms.split(',').map(s => s.trim()).filter(Boolean) : [],
      notes: logged.notes ?? ''
    }
    return
  }

  const active = findRelevantOpenCycle(ds)
  let context = null

  if (active) {
    if (periodDates.value.has(ds)) {
      context = 'open-cycle-day'
    } else {
      const lastDay = active.last_logged_day || active.start_date
      const diff = Math.round(
        (new Date(ds + 'T00:00:00') - new Date(lastDay + 'T00:00:00')) / 86400000
      )
      if (diff === 1)   context = 'consecutive'
      else if (diff > 1) context = 'large-gap'
      else {
        // Tapping before the active cycle or in an unrelated inter-cycle gap
        // Fall through to between-cycles / no-cycle handling below
      }
    }
  }

  if (!context) {
    if (periodDates.value.has(ds)) {
      context = 'open-cycle-day'
    } else {
      context = 'no-cycle'
    }
  }

  // Partner can't log — nothing to show on non-period days
  if (isPartner.value && ['no-cycle', 'consecutive', 'large-gap'].includes(context)) return

  // Quick-log: immediately save new period days without opening a form
  if (['no-cycle', 'consecutive', 'large-gap'].includes(context)) {
    tapContext.value = context
    form.value = { flow_intensity: '', symptoms: [], notes: '' }

    // For no-cycle: check if this date is immediately adjacent to an existing cycle
    // and silently extend rather than create a new one (except when both sides are adjacent)
    if (context === 'no-cycle') {
      const adj = getAdjacentCycles(ds)
      if (adj.prevCycle || adj.nextCycle) {
        // If only one side is adjacent, automatically extend that cycle
        if (adj.prevCycle && !adj.nextCycle) {
          // Extend previous cycle
          onAdjacencyExtendPrevSilent(adj.prevCycle, cell)
        } else if (adj.nextCycle && !adj.prevCycle) {
          // Extend next cycle
          onAdjacencyExtendNextSilent(adj.nextCycle, cell)
        } else {
          // Both sides adjacent - show dialog for user choice
          adjacencyDialog.value = { show: true, prevCycle: adj.prevCycle, nextCycle: adj.nextCycle, pendingCell: cell, working: false }
        }
        return
      }
    }

    quickLogDay(cell)
    return
  }

  tapContext.value = context
  selectedCell.value = cell

  if (!logged) {
    // In a cycle but no cycle_day record (drag-created or legacy)
    if (isPartner.value) return  // nothing to show partner
    mode.value = 'view'
    form.value = { flow_intensity: '', symptoms: [], notes: '' }
    return
  }

  // Already-logged day (open-cycle-day): open view panel for details/editing
  mode.value = 'view'
  form.value = {
    flow_intensity: logged.flow_intensity ?? '',
    symptoms: logged.symptoms ? logged.symptoms.split(',').map(s => s.trim()).filter(Boolean) : [],
    notes: logged.notes ?? ''
  }
}

async function quickLogDay(cell) {
  const ds = cell.dateStr

  const doLog = async () => {
    saving.value = true
    const cellEl = document.querySelector(`[data-date="${ds}"]`)
    const x = cellEl
      ? cellEl.getBoundingClientRect().left + cellEl.getBoundingClientRect().width / 2
      : window.innerWidth / 2
    try {
      const ok = await _saveCycleDayCore(ds)
      if (!ok) return
      justSaved.value = new Set([...justSaved.value, ds])
      setTimeout(() => {
        const next = new Set(justSaved.value)
        next.delete(ds)
        justSaved.value = next
      }, 1500)
      await loadData()
      const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      const isNew = tapContext.value === 'no-cycle' || tapContext.value === 'large-gap'
      showHintBubble(x, ds, isNew ? `Period started: ${fmt(ds)}` : `Period day logged: ${fmt(ds)}`, 'green')
    } finally {
      saving.value = false
    }
  }

  if (tapContext.value === 'consecutive') {
    const active = findRelevantOpenCycle(ds)
    if (active) {
      const dayCount = (new Date(ds + 'T00:00:00') - new Date(active.start_date + 'T00:00:00')) / 86400000 + 1
      if (guardLongCycle(dayCount, doLog, active.id)) return
    }
  }

  if (['no-cycle', 'large-gap'].includes(tapContext.value)) {
    if (guardShortGap(ds, doLog)) return
  }

  await doLog()
}

function closePanel() {
  selectedCell.value = null
}

function switchToEdit() {
  mode.value = 'log'
}

// ── Adjust Cycle ─────────────────────────────────────────────
function exitAdjustMode() {
  adjustingCycleId.value = null
  adjustHandle.value = null
  adjustDragActive.value = false
  adjustPreviewDate.value = null
  isDragging.value = false
  dragStart.value = null
  dragEnd.value = null
  dragMoved.value = false
}

async function commitAdjust() {
  if (!adjustingCycleId.value || !adjustPreviewDate.value || !adjustHandle.value) {
    adjustDragActive.value = false
    adjustHandle.value = null
    adjustPreviewDate.value = null
    return
  }

  // Block if the drag would overwrite another cycle
  if (adjustHasOverlap.value) {
    const cellEl = document.querySelector(`[data-date="${adjustPreviewDate.value}"]`)
    const x = cellEl ? cellEl.getBoundingClientRect().left + cellEl.getBoundingClientRect().width / 2 : window.innerWidth / 2
    showHintBubble(x, adjustPreviewDate.value, 'Overlaps an existing cycle', 'dark')
    adjustDragActive.value = false
    adjustHandle.value = null
    adjustPreviewDate.value = null
    return
  }

  const cycleId = adjustingCycleId.value
  const ac = adjustCycle.value
  const newStart = adjustHandle.value === 'start' ? adjustPreviewDate.value : ac.start_date
  const newEnd = adjustHandle.value === 'end' ? adjustPreviewDate.value : (ac.end_date || ac.last_logged_day)

  const dayCount = (new Date(newEnd + 'T00:00:00') - new Date(newStart + 'T00:00:00')) / 86400000 + 1
  if (dayCount > 10) {
    const emptyDays = allCycleDays.value.filter(d => {
      if (d.cycle_id !== cycleId) return false
      const outside = d.date < newStart || (newEnd && d.date > newEnd)
      if (!outside) return false
      return !(d.flow_intensity || d.notes || (d.symptoms && d.symptoms.trim()))
    })
    const h = adjustHandle.value
    const nd = [...adjustGhostDates.value]
    adjustDragActive.value = false
    adjustHandle.value = null
    adjustPreviewDate.value = null
    if (!guardLongCycle(dayCount, () => applyAdjust({ cycleId, newStart, newEnd, emptyDays, handle: h, newDates: nd }), cycleId)) {
      await applyAdjust({ cycleId, newStart, newEnd, emptyDays, handle: h, newDates: nd })
    }
    return
  }

  const handle = adjustHandle.value
  const emptyDays = allCycleDays.value.filter(d => {
    if (d.cycle_id !== cycleId) return false
    const outside = d.date < newStart || (newEnd && d.date > newEnd)
    if (!outside) return false
    return !(d.flow_intensity || d.notes || (d.symptoms && d.symptoms.trim()))
  })
  const newDates = [...adjustGhostDates.value]
  adjustDragActive.value = false
  adjustHandle.value = null
  adjustPreviewDate.value = null
  await applyAdjust({ cycleId, newStart, newEnd, emptyDays, handle, newDates })
  if (newStart === newEnd) exitAdjustMode()
}

async function applyAdjust({ cycleId, newStart, newEnd, emptyDays, handle, newDates = [] }) {
  await apiFetch(`${API}/premium/period/cycles/${cycleId}/adjust`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(handle === 'start' ? { start_date: newStart } : { end_date: newEnd })
  })
  if (emptyDays.length) {
    await Promise.all(emptyDays.map(d => apiFetch(`${API}/period/cycle-days/${d.id}`, { method: 'DELETE' })))
  }
  await loadData()
  if (newDates.length) flashDates(newDates)
}

async function confirmLongCycleAdjust() {
  showLongCycleDialog.value = false
  const fn = longCyclePendingFn.value
  longCyclePendingFn.value = null
  if (fn) await fn()
}

function cancelLongCycleAdjust() {
  showLongCycleDialog.value = false
  longCyclePendingFn.value = null
}

function guardShortGap(newStartDate, fn) {
  // Check the cycle that ends closest before newStartDate
  const preceding = allCycles.value
    .filter(c => c.end_date && c.end_date < newStartDate)
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0]
  if (preceding) {
    const days = Math.round(
      (new Date(newStartDate + 'T00:00:00') - new Date(preceding.end_date + 'T00:00:00')) / 86400000
    )
    if (days > 0 && days < 7) {
      shortGapDays.value = days
      shortGapPendingFn.value = fn
      showShortGapDialog.value = true
      return true
    }
  }
  // Check the cycle that starts closest after newStartDate
  const following = allCycles.value
    .filter(c => c.start_date > newStartDate)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  if (following) {
    const days = Math.round(
      (new Date(following.start_date + 'T00:00:00') - new Date(newStartDate + 'T00:00:00')) / 86400000
    )
    if (days > 0 && days < 7) {
      shortGapDays.value = days
      shortGapPendingFn.value = fn
      showShortGapDialog.value = true
      return true
    }
  }
  return false
}

async function confirmShortGap() {
  showShortGapDialog.value = false
  const fn = shortGapPendingFn.value
  shortGapPendingFn.value = null
  if (fn) await fn()
}

function cancelShortGap() {
  showShortGapDialog.value = false
  shortGapPendingFn.value = null
}

function guardLongCycle(dayCount, fn, cycleId = null) {
  if (dayCount > 10 && (cycleId === null || !longCycleWarnedIds.has(cycleId))) {
    longCycleDays.value = Math.round(dayCount)
    longCyclePendingFn.value = async () => {
      if (cycleId !== null) longCycleWarnedIds.add(cycleId)
      await fn()
    }
    showLongCycleDialog.value = true
    return true
  }
  return false
}

async function deleteOrphanedDay() {
  const ds = selectedCell.value?.dateStr
  if (!ds) return
  const day = allCycleDays.value.find(d => d.date === ds)
  if (!day) return
  await apiFetch(`${API}/period/cycle-days/${day.id}`, { method: 'DELETE' })
  closePanel()
  await loadData()
}

function onAdjustKeydown(ev) {
  if (ev.key === 'Escape' && adjustingCycleId.value) exitAdjustMode()
}

// ── Drag-to-select ───────────────────────────────────────────
function onCellMouseDown(cell, ev) {
  if (isTouchInteraction) return
  // If in adjust mode, clicking a handle starts a resize drag;
  // clicking inside the same cycle does nothing; clicking elsewhere exits
  if (adjustingCycleId.value) {
    const ac = adjustCycle.value
    if (ac) {
      const acEnd = ac.end_date || ac.last_logged_day
      if (cell.dateStr === ac.start_date) {
        adjustHandle.value = 'start'
        adjustPreviewDate.value = cell.dateStr
        adjustDragActive.value = true
        return
      }
      if (cell.dateStr === acEnd) {
        adjustHandle.value = 'end'
        adjustPreviewDate.value = cell.dateStr
        adjustDragActive.value = true
        return
      }
      // Clicking inside the active cycle body: stay in adjust mode, no action
      if (dateToCycleId.value.get(cell.dateStr) === adjustingCycleId.value) return
    }
    exitAdjustMode()
    return
  }

  // Period cell: hold-to-adjust only — no drag-to-log
  if (!isPartner.value && periodDates.value.has(cell.dateStr)) {
    const cycleId = dateToCycleId.value.get(cell.dateStr)
    const cycle = allCycles.value.find(c => c.id === cycleId)
    const cycleEnd = cycle?.end_date || cycle?.last_logged_day
    if (cycleId && cycle && cycle.start_date !== cycleEnd) {
      dragStart.value = cell.dateStr
      adjustVibrateTimer.value = setTimeout(() => {
        adjustVibrateTimer.value = null
        holdPendingCycleId.value = cycleId
      }, 250)
      // PREMIUM GATE (frontend) — checked after vibrate so the user sees hold feedback first
      adjustHoldTimer.value = setTimeout(() => {
        adjustHoldTimer.value = null
        holdPendingCycleId.value = null
        dragStart.value = null
        if (!isPremium.value) { adjustGateOpen.value = true; return }
        adjustingCycleId.value = cycleId
      }, 500)
      return
    }
  }

  // Gap cell: hold 500ms to open ovulation/notes panel
  if (!isPartner.value && cell.dateStr <= todayStr && !orphanedDaySet.value.has(cell.dateStr) && !periodDates.value.has(cell.dateStr)) {
    gapVibrateTimer.value = setTimeout(() => {
      gapVibrateTimer.value = null
      gapHoldPendingDate.value = cell.dateStr
    }, 250)
    gapHoldTimer.value = setTimeout(() => {
      gapHoldTimer.value = null
      gapHoldPendingDate.value = null
      if (dragMoved.value) return
      isDragging.value = false
      dragStart.value = null
      dragEnd.value = null
      dragMoved.value = false
      tapContext.value = null
      form.value = { flow_intensity: '', symptoms: [], notes: '' }
      gapMode.value = 'view'
      gapForm.value = { symptoms: [], notes: '' }
      selectedCell.value = cell
      mode.value = 'view'
    }, 500)
  }

  isDragging.value = true
  dragMoved.value = false
  dragStart.value = cell.dateStr
  dragEnd.value = cell.dateStr
}

function onCellMouseEnter(cell) {
  if (adjustDragActive.value && cell.dateStr) {
    adjustPreviewDate.value = cell.dateStr
    return
  }
  // Cancel period hold on movement to a different cell — no drag-to-log fallback
  if (adjustHoldTimer.value && cell.dateStr !== dragStart.value) {
    clearTimeout(adjustHoldTimer.value)
    adjustHoldTimer.value = null
    if (adjustVibrateTimer.value) { clearTimeout(adjustVibrateTimer.value); adjustVibrateTimer.value = null }
    holdPendingCycleId.value = null
    dragStart.value = null
    return
  }
  if (gapHoldTimer.value && cell.dateStr !== dragStart.value) {
    clearTimeout(gapHoldTimer.value)
    gapHoldTimer.value = null
    if (gapVibrateTimer.value) { clearTimeout(gapVibrateTimer.value); gapVibrateTimer.value = null }
    gapHoldPendingDate.value = null
  }
  if (!isDragging.value || !cell.dateStr) return
  dragEnd.value = cell.dateStr
  if (cell.dateStr !== dragStart.value) dragMoved.value = true
}

function onDocumentMouseUp(ev = {}) {
  // Complete adjust-drag
  if (adjustDragActive.value) {
    commitAdjust()
    return
  }

  // Early release on a period hold: treat as a normal tap
  if (adjustHoldTimer.value) {
    clearTimeout(adjustHoldTimer.value)
    adjustHoldTimer.value = null
    if (adjustVibrateTimer.value) { clearTimeout(adjustVibrateTimer.value); adjustVibrateTimer.value = null }
    holdPendingCycleId.value = null
    periodHoldTouchStart.value = null
    const startDate = dragStart.value
    dragStart.value = null
    const cell = calendarCells.value.find(c => c.dateStr === startDate)
    if (cell && cell.day && !cell.faded) onDayClick(cell)
    return
  }
  if (gapHoldTimer.value) {
    clearTimeout(gapHoldTimer.value)
    gapHoldTimer.value = null
    if (gapVibrateTimer.value) { clearTimeout(gapVibrateTimer.value); gapVibrateTimer.value = null }
    gapHoldPendingDate.value = null
  }

  if (!isDragging.value) return
  isDragging.value = false

  if (!dragMoved.value) {
    // Single cell: treat as a tap/click
    const startDate = dragStart.value
    const cell = calendarCells.value.find(c => c.dateStr === startDate)
    dragStart.value = null
    dragEnd.value = null
    if (startDate > todayStr && !periodDates.value.has(startDate)) {
      if (ev.clientX != null) showHintBubble(ev.clientX, startDate)
      return
    }
    if (cell && cell.day && !cell.faded) onDayClick(cell)
    return
  }

  const s = dragStart.value <= dragEnd.value ? dragStart.value : dragEnd.value
  const e = dragStart.value <= dragEnd.value ? dragEnd.value : dragStart.value
  dragMoved.value = false

  if (e > todayStr) {
    dragStart.value = null
    dragEnd.value = null
    if (ev.clientX != null) showHintBubble(ev.clientX, e)
    return
  }

  if (hasOverlap(s, e)) {
    dragStart.value = null
    dragEnd.value = null
    if (ev.clientX != null) showHintBubble(ev.clientX, e, 'Overlaps an existing cycle')
    return
  }

  if (isPartner.value) { dragStart.value = null; dragEnd.value = null; return }
  doSwipeCreate(ev.clientX ?? window.innerWidth / 2, s, e)
}

function hasOverlap(start, end) {
  return allCycles.value.some(cycle => {
    const cEnd = cycle.end_date || cycle.last_logged_day
    if (!cEnd) return start <= cycle.start_date && end >= cycle.start_date
    return start <= cEnd && end >= cycle.start_date
  })
}

// Prevent synthetic mousedown/mouseup fired by the browser after a touch sequence
// from being double-processed by the mouse handlers.
let isTouchInteraction = false
let touchResetTimer = null

// Touch equivalents
function onTouchStart(e) {
  isTouchInteraction = true
  if (touchResetTimer) { clearTimeout(touchResetTimer); touchResetTimer = null }
  const touch = e.touches[0]
  const el = document.elementFromPoint(touch.clientX, touch.clientY)
  const cellEl = el?.closest('[data-date]')
  if (!cellEl) return
  const dateStr = cellEl.dataset.date

  // Adjust mode: touching a handle starts the drag; touching elsewhere exits
  if (adjustingCycleId.value) {
    const ac = adjustCycle.value
    if (ac) {
      const acEnd = ac.end_date || ac.last_logged_day
      if (dateStr === ac.start_date) {
        adjustHandle.value = 'start'
        adjustPreviewDate.value = dateStr
        adjustDragActive.value = true
        return
      }
      if (dateStr === acEnd) {
        adjustHandle.value = 'end'
        adjustPreviewDate.value = dateStr
        adjustDragActive.value = true
        return
      }
      if (dateToCycleId.value.get(dateStr) === adjustingCycleId.value) return
    }
    exitAdjustMode()
    return
  }

  // Period cell: hold-to-adjust only — no drag-to-log
  if (!isPartner.value && periodDates.value.has(dateStr)) {
    const cycleId = dateToCycleId.value.get(dateStr)
    const cycle = allCycles.value.find(c => c.id === cycleId)
    const cycleEnd = cycle?.end_date || cycle?.last_logged_day
    if (cycleId && cycle && cycle.start_date !== cycleEnd) {
      dragStart.value = dateStr
      periodHoldTouchStart.value = { x: touch.clientX, y: touch.clientY }
      adjustVibrateTimer.value = setTimeout(() => {
        adjustVibrateTimer.value = null
        holdPendingCycleId.value = cycleId
      }, 250)
      // PREMIUM GATE (frontend) — checked after vibrate so the user sees hold feedback first
      adjustHoldTimer.value = setTimeout(() => {
        adjustHoldTimer.value = null
        holdPendingCycleId.value = null
        dragStart.value = null
        periodHoldTouchStart.value = null
        if (!isPremium.value) { adjustGateOpen.value = true; return }
        adjustingCycleId.value = cycleId
      }, 500)
      // Fall through to set isDragging=true so onDocumentMouseUp has a fallback
      // tap path (!dragMoved branch) if Android prematurely clears adjustHoldTimer.
    }
  }

  // Gap cell: hold 500ms to open ovulation/notes panel
  if (!isPartner.value && dateStr <= todayStr && !periodDates.value.has(dateStr)) {
    const cell = calendarCells.value.find(c => c.dateStr === dateStr)
    if (cell && !orphanedDaySet.value.has(dateStr)) {
      gapVibrateTimer.value = setTimeout(() => {
        gapVibrateTimer.value = null
        gapHoldPendingDate.value = dateStr
      }, 250)
      gapHoldTimer.value = setTimeout(() => {
        gapHoldTimer.value = null
        gapHoldPendingDate.value = null
        if (dragMoved.value) return
        isDragging.value = false
        dragStart.value = null
        dragEnd.value = null
        dragMoved.value = false
        tapContext.value = null
        form.value = { flow_intensity: '', symptoms: [], notes: '' }
        gapMode.value = 'view'
        gapForm.value = { symptoms: [], notes: '' }
        selectedCell.value = cell
        mode.value = 'view'
      }, 500)
    }
  }

  isDragging.value = true
  dragMoved.value = false
  dragStart.value = dateStr
  dragEnd.value = dateStr
}

function onTouchMove(e) {
  const touch = e.touches[0]
  const el = document.elementFromPoint(touch.clientX, touch.clientY)
  const cellEl = el?.closest('[data-date]')
  if (!cellEl) return
  const dateStr = cellEl.dataset.date
  if (adjustHoldTimer.value) {
    const ps = periodHoldTouchStart.value
    const dx = ps ? Math.abs(touch.clientX - ps.x) : 0
    const dy = ps ? Math.abs(touch.clientY - ps.y) : 0
  }

  // Propagate adjust drag on touch
  if (adjustDragActive.value) {
    adjustPreviewDate.value = dateStr
    return
  }

  // Cancel period hold only on intentional movement (>10px) — not micro-movements from Android touch jitter
  if (adjustHoldTimer.value) {
    const ps = periodHoldTouchStart.value
    const moved = ps && (Math.abs(touch.clientX - ps.x) > 10 || Math.abs(touch.clientY - ps.y) > 10)
    if (moved) {
      clearTimeout(adjustHoldTimer.value)
      adjustHoldTimer.value = null
      if (adjustVibrateTimer.value) { clearTimeout(adjustVibrateTimer.value); adjustVibrateTimer.value = null }
      holdPendingCycleId.value = null
      periodHoldTouchStart.value = null
      dragStart.value = null
    }
    return
  }
  if (gapHoldTimer.value && dateStr !== dragStart.value) {
    clearTimeout(gapHoldTimer.value)
    gapHoldTimer.value = null
    if (gapVibrateTimer.value) { clearTimeout(gapVibrateTimer.value); gapVibrateTimer.value = null }
    gapHoldPendingDate.value = null
  }

  if (!isDragging.value) return

  if (dateStr !== dragEnd.value) {
    dragEnd.value = dateStr
    if (dateStr !== dragStart.value) dragMoved.value = true
  }
}

function onTouchEnd(e) {
  touchResetTimer = setTimeout(() => { isTouchInteraction = false; touchResetTimer = null }, 500)
  const touch = e.changedTouches[0]
  onDocumentMouseUp(touch ? { clientX: touch.clientX, clientY: touch.clientY } : {})
}

async function markOvulation() {
  if (!ovulationCycle.value || !selectedCell.value) return
  markingOvulation.value = true
  try {
    const newDate = isMarkedOvulation.value ? null : selectedCell.value.dateStr
    await apiFetch(`${API}/period/cycles/${ovulationCycle.value.id}/ovulation`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ovulation_date: newDate })
    })
    await loadData()
  } finally {
    markingOvulation.value = false
  }
}

async function doSwipeCreate(x, s, e) {
  const dayCount = (new Date(e + 'T00:00:00') - new Date(s + 'T00:00:00')) / 86400000 + 1
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const label = s === e ? fmt(s) : `${fmt(s)} → ${fmt(e)}`

  const doCreate = async () => {
    dragRange.value = { start: s, end: e }
    creating.value = true
    try {
      const startRes = await apiFetch(`${API}/period/cycles/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: s,
          predicted_start_date: summary.value?.nextPeriodDate ?? null
        })
      })
      const { id } = await startRes.json()
      await apiFetch(`${API}/period/cycles/${id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ end_date: e })
      })
      const allDays = []
      let cur = new Date(s + 'T00:00:00')
      const endD = new Date(e + 'T00:00:00')
      while (cur <= endD) { allDays.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1) }
      await Promise.all(allDays.map(date => apiFetch(`${API}/period/cycle-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: id, date })
      })))
      dragRange.value = null
      dragStart.value = null
      dragEnd.value = null
      await loadData()
      flashDates(allDays)
      showHintBubble(x, s, `Period logged: ${label}`, 'green')
    } finally {
      creating.value = false
    }
  }

  if (guardShortGap(s, doCreate)) {
    dragStart.value = null
    dragEnd.value = null
    return
  }

  if (guardLongCycle(dayCount, doCreate)) {
    dragStart.value = null
    dragEnd.value = null
    return
  }

  await doCreate()
}

const selectedLoggedDay = computed(() => {
  if (!selectedCell.value) return null
  return loggedDayMap.value[selectedCell.value.dateStr] ?? null
})

const selectedCycle = computed(() => {
  if (!selectedCell.value) return null
  const ds = selectedCell.value.dateStr
  return allCycles.value.find(c => {
    const end = c.end_date || c.last_logged_day
    return c.start_date <= ds && (!end || end >= ds)
  }) ?? null
})

const isEdgeDay = computed(() => {
  const ds = selectedCell.value?.dateStr
  const c = selectedCycle.value
  if (!ds || !c) return null
  if (ds === c.start_date) return 'first'
  const end = c.end_date || c.last_logged_day
  if (end && ds === end) return 'last'
  return null
})

const selectedCycleLabel = computed(() => {
  if (!selectedCycle.value) return ''
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const c = selectedCycle.value
  const end = c.end_date || c.last_logged_day
  if (!end || end === c.start_date) return fmt(c.start_date)
  return `${fmt(c.start_date)} → ${fmt(end)}`
})

const selectedCycleWarnings = computed(() =>
  selectedCycle.value ? (cycleWarningMap.value.get(selectedCycle.value.id) ?? []) : []
)

const selectedCycleStartLabel = computed(() => {
  if (!selectedCycle.value) return ''
  return new Date(selectedCycle.value.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

const selectedSymptoms = computed(() => {
  if (!selectedLoggedDay.value?.symptoms) return []
  return selectedLoggedDay.value.symptoms.split(',').map(s => s.trim()).filter(Boolean)
})

const selectedDateLabel = computed(() => {
  if (!selectedCell.value?.dateStr) return ''
  return new Date(selectedCell.value.dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
})

const selectedDayType = computed(() => {
  if (!selectedCell.value?.dateStr) return ''
  const ds = selectedCell.value.dateStr
  switch (tapContext.value) {
    case 'no-cycle':       return 'Starting period'
    case 'consecutive':    return 'Period day'
    case 'large-gap':      return 'Start new period?'
    case 'closed-cycle':   return 'Log details'
    case 'open-cycle-day': return 'Period day'
    case 'orphaned':       return 'Logged data outside cycle'
  }
  // View-mode fallback (future dates, ovulation zone, existing data)
  if (periodDates.value.has(ds)) return 'Period day'
  if (markedOvulationDates.value.has(ds)) return 'Ovulation day'
  if (predictedOvulationDates.value.has(ds)) return 'Predicted ovulation'
  if (fertileDates.value.has(ds)) return 'Fertile window'
  if (predictedDates.value.has(ds)) return 'Predicted period'
  return 'No cycle data'
})

// ── Form helpers ─────────────────────────────────────────────
function toggleSymptom(s) {
  const idx = form.value.symptoms.indexOf(s)
  if (idx === -1) form.value.symptoms.push(s)
  else form.value.symptoms.splice(idx, 1)
}

function toggleGapSymptom(s) {
  const idx = gapForm.value.symptoms.indexOf(s)
  if (idx === -1) gapForm.value.symptoms.push(s)
  else gapForm.value.symptoms.splice(idx, 1)
}

async function saveGapDay() {
  if (!selectedCell.value) return
  savingGap.value = true
  const ds = selectedCell.value.dateStr
  try {
    const hasData = gapForm.value.symptoms.length > 0 || !!gapForm.value.notes
    if (!hasData && gapDayLog.value) {
      await apiFetch(`${API}/period/gap-days/${gapDayLog.value.id}`, { method: 'DELETE' })
    } else if (hasData) {
      if (gapDayLog.value) {
        await apiFetch(`${API}/period/gap-days/${gapDayLog.value.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: gapForm.value.notes || null, symptoms: gapForm.value.symptoms })
        })
      } else {
        await apiFetch(`${API}/period/gap-days`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: ds, notes: gapForm.value.notes || null, symptoms: gapForm.value.symptoms })
        })
      }
    }
    if (gapForm.value.ovulation !== isMarkedOvulation.value) {
      await apiFetch(`${API}/period/cycles/${ovulationCycle.value.id}/ovulation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ovulation_date: gapForm.value.ovulation ? ds : null })
      })
    }
    await loadData()
    if (!hasData && !gapForm.value.ovulation) {
      selectedCell.value = null
    } else {
      gapMode.value = 'view'
      flashDates([ds])
    }
  } finally {
    savingGap.value = false
  }
}

async function deleteGapDay() {
  if (!gapDayLog.value && !isMarkedOvulation.value) return
  deletingGapDay.value = true
  const ds = selectedCell.value?.dateStr
  try {
    if (gapDayLog.value) {
      await apiFetch(`${API}/period/gap-days/${gapDayLog.value.id}`, { method: 'DELETE' })
    }
    if (isMarkedOvulation.value && ovulationCycle.value) {
      await apiFetch(`${API}/period/cycles/${ovulationCycle.value.id}/ovulation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ovulation_date: null })
      })
    }
    await loadData()
    selectedCell.value = null
  } finally {
    deletingGapDay.value = false
  }
}

async function saveDay() {
  if (!selectedCell.value) return
  saving.value = true
  const ds = selectedCell.value.dateStr
  try {
    const ok = await _saveCycleDayCore(ds)
    if (!ok) return
    justSaved.value = new Set([...justSaved.value, ds])
    setTimeout(() => {
      const next = new Set(justSaved.value)
      next.delete(ds)
      justSaved.value = next
    }, 1500)
    mode.value = 'view'
    await loadData()
  } finally {
    saving.value = false
  }
}

async function onAdjacencyExtendPrevSilent(prevCycle, cell) {
  const dayCount = (new Date(cell.dateStr + 'T00:00:00') - new Date(prevCycle.start_date + 'T00:00:00')) / 86400000 + 1
  const doExtend = async () => {
    try {
      await apiFetch(`${API}/period/cycles/${prevCycle.id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ end_date: cell.dateStr })
      })
      // Create a cycle_day for the tapped date so it's tracked individually.
      // Without this, retroactive tap-by-tap logging only creates a cycle_day for the
      // first day — subsequent adjacent taps only extend end_date, leaving no rows.
      await apiFetch(`${API}/period/cycle-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: prevCycle.id, date: cell.dateStr })
      })
      await loadData()
      const cellEl = document.querySelector(`[data-date="${cell.dateStr}"]`)
      const x = cellEl ? cellEl.getBoundingClientRect().left + cellEl.getBoundingClientRect().width / 2 : window.innerWidth / 2
      showHintBubble(x, cell.dateStr, 'Period extended', 'green')
    } catch (err) {
      console.error('Failed to extend previous cycle:', err)
    }
  }
  if (guardLongCycle(dayCount, doExtend, prevCycle.id)) return
  await doExtend()
}

async function onAdjacencyExtendNextSilent(nextCycle, cell) {
  const cycleEnd = nextCycle.end_date || nextCycle.last_logged_day
  const dayCount = cycleEnd
    ? (new Date(cycleEnd + 'T00:00:00') - new Date(cell.dateStr + 'T00:00:00')) / 86400000 + 1
    : 1
  const doExtend = async () => {
    try {
      await apiFetch(`${API}/period/cycles/${nextCycle.id}/start`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: cell.dateStr })
      })
      await apiFetch(`${API}/period/cycle-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: nextCycle.id, date: cell.dateStr })
      })
      await loadData()
      const cellEl = document.querySelector(`[data-date="${cell.dateStr}"]`)
      const x = cellEl ? cellEl.getBoundingClientRect().left + cellEl.getBoundingClientRect().width / 2 : window.innerWidth / 2
      showHintBubble(x, cell.dateStr, 'Period start moved', 'green')
    } catch (err) {
      console.error('Failed to move next cycle start:', err)
    }
  }
  if (guardLongCycle(dayCount, doExtend, nextCycle.id)) return
  await doExtend()
}

async function onAdjacencyExtendPrev() {
  const { prevCycle, pendingCell } = adjacencyDialog.value
  const dayCount = (new Date(pendingCell.dateStr + 'T00:00:00') - new Date(prevCycle.start_date + 'T00:00:00')) / 86400000 + 1
  const doExtend = async () => {
    adjacencyDialog.value.working = true
    try {
      await apiFetch(`${API}/period/cycles/${prevCycle.id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ end_date: pendingCell.dateStr })
      })
      adjacencyDialog.value.show = false
      await loadData()
      const cellEl = document.querySelector(`[data-date="${pendingCell.dateStr}"]`)
      const x = cellEl ? cellEl.getBoundingClientRect().left + cellEl.getBoundingClientRect().width / 2 : window.innerWidth / 2
      showHintBubble(x, pendingCell.dateStr, 'Period extended', 'green')
    } finally {
      adjacencyDialog.value.working = false
    }
  }
  if (guardLongCycle(dayCount, doExtend, prevCycle.id)) {
    adjacencyDialog.value.show = false
    return
  }
  await doExtend()
}

async function onAdjacencyExtendNext() {
  const { nextCycle, pendingCell } = adjacencyDialog.value
  const cycleEnd = nextCycle.end_date || nextCycle.last_logged_day
  const dayCount = cycleEnd
    ? (new Date(cycleEnd + 'T00:00:00') - new Date(pendingCell.dateStr + 'T00:00:00')) / 86400000 + 1
    : 1
  const doExtend = async () => {
    adjacencyDialog.value.working = true
    try {
      await apiFetch(`${API}/period/cycles/${nextCycle.id}/start`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: pendingCell.dateStr })
      })
      adjacencyDialog.value.show = false
      await loadData()
      const cellEl = document.querySelector(`[data-date="${pendingCell.dateStr}"]`)
      const x = cellEl ? cellEl.getBoundingClientRect().left + cellEl.getBoundingClientRect().width / 2 : window.innerWidth / 2
      showHintBubble(x, pendingCell.dateStr, 'Period start moved', 'green')
    } finally {
      adjacencyDialog.value.working = false
    }
  }
  if (guardLongCycle(dayCount, doExtend, nextCycle.id)) {
    adjacencyDialog.value.show = false
    return
  }
  await doExtend()
}

function onAdjacencyNewPeriod() {
  const { pendingCell } = adjacencyDialog.value
  adjacencyDialog.value.show = false
  quickLogDay(pendingCell)
}

async function deleteCycle() {
  const cycle = selectedCycle.value
  if (!cycle) return
  deletingCycle.value = true
  let cancelAnim
  try {
    const end = cycle.end_date || cycle.last_logged_day
    const dates = []
    if (end) {
      const cur = new Date(cycle.start_date + 'T00:00:00')
      const endD = new Date(end + 'T00:00:00')
      while (cur <= endD) {
        dates.push(cur.toISOString().split('T')[0])
        cur.setDate(cur.getDate() + 1)
      }
    } else {
      dates.push(cycle.start_date)
    }
    cancelAnim = flashDeleteDates(dates)
    const animDone = new Promise(r => setTimeout(r, dates.length * 30 + 220))
    await apiFetch(`${API}/period/cycles/${cycle.id}`, { method: 'DELETE' })
    showDeleteCycleDialog.value = false
    closePanel()
    await animDone
    await loadData()
  } finally {
    deletingCycle.value = false
    cancelAnim?.()
  }
}

// ── Day-by-day logging ───────────────────────────────────────
async function removeDay() {
  const ds = selectedCell.value?.dateStr
  const c = selectedCycle.value
  if (!isEdgeDay.value || !ds || !c) return
  removingDay.value = true
  let cancelAnim
  try {
    cancelAnim = flashDeleteDates([ds])
    const animDone = new Promise(r => setTimeout(r, 250))
    const day = selectedLoggedDay.value
    if (day) {
      await apiFetch(`${API}/period/cycle-days/${day.id}`, { method: 'DELETE' })
    } else if (isEdgeDay.value === 'last') {
      const prev = new Date(ds + 'T00:00:00')
      prev.setDate(prev.getDate() - 1)
      const newEnd = prev.toISOString().split('T')[0]
      if (newEnd < c.start_date) {
        await apiFetch(`${API}/period/cycles/${c.id}`, { method: 'DELETE' })
      } else {
        await apiFetch(`${API}/period/cycles/${c.id}/adjust`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ end_date: newEnd })
        })
      }
    } else if (isEdgeDay.value === 'first') {
      const next = new Date(ds + 'T00:00:00')
      next.setDate(next.getDate() + 1)
      const newStart = next.toISOString().split('T')[0]
      const end = c.end_date || c.last_logged_day
      if (end && newStart > end) {
        await apiFetch(`${API}/period/cycles/${c.id}`, { method: 'DELETE' })
      } else {
        await apiFetch(`${API}/period/cycles/${c.id}/adjust`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_date: newStart })
        })
      }
    }
    closePanel()
    // If the deleted day falls within the predicted period window it will reappear as a
    // predicted tail cell. Load data first so predictedCurrentEndDates updates mid-fade and
    // getCellClass can swap to cal-predicted smoothly rather than snapping in after transparency.
    const avgLen = summary.value?.avgPeriodLength
    const predictedEnd = avgLen && c?.start_date
      ? (() => { const e = new Date(c.start_date + 'T00:00:00'); e.setDate(e.getDate() + avgLen - 1); return e.toISOString().split('T')[0] })()
      : null
    const willBecomePredicted = !!(predictedEnd && ds <= predictedEnd)
    if (willBecomePredicted) {
      await loadData()
      await animDone
    } else {
      await animDone
      await loadData()
    }
  } finally {
    removingDay.value = false
    cancelAnim?.()
  }
}

async function endActivePeriod() {
  const active = relevantActiveCycle.value
  const ds = selectedCell.value?.dateStr
  if (!active || !ds) return
  endingPeriod.value = true
  try {
    await apiFetch(`${API}/period/cycles/${active.id}/end`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ end_date: ds })
    })
    closePanel()
    await loadData()
  } finally {
    endingPeriod.value = false
  }
}

// Core: resolves cycleId and saves the cycle-day record.
// Returns the cycleId on success, null on failure.
async function _saveCycleDayCore(ds) {
  const existing = loggedDayMap.value[ds]
  const ctx = tapContext.value
  let cycleId = existing?.cycle_id ?? null

  if (!cycleId) {
    if (ctx === 'no-cycle') {
      const res = await apiFetch(`${API}/period/cycles/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: ds, predicted_start_date: summary.value?.nextPeriodDate ?? null })
      })
      const data = await res.json()
      cycleId = data.id
    } else if (ctx === 'large-gap') {
      const res = await apiFetch(`${API}/period/cycles/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: ds, predicted_start_date: summary.value?.nextPeriodDate ?? null })
      })
      const data = await res.json()
      cycleId = data.id
    } else if (ctx === 'consecutive') {
      const active = findRelevantOpenCycle(ds)
      if (!active) return null
      cycleId = active.id
    } else if (ctx === 'open-cycle-day') {
      const match = allCycles.value.find(c => {
        const end = c.end_date || c.last_logged_day
        return c.start_date <= ds && (!end || end >= ds)
      })
      if (!match) return null
      cycleId = match.id
    }
  }

  if (!cycleId) return null

  if (existing) {
    await apiFetch(`${API}/period/cycle-days/${existing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flow_intensity: form.value.flow_intensity || null,
        notes: form.value.notes || null,
        symptoms: form.value.symptoms
      })
    })
  } else {
    await apiFetch(`${API}/period/cycle-days`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cycle_id: cycleId,
        date: ds,
        flow_intensity: form.value.flow_intensity || null,
        notes: form.value.notes || null,
        symptoms: form.value.symptoms
      })
    })
  }

  return cycleId
}

async function saveAndEndPeriod() {
  if (!selectedCell.value) return
  saving.value = true
  const ds = selectedCell.value.dateStr
  try {
    const cycleId = await _saveCycleDayCore(ds)
    if (!cycleId) return
    await apiFetch(`${API}/period/cycles/${cycleId}/end`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ end_date: ds })
    })
    justSaved.value = new Set([...justSaved.value, ds])
    setTimeout(() => {
      const next = new Set(justSaved.value)
      next.delete(ds)
      justSaved.value = next
    }, 1500)
    closePanel()
    await loadData()
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  resetView()
  loadData()
  fetchSettings()
  fetchLicenseStatus()
  document.addEventListener('mouseup', onDocumentMouseUp)
  document.addEventListener('touchend', onTouchEnd, { passive: true })
  document.addEventListener('keydown', onAdjustKeydown)
})

onUnmounted(() => {
  document.removeEventListener('mouseup', onDocumentMouseUp)
  document.removeEventListener('touchend', onTouchEnd)
  document.removeEventListener('keydown', onAdjustKeydown)
  if (hintBubbleTimer) clearTimeout(hintBubbleTimer)
  if (touchResetTimer) clearTimeout(touchResetTimer)
  if (adjustHoldTimer.value) clearTimeout(adjustHoldTimer.value)
  if (gapHoldTimer.value) clearTimeout(gapHoldTimer.value)
  if (gapVibrateTimer.value) clearTimeout(gapVibrateTimer.value)
})
</script>

<style scoped>
.period-column-root {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: calc(100vh - 2.5rem);
  box-sizing: border-box;
}
.period-wrapper {
  padding: 1.25rem;
  max-width: 480px;
  margin: 0 auto;
}

@media (max-width: 1279px) {
  .period-column-root { height: 100%; overflow-y: auto; min-height: unset; }
}

@media (min-width: 769px) {
  .period-wrapper {
    max-width: 540px;
    transform: scale(1.12);
    transform-origin: top center;
  }
}

@media (max-width: 1279px) {
  .period-wrapper {
    max-width: 100%;
    transform: none;
    margin: 0;
  }
}

/* Header */
.period-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1rem;
  flex-shrink: 0;
}
.back-chip {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 1px;
  background: #fff;
  color: #993556;
  border: 1px solid #F4C0D1;
  border-radius: 99px;
  padding: 5px 12px 5px 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.back-chip:hover { background: #fdf5f8; }

@media (min-width: 1280px) {
  .back-chip--mobile-only { display: none; }
}

@media (min-width: 1280px) {
  .period-wrapper {
    transform: none;
    margin: 0;
    max-width: 100%;
  }
}
.period-title { font-size: 22px; font-weight: 700; margin: 0; line-height: 1.2; color: #72243E; }

.settings-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  padding: 2px;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.65;
  transition: opacity 0.15s;
}
.settings-icon-btn:hover { opacity: 1; }

/* Premium variant — same shape as the regular ? button, with a small unlocked-lock
   corner badge to signal premium content. No tint or recolor on the button itself
   so the two buttons read as siblings, not competitors. */
.settings-icon-btn--premium { position: relative; }
.settings-icon-btn--premium .premium-corner-badge {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #993556;
  border: 1.5px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

/* Warnings card */
.warnings-card {
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 12px;
  margin-top: 1rem;
  overflow: hidden;
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

/* Calendar cell badges (bottom-right icons) */
.cal-cell-badges {
  position: absolute;
  bottom: 2px;
  right: 2px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-end;
  pointer-events: none;
}
.cal-cell-badge {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  position: relative;
}
.cal-cell-badge .v-icon {
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  -webkit-transform: translate(-50%, -50%) !important;
  font-size: 16px !important;
  line-height: 1 !important;
  margin: 0 !important;
  padding: 0 !important;
  width: auto !important;
  height: auto !important;
}
@media (max-width: 600px) {
  .cal-cell-badge {
    width: 13px;
    height: 13px;
  }
  .cal-cell-badge .v-icon {
    font-size: 11px !important;
  }
}
.cal-cell-badge-warn { background: rgba(254, 243, 199, 0.9); }
.cal-cell-badge-note { background: rgba(226, 232, 240, 0.9); }


/* Status card */
.status-card {
  background: #FBEAF0;
  border: 1px solid #F4C0D1;
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 1rem;
}
.status-row { display: flex; align-items: center; }
.status-item { flex: 1; text-align: center; }
.status-divider { width: 1px; height: 32px; background: #F4C0D1; }
.status-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #993556; margin: 0 0 2px; }
.status-value { font-size: 13px; font-weight: 500; color: #72243E; margin: 0; }

/* Month nav */
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.month-label { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: #72243E; margin: 0; display: flex; align-items: center; gap: 6px; line-height: 1; text-transform: uppercase; }
.month-btn {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid #F4C0D1; background: #FBEAF0;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

/* Calendar */
.calendar {
  background: #FBEAF0;
  border: 1px solid #F4C0D1;
  border-radius: 16px;
  padding: 12px;
  margin-bottom: 0.75rem;
}
.cal-header-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 6px;
}
.cal-dow {
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  color: #993556;
  letter-spacing: 0.04em;
  padding: 4px 0;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  touch-action: none;
}
.cal-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  cursor: default;
  position: relative;
  gap: 2px;
  transition: background 0.15s ease;
  user-select: none;
}
.cal-cell-day { cursor: pointer; }
.cal-cell-day:hover { background: #F4C0D1; }
.cal-cell-empty { cursor: default; }
.cal-cell-faded { cursor: default; }
.cal-cell-faded .cal-day-num { color: #D4A8B8; font-size: 13px; line-height: 1; }

.cal-saved-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--flow-hue), 65%, 58%);
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  z-index: 10;
  animation: check-pulse 1.2s ease forwards;
}

@keyframes check-pulse {
  0%   { opacity: 0; transform: scale(0.85); }
  20%  { opacity: 1; transform: scale(1.15); }
  40%  { transform: scale(1); }
  75%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes warning-pulse {
  0%   { box-shadow: 0 0 0 0px rgba(245, 158, 11, 0); }
  25%  { box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.9); }
  60%  { box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.5); }
  100% { box-shadow: 0 0 0 0px rgba(245, 158, 11, 0); }
}
@keyframes cell-delete-out {
  to { background-color: transparent; background-image: none; border-color: transparent; box-shadow: none; }
}
@keyframes day-num-to-dark {
  to { color: #72243E; }
}
.cal-cell-fading {
  animation: cell-delete-out 200ms ease-in forwards;
}
.cal-cell-fading .cal-day-num {
  animation: day-num-to-dark 200ms ease-in forwards;
  font-weight: 400;
}
.cal-cell-pulse {
  animation: warning-pulse 1.6s ease forwards;
  border-radius: 6px;
  position: relative;
  z-index: 2;
}

.cal-day-num { font-size: 13px; color: #72243E; line-height: 1; }

/* How-to hints card */
.cal-hints {
  background: #FCF3F6;
  border: 1px solid #F3DCE5;
  border-radius: 12px;
  padding: 12px 14px;
  margin: 4px 0 1rem;
}
.cal-hints-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #993556;
  margin: 0 0 8px;
}
.cal-hint {
  font-size: 11.5px;
  line-height: 1.35;
  color: #a86c7e;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 6px;
  text-align: left;
}
.cal-hint:last-child { margin-bottom: 0; }
.cal-hint > span:first-of-type { flex: 1; }
.cal-hint :deep(.v-icon) { flex-shrink: 0; margin-top: 1px; }

.drag-hint-badge-wrap { display: inline-flex; align-items: center; flex-shrink: 0; }
.drag-hint-badge-wrap :deep(.premium-badge) {
  font-size: 8px;
  padding: 1px 5px 1px 4px;
  gap: 3px;
}

/* Future-date speech bubble */
.hint-bubble {
  position: fixed;
  transform: translate(-50%, calc(-100% - 26px));
  background: rgba(94, 28, 52, 0.92);
  color: #FBEAF0;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 11px;
  border-radius: 14px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 9999;
  letter-spacing: 0.01em;
}
.hint-bubble::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(94, 28, 52, 0.92);
  border-bottom: none;
}
.hint-bubble-success {
  background: rgba(21, 128, 61, 0.92);
  color: #dcfce7;
}
.hint-bubble-success::after {
  border-top-color: rgba(21, 128, 61, 0.92);
}

.hint-bubble-fade-enter-active { transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1); }
.hint-bubble-fade-leave-active { transition: opacity 0.2s ease 0.75s; }
.hint-bubble-fade-enter-from { opacity: 0; transform: translate(-50%, calc(-100% - 14px)) scale(0.9); }
.hint-bubble-fade-enter-to   { opacity: 1; transform: translate(-50%, calc(-100% - 26px)) scale(1); }
.hint-bubble-fade-leave-from { opacity: 1; }
.hint-bubble-fade-leave-to   { opacity: 0; }

/* Drag-to-select highlight */
.cal-dragging {
  background: #F9D0DE !important;
  border: 1.5px solid #D4537E !important;
}
.cal-dragging .cal-day-num { color: #993556 !important; }
.cal-cell-faded.cal-dragging .cal-day-num { color: #993556 !important; }
.cal-cell-faded.cal-period,
.cal-cell-faded.cal-fertile,
.cal-cell-faded.cal-predicted,
.cal-cell-faded.cal-ovulation { opacity: 0.5; }

/* Scale up the start/end anchor cells during drag */
.cal-drag-anchor {
  transform: scale(1.22);
  z-index: 2;
  transition: transform 0.12s cubic-bezier(.4,0,.2,1);
}

/* Disable text selection while dragging */
.cal-grid-dragging {
  user-select: none;
  -webkit-user-select: none;
}

/* Month slide transitions */
.cal-grid-wrap {
  position: relative;
  overflow: hidden;
}
.left-enter-active,
.left-leave-active,
.right-enter-active,
.right-leave-active {
  transition: transform 220ms ease, opacity 220ms ease;
}
.left-leave-active,
.right-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
.left-enter-from  { transform: translateX(100%); opacity: 0; }
.left-leave-to    { transform: translateX(-100%); opacity: 0; }
.right-enter-from { transform: translateX(-100%); opacity: 0; }
.right-leave-to   { transform: translateX(100%); opacity: 0; }

/* Period day — continuous band */
.cal-period {
  background: hsl(var(--flow-hue), 60%, 65%);
  border-radius: 0;
  border-top: 1.5px solid hsl(var(--flow-hue), 55%, 35%);
  border-bottom: 1.5px solid hsl(var(--flow-hue), 55%, 35%);
}
.cal-period .cal-day-num { color: #fff; font-weight: 600; }
.cal-period:hover { background: hsl(var(--flow-hue), 60%, 56%); }

/* Flow intensity tints — driven by --flow-hue set from Settings */
.cal-flow-spotting { background: hsl(var(--flow-hue), 50%, 80%) !important; }
.cal-flow-spotting .cal-day-num { color: #fff !important; }
.cal-flow-light    { background: hsl(var(--flow-hue), 55%, 74%) !important; }
.cal-flow-medium   { background: hsl(var(--flow-hue), 65%, 58%) !important; }
.cal-flow-heavy    { background: hsl(var(--flow-hue), 80%, 42%) !important; }

.cal-period-row-start {
  border-top-left-radius: 10px;
  border-bottom-left-radius: 10px;
  border-left: 1.5px solid #993556;
}
.cal-period-row-end {
  border-top-right-radius: 10px;
  border-bottom-right-radius: 10px;
  border-right: 1.5px solid #993556;
}

/* Predicted period — soft pink */
.cal-predicted {
  background: #F9D0DE;
  border: 1.5px dashed #D4537E;
}
.cal-predicted .cal-day-num { color: #993556; }

/* Fertile window — soft teal, dashed to match predicted visual language */
.cal-fertile {
  background: #D4F0E8;
  border: 1.5px dashed #7ED4BC;
}
.cal-fertile .cal-day-num { color: #0F6E56; }

/* Gap day with logged data — border only, no fill */
.cal-gap-logged {
  border: 1.5px solid #D4537E;
  border-radius: 10px;
}
.cal-gap-logged .cal-day-num { color: #993556; font-weight: 600; }

/* Ovulation */
.cal-ovulation {
  background: #FFE4B5;
  border: 1.5px solid #FAC775;
}
.cal-ovulation .cal-day-num { color: #854F0B; font-weight: 600; }

/* Today ring */
.cal-today:not(.cal-period):not(.cal-predicted):not(.cal-fertile):not(.cal-ovulation) {
  border: 2px solid #D4537E;
}
.cal-today .cal-day-num { font-weight: 700; }


/* Legend */
.legend {
  display: flex;
  gap: 8px 14px;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
  padding: 0 2px;
}
.prediction-disclaimer {
  font-size: 10.5px;
  line-height: 1.45;
  color: #B07B8C;
  margin: 0 0 0.85rem;
  padding: 0 2px;
}
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-dot {
  width: 12px; height: 12px; border-radius: 4px; flex-shrink: 0;
}
.period-dot { background: #D4537E; }
.predicted-dot { background: #F9D0DE; border: 1.5px dashed #D4537E; }
.fertile-dot { background: #D4F0E8; border: 1px solid #7ED4BC; }
.ovulation-dot { background: #FFE4B5; border: 1.5px solid #FAC775; }
.legend-text { font-size: 11px; color: #993556; font-weight: 500; }


/* Bottom nav */
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: white; border-top: 1px solid #f0f0f0;
  display: flex; justify-content: space-around;
  padding: 10px 0 16px; z-index: 50;
}
.nav-item { text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.nav-label { font-size: 10px; color: #bbb; }
.active-label { color: #D4537E; font-weight: 500; }

/* View content */
.day-sheet-content { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.view-content { display: flex; flex-direction: column; gap: 1.1rem; flex: 0 0 auto; min-height: 0; }
.view-section { flex-shrink: 0; }
/* Notes is now a persistent sibling (.day-notes-section), so chip sections
   no longer need to stretch to host it. */
/* Fixed size (matches the shopping-list notes 150 floor), anchored to the
   bottom of the sheet. margin-top:auto absorbs the slack as empty space
   between the chips and the notes instead of stretching the notes box. */
.day-notes-section {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  margin-top: auto;
  padding-top: 1.1rem;
}
.view-section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #993556; margin: 0 0 8px; }
.view-empty { text-align: center; padding: 2rem 0; color: #bbb; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.view-empty p { font-size: 13px; margin: 0; }
.view-empty-hint { font-size: 11px !important; color: #c0899b !important; }
.view-ovulation-label { font-size: 13px; color: #72243E; margin: 0; }

.ovulation-btn {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: #993556;
  background: #FBEAF0; border: 1px solid #F4C0D1;
  border-radius: 20px; padding: 6px 16px;
  cursor: pointer;
}
.ovulation-btn:disabled { opacity: 0.6; cursor: default; }
.ovulation-btn--active { background: #FFF0D6; border-color: #FAC775; color: #854F0B; }
.ovulation-status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: #bbb;
  background: #f7f7f7; border: 1px solid #e0e0e0;
  border-radius: 20px; padding: 6px 16px;
}
.ovulation-status.ovulation-status--active { background: #FFF0D6; border-color: #FAC775; color: #854F0B; }
.gap-day-coming-soon {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: #cca7b8; margin-top: 10px;
  padding: 6px 12px; border-radius: 16px;
  border: 1px dashed #f4c0d1; background: #fdf5f8;
}

.irregular-card {
  display: flex; align-items: center; gap: 8px;
  background: #FDF2F5; border: 1px solid #F4C0D1;
  border-radius: 12px; padding: 10px 12px;
  margin-top: 1rem;
}
.irregular-text { font-size: 12px; color: #72243E; line-height: 1.4; }


/* Confirm modal */
.confirm-backdrop {
  position: fixed; inset: 0;
  background: rgba(114,36,62,0.25);
  z-index: 200;
  opacity: 0; pointer-events: none;
  transition: opacity 0.2s;
}
.confirm-backdrop.visible { opacity: 1; pointer-events: all; }

.confirm-modal {
  position: fixed;
  inset: 0;
  z-index: 201;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  padding: 1.5rem;
}
.confirm-modal.open { pointer-events: all; }

.confirm-inner {
  background: #fff;
  border-radius: 20px;
  padding: 2rem 1.5rem 1.5rem;
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  box-shadow: 0 8px 40px rgba(114,36,62,0.18);
  transform: scale(0.92);
  opacity: 0;
  transition: transform 0.22s cubic-bezier(.4,0,.2,1), opacity 0.22s;
}
.confirm-modal.open .confirm-inner {
  transform: scale(1);
  opacity: 1;
}

.confirm-icon {
  width: 52px; height: 52px;
  background: #fff0ee;
  border: 1px solid #f5c6c0;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 0.25rem;
}
.confirm-title {
  font-size: 16px; font-weight: 600; color: #72243E;
  margin: 0; text-align: center;
}
.confirm-desc {
  font-size: 13px; color: #a0667a;
  margin: 0; text-align: center; line-height: 1.5;
}

/* Adjacency dialog action buttons */
.adj-actions {
  display: flex; flex-direction: column; gap: 8px;
  margin-top: 0.75rem; width: 100%;
}
.adj-btn {
  width: 100%; padding: 11px 14px;
  border-radius: 20px; font-size: 13px; font-weight: 500;
  cursor: pointer; text-align: left; display: flex; align-items: center;
  transition: opacity 0.15s;
}
.adj-btn:disabled { opacity: 0.6; cursor: default; }
.adj-btn-extend {
  background: #FBE8EF; border: 1px solid #F4C0D1; color: #72243E;
}
.adj-btn-new {
  background: #fff; border: 1px solid #e8e0e4; color: #9b7a89;
  justify-content: center; font-size: 12px;
}

/* Flow chips */
.flow-chips { display: flex; gap: 6px; }
.flow-chip {
  padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 500;
  background: #F4C0D1; color: #993556;
  border: none; text-transform: capitalize;
  display: inline-flex; align-items: center;
  box-sizing: border-box; font-family: inherit; line-height: 1.4;
}
.flow-chip-btn { cursor: pointer; transition: background 0.15s; }
.flow-chip-active { background: #D4537E; color: #fff; }

/* Symptom chips */
.symptom-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.symptom-chip {
  padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 500;
  background: #FBEAF0; color: #993556;
  border: 1px solid #F4C0D1;
  display: inline-flex; align-items: center;
  box-sizing: border-box; font-family: inherit; line-height: 1.4;
}
.symptom-chip-btn { cursor: pointer; transition: background 0.15s; }
.symptom-chip-active { background: #D4537E; color: #fff; border-color: #D4537E; }

/* Log form */
.log-form { display: flex; flex-direction: column; gap: 1.1rem; flex: 0 0 auto; min-height: 0; }
.form-section { flex-shrink: 0; }
.form-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #993556; margin: 0 0 8px; }

.form-actions { display: flex; gap: 8px; margin-left: auto; }
.btn-cancel {
  padding: 8px 18px; border-radius: 20px;
  border: 1px solid #F4C0D1; background: #fff;
  font-size: 13px; color: #993556; cursor: pointer;
}
.btn-save {
  padding: 8px 22px; border-radius: 20px;
  border: none; background: #D4537E;
  font-size: 13px; font-weight: 500; color: #fff; cursor: pointer;
}
.btn-save:disabled { opacity: 0.6; cursor: default; }



.cycle-icon-actions { display: flex; gap: 20px; align-items: flex-start; }
.remove-day-hint {
  font-size: 10px; color: #94a3b8;
  margin: 4px 0 0; padding: 0;
}

/* ── Hold-to-adjust charging indicator ──────────────────────── */
.cal-cell-hold-pending {
  border-top: 2px solid rgba(0, 0, 0, 0.65) !important;
  border-bottom: 2px solid rgba(0, 0, 0, 0.65) !important;
  animation: hold-vibrate 0.12s ease-in-out infinite;
  position: relative;
  z-index: 1;
}
.cal-cell-hold-pending.cal-period-row-start {
  border-left: 2px solid rgba(0, 0, 0, 0.65) !important;
}
.cal-cell-hold-pending.cal-period-row-end {
  border-right: 2px solid rgba(0, 0, 0, 0.65) !important;
}
.cal-cell-hold-pending:not(.cal-period) {
  border-left: 2px solid rgba(0, 0, 0, 0.65) !important;
  border-right: 2px solid rgba(0, 0, 0, 0.65) !important;
}

/* ── Adjust Cycle mode ───────────────────────────────────────── */
@keyframes handle-pulse {
  0%, 100% { outline-color: #993556; outline-offset: 1px; }
  50%       { outline-color: #D4537E; outline-offset: 3px; }
}

.cal-adjust-handle-start,
.cal-adjust-handle-end {
  cursor: ew-resize;
  outline: 2.5px solid #993556;
  outline-offset: 1px;
  z-index: 1;
  animation: handle-pulse 1s ease-in-out infinite;
}
/* Arrow indicators on resize handles */
.cal-adjust-handle-start::before {
  content: '←';
  position: absolute;
  top: 2px;
  left: 3px;
  font-size: 8px;
  color: #993556;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}
.cal-adjust-handle-end::after {
  content: '→';
  position: absolute;
  top: 2px;
  right: 3px;
  font-size: 8px;
  color: #993556;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}
.cal-adjust-active { opacity: 0.8; }
.cal-adjust-dimmed { opacity: 0.35; }

/* Ghost preview cells during drag */
.cal-adjust-ghost {
  background: hsla(var(--flow-hue), 60%, 65%, 0.55) !important;
  border: 1.5px dashed #D4537E !important;
  border-radius: 10px !important;
}
.cal-adjust-adding {
  background: hsla(var(--flow-hue), 60%, 65%, 0.35) !important;
  border: 1.5px dashed #D4537E !important;
  border-radius: 10px !important;
}
.cal-adjust-removing {
  opacity: 0.18 !important;
}
.cal-adjust-overlap {
  background: hsla(0, 75%, 62%, 0.35) !important;
  border: 1.5px dashed #ef4444 !important;
  border-radius: 4px !important;
}

/* Orphaned day badge */
.cal-cell-badge-orphan { background: rgba(255, 237, 213, 0.9); }

/* Orphaned day panel */
.orphaned-notice {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 16px 0; text-align: center;
}
.orphaned-notice p { font-size: 14px; color: #666; margin: 0; }
.delete-orphan-btn {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: #c0392b;
  background: #fef2f2; border: 1px solid #fca5a5;
  border-radius: 8px; padding: 8px 16px; cursor: pointer;
}
</style>
