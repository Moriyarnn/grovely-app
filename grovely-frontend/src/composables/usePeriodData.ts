import { ref, computed } from 'vue'
import { API, apiFetch } from '../api'
import { getWarningPulseDates } from '../utils/periodWarningPulse'

const allCycleDays = ref<any[]>([])
const allCycles = ref<any[]>([])
const summary = ref<any>(null)
const gapDayLogs = ref<any[]>([])
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())
const pulseDates = ref(new Set<string>())
let pulseTimeout: ReturnType<typeof setTimeout> | null = null

const warningDateSet = computed(() => {
  const set = new Set<string>()
  summary.value?.dataWarnings?.forEach((w: any) => w.affectedDates?.forEach((d: string) => set.add(d)))
  return set
})

const orphanedDaySet = computed(() => {
  const set = new Set<string>()
  const cycleMap = Object.fromEntries(allCycles.value.map((c: any) => [c.id, c]))
  for (const day of allCycleDays.value) {
    const cycle = cycleMap[day.cycle_id]
    if (!cycle || cycle.review_state === 'excluded') continue
    const isOutside = day.date < cycle.start_date || (cycle.end_date && day.date > cycle.end_date)
    if (!isOutside) continue
    if (day.flow_intensity || day.notes || (day.symptoms && day.symptoms.trim()))
      set.add(day.date)
  }
  return set
})

const orphanedWarnings = computed(() => {
  const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return [...orphanedDaySet.value].sort().map(date => ({
    message: `${fmt(date)}: Logged data is outside your cycle range`,
    targetDate: date,
    affectedDates: [date],
    isOrphaned: true
  }))
})

const allWarnings = computed(() => [
  ...(summary.value?.dataWarnings ?? []),
  ...orphanedWarnings.value
])

// Map from cycleId → list of reviewable warnings (SHORT_CYCLE_GAP, LONG_PERIOD)
const cycleWarningMap = computed(() => {
  const map = new Map<number, any[]>()
  summary.value?.dataWarnings?.forEach((w: any) => {
    if (w.cycleId && (w.code === 'SHORT_CYCLE_GAP' || w.code === 'LONG_PERIOD')) {
      const cycleIds = w.cycleIds ?? [w.cycleId]
      cycleIds.forEach((cycleId: number) => {
        if (!map.has(cycleId)) map.set(cycleId, [])
        map.get(cycleId)!.push(w)
      })
    }
  })
  return map
})

function goToWarning(w: any) {
  if (!w.targetDate) return
  const d = new Date(w.targetDate + 'T00:00:00')
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()

  const dates = getWarningPulseDates(w, allCycles.value)
  if (pulseTimeout) clearTimeout(pulseTimeout)
  pulseDates.value = new Set()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pulseDates.value = dates
      pulseTimeout = setTimeout(() => { pulseDates.value = new Set() }, 1600)
    })
  })
}

async function loadData() {
  const [daysRes, summaryRes, cyclesRes, gapRes] = await Promise.all([
    apiFetch(`${API}/period/cycle-days/all`),
    apiFetch(`${API}/period/calculations/summary`),
    apiFetch(`${API}/period/cycles`),
    apiFetch(`${API}/period/gap-days`)
  ])
  const [days, sum, cycles, gaps] = await Promise.all([
    daysRes.json(), summaryRes.json(), cyclesRes.json(), gapRes.json()
  ])
  allCycleDays.value = days
  summary.value = sum
  allCycles.value = cycles
  gapDayLogs.value = gaps
}

export function usePeriodData() {
  return {
    allCycleDays,
    allCycles,
    summary,
    gapDayLogs,
    viewYear,
    viewMonth,
    pulseDates,
    warningDateSet,
    orphanedDaySet,
    allWarnings,
    cycleWarningMap,
    goToWarning,
    loadData,
    resetView: () => {
      const now = new Date()
      viewYear.value = now.getFullYear()
      viewMonth.value = now.getMonth()
    },
  }
}
