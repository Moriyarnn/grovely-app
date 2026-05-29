import { ref } from 'vue'
import { API, apiFetch } from '../api'

const dynamicSubs = ref<Record<string, string>>({})
const pantryStats = ref<{ expired: number; expiringSoon: number; total: number }>({ expired: 0, expiringSoon: 0, total: 0 })

function getPantrySub(items: any[], warnDays: number): string {
  const todayMs = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00').getTime()
  const count = items.length
  let expiringSoon = 0
  for (const i of items) {
    if (!i.expiry_date) continue
    const days = Math.round((new Date(i.expiry_date + 'T00:00:00').getTime() - todayMs) / 86400000)
    if (days >= 0 && days <= warnDays) expiringSoon++
  }
  if (count === 0) return 'Nothing in pantry yet'
  if (expiringSoon > 0) return `${count} item${count !== 1 ? 's' : ''} · ${expiringSoon} expiring`
  return `${count} item${count !== 1 ? 's' : ''} in pantry`
}

function computePantryStats(items: any[], warnDays: number): void {
  const todayMs = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00').getTime()
  let expired = 0, expiringSoon = 0
  for (const item of items) {
    if (!item.expiry_date) continue
    const diff = Math.round((new Date(item.expiry_date + 'T00:00:00').getTime() - todayMs) / 86400000)
    if (diff < 0) expired++
    else if (diff <= warnDays) expiringSoon++
  }
  pantryStats.value = { expired, expiringSoon, total: items.length }
}

function getPeriodSub(summary: any): string | null {
  if (summary.currentCycle) {
    const start = new Date(summary.currentCycle.start_date + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const day = Math.round((today.getTime() - start.getTime()) / 86400000) + 1
    return `Active · day ${day}`
  }
  if (summary.nextPeriodDate) {
    const next = new Date(summary.nextPeriodDate + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = Math.round((next.getTime() - today.getTime()) / 86400000)
    if (days === 0) return 'Due today'
    if (days === 1) return 'Due tomorrow'
    return `Due in ~${days} days`
  }
  return null
}

async function fetchAppStats(): Promise<void> {
  try {
    const [pantryRes, periodRes, settingsRes] = await Promise.all([
      apiFetch(`${API}/pantry`),
      apiFetch(`${API}/period/calculations/summary`),
      apiFetch(`${API}/settings`)
    ])
    const warnDays = settingsRes.ok
      ? Math.max(1, parseInt((await settingsRes.json()).pantry_expiry_warning_days ?? '3', 10))
      : 3
    const subs: Record<string, string> = {}
    if (pantryRes.ok) {
      const items = await pantryRes.json()
      computePantryStats(items, warnDays)
      subs['Pantry'] = getPantrySub(items, warnDays)
    }
    if (periodRes.ok) {
      const summary = await periodRes.json()
      const sub = getPeriodSub(summary)
      if (sub) subs['Period tracker'] = sub
    }
    dynamicSubs.value = subs
  } catch {}
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
window.addEventListener('appstats:invalidate', () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchAppStats, 400)
})

export function useAppStats() {
  return { dynamicSubs, pantryStats, fetchAppStats }
}
