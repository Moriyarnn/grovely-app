<template>
  <section class="update-card" :class="{ 'update-card--available': available, 'update-card--error': status.error }">
    <div class="update-card__icon">
      <v-icon size="18" :color="status.error ? '#9b6d18' : available ? '#993556' : '#2E7D52'">
        {{ status.error ? 'mdi-cloud-alert-outline' : available ? 'mdi-package-up' : 'mdi-shield-check-outline' }}
      </v-icon>
    </div>
    <div class="update-card__body">
      <p class="update-card__title">
        {{ status.error ? 'Update status unavailable' : available ? `Grovely ${latestVersion} is available` : 'Grovely is up to date' }}
      </p>
      <p class="update-card__text">
        <template v-if="status.error">{{ status.error }}</template>
        <template v-else-if="status.updating">Updating safely. Grovely will reconnect when it is ready.</template>
        <template v-else-if="available">{{ latestNotes }}</template>
        <template v-else>Checks daily for new releases. No household data is sent.</template>
      </p>
      <p class="update-card__checked">
        {{ status.last_checked_at ? `Last checked ${lastCheckedLabel}` : '\u00a0' }}
      </p>
      <div class="update-card__actions">
        <button class="update-card__button update-card__button--quiet" :disabled="loading || status.updating" @click="checkNow">
          {{ loading ? 'Checking…' : 'Check now' }}
        </button>
        <button v-if="available" class="update-card__button" :disabled="loading || status.updating" @click="installNow">
          {{ status.updating ? 'Updating…' : 'Update now' }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { API, apiFetch } from '../api'

type UpdateStatus = {
  current_version?: string
  latest?: { version?: string, summary?: string, notes?: string }
  last_checked_at?: string
  updating?: boolean
  error?: string | null
}

const status = ref<UpdateStatus>({})
const loading = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

function comparable(version?: string): number[] {
  return (version || '').replace(/^v/, '').split('.').map(part => Number(part) || 0)
}

function isNewer(latest?: string, current?: string): boolean {
  const a = comparable(latest)
  const b = comparable(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0)
  }
  return false
}

const latestVersion = computed(() => status.value.latest?.version || '')
const available = computed(() => isNewer(latestVersion.value, status.value.current_version))
const latestNotes = computed(() => status.value.latest?.summary || status.value.latest?.notes || 'A newer release is ready for this household.')
const lastCheckedLabel = computed(() => {
  const date = new Date(status.value.last_checked_at || '')
  return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleString()
})

async function load(path = '') {
  const response = await apiFetch(`${API}/system/update${path}`, { method: path ? 'POST' : 'GET' })
  const body = await response.json().catch(() => ({}))
  status.value = { ...status.value, ...body }
}

async function checkNow() {
  loading.value = true
  try { await load('/check') } catch { status.value.error = 'Could not check for updates right now.' }
  finally { loading.value = false }
}

async function installNow() {
  if (!window.confirm(`Update Grovely to ${latestVersion.value}? A local recovery snapshot will be created first.`)) return
  loading.value = true
  try { await load('/install') } catch { status.value.error = 'Could not start the update.' }
  finally { loading.value = false }
}

onMounted(async () => {
  await load().catch(() => { status.value.error = 'Could not reach the Update Service.' })
  pollTimer = setInterval(() => { if (status.value.updating) load().catch(() => {}) }, 5000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<style scoped>
.update-card { display: flex; height: 136px; gap: 10px; padding: 12px; border: 1px solid #d7eadf; border-radius: 14px; background: #f7fcf8; margin: 12px 0 2px; }
.update-card--available { border-color: #f3cdda; background: #fff8fb; }
.update-card--error { border-color: #f0dfb6; background: #fffcf4; }
.update-card__icon { padding-top: 2px; }
.update-card__body { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.update-card__title { margin: 0; color: #285c40; font-size: 12px; font-weight: 700; }
.update-card--available .update-card__title { color: #993556; }
.update-card__text, .update-card__checked { margin: 3px 0 0; color: #6d7d73; font-size: 11px; line-height: 1.45; }
.update-card__text { display: -webkit-box; min-height: 32px; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.update-card__checked { height: 16px; color: #9aa59e; }
.update-card__actions { display: flex; min-height: 29px; gap: 7px; margin-top: auto; }
.update-card__button { border: 0; border-radius: 999px; background: #993556; color: #fff; padding: 6px 10px; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
.update-card__button--quiet { color: #547264; background: #e7f4eb; }
.update-card__button:disabled { opacity: .55; cursor: default; }
</style>
