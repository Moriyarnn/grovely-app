<template>
  <DetailSheet
    :open="modelValue"
    theme="neutral"
    size="large"
    title="Scheduled backups"
    subtitle="Automatic snapshots - local and remote"
    subtitle-style="plain"
    @update:open="v => { if (!v) close() }"
  >
    <div class="bk-body" :class="{ 'bk-body--no-warnings': !hasWarnings }">

      <!-- Env-var warnings -->
      <div v-if="status && !status.enabled" class="bk-warning bk-warning--soft">
        <v-icon size="14" color="#a16207">mdi-information-outline</v-icon>
        <span>Scheduled backups are off. Enable below to start the daily run; manual exports are unaffected.</span>
      </div>
      <div v-if="status && status.enabled && configuredTargetCount === 0" class="bk-warning bk-warning--soft">
        <v-icon size="14" color="#a16207">mdi-information-outline</v-icon>
        <span>No remote destination configured. Snapshots will be written locally only.</span>
      </div>

      <div class="bk-sections">

        <!-- SCHEDULE — just Run at -->
        <div class="bk-section">
          <p class="bk-section-label">Schedule</p>
          <div class="bk-list">
            <div class="bk-row">
              <div class="bk-field-body">
                <span class="bk-field-label">Run at</span>
                <span class="bk-field-value">Daily check runs at this time</span>
              </div>
              <button
                class="bk-test-btn"
                :class="{
                  'bk-test-btn--sending': runSending,
                  'bk-test-btn--sent':    runResult === 'ok',
                  'bk-test-btn--partial': runResult === 'partial',
                  'bk-test-btn--error':   runResult === 'error',
                }"
                :disabled="runSending"
                @click="runNow"
              >{{ runSending ? '…' : runResult ? '✓' : 'Run' }}</button>
              <input
                type="time"
                class="bk-time-input"
                :value="settings.backup_schedule_time ?? '03:00'"
                @change="e => updateSetting('backup_schedule_time', (e.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>

        <!-- STORAGE -->
        <div class="bk-section">
          <div class="bk-section-head">
            <div class="bk-section-head-left">
              <p class="bk-section-label">Storage</p>
              <button
                v-if="!drilledDestination"
                class="bk-all-on-btn"
                :class="{ 'bk-all-on-btn--done': enableAllFlash }"
                @click="enableAllDestinations"
              >
                <span v-if="!enableAllFlash" class="bk-status-dot" />{{ enableAllFlash ? 'All on' : 'Enable all' }}
              </button>
            </div>
            <button class="bk-refresh-btn" @click="refresh">Refresh</button>
          </div>
          <div class="bk-app-card">

            <div class="bk-app-header">
              <span class="bk-app-header-title">Destinations</span>
              <div class="bk-app-header-right">
                <span class="bk-status-pill" :class="headerCount === 'All paused' ? 'bk-status-pill--paused' : 'bk-status-pill--live'">
                  <span class="bk-status-dot" />{{ headerCount }}
                </span>
              </div>
            </div>

            <div class="bk-app-content">
              <Transition :name="`bk-slide-${slideDirection}`" mode="out-in">

                <!-- DESTINATIONS LIST -->
                <div v-if="!drilledDestination" key="destinations" class="bk-type-scroll bk-type-scroll--split">
                  <div class="bk-dest-list-scroll">
                    <div
                      v-for="d in storageDestinations"
                      :key="d.id"
                      class="bk-type-item"
                      :class="{ 'bk-type-item--stub': d.pill.tone === 'paused' }"
                    >
                      <div class="bk-dest-row">
                        <v-icon
                          v-if="d.id === 'local'"
                          size="15"
                          class="bk-type-icon bk-type-icon--locked"
                          color="#4ade80"
                        >mdi-check-circle</v-icon>
                        <v-icon
                          v-else-if="d.toggleable"
                          size="15"
                          class="bk-type-icon"
                          :color="d.enabled ? '#4ade80' : '#d4d4d4'"
                          @click.stop="toggleDestination(d.id)"
                        >{{ d.enabled ? 'mdi-check-circle' : 'mdi-close-circle' }}</v-icon>
                        <v-icon
                          v-else
                          size="15"
                          class="bk-type-icon bk-type-icon--locked"
                          color="#ef4444"
                        >mdi-alert-circle</v-icon>

                        <div
                          class="bk-dest-row-body"
                          :class="{ 'bk-dest-row-body--clickable': d.drillable }"
                          @click="d.drillable && drillInto(d.id, 'files')"
                        >
                          <div class="bk-dest-row-line">
                            <v-icon size="14" :color="d.color">{{ d.icon }}</v-icon>
                            <span class="bk-dest-name">{{ d.label }}</span>
                          </div>
                          <span class="bk-dest-detail-inline">{{ d.detail }}</span>
                        </div>

                        <button
                          v-if="d.drillable"
                          class="bk-dest-history-btn"
                          @click.stop="drillInto(d.id, 'history')"
                        >History</button>
                        <span
                          class="bk-status-pill"
                          :class="`bk-status-pill--${d.pill.tone}`"
                        >
                          <span class="bk-status-dot" />{{ d.pill.label }}
                        </span>
                        <v-icon
                          v-if="d.drillable"
                          size="14"
                          color="#bbb"
                          class="bk-dest-chev"
                          @click.stop="drillInto(d.id, 'files')"
                        >mdi-chevron-right</v-icon>
                      </div>
                    </div>
                  </div>
                  <div class="bk-type-item bk-dest-all-row">
                    <div class="bk-dest-row">
                      <v-icon
                        size="15"
                        class="bk-type-icon bk-type-icon--locked"
                        color="#888"
                      >mdi-history</v-icon>
                      <div
                        class="bk-dest-row-body bk-dest-row-body--clickable"
                        @click="drillInto('history', 'history')"
                      >
                        <div class="bk-dest-row-line">
                          <v-icon size="14" color="#888">mdi-history</v-icon>
                          <span class="bk-dest-name">All destinations</span>
                        </div>
                        <span class="bk-dest-detail-inline">{{ history.length }} runs recorded</span>
                      </div>
                      <span class="bk-status-pill bk-status-pill--spacer" />
                      <v-icon
                        size="14"
                        color="#bbb"
                        class="bk-dest-chev"
                        @click.stop="drillInto('history', 'history')"
                      >mdi-chevron-right</v-icon>
                    </div>
                  </div>
                </div>

                <!-- DRILL-IN -->
                <div v-else :key="`drill-${drilledDestination}`" class="bk-type-scroll bk-type-scroll--drill">
                  <div class="bk-drill-head">
                    <button class="bk-back-chip" @click="drillBack()">
                      <v-icon size="16">mdi-chevron-left</v-icon>
                    </button>
                    <span class="bk-drill-title">{{ drilledLabel }}</span>
                    <div class="bk-drill-tabs">
                      <button
                        v-if="drilledDestination !== 'history'"
                        class="bk-drill-tab"
                        :class="{ 'bk-drill-tab--active': drilledView === 'files' }"
                        @click="switchTab('files')"
                      >Files</button>
                      <button
                        class="bk-drill-tab"
                        :class="{ 'bk-drill-tab--active': drilledView === 'history' || drilledDestination === 'history' }"
                        @click="switchTab('history')"
                      >History</button>
                    </div>
                  </div>

                  <div class="bk-drill-body">

                  <!-- All-history drill-in (no tabs) -->
                  <template v-if="drilledDestination === 'history'">
                    <div v-if="history.length === 0" class="bk-history-empty">No backups have run yet.</div>
                    <div
                      v-for="row in history"
                      :key="row.id"
                      class="bk-type-item"
                    >
                      <div class="bk-type-row" @click="toggleExpanded(row.id)">
                        <v-icon size="15" class="bk-type-icon" :color="historyIconColor(row)">{{ historyIcon(row) }}</v-icon>
                        <div class="bk-type-body">
                          <span class="bk-type-name">{{ formatDateTime(row.logged_at) }}</span>
                          <span class="bk-type-when">
                            {{ row.trigger }}
                            <template v-if="row.row_count != null"> · {{ row.row_count }} rows</template>
                            <template v-if="row.size_bytes != null"> · {{ formatBytes(row.size_bytes) }}</template>
                          </span>
                        </div>
                        <v-icon size="14" color="#bbb" class="bk-chev" :class="{ 'bk-chev--open': expandedId === row.id }">mdi-chevron-down</v-icon>
                      </div>
                      <div v-if="expandedId === row.id" class="bk-history-detail">
                        <div class="bk-detail-pair"><span class="bk-detail-key">Triggered by</span><span class="bk-detail-val">{{ row.trigger }}</span></div>
                        <div class="bk-detail-pair"><span class="bk-detail-key">Duration</span><span class="bk-detail-val">{{ row.duration_ms != null ? row.duration_ms + ' ms' : '-' }}</span></div>
                        <div v-if="row.table_count != null" class="bk-detail-pair"><span class="bk-detail-key">Tables</span><span class="bk-detail-val">{{ row.table_count }}</span></div>
                        <div v-if="row.file_path" class="bk-detail-pair"><span class="bk-detail-key">File</span><span class="bk-detail-val bk-detail-val--mono">{{ row.file_path }}</span></div>
                        <div
                          v-for="dest in row.destinations"
                          :key="dest.destination"
                          class="bk-detail-pair"
                          :class="{ 'bk-detail-pair--err': dest.status === 'error' }"
                        >
                          <span class="bk-detail-key">{{ dest.destination }}</span>
                          <span class="bk-detail-val">{{ dest.status }}{{ dest.error ? ' - ' + dest.error : '' }}</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Per-destination drill-in (Files / History tabs) -->
                  <template v-else>
                  <div class="bk-tab-content">
                  <Transition :name="`bk-slide-${tabDirection}`" mode="out-in">

                  <!-- Files view -->
                  <div v-if="drilledView === 'files'" key="tab-files" class="bk-tab-inner">
                    <div v-if="availableLoading" class="bk-history-empty">Checking…</div>
                    <div v-else-if="availableError" class="bk-history-empty bk-history-empty--err">{{ availableError }}</div>
                    <div v-else-if="availableFiles.length === 0" class="bk-history-empty">No snapshots stored here yet.</div>
                    <div
                      v-for="file in availableFiles"
                      :key="file.filename"
                      class="bk-type-item"
                    >
                      <div class="bk-snap-row">
                        <v-icon size="15" class="bk-type-icon" color="#4ade80">mdi-database-outline</v-icon>
                        <div class="bk-type-body">
                          <span class="bk-type-name">{{ file.logged_at ? formatDateTime(file.logged_at) : file.filename }}</span>
                          <span class="bk-type-when">
                            <template v-if="file.trigger">{{ file.trigger }}</template>
                            <template v-if="file.row_count != null"> · {{ file.row_count }} rows</template>
                            <template v-if="file.size_bytes != null"> · {{ formatBytes(file.size_bytes) }}</template>
                          </span>
                        </div>
                        <button
                          class="bk-test-btn"
                          :class="{
                            'bk-test-btn--sending': downloadingFile === file.filename,
                            'bk-test-btn--sent':    downloadFlashFile === file.filename,
                            'bk-test-btn--error':   downloadErrorFile === file.filename,
                          }"
                          :disabled="downloadingFile === file.filename"
                          @click="downloadFile(file)"
                        >{{ downloadingFile === file.filename ? '…' : downloadFlashFile === file.filename ? '✓' : downloadErrorFile === file.filename ? '!' : 'Get' }}</button>
                        <button
                          class="bk-test-btn bk-test-btn--restore"
                          :class="{
                            'bk-test-btn--sending': restoringFile === file.filename,
                            'bk-test-btn--sent':    restoreFlashFile === file.filename,
                            'bk-test-btn--error':   restoreErrorFile === file.filename,
                          }"
                          :disabled="restoringFile === file.filename"
                          @click="confirmRestore(file)"
                        >{{ restoringFile === file.filename ? '…' : restoreFlashFile === file.filename ? '✓' : restoreErrorFile === file.filename ? '!' : 'Restore' }}</button>
                      </div>
                    </div>
                  </div>

                  <!-- Per-destination history view -->
                  <div v-else key="tab-history" class="bk-tab-inner">
                    <div v-if="drilledHistory.length === 0" class="bk-history-empty">No runs recorded for this destination.</div>
                    <div
                      v-for="row in drilledHistory"
                      :key="row.id"
                      class="bk-type-item"
                    >
                      <div class="bk-type-row" @click="toggleExpanded(row.id)">
                        <v-icon size="15" class="bk-type-icon" :color="destHistoryIconColor(row)">{{ destHistoryIcon(row) }}</v-icon>
                        <div class="bk-type-body">
                          <span class="bk-type-name">{{ formatDateTime(row.logged_at) }}</span>
                          <span class="bk-type-when">
                            {{ row.trigger }}
                            <template v-if="row.row_count != null"> · {{ row.row_count }} rows</template>
                            <template v-if="row.size_bytes != null"> · {{ formatBytes(row.size_bytes) }}</template>
                          </span>
                        </div>
                        <v-icon size="14" color="#bbb" class="bk-chev" :class="{ 'bk-chev--open': expandedId === row.id }">mdi-chevron-down</v-icon>
                      </div>
                      <div v-if="expandedId === row.id" class="bk-history-detail">
                        <div class="bk-detail-pair"><span class="bk-detail-key">Triggered by</span><span class="bk-detail-val">{{ row.trigger }}</span></div>
                        <div class="bk-detail-pair"><span class="bk-detail-key">Duration</span><span class="bk-detail-val">{{ row.duration_ms != null ? row.duration_ms + ' ms' : '-' }}</span></div>
                        <div v-if="row.table_count != null" class="bk-detail-pair"><span class="bk-detail-key">Tables</span><span class="bk-detail-val">{{ row.table_count }}</span></div>
                        <div v-if="row.file_path" class="bk-detail-pair"><span class="bk-detail-key">File</span><span class="bk-detail-val bk-detail-val--mono">{{ row.file_path }}</span></div>
                        <div
                          v-for="dest in row.destinations.filter(d => d.destination === drilledDestination || d.destination.startsWith(drilledDestination + ':'))"
                          :key="dest.destination"
                          class="bk-detail-pair"
                          :class="{ 'bk-detail-pair--err': dest.status === 'error' }"
                        >
                          <span class="bk-detail-key">{{ dest.destination }}</span>
                          <span class="bk-detail-val">{{ dest.status }}{{ dest.error ? ' - ' + dest.error : '' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  </Transition>
                  </div><!-- /bk-tab-content -->
                  </template>

                  </div><!-- /bk-drill-body -->
                </div>

              </Transition>
            </div>

          </div>
        </div>

        <!-- STATUS — at the bottom, mirrors Notifications "App Notifications" toggle row -->
        <div class="bk-section">
          <p class="bk-section-label">Status</p>
          <div class="bk-list">
            <div class="bk-row">
              <div class="bk-field-body">
                <span class="bk-field-label">{{ keepAll ? 'Keep all' : 'Keep last' }}</span>
                <span class="bk-field-value">{{ keepAll ? 'Snapshots are kept indefinitely' : 'Older snapshots removed automatically' }}</span>
              </div>
              <div class="bk-retention">
                <Transition name="bk-retention-slide">
                  <div v-if="!keepAll" class="bk-retention-inner">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      class="bk-number-input"
                      :value="settings.backup_retention_count ?? '7'"
                      @change="e => updateSetting('backup_retention_count', (e.target as HTMLInputElement).value)"
                    />
                    <span class="bk-retention-suffix">snapshots</span>
                  </div>
                </Transition>
                <button
                  class="bk-test-btn"
                  :class="{ 'bk-test-btn--sent': keepAll }"
                  @click="toggleKeepAll"
                >All</button>
              </div>
            </div>
            <div class="bk-row">
              <div class="bk-field-body">
                <span class="bk-field-label">Schedule</span>
                <span class="bk-field-value">{{ statusSummary }}</span>
              </div>
              <span
                v-if="lastStatusPill"
                class="bk-status-pill"
                :class="`bk-status-pill--${lastStatusPill.tone}`"
              >
                <span class="bk-status-dot" />{{ lastStatusPill.label }}
              </span>
              <div class="bk-toggle" :class="{ on: enabledLive }" @click="toggleEnabled"><div class="bk-knob" /></div>
            </div>
          </div>
        </div>

      </div><!-- /bk-sections -->
    </div><!-- /bk-body -->

    <!-- Restore confirm overlay -->
    <Transition name="bk-fade">
      <div v-if="restoreConfirmFile" class="bk-confirm-backdrop" @click.self="restoreConfirmFile = null">
        <div class="bk-confirm-card">
          <div class="bk-confirm-icon"><v-icon size="22" color="#b45309">mdi-alert-outline</v-icon></div>
          <p class="bk-confirm-title">Restore this snapshot?</p>
          <p class="bk-confirm-body">
            All current data will be replaced with the contents of
            <strong>{{ restoreConfirmFile.logged_at ? formatDateTime(restoreConfirmFile.logged_at) : restoreConfirmFile.filename }}</strong>.
            A safety snapshot of your current state is written automatically before the restore runs.
          </p>
          <div class="bk-confirm-actions">
            <button class="bk-test-btn" @click="restoreConfirmFile = null">Cancel</button>
            <button class="bk-test-btn bk-test-btn--restore-go" @click="doRestore">Restore</button>
          </div>
        </div>
      </div>
    </Transition>

    <AppToast
      v-model="toastMessage"
      icon="mdi-alert-circle-outline"
      icon-color="#ef4444"
    />
  </DetailSheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import DetailSheet from '../components/ui/DetailSheet.vue'
import AppToast from '../components/ui/AppToast.vue'
import { useSettings } from '../composables/useSettings'
import { API, apiFetch } from '../api'

interface DestinationResult {
  destination: string
  status: 'ok' | 'error' | 'skipped'
  error: string | null
}

interface BackupRow {
  id: number
  trigger: string
  status: string
  file_path: string | null
  size_bytes: number | null
  duration_ms: number | null
  table_count: number | null
  row_count: number | null
  logged_at: string
  destinations: DestinationResult[]
}

interface TargetDesc {
  name: string
  display_name?: string | null
  endpoint?: string
  bucket?: string
  prefix?: string | null
  url?: string
}

interface DestDiag {
  config_state: 'configured' | 'partial' | 'absent'
  missing: string[]
  enabled: boolean
}

interface StatusPayload {
  enabled: boolean
  time: string
  retention: number
  last_run: BackupRow | null
  next_run: string | null
  targets: TargetDesc[]
  configured_target_names: string[]
  destinations?: { s3: DestDiag; webdav: DestDiag }
}


const props = defineProps<{ modelValue: boolean }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

function close() {
  expandedId.value         = null
  runResult.value          = null
  drilledDestination.value = null
  drilledView.value        = 'files'
  availableFiles.value     = []
  availableError.value     = null
  restoreConfirmFile.value = null
  emit('update:modelValue', false)
}

const { settings, fetchSettings, updateSetting } = useSettings()

const status  = ref<StatusPayload | null>(null)
const history = ref<BackupRow[]>([])
const expandedId = ref<number | null>(null)

const configuredTargetCount = computed(() => status.value?.configured_target_names.length ?? 0)
const enabledLive = computed(() => settings.value.backup_schedule_enabled === '1')

const keepAll = computed(() => parseInt(settings.value.backup_retention_count ?? '7', 10) <= 0)

const previousRetention = ref('7')

async function toggleKeepAll() {
  if (keepAll.value) {
    await updateSetting('backup_retention_count', previousRetention.value)
  } else {
    previousRetention.value = settings.value.backup_retention_count ?? '7'
    await updateSetting('backup_retention_count', '0')
  }
}

const hasWarnings = computed(() => {
  if (!status.value) return false
  if (!status.value.enabled) return true
  if (status.value.enabled && configuredTargetCount.value === 0) return true
  return false
})

const lastStatusPill = computed(() => {
  // First: if any enabled destination is currently in an error/misconfigured
  // state, the schedule pill stays red until it next clears. This matches what
  // the destination pills show, so the two never disagree.
  const badDest = destinationsList.value.find(
    d => d.id !== 'local' && d.enabled && d.pill.tone === 'err'
  )
  if (badDest) return { tone: 'err', label: 'Remote err' }

  const lr = status.value?.last_run
  if (!lr) return null
  if (lr.status === 'ok') {
    const hasRemoteErr = lr.destinations?.some(d => d.destination !== 'local' && d.status === 'error')
    if (hasRemoteErr) return { tone: 'err', label: 'Remote err' }
    return { tone: 'live', label: 'OK' }
  }
  return { tone: 'err', label: 'Failed' }
})

const statusSummary = computed(() => {
  if (!status.value) return '-'
  if (!status.value.enabled) return 'Schedule disabled'
  const lr = status.value.last_run
  const last = lr ? `last ${formatDateTime(lr.logged_at)}` : 'no runs yet'
  const next = status.value.next_run ? `next ${formatDateTime(status.value.next_run)}` : ''
  return next ? `${last} · ${next}` : last
})

// ── Run ─────────────────────────────────────────────────────────────────────

const runSending = ref(false)
const runResult  = ref<'ok' | 'partial' | 'error' | null>(null)

async function runNow() {
  if (runSending.value) return
  runSending.value = true
  runResult.value  = null
  try {
    const res = await apiFetch(`${API}/premium/backups/run-now`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      runResult.value = 'error'
    } else {
      const hasRemoteErr = data.row?.destinations?.some(
        (d: DestinationResult) => d.destination !== 'local' && d.status === 'error'
      )
      runResult.value = hasRemoteErr ? 'partial' : 'ok'
    }
  } catch {
    runResult.value = 'error'
  }
  runSending.value = false
  await refresh()
  setTimeout(() => { runResult.value = null }, 2000)
}

// ── Toggle ──────────────────────────────────────────────────────────────────

async function toggleEnabled() {
  const next = enabledLive.value ? '0' : '1'
  await updateSetting('backup_schedule_enabled', next)
  await refresh()
}

// ── Slide direction ─────────────────────────────────────────────────────────

const slideDirection = ref<'left' | 'right'>('left')

// ── Destinations ────────────────────────────────────────────────────────────
//
// Each entry combines:
//   • live config state (configured / partial / absent)
//   • user enable toggle (settings: backup_dest_<name>_enabled)
//   • most-recent runtime status for that target (from history)
// into a single pill + toggle row.

type PillTone = 'live' | 'err' | 'paused' | 'partial'

interface DestEntry {
  id: 'local' | 's3' | 'webdav' | 'history'
  label: string
  icon: string
  color: string
  detail: string
  enabled: boolean
  toggleable: boolean
  drillable: boolean
  pill: { tone: PillTone; label: string }
}

// Most recent attempt status for a given remote destination name.
// Matches exact name or name-prefixed entries (e.g. 's3' matches 's3:archive').
// Scans history newest-first; returns 'ok' | 'err' | 'never'.
function lastRemoteStatus(name: string): 'ok' | 'err' | 'never' {
  for (const row of history.value) {
    const dest = row.destinations?.find(
      d => d.destination === name || d.destination.startsWith(name + ':')
    )
    if (!dest) continue
    if (dest.status === 'ok')    return 'ok'
    if (dest.status === 'error') return 'err'
  }
  return 'never'
}

const destinationsList = computed<DestEntry[]>(() => {
  const out: DestEntry[] = []

  out.push({
    id: 'local',
    label: 'Local',
    icon: 'mdi-folder-outline',
    color: '#4ade80',
    detail: 'Inside the server data volume',
    enabled: true,
    toggleable: false,
    drillable: true,
    pill: { tone: 'live', label: 'On' },
  })

  const dests = status.value?.destinations
  if (!dests) return out

  // S3
  if (dests.s3.config_state !== 'absent') {
    const enabled = settings.value.backup_dest_s3_enabled !== '0'
    const last    = lastRemoteStatus('s3')
    const partial = dests.s3.config_state === 'partial'
    const t       = (status.value?.targets ?? []).find(x => x.name === 's3')
    const detail  = partial
      ? `Missing ${dests.s3.missing.join(', ')}`
      : (t ? `${t.endpoint} · ${t.bucket} · S3-compatible` : 'S3-compatible')
    let pill: { tone: PillTone; label: string }
    if (partial)        pill = { tone: 'err',    label: 'Misconfigured' }
    else if (!enabled)  pill = { tone: 'paused', label: 'Paused' }
    else if (last === 'err') pill = { tone: 'err', label: 'Remote err' }
    else                pill = { tone: 'live',   label: 'On' }
    out.push({
      id: 's3',
      label: t?.display_name || 'S3',
      icon: 'mdi-cloud-outline',
      color: '#3b82f6',
      detail,
      enabled,
      toggleable: !partial,
      drillable: !partial,
      pill,
    })
  }

  // WebDAV
  if (dests.webdav.config_state !== 'absent') {
    const enabled = settings.value.backup_dest_webdav_enabled !== '0'
    const last    = lastRemoteStatus('webdav')
    const partial = dests.webdav.config_state === 'partial'
    const t       = (status.value?.targets ?? []).find(x => x.name === 'webdav')
    const detail  = partial
      ? `Missing ${dests.webdav.missing.join(', ')}`
      : (t?.url ? `${t.url} · WebDAV` : 'WebDAV')
    let pill: { tone: PillTone; label: string }
    if (partial)        pill = { tone: 'err',    label: 'Misconfigured' }
    else if (!enabled)  pill = { tone: 'paused', label: 'Paused' }
    else if (last === 'err') pill = { tone: 'err', label: 'Remote err' }
    else                pill = { tone: 'live',   label: 'On' }
    out.push({
      id: 'webdav',
      label: t?.display_name || 'WebDAV',
      icon: 'mdi-server-network',
      color: '#8b5cf6',
      detail,
      enabled,
      toggleable: !partial,
      drillable: !partial,
      pill,
    })
  }

  return out
})

const storageDestinations = computed(() => destinationsList.value)

// ── Destination toggle + Enable all ─────────────────────────────────────────

async function toggleDestination(id: 'local' | 's3' | 'webdav') {
  if (id === 'local') return
  const key = id === 's3' ? 'backup_dest_s3_enabled' : 'backup_dest_webdav_enabled'
  const cur = settings.value[key] === '1'
  await updateSetting(key, cur ? '0' : '1')
}

const enableAllFlash = ref(false)

async function enableAllDestinations() {
  const dests = status.value?.destinations
  if (dests?.s3.config_state === 'configured')     await updateSetting('backup_dest_s3_enabled',     '1')
  if (dests?.webdav.config_state === 'configured') await updateSetting('backup_dest_webdav_enabled', '1')
  enableAllFlash.value = true
  setTimeout(() => { enableAllFlash.value = false }, 2000)
}

// ── Destination drill-in ────────────────────────────────────────────────────

// AvailableFile is what the /available/:target endpoint returns - files that
// actually exist right now, not history. source matches the target name string
// ('local', 's3', 'webdav', 's3:archive', etc.) so it's extensible.
interface AvailableFile {
  source:      string
  history_id:  number | null
  file_path:   string | null
  remote_key:  string | null
  filename:    string
  size_bytes:  number | null
  logged_at:   string | null
  row_count:   number | null
  table_count: number | null
  trigger:     string | null
}

const drilledDestination  = ref<string | null>(null)
const drilledView         = ref<'files' | 'history'>('files')
const tabDirection        = ref<'left' | 'right'>('left')
const availableFiles      = ref<AvailableFile[]>([])
const availableLoading    = ref(false)
const availableError      = ref<string | null>(null)

function switchTab(tab: 'files' | 'history') {
  if (tab === drilledView.value) return
  tabDirection.value = tab === 'history' ? 'left' : 'right'
  drilledView.value = tab
}

function drillBack() {
  slideDirection.value     = 'right'
  drilledDestination.value = null
}

async function drillInto(id: string, view: 'files' | 'history' = 'files') {
  slideDirection.value     = 'left'
  drilledDestination.value = id
  drilledView.value        = view
  if (view === 'files') {
    availableFiles.value   = []
    availableError.value   = null
    availableLoading.value = true
    try {
      const res = await apiFetch(`${API}/premium/backups/available/${id}`)
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        availableFiles.value = data
      } else {
        availableError.value = data.error || 'Failed to load'
      }
    } catch {
      availableError.value = 'Could not reach server'
    }
    availableLoading.value = false
  }
}

const drilledHistory = computed<BackupRow[]>(() => {
  const id = drilledDestination.value
  if (!id) return []
  if (id === 'local' || id === 'history') return history.value
  return history.value.filter(r =>
    r.destinations?.some(d => d.destination === id || d.destination.startsWith(id + ':'))
  )
})

const drilledLabel = computed(() => {
  if (drilledDestination.value === 'history') return 'All destinations'
  const d = destinationsList.value.find(x => x.id === drilledDestination.value)
  return d?.label ?? drilledDestination.value ?? ''
})

const headerCount = computed(() => {
  if (drilledDestination.value === 'history') return `${history.value.length} runs`
  if (drilledDestination.value) {
    return drilledView.value === 'history'
      ? `${drilledHistory.value.length} runs`
      : `${availableFiles.value.length} snapshots`
  }
  const active = destinationsList.value.filter(d => d.enabled).length
  return active === 0 ? 'All paused' : `${active} of ${destinationsList.value.length} active`
})

// ── Toast ────────────────────────────────────────────────────────────────────

const toastMessage = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = null }, 4000)
}

// ── Download ────────────────────────────────────────────────────────────────

const downloadingFile = ref<string | null>(null)
const downloadFlashFile = ref<string | null>(null)
const downloadErrorFile = ref<string | null>(null)

async function downloadFile(file: AvailableFile) {
  if (downloadingFile.value) return
  downloadingFile.value  = file.filename
  downloadErrorFile.value = null

  try {
    let res: Response
    if (file.source === 'local' && file.history_id != null) {
      res = await apiFetch(`${API}/premium/backups/${file.history_id}/download`)
    } else {
      const params = new URLSearchParams({ target: file.source, key: file.remote_key! })
      res = await apiFetch(`${API}/premium/backups/download-remote?${params}`)
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      showToast(data.error || 'Download failed')
      downloadErrorFile.value = file.filename
      setTimeout(() => { if (downloadErrorFile.value === file.filename) downloadErrorFile.value = null }, 2500)
      return
    }

    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = file.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    downloadFlashFile.value = file.filename
    setTimeout(() => { if (downloadFlashFile.value === file.filename) downloadFlashFile.value = null }, 2500)
  } catch {
    showToast('Download failed - could not reach the server')
    downloadErrorFile.value = file.filename
    setTimeout(() => { if (downloadErrorFile.value === file.filename) downloadErrorFile.value = null }, 2500)
  }
  downloadingFile.value = null
}

// ── Restore ─────────────────────────────────────────────────────────────────

const restoringFile       = ref<string | null>(null)
const restoreFlashFile    = ref<string | null>(null)
const restoreErrorFile    = ref<string | null>(null)
const restoreConfirmFile  = ref<AvailableFile | null>(null)

function confirmRestore(file: AvailableFile) {
  restoreConfirmFile.value = file
}

async function doRestore() {
  const file = restoreConfirmFile.value
  if (!file) return
  restoreConfirmFile.value = null
  restoringFile.value    = file.filename
  restoreErrorFile.value = null

  try {
    let res: Response
    if (file.source === 'local' && file.history_id != null) {
      res = await apiFetch(`${API}/premium/backups/${file.history_id}/restore`, { method: 'POST' })
    } else {
      res = await apiFetch(`${API}/premium/backups/restore-remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: file.source, remote_key: file.remote_key }),
      })
    }

    const data = await res.json().catch(() => ({}))
    if (res.ok && data.success) {
      restoreFlashFile.value = file.filename
      setTimeout(() => { if (restoreFlashFile.value === file.filename) restoreFlashFile.value = null }, 2500)
    } else {
      const msg = data.error || 'Restore failed'
      showToast(msg)
      restoreErrorFile.value = file.filename
      setTimeout(() => { if (restoreErrorFile.value === file.filename) restoreErrorFile.value = null }, 2500)
      // File confirmed gone on server - remove from live list so button disables
      if (msg.includes('no longer on disk') || msg.includes('pruned')) {
        availableFiles.value = availableFiles.value.filter(f => f.filename !== file.filename)
      }
    }
  } catch {
    showToast('Restore failed - could not reach the server')
    restoreErrorFile.value = file.filename
    setTimeout(() => { if (restoreErrorFile.value === file.filename) restoreErrorFile.value = null }, 2500)
  }
  restoringFile.value = null
}

// ── Data load ──────────────────────────────────────────────────────────────

async function fetchStatus() {
  try {
    const res = await apiFetch(`${API}/premium/backups/status`)
    if (res.ok) status.value = await res.json()
  } catch { /* non-fatal */ }
}

async function fetchHistory() {
  try {
    const res = await apiFetch(`${API}/premium/backups/history?limit=30`)
    if (res.ok) {
      const data = await res.json()
      history.value = data.rows ?? []
    }
  } catch { /* non-fatal */ }
}

async function refresh() {
  await Promise.all([fetchStatus(), fetchHistory()])
  if (drilledDestination.value) {
    const current = drilledDestination.value
    const currentView = drilledView.value
    if (currentView === 'files') {
      availableLoading.value = true
      availableError.value   = null
      try {
        const res  = await apiFetch(`${API}/premium/backups/available/${current}`)
        availableFiles.value = res.ok ? await res.json() : []
        if (!res.ok) availableError.value = 'Failed to load files'
      } catch { availableError.value = 'Failed to load files' }
      finally { availableLoading.value = false }
    }
  }
}

function toggleExpanded(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

watch(() => props.modelValue, (open) => {
  if (open) { fetchSettings(); refresh() }
}, { immediate: true })

// ── Formatters ─────────────────────────────────────────────────────────────

function historyIcon(row: BackupRow): string {
  if (row.status !== 'ok') return 'mdi-alert-circle'
  if (row.destinations?.some(d => d.destination !== 'local' && d.status === 'error')) return 'mdi-alert-circle-outline'
  return 'mdi-check-circle'
}
function historyIconColor(row: BackupRow): string {
  if (row.status !== 'ok') return '#ef4444'
  if (row.destinations?.some(d => d.destination !== 'local' && d.status === 'error')) return '#f59e0b'
  return '#4ade80'
}

function destHistoryIcon(row: BackupRow): string {
  const id = drilledDestination.value
  if (!id) return 'mdi-check-circle'
  const dest = row.destinations?.find(d => d.destination === id || d.destination.startsWith(id + ':'))
  if (!dest || dest.status === 'error') return 'mdi-alert-circle'
  return 'mdi-check-circle'
}
function destHistoryIconColor(row: BackupRow): string {
  const id = drilledDestination.value
  if (!id) return '#4ade80'
  const dest = row.destinations?.find(d => d.destination === id || d.destination.startsWith(id + ':'))
  if (!dest || dest.status === 'error') return '#ef4444'
  return '#4ade80'
}

function formatDateTime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
</script>

<style scoped>
/* Shell, handle, header, subtitle come from DetailSheet (subtitle-style="plain"). */

/* ── Warnings ──────────────────────────────────────────────────────────────── */
.bk-warning {
  display: flex; align-items: flex-start; gap: 8px;
  margin: 0; padding: 10px 14px;
  background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;
  font-size: 11px; color: #92400e; line-height: 1.5;
  flex-shrink: 0;
}
.bk-warning--soft { background: #fefce8; border-color: #fef08a; color: #a16207; }
.bk-warning code {
  background: #fef3c7; border-radius: 3px; padding: 0 3px;
  font-size: 10px; font-family: monospace;
}

/* ── Body ──────────────────────────────────────────────────────────────────── */
.bk-body {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; gap: 16px;
}
.bk-sections { display: flex; flex-direction: column; gap: 16px; }

/* ── Section ──────────────────────────────────────────────────────────────── */
.bk-section { display: flex; flex-direction: column; gap: 8px; }
.bk-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.bk-section-label {
  font-size: 10px; font-weight: 700; color: #bbb;
  letter-spacing: 0.07em; text-transform: uppercase; margin: 0;
}

/* ── Status pill ──────────────────────────────────────────────────────────── */
.bk-status-pill {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  border-radius: 99px; padding: 2px 8px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
  min-width: 50px; flex-shrink: 0;
}
.bk-status-pill--live    { background: #DCFCE7; color: #15803D; }
.bk-status-pill--partial { background: #fef3c7; color: #92400e; }
.bk-status-pill--err     { background: #fee2e2; color: #b91c1c; }
.bk-status-pill--paused  { background: #F5F5F5; color: #aaa; }
.bk-status-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: currentColor; flex-shrink: 0;
}

/* ── List card ────────────────────────────────────────────────────────────── */
.bk-list { border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; }
.bk-row {
  padding: 12px 14px;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #f0f0f0; gap: 12px;
}
.bk-row:last-child { border-bottom: none; }

.bk-field-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.bk-field-label { font-size: 13px; color: #333; }
.bk-field-value { font-size: 12px; color: #888; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Toggle ───────────────────────────────────────────────────────────────── */
.bk-toggle {
  width: 40px; height: 22px; border-radius: 11px;
  background: #e0e0e0; position: relative; cursor: pointer;
  transition: background 0.2s; flex-shrink: 0;
}
.bk-toggle.on { background: #4ade80; }
.bk-knob {
  position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.bk-toggle.on .bk-knob { transform: translateX(18px); }

/* ── Inputs ───────────────────────────────────────────────────────────────── */
.bk-time-input {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  text-align: right; padding: 2px 0; outline: none; width: 90px;
}
.bk-retention { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.bk-retention-inner { display: flex; align-items: baseline; gap: 6px; }
.bk-retention-slide-enter-active,
.bk-retention-slide-leave-active {
  transition: transform 0.22s ease, opacity 0.18s ease;
}
.bk-retention-slide-enter-from,
.bk-retention-slide-leave-to {
  transform: translateX(12px); opacity: 0;
}
.bk-number-input {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  text-align: right; padding: 2px 0; outline: none; width: 48px;
}
.bk-retention-suffix { font-size: 11px; color: #aaa; }

/* ── Test/Run pill button ─────────────────────────────────────────────────── */
.bk-test-btn {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 99px; padding: 2px 10px;
  min-width: 44px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
  background: #fff; color: #888; border: 1px solid #e0e0e0;
  cursor: pointer; flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.bk-test-btn:not(:disabled):not(.bk-test-btn--sent):not(.bk-test-btn--error):not(.bk-test-btn--sending):not(.bk-test-btn--partial):hover {
  background: #f5f5f5; color: #555;
}
.bk-test-btn:disabled { opacity: 0.45; cursor: default; }
.bk-test-btn--sending { opacity: 0.6; cursor: default; }
.bk-test-btn--sent    { background: #DCFCE7; color: #15803D; border-color: #bbf7d0; cursor: default; }
.bk-test-btn--sent:hover    { background: #DCFCE7; color: #15803D; border-color: #bbf7d0; }
.bk-test-btn--partial { background: #fef3c7; color: #92400e; border-color: #fde68a; cursor: default; }
.bk-test-btn--partial:hover { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.bk-test-btn--error   { background: #fee2e2; color: #b91c1c; border-color: #fecaca; cursor: default; }
.bk-test-btn--error:hover   { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
.bk-test-btn--restore { color: #b45309; border-color: #fde68a; }
.bk-test-btn--restore.bk-test-btn--sent  { color: #15803D; border-color: #bbf7d0; background: #DCFCE7; }
.bk-test-btn--restore.bk-test-btn--error { color: #b91c1c; border-color: #fecaca; background: #fee2e2; }
.bk-test-btn--restore:not(:disabled):not(.bk-test-btn--error):not(.bk-test-btn--sent):hover { background: #fffbeb; color: #b45309; border-color: #fde68a; }
.bk-test-btn--restore-go { background: #b45309; color: #fff; border-color: #b45309; }
.bk-test-btn--restore-go:hover { background: #92400e; color: #fff; }

.bk-refresh-btn {
  background: none; border: none; cursor: pointer;
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; color: #888; padding: 2px 6px;
  border-radius: 6px; transition: background 0.15s;
}
.bk-refresh-btn:hover { background: #f5f5f5; color: #555; }

.bk-section-head-left { display: flex; align-items: center; gap: 8px; }

/* ── Enable all chip (mirror nm-all-on-btn) ───────────────────────────────── */
.bk-all-on-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  border-radius: 99px; padding: 2px 8px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
  border: none; cursor: pointer; transition: background 0.2s, color 0.2s;
  background: #FBEAF0; color: #993556;
  min-width: 68px;
}
.bk-all-on-btn .bk-status-dot { background: #993556; flex-shrink: 0; }
.bk-all-on-btn:hover { background: #f7dae6; }
.bk-all-on-btn--done { background: #DCFCE7; color: #15803D; }
.bk-all-on-btn--done:hover { background: #DCFCE7; color: #15803D; }

/* ── App card ─────────────────────────────────────────────────────────────── */
.bk-app-card {
  border: 1px solid #f0f0f0; border-radius: 12px; overflow: visible;
}
.bk-app-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px; gap: 12px; background: #fff;
  border-radius: 12px 12px 0 0;
}
.bk-app-header-right { display: flex; align-items: center; gap: 10px; }

.bk-app-header-title {
  font-size: 13px; font-weight: 600; color: #333;
  padding: 6px 0;
}

/* ── App content wrapper ──────────────────────────────────────────────────── */
.bk-app-content { overflow: hidden; }

/* ── Slide transition ─────────────────────────────────────────────────────── */
.bk-slide-left-enter-active,
.bk-slide-left-leave-active,
.bk-slide-right-enter-active,
.bk-slide-right-leave-active {
  transition: transform 0.22s ease, opacity 0.18s ease;
}
.bk-slide-left-enter-from  { transform: translateX(32px);  opacity: 0; }
.bk-slide-left-leave-to    { transform: translateX(-32px); opacity: 0; }
.bk-slide-right-enter-from { transform: translateX(-32px); opacity: 0; }
.bk-slide-right-leave-to   { transform: translateX(32px);  opacity: 0; }

/* ── Type scroll ──────────────────────────────────────────────────────────── */
.bk-type-scroll {
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
  border-radius: 0 0 12px 12px;
  height: 220px; overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: #e0e0e0 transparent;
  display: flex; flex-direction: column;
  overscroll-behavior: none;
  touch-action: pan-y;
}
.bk-type-scroll::-webkit-scrollbar { width: 4px; }
.bk-type-scroll::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 99px; }

.bk-body--no-warnings .bk-type-scroll { height: 260px; }

.bk-type-item {
  border-bottom: 1px solid #f0f0f0;
  background: none;
  border-top: none; border-left: none; border-right: none;
  width: 100%; text-align: left; padding: 0;
  font: inherit; color: inherit;
}
.bk-type-item:last-child { border-bottom: none; }
.bk-dest-clickable { cursor: pointer; transition: background 0.12s; }
.bk-dest-clickable:hover { background: #f5f5f5; }

.bk-type-row {
  padding: 9px 14px;
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; transition: background 0.12s;
}
.bk-type-row:hover { background: #f5f5f5; }
.bk-type-icon { flex-shrink: 0; }
.bk-type-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.bk-type-name { font-size: 12px; color: #444; }
.bk-type-when { font-size: 11px; color: #bbb; }

.bk-chev { transition: transform 0.2s; flex-shrink: 0; }
.bk-chev--open { transform: rotate(180deg); }

/* ── Destination row (toggleable, matches notification type rows) ─────────── */
.bk-dest-row {
  padding: 9px 14px;
  display: flex; align-items: center; gap: 10px;
}
.bk-dest-row-body {
  display: flex; flex-direction: column; gap: 1px;
  min-width: 0; flex: 1;
}
.bk-dest-row-body--clickable { cursor: pointer; }
.bk-dest-row-line { display: flex; align-items: center; gap: 6px; }
.bk-dest-name { font-size: 12px; color: #444; font-weight: 500; text-align: left; }
.bk-dest-detail-inline {
  font-size: 11px; color: #bbb; line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bk-type-icon { cursor: pointer; flex-shrink: 0; transition: opacity 0.15s; }
.bk-type-icon:hover { opacity: 0.7; }
.bk-type-icon--locked { cursor: default; }
.bk-type-icon--locked:hover { opacity: 1; }
.bk-dest-chev { flex-shrink: 0; cursor: pointer; }
.bk-dest-row .bk-status-pill { width: 68px; }
.bk-dest-history-btn {
  flex-shrink: 0;
  background: none; border: 1px solid #e8e8e8; border-radius: 99px;
  font-size: 10px; font-weight: 600; color: #aaa; letter-spacing: 0.02em;
  padding: 2px 7px; cursor: pointer; transition: background 0.12s, color 0.12s;
}
.bk-dest-history-btn:hover { background: #f5f5f5; color: #555; }

/* ── Split destinations layout ────────────────────────────────────────────── */
.bk-type-scroll--split { overflow-y: hidden; display: flex; flex-direction: column; }
.bk-dest-list-scroll { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #e0e0e0 transparent; }
.bk-dest-all-row { flex-shrink: 0; border-top: 1px solid #f0f0f0; }
.bk-status-pill--spacer { visibility: hidden; }

/* ── Drill-in layout ──────────────────────────────────────────────────────── */
.bk-type-scroll--drill { overflow-y: hidden; display: flex; flex-direction: column; }
.bk-drill-body { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #e0e0e0 transparent; }

/* ── Drill-in tab content ─────────────────────────────────────────────────── */
.bk-tab-content { flex: 1; min-height: 0; overflow: hidden; }
.bk-tab-inner { height: 100%; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #e0e0e0 transparent; }

/* ── Drill-in header ──────────────────────────────────────────────────────── */
.bk-drill-head {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}
.bk-back-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 99px;
  color: #888; background: #f5f5f5; border: 1px solid #e8e8e8;
  cursor: pointer; transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.bk-back-chip:hover { background: #ececec; color: #444; }
.bk-drill-title { font-size: 12px; font-weight: 600; color: #333; }
.bk-drill-tabs { display: flex; gap: 4px; margin-left: auto; flex-shrink: 0; }
.bk-drill-tab {
  background: none; border: 1px solid #e8e8e8; border-radius: 99px;
  font-size: 10px; font-weight: 600; color: #aaa; letter-spacing: 0.02em;
  padding: 2px 8px; cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.bk-drill-tab:hover { background: #f5f5f5; color: #555; }
.bk-drill-tab--active { background: #f5f5f5; color: #333; border-color: #d0d0d0; }

/* ── Snapshot row (download/restore) ──────────────────────────────────────── */
.bk-snap-row {
  padding: 9px 12px;
  display: flex; align-items: center; gap: 8px;
}
.bk-snap-row .bk-test-btn { padding: 2px 8px; min-width: 52px; }
.bk-snap-row .bk-test-btn--restore { width: 58px; min-width: 58px; }

/* ── History empty / detail ───────────────────────────────────────────────── */
.bk-history-empty {
  padding: 24px 14px; text-align: center;
  font-size: 12px; color: #aaa;
}
.bk-history-empty--err { color: #b91c1c; }

.bk-history-detail {
  padding: 8px 14px 12px 39px;
  background: #fff;
  display: flex; flex-direction: column; gap: 4px;
  border-top: 1px solid #f5f5f5;
}
.bk-detail-pair { display: flex; gap: 10px; align-items: baseline; }
.bk-detail-key  { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.04em; min-width: 80px; flex-shrink: 0; }
.bk-detail-val  { font-size: 11.5px; color: #555; word-break: break-all; }
.bk-detail-val--mono { font-family: monospace; font-size: 11px; color: #444; }
.bk-detail-pair--err .bk-detail-val { color: #b91c1c; }

/* ── Restore confirm overlay ──────────────────────────────────────────────── */
.bk-confirm-backdrop {
  position: fixed; inset: 0; z-index: 999;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.bk-confirm-card {
  background: #fff; border-radius: 14px;
  padding: 20px 22px; max-width: 360px; width: 100%;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.2);
}
.bk-confirm-icon {
  width: 44px; height: 44px; border-radius: 50%;
  background: #fffbeb; border: 1px solid #fde68a;
  display: flex; align-items: center; justify-content: center;
  align-self: center;
}
.bk-confirm-title {
  font-size: 15px; font-weight: 700; color: #1a1a1a;
  margin: 0; text-align: center;
}
.bk-confirm-body {
  font-size: 12px; color: #555; margin: 0;
  line-height: 1.5; text-align: center;
}
.bk-confirm-actions {
  display: flex; justify-content: center; gap: 8px;
  margin-top: 6px;
}

.bk-fade-enter-active, .bk-fade-leave-active { transition: opacity 0.15s ease; }
.bk-fade-enter-from, .bk-fade-leave-to { opacity: 0; }

</style>
