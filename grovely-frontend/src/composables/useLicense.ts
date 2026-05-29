import { ref } from 'vue'
import { API, apiFetch } from '../api'

const licenseActive = ref<boolean | null>(null)

async function fetchLicenseStatus(): Promise<void> {
  try {
    const res = await apiFetch(`${API}/license/status`)
    if (res.ok) {
      const data = await res.json()
      licenseActive.value = data.active === true
    }
  } catch {
    licenseActive.value = false
  }
}

export function useLicense() {
  return { licenseActive, fetchLicenseStatus }
}
