import { ref } from 'vue'
import { API, apiFetch } from '../api'

const preferences = ref<Record<string, string>>({})
let loaded = false

function applyToDom(prefs: Record<string, string>) {
  const hue = prefs.flow_hue ?? '335'
  document.documentElement.style.setProperty('--flow-hue', hue)
}

export function usePreferences() {
  async function fetchPreferences() {
    if (loaded) return
    try {
      const res = await apiFetch(`${API}/preferences`)
      if (!res.ok) return
      const data: Record<string, string> = await res.json()

      // One-time migration: backfill flow_hue from localStorage
      if (!data.flow_hue) {
        const localHue = localStorage.getItem('flow-hue')
        if (localHue) {
          await updatePreference('flow_hue', localHue)
          localStorage.removeItem('flow-hue')
          data.flow_hue = localHue
        }
      }

      preferences.value = data
      applyToDom(data)
      loaded = true
    } catch {}
  }

  async function updatePreference(key: string, value: string) {
    preferences.value = { ...preferences.value, [key]: value }
    await apiFetch(`${API}/preferences/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    })
  }

  function resetCache() {
    loaded = false
    preferences.value = {}
  }

  return { preferences, fetchPreferences, updatePreference, resetCache }
}
