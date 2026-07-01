<template>
  <!-- Wrapper always rendered so it reserves height and prevents layout jump
       when data arrives. Inner content gated on cards being ready. -->
  <div class="strip-wrapper">
    <template v-if="stripCards.length > 0">
      <div
        class="strip-track"
        @mousedown="dragStart"
        @mouseup="dragEnd"
        @touchstart.passive="touchStart"
        @touchend.passive="touchEnd"
      >
        <div class="strip-inner" :style="{ transform: `translateX(-${current * 100}%)` }">
          <div
            v-for="(card, i) in stripCards"
            :key="i"
            class="strip-card"
            :style="{ background: card.bg, borderColor: card.border }"
          >
            <p class="strip-label" :style="{ color: card.labelColor }">{{ card.label }}</p>
            <p class="strip-message" :style="{ color: card.messageColor }">{{ card.message }}</p>
          </div>
        </div>
      </div>
      <div v-if="stripCards.length > 1" class="strip-dots">
        <span
          v-for="(_, i) in stripCards"
          :key="i"
          class="dot"
          :class="{ active: i === current }"
          @click="goTo(i)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { API, apiFetch, getUser } from '../api'
import { useAppStats } from '../composables/useAppStats'

const isOwner = getUser()?.role === 'owner1'
const { pantryStats, fetchAppStats } = useAppStats()

const current = ref(0)
let timer = null
let startX = 0

const periodSummary = ref(null)
const today = new Date()
today.setHours(0, 0, 0, 0)
const todayStr = today.toISOString().split('T')[0]

const stripCards = computed(() => {
  const cards = []
  const s = periodSummary.value

  if (s) {
    if (!s.currentCycle && s.nextPeriodDate) {
      const days = Math.round((new Date(s.nextPeriodDate + 'T00:00:00') - today) / 86400000)
      const w = s.confidenceWindow ? ` ±${s.confidenceWindow}d` : ''
      let periodMsg = null
      if (isOwner) {
        if (days < 0)        periodMsg = `Period is ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} late${w}`
        else if (days === 0) periodMsg = `Period is due today${w}`
        else if (days === 1) periodMsg = `Period due tomorrow${w}`
        else if (days <= 3)  periodMsg = `Period in ${days} days${w}`
      } else {
        if (days < 0)        periodMsg = `Her period is ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} late${w}`
        else if (days === 0) periodMsg = `Her period is due today${w}`
        else if (days === 1) periodMsg = `Her period is due tomorrow${w}`
        else if (days <= 3)  periodMsg = `Her period is in ${days} days${w}`
      }
      if (periodMsg) {
        cards.push({ label: 'Period tracker', message: periodMsg, bg: '#FBEAF0', border: '#F4C0D1', labelColor: '#993556', messageColor: '#72243E' })
      }
    }

    if (!s.currentCycle && s.fertileWindow) {
      const fStart = new Date(s.fertileWindow.start + 'T00:00:00')
      const fEnd   = new Date(s.fertileWindow.end   + 'T00:00:00')
      let fertileMsg = null
      if (s.ovulationDate === todayStr) {
        fertileMsg = isOwner ? 'Today is your predicted ovulation day' : 'Today is her predicted ovulation day'
      } else if (today >= fStart && today <= fEnd) {
        fertileMsg = `Fertile window active - ends ${fEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      } else if (today < fStart) {
        const daysUntil = Math.round((fStart - today) / 86400000)
        if (daysUntil <= 5) fertileMsg = `Fertile window starts in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`
      }
      if (fertileMsg) {
        cards.push({ label: 'Fertile window', message: fertileMsg, bg: '#E8F8F4', border: '#7ED4BC', labelColor: '#0F6E56', messageColor: '#085041' })
      }
    }

    if (s.isIrregular) {
      cards.push({ label: 'Cycle alert', message: isOwner ? 'Your recent cycles have been irregular' : 'Her recent cycles have been irregular', bg: '#FFFBEB', border: '#FAC775', labelColor: '#854F0B', messageColor: '#633806' })
    }

    if (!s.currentCycle && s.ovulationDate && s.ovulationDate < todayStr) {
      const daysSinceOv = Math.round((today.getTime() - new Date(s.ovulationDate + 'T00:00:00').getTime()) / 86400000)
      if (daysSinceOv >= 1 && daysSinceOv <= 14) {
        cards.push({ label: 'Luteal phase', message: `Day ${daysSinceOv} post-ovulation`, bg: '#F5F0FF', border: '#C4B5FD', labelColor: '#5B21B6', messageColor: '#4C1D95' })
      }
    }

    if (isOwner) {
      if (s.totalCyclesTracked === 0) {
        cards.push({ label: 'Period tracker', message: 'Log your first period to get started', bg: '#FBEAF0', border: '#F4C0D1', labelColor: '#993556', messageColor: '#72243E' })
      } else if (s.note) {
        cards.push({ label: 'Period tracker', message: s.note, bg: '#FBEAF0', border: '#F4C0D1', labelColor: '#993556', messageColor: '#72243E' })
      }
    }
  }

  const { expired, expiringSoon, total } = pantryStats.value
  let pantryMsg = null
  if (expired > 0 && expiringSoon > 0)  pantryMsg = `${expired} expired · ${expiringSoon} expiring soon`
  else if (expired > 0)                  pantryMsg = `${expired} item${expired !== 1 ? 's' : ''} expired`
  else if (expiringSoon > 0)             pantryMsg = `${expiringSoon} expiring soon`
  else if (total === 0 && s)             pantryMsg = 'Add your first item to track expiry'
  if (pantryMsg) {
    cards.push({ label: 'Pantry', message: pantryMsg, bg: '#F0FAF4', border: '#86CBAA', labelColor: '#1A6B42', messageColor: '#145235' })
  }

  if (cards.length === 0 && s) {
    cards.push({ label: 'All clear', message: 'Nothing to worry about right now', bg: '#F5F9FF', border: '#BFDBFE', labelColor: '#1D4ED8', messageColor: '#1E3A5F' })
  }

  return cards
})

function goTo(i) {
  current.value = (i + stripCards.value.length) % stripCards.value.length
}
function dragStart(e) { startX = e.clientX }
function dragEnd(e) {
  const diff = startX - e.clientX
  if (Math.abs(diff) > 30) goTo(current.value + (diff > 0 ? 1 : -1))
}
function touchStart(e) { startX = e.touches[0].clientX }
function touchEnd(e) {
  const diff = startX - e.changedTouches[0].clientX
  if (Math.abs(diff) > 30) goTo(current.value + (diff > 0 ? 1 : -1))
}

onMounted(async () => {
  timer = setInterval(() => goTo(current.value + 1), 4000)

  const [periodRes] = await Promise.allSettled([
    apiFetch(`${API}/period/calculations/summary`),
    fetchAppStats()
  ])

  if (periodRes.status === 'fulfilled' && periodRes.value.ok) {
    periodSummary.value = await periodRes.value.json()
  }
})

onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.strip-wrapper { margin-bottom: 1.25rem; }
.strip-track { overflow: hidden; border-radius: 14px; cursor: grab; }
.strip-inner { display: flex; transition: transform 0.35s cubic-bezier(.4,0,.2,1); }
.strip-card { min-width: 100%; padding: 12px 14px; box-sizing: border-box; border: 3px solid; border-radius: 12px; }
.strip-label { font-size: 10px; font-weight: 600; margin: 0 0 3px; letter-spacing: 0.06em; text-transform: uppercase; }
.strip-message { font-size: 15px; font-weight: 500; margin: 0; }
.strip-dots { display: flex; justify-content: center; gap: 5px; margin-top: 8px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: #ddd; cursor: pointer; display: inline-block; transition: background 0.2s; }
.dot.active { background: #D4537E; }
</style>
