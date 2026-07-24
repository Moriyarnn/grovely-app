import { ref } from 'vue'
import { API, apiFetch } from '../api'

interface Settings {
  partner_can_read_notes?: string
  notifications_enabled?: string
  notification_greeting?: string
  notification_signoff?: string
  notification_sender_name?: string
  reminder_days?: string
  pantry_currency?: string
  pantry_currency_custom_symbol?: string
  pantry_currency_custom_label?: string
  [key: string]: string | undefined
}

const settings = ref<Settings>({ partner_can_read_notes: '0' })
let loaded = false

export function useSettings() {
  async function fetchSettings() {
    if (loaded) return
    try {
      const res = await apiFetch(`${API}/settings`)
      if (res.ok) {
        settings.value = await res.json()
        loaded = true
      }
    } catch {}
  }

  async function updateSetting(key: string, value: string): Promise<string | null> {
    const prev = settings.value[key]
    settings.value = { ...settings.value, [key]: value }
    try {
      const res = await apiFetch(`${API}/settings/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      })
      if (!res.ok) {
        settings.value = { ...settings.value, [key]: prev }
        if (res.status === 403) return 'Only the owner can change this setting.'
        return 'Could not save setting - check your connection.'
      }
      window.dispatchEvent(new Event('appstats:invalidate'))
      return null
    } catch {
      settings.value = { ...settings.value, [key]: prev }
      return 'Could not save setting - check your connection.'
    }
  }

  function resetCache() {
    loaded = false
  }

  return { settings, fetchSettings, updateSetting, resetCache }
}
