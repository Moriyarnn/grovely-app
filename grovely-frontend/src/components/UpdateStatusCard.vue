<template>
  <section class="update-card" :class="{ 'update-card--available': available || (isDemo && demoReleaseCurrent === false), 'update-card--error': status.error || (isDemo && demoReleaseCurrent === null), 'update-card--demo': isDemo }">
    <div class="update-card__icon">
      <v-icon size="18" :color="isDemo ? '#547264' : status.error ? '#9b6d18' : available ? '#993556' : '#2E7D52'">
        {{ isDemo ? 'mdi-cloud-off-outline' : status.error ? 'mdi-cloud-alert-outline' : available ? 'mdi-package-up' : 'mdi-shield-check-outline' }}
      </v-icon>
    </div>
    <div class="update-card__body">
      <p class="update-card__title">
        {{ isDemo ? demoReleaseCurrent === true ? 'Grovely is up to date' : demoReleaseCurrent === false ? 'A newer Grovely version is available' : 'Update status unavailable' : status.error ? 'Update status unavailable' : available ? `Grovely ${latestVersion} is available` : 'Grovely is up to date' }}
      </p>
      <p class="update-card__text">
        <template v-if="isDemo">Updates are disabled for this demo.</template>
        <template v-else-if="status.error">{{ status.error }}</template>
        <template v-else-if="status.updating">Updating safely. Grovely will reconnect when it is ready.</template>
        <template v-else-if="available">{{ latestNotes }}</template>
        <template v-else>Checks daily for new releases. No household data is sent.</template>
      </p>
      <p class="update-card__checked">
        {{ isDemo ? 'Run Grovely on your own device for one-click updates with a recovery backup.' : status.last_checked_at ? `Last checked ${lastCheckedLabel}` : '\u00a0' }}
      </p>
      <div v-if="!isDemo" class="update-card__actions">
        <button class="update-card__button update-card__button--quiet" :disabled="loading || status.updating" @click="checkNow">
          {{ loading ? 'Checking…' : 'Check now' }}
        </button>
        <button v-if="available" class="update-card__button update-card__button--update" :disabled="loading || status.updating" @click="installNow">
          {{ status.updating ? 'Updating…' : 'Update now' }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { API, apiFetch } from '../api'
import { isNewerVersion, isSameVersion } from '../utils/version'

type UpdateStatus = {
  current_version?: string
  latest?: { version?: string, summary?: string, notes?: string }
  last_checked_at?: string
  updating?: boolean
  error?: string | null
}

const status = ref<UpdateStatus>({})
const loading = ref(false)
const reloadAfterUpdate = ref(false)
const isDemo = __DEMO__
const demoReleaseCurrent = __DEMO_RELEASE_CURRENT__
let pollTimer: ReturnType<typeof setInterval> | null = null

const latestVersion = computed(() => status.value.latest?.version || '')
const available = computed(() => isNewerVersion(latestVersion.value, status.value.current_version))
const latestNotes = computed(() => status.value.latest?.summary || status.value.latest?.notes || 'A newer release is ready for this household.')
const lastCheckedLabel = computed(() => {
  const date = new Date(status.value.last_checked_at || '')
  return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleString()
})

async function load(path = '') {
  const response = await apiFetch(`${API}/system/update${path}`, { method: path ? 'POST' : 'GET' })
  const body = await response.json().catch(() => ({}))
  status.value = { ...status.value, ...body }
  if (reloadAfterUpdate.value && !status.value.updating && !status.value.error && isSameVersion(latestVersion.value, status.value.current_version)) {
    reloadAfterUpdate.value = false
    window.location.reload()
  }
}

async function checkNow() {
  loading.value = true
  try { await load('/check') } catch { status.value.error = 'Could not check for updates right now.' }
  finally { loading.value = false }
}

async function installNow() {
  if (!window.confirm(`Update Grovely to ${latestVersion.value}? A local recovery snapshot will be created first.`)) return
  loading.value = true
  try {
    await load('/install')
    reloadAfterUpdate.value = Boolean(status.value.updating)
  } catch { status.value.error = 'Could not start the update.' }
  finally { loading.value = false }
}

onMounted(async () => {
  if (isDemo) return
  await load().catch(() => { status.value.error = 'Could not reach the Update Service.' })
  pollTimer = setInterval(() => { if (status.value.updating) load().catch(() => {}) }, 5000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<style scoped>
.update-card { display: flex; height: 136px; gap: 10px; padding: 12px; border: 1px solid #d7eadf; border-radius: 14px; background: #f7fcf8; margin: 12px 0 2px; }
.update-card--available { border-color: #f3cdda; background: #fff8fb; }
.update-card--error { border-color: #f0dfb6; background: #fffcf4; }
.update-card--demo.update-card--available { border-color: #efb8b8; background: #fff8f8; }
.update-card--demo.update-card--available .update-card__title { color: #b42318; }
.update-card--demo.update-card--error { border-color: #efb8b8; background: #fff8f8; }
.update-card--demo.update-card--error .update-card__title { color: #b42318; }
.update-card__icon { padding-top: 2px; }
.update-card__body { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.update-card__title { margin: 0; color: #285c40; font-size: 12px; font-weight: 700; }
.update-card--available .update-card__title { color: #993556; }
.update-card__text, .update-card__checked { margin: 3px 0 0; color: #6d7d73; font-size: 11px; line-height: 1.45; }
.update-card__text { display: -webkit-box; min-height: 32px; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.update-card__checked { height: 16px; color: #9aa59e; }
.update-card__actions { display: flex; min-height: 29px; gap: 7px; margin-top: auto; }
.update-card__button { box-sizing: border-box; border: 0; border-radius: 999px; background: #993556; color: #fff; padding: 6px 10px; font: inherit; font-size: 11px; font-weight: 700; line-height: 17px; white-space: nowrap; cursor: pointer; }
.update-card__button--quiet { flex: 0 0 86px; width: 86px; color: #547264; background: #e7f4eb; }
.update-card__button--update { flex: 0 0 88px; width: 88px; }
.update-card__button:disabled { opacity: .55; cursor: default; }
</style>
