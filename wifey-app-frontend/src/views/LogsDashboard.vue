<template>
  <div class="logs-wrapper">

        <!-- Header -->
        <div class="logs-header">
          <button class="back-btn" @click="$router.push('/')">
            <v-icon size="18" color="grey-darken-1">mdi-arrow-left</v-icon>
          </button>
          <div>
            <h1 class="logs-title">App Logs</h1>
            <p class="logs-sub">{{ lastFetched ? `Updated ${lastFetched}` : 'Loading...' }}</p>
          </div>
          <button class="refresh-btn" @click="fetchLogs">
            <v-icon size="18" :class="{ spinning: loading }" color="grey-darken-1">mdi-refresh</v-icon>
          </button>
        </div>

        <!-- Pagination -->
        <div class="pagination-bar">
          <button class="page-btn" :disabled="offset === 0" @click="goNewer">
            <v-icon size="16" color="grey-darken-1">mdi-chevron-left</v-icon>
            Newer
          </button>
          <span class="page-label">{{ offset === 0 ? 'Latest' : `−${offset}` }}</span>
          <button class="page-btn" :disabled="!hasMore" @click="goOlder">
            Older
            <v-icon size="16" color="grey-darken-1">mdi-chevron-right</v-icon>
          </button>
        </div>

        <!-- Error state -->
        <div v-if="error" class="error-banner">
          <v-icon size="16" color="red">mdi-alert-circle-outline</v-icon>
          <span>{{ error }}</span>
        </div>

        <!-- Tabs -->
        <v-tabs v-model="tab" color="#D4537E" density="compact" class="logs-tabs">
          <v-tab value="system_errors">
            Errors
            <v-badge v-if="logs.system_errors.length" :content="logs.system_errors.length" color="red" inline class="ml-1" />
          </v-tab>
          <v-tab value="notification_runs">Notif. Runs</v-tab>
          <v-tab value="notification_sends">Sends</v-tab>
          <v-tab value="period_events">Period Events</v-tab>
          <v-tab value="period_calculations">Calculations</v-tab>
        </v-tabs>

        <v-tabs-window v-model="tab">

          <!-- System Errors -->
          <v-tabs-window-item value="system_errors">
            <div v-if="!logs.system_errors.length" class="empty-state">No errors recorded</div>
            <div v-for="row in logs.system_errors" :key="row.id" class="log-card error-card">
              <div class="log-meta">
                <span class="log-badge source-badge">{{ row.source }}</span>
                <span class="log-time">{{ formatTime(row.logged_at) }}</span>
              </div>
              <p class="log-message">{{ row.message }}</p>
              <pre v-if="row.stack" class="log-stack">{{ row.stack }}</pre>
            </div>
          </v-tabs-window-item>

          <!-- Notification Runs -->
          <v-tabs-window-item value="notification_runs">
            <div v-if="!logs.notification_runs.length" class="empty-state">No runs recorded</div>
            <div v-for="row in logs.notification_runs" :key="row.id" class="log-card">
              <div class="log-meta">
                <span class="log-badge">{{ row.trigger }}</span>
                <span class="log-time">{{ formatTime(row.logged_at) }}</span>
              </div>
              <div class="log-stats">
                <span class="stat">Checked <strong>{{ row.total_checked }}</strong></span>
                <span class="stat sent">Sent <strong>{{ row.total_sent }}</strong></span>
                <span class="stat">Skipped <strong>{{ row.total_skipped }}</strong></span>
                <span class="stat" :class="{ 'stat-error': row.total_errors > 0 }">
                  Errors <strong>{{ row.total_errors }}</strong>
                </span>
              </div>
              <p class="log-detail">{{ row.run_date }}</p>
            </div>
          </v-tabs-window-item>

          <!-- Notification Sends -->
          <v-tabs-window-item value="notification_sends">
            <div v-if="!logs.notification_sends.length" class="empty-state">No sends recorded</div>
            <div v-for="row in logs.notification_sends" :key="row.id" class="log-card">
              <div class="log-meta">
                <span class="log-badge">run #{{ row.run_id }}</span>
                <span class="log-time">{{ formatTime(row.logged_at) }}</span>
              </div>
              <p class="log-message">{{ row.type_id }}</p>
            </div>
          </v-tabs-window-item>

          <!-- Period Events -->
          <v-tabs-window-item value="period_events">
            <div v-if="!logs.period_events.length" class="empty-state">No period events recorded</div>
            <div v-for="row in logs.period_events" :key="row.id" class="log-card">
              <div class="log-meta">
                <span class="log-badge" :class="actionClass(row.action)">{{ row.action }}</span>
                <span class="log-badge entity-badge">{{ row.entity }}</span>
                <span class="log-time">{{ formatTime(row.logged_at) }}</span>
              </div>
              <p class="log-detail">
                {{ row.date }} &nbsp;·&nbsp; entity_id: {{ row.entity_id }} &nbsp;·&nbsp; cycle_id: {{ row.cycle_id }}
              </p>
            </div>
          </v-tabs-window-item>

          <!-- Period Calculations -->
          <v-tabs-window-item value="period_calculations">
            <div v-if="!logs.period_calculations.length" class="empty-state">No calculations recorded</div>
            <div v-for="row in logs.period_calculations" :key="row.id" class="log-card">
              <div class="log-meta">
                <span class="log-badge">{{ row.source }}</span>
                <span v-if="row.is_irregular" class="log-badge irregular-badge">irregular</span>
                <span class="log-time">{{ formatTime(row.logged_at) }}</span>
              </div>
              <div class="log-stats">
                <span class="stat">Avg cycle <strong>{{ row.avg_cycle_length ?? '—' }}d</strong></span>
                <span class="stat">Avg period <strong>{{ row.avg_period_length ?? '—' }}d</strong></span>
                <span class="stat">Cycles <strong>{{ row.total_cycles_tracked ?? '—' }}</strong></span>
                <span class="stat" :class="{ 'stat-error': row.data_warnings_count > 0 }">
                  Warnings <strong>{{ row.data_warnings_count }}</strong>
                </span>
              </div>
              <p class="log-detail">
                Next period: {{ row.next_period_date ?? '—' }} &nbsp;·&nbsp;
                Ovulation: {{ row.ovulation_date ?? '—' }}
              </p>
            </div>
          </v-tabs-window-item>

        </v-tabs-window>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { API_BASE, apiFetch } from '../api'

const LIMIT = 200

const tab = ref('system_errors')
const loading = ref(false)
const error = ref<string | null>(null)
const lastFetched = ref<string | null>(null)
const offset = ref(0)

const logs = ref({
  system_errors: [] as any[],
  notification_runs: [] as any[],
  notification_sends: [] as any[],
  period_events: [] as any[],
  period_calculations: [] as any[]
})

const hasMore = computed(() =>
  Object.values(logs.value).some(arr => arr.length === LIMIT)
)

async function fetchLogs() {
  loading.value = true
  error.value = null
  try {
    const res = await apiFetch(`${API_BASE}/api/logs?offset=${offset.value}`)
    if (!res.ok) throw new Error(`Server responded ${res.status}`)
    const data = await res.json()
    logs.value = data
    lastFetched.value = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } catch (err: any) {
    error.value = err.message ?? 'Failed to load logs'
  } finally {
    loading.value = false
  }
}

function goOlder() {
  offset.value += LIMIT
  fetchLogs()
}

function goNewer() {
  offset.value = Math.max(0, offset.value - LIMIT)
  fetchLogs()
}

function formatTime(ts: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function actionClass(action: string) {
  if (action === 'create') return 'action-create'
  if (action === 'delete') return 'action-delete'
  return 'action-update'
}

onMounted(fetchLogs)
</script>

<style scoped>
.logs-wrapper {
  padding: 1.25rem;
  max-width: 480px;
  margin: 0 auto;
}

@media (min-width: 769px) {
  .logs-wrapper {
    max-width: 540px;
    transform: scale(1.12);
    transform-origin: top center;
  }
}

.logs-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1rem;
}
.logs-header > div {
  flex: 1;
}
.logs-title { font-size: 20px; font-weight: 500; margin: 0 0 2px; }
.logs-sub { font-size: 11px; color: #aaa; margin: 0; }
.back-btn, .refresh-btn {
  width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid #e0e0e0; background: #f5f5f5;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  flex-shrink: 0;
}

.spinning { animation: spin 0.7s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.error-banner {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 8px;
  background: #FEF2F2; color: #991B1B;
  font-size: 12px; margin-bottom: 10px;
}

.pagination-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.page-btn {
  display: flex; align-items: center; gap: 3px;
  font-size: 12px; color: #555; background: #f5f5f5;
  border: 1px solid #e0e0e0; border-radius: 6px;
  padding: 4px 10px; cursor: pointer;
}
.page-btn:disabled { opacity: 0.35; cursor: default; }
.page-label { font-size: 11px; color: #aaa; }

.logs-tabs { margin-bottom: 10px; }

.empty-state {
  text-align: center; padding: 32px 0;
  font-size: 13px; color: #aaa;
}

.log-card {
  background: #fff; border: 1px solid #f0f0f0; border-radius: 10px;
  padding: 10px 12px; margin-bottom: 8px;
}
.error-card { border-color: #FECACA; background: #FFF7F7; }

.log-meta {
  display: flex; align-items: center; gap: 6px; margin-bottom: 5px; flex-wrap: wrap;
}
.log-time { font-size: 10px; color: #aaa; margin-left: auto; }

.log-badge {
  font-size: 10px; font-weight: 600; padding: 2px 7px;
  border-radius: 20px; background: #f0f0f0; color: #666;
}
.source-badge { background: #FEE2E2; color: #991B1B; }
.entity-badge { background: #EDE9FE; color: #5B21B6; }
.irregular-badge { background: #FEF9C3; color: #854D0E; }
.action-create { background: #DCFCE7; color: #166534; }
.action-delete { background: #FEE2E2; color: #991B1B; }
.action-update { background: #DBEAFE; color: #1E40AF; }

.log-message { font-size: 13px; margin: 0 0 3px; color: #333; }
.log-detail { font-size: 11px; color: #888; margin: 4px 0 0; }
.log-stack {
  font-size: 10px; color: #999; margin: 6px 0 0;
  white-space: pre-wrap; word-break: break-all;
  background: #f9f9f9; border-radius: 6px; padding: 6px 8px;
  max-height: 120px; overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: #d4d4d4 transparent;
}
.log-stack::-webkit-scrollbar       { width: 5px; }
.log-stack::-webkit-scrollbar-track { background: transparent; }
.log-stack::-webkit-scrollbar-thumb { border-radius: 99px; background: #d4d4d4; }
.log-stack::-webkit-scrollbar-thumb:hover { background: #adadad; }

.log-stats {
  display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 3px;
}
.stat { font-size: 11px; color: #888; }
.stat strong { color: #444; }
.stat-error strong { color: #DC2626; }
</style>
