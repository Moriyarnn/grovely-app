<template>
  <DetailSheet
    :open="modelValue"
    theme="neutral"
    size="large"
    title="Notifications"
    subtitle="Email notifications for your household"
    subtitle-style="plain"
    @update:open="v => { if (!v) close() }"
  >
    <div class="nm-body">

          <!-- Env-config nags are irrelevant in the demo (no server to set MAIL_* on),
               so hide the whole warning block there. -->
          <template v-if="emailStatus && !isDemo">
            <div v-if="!emailStatus.smtp" class="nm-email-warning">
              <v-icon size="14" color="#b45309">mdi-alert-circle-outline</v-icon>
              <span>Email delivery is not configured. Set <code>MAIL_HOST</code>, <code>MAIL_USER</code>, and <code>MAIL_PASSWORD</code> in your environment.</span>
            </div>
            <div v-if="!emailStatus.account1 && !emailStatus.account2" class="nm-email-warning">
              <v-icon size="14" color="#b45309">mdi-alert-circle-outline</v-icon>
              <span>No recipient emails are configured. Add <code>ACCOUNT1_EMAIL</code> and <code>ACCOUNT2_EMAIL</code> to your environment. No notifications will be delivered.</span>
            </div>
            <div v-else-if="!emailStatus.account1" class="nm-email-warning">
              <v-icon size="14" color="#b45309">mdi-alert-circle-outline</v-icon>
              <span>Owner 1 email is not set. Add <code>ACCOUNT1_EMAIL</code> to your environment. No notifications will be delivered.</span>
            </div>
            <div v-else-if="!emailStatus.account2" class="nm-email-warning nm-email-warning--soft">
              <v-icon size="14" color="#a16207">mdi-information-outline</v-icon>
              <span>Owner 2 email is not set. Add <code>ACCOUNT2_EMAIL</code> to your environment. Partner notifications are disabled.</span>
            </div>
          </template>

          <div class="nm-sections">

            <!-- DELIVERY -->
            <div class="nm-section">
              <p class="nm-section-label">Delivery</p>
              <div class="nm-list">
                <div class="nm-row">
                  <div class="nm-field-body">
                    <span class="nm-field-label">Send at ({{ serverTimezone }})</span>
                    <span class="nm-field-value">Daily check runs at this time</span>
                  </div>
                  <button
                    class="nm-test-btn"
                    :class="{
                      'nm-test-btn--sending': testSending,
                      'nm-test-btn--sent':    testCountdown > 0 && testResult === 'sent',
                      'nm-test-btn--error':   testCountdown > 0 && testResult === 'error',
                    }"
                    :disabled="testSending || testCountdown > 0"
                    @click="sendTestEmail"
                  >{{ testSending ? '…' : testCountdown > 0 ? testCountdown : 'Test' }}</button>
                  <input
                    type="time"
                    class="nm-time-input"
                    :value="settings.notification_time ?? '08:00'"
                    @change="e => updateSetting('notification_time', (e.target as HTMLInputElement).value)"
                  />
                </div>
              </div>
            </div>

            <!-- APP NOTIFICATIONS -->
            <div class="nm-section">
              <div class="nm-section-head">
                <div class="nm-section-head-left">
                  <p class="nm-section-label">App Notifications</p>
                  <button class="nm-all-on-btn" :class="{ 'nm-all-on-btn--done': allOnFlash, 'nm-all-on-btn--hidden': !!drilledApp }" @click="enableAll">
                    <span v-if="!allOnFlash" class="nm-status-dot" />{{ allOnFlash ? 'All on' : 'Enable all' }}
                  </button>
                </div>
              </div>
              <div class="nm-app-card">

                <div class="nm-app-header">
                  <span class="nm-app-header-title">Notifications</span>
                  <div class="nm-app-header-right">
                    <span class="nm-status-pill" :class="headerCount === 'All paused' ? 'nm-status-pill--paused' : 'nm-status-pill--live'">
                      <span class="nm-status-dot" />{{ headerCount }}
                    </span>
                  </div>
                </div>

                <div class="nm-app-content">
                <Transition :name="`nm-slide-${slideDirection}`" mode="out-in">

                <!-- APP LIST -->
                <div v-if="!drilledApp" key="app-list" class="nm-type-scroll nm-type-scroll--list">
                  <div
                    v-for="app in APP_LIST"
                    :key="app.id"
                    class="nm-type-item"
                  >
                    <div class="nm-dest-row">
                      <v-icon
                        v-if="app.id === 'general'"
                        size="15"
                        class="nm-type-icon nm-type-icon--locked"
                        color="#888"
                      >mdi-cog-outline</v-icon>
                      <v-icon
                        v-else
                        size="15"
                        class="nm-type-icon"
                        :color="appLiveState(app.id) ? '#4ade80' : '#d4d4d4'"
                        @click.stop="toggleAppFromList(app.id)"
                      >{{ appLiveState(app.id) ? 'mdi-check-circle' : 'mdi-close-circle' }}</v-icon>

                      <div
                        class="nm-dest-row-body nm-dest-row-body--clickable"
                        @click="drillInto(app.id)"
                      >
                        <div class="nm-dest-row-line">
                          <v-icon size="8" color="#ccc">mdi-circle</v-icon>
                          <span class="nm-dest-name">{{ app.label }}</span>
                        </div>
                        <span class="nm-dest-detail">{{ app.detail }}</span>
                      </div>

                      <span
                        v-if="app.id !== 'general'"
                        class="nm-status-pill"
                        :class="appLiveState(app.id) ? 'nm-status-pill--live' : 'nm-status-pill--paused'"
                      >
                        <span class="nm-status-dot" />{{ appLiveState(app.id) ? 'On' : 'Paused' }}
                      </span>
                      <span v-else class="nm-status-pill nm-status-pill--spacer" />
                      <v-icon
                        size="14"
                        color="#bbb"
                        class="nm-dest-chev"
                        @click.stop="drillInto(app.id)"
                      >mdi-chevron-right</v-icon>
                    </div>
                  </div>
                </div>

                <!-- DRILL-IN -->
                <div v-else :key="`drill-${drilledApp}`" class="nm-type-scroll nm-type-scroll--drill">
                  <div class="nm-drill-head">
                    <button class="nm-back-chip" @click="drillBack()">
                      <v-icon size="16">mdi-chevron-left</v-icon>
                    </button>
                    <span class="nm-drill-title">{{ drilledAppLabel }}</span>
                  </div>

                  <div class="nm-drill-body">

                  <!-- Period / Pantry types -->
                  <template v-if="drilledApp !== 'general'">
                    <div v-for="t in drilledTypes" :key="t.id" class="nm-type-item">
                      <div class="nm-type-row">
                        <v-icon
                          size="15"
                          class="nm-type-icon"
                          :color="drilledAppLive && isTypeEnabled(t.id) ? '#4ade80' : '#d4d4d4'"
                          @click="toggleType(t.id)"
                        >{{ drilledAppLive && isTypeEnabled(t.id) ? 'mdi-check-circle' : 'mdi-close-circle' }}</v-icon>
                        <div class="nm-type-body">
                          <span class="nm-type-name">{{ t.label }}</span>
                          <span class="nm-type-when">{{ t.when }}</span>
                        </div>
                        <button
                          v-if="editingTypeId !== t.id"
                          class="nm-type-edit-btn"
                          @click="startEditType(t)"
                        >Edit</button>
                      </div>
                      <Transition
                        @before-enter="onPanelBeforeEnter"
                        @enter="onPanelEnter"
                        @leave="onPanelLeave"
                      >
                        <div v-if="editingTypeId === t.id" class="nm-type-edit-panel">
                          <textarea
                            class="nm-type-textarea"
                            v-model="editingTypeValue"
                            :placeholder="t.message"
                            autofocus
                          />
                          <div class="nm-type-edit-footer">
                            <button class="nm-type-cancel-btn" @click="cancelEditType">Cancel</button>
                            <button class="nm-type-save-btn" @click="saveEditType">Save</button>
                          </div>
                        </div>
                      </Transition>
                    </div>
                  </template>

                  <!-- General — email fields + preview -->
                  <template v-else>
                    <div class="nm-general-inner">
                      <div class="nm-fields-scroll">
                      <div v-for="field in EMAIL_FIELDS" :key="field.key" class="nm-type-item">
                        <div class="nm-type-row">
                          <v-icon size="15" color="#e0e0e0">mdi-circle-outline</v-icon>
                          <div class="nm-type-body">
                            <span class="nm-type-name">{{ field.label }}</span>
                            <span class="nm-type-when">{{ field.description }}</span>
                          </div>
                          <button
                            v-if="editingKey !== field.key"
                            class="nm-type-edit-btn"
                            @click="startEdit(field.key)"
                          >Edit</button>
                        </div>
                        <Transition
                          @before-enter="onPanelBeforeEnter"
                          @enter="onPanelEnter"
                          @leave="onPanelLeave"
                        >
                          <div v-if="editingKey === field.key" class="nm-type-edit-panel nm-type-edit-panel--field">
                            <textarea
                              class="nm-type-textarea"
                              v-model="editingValue"
                              :placeholder="field.placeholder"
                              autofocus
                            />
                            <div class="nm-type-edit-footer">
                              <button class="nm-type-cancel-btn" @click="cancelEdit">Cancel</button>
                              <button class="nm-type-save-btn" @click="saveEdit(field.key)">Save</button>
                            </div>
                          </div>
                        </Transition>
                      </div>
                      </div>

                      <div class="nm-email-preview">
                        <p class="nm-preview-label">Preview</p>
                        <div class="nm-preview-card">
                          <p class="nm-preview-from">From: <span>{{ previewSenderName }}</span></p>
                          <p class="nm-preview-line">Hi {{ previewGreeting }},</p>
                          <p class="nm-preview-body">Your period is predicted to start in 3 days. Take care of yourself.</p>
                          <p class="nm-preview-signoff">{{ previewSignoff }}</p>
                        </div>
                      </div>
                    </div>
                  </template>

                  </div><!-- /nm-drill-body -->
                </div>

                </Transition>
                </div><!-- /nm-app-content -->

              </div>
            </div>


          </div><!-- /nm-sections -->
    </div><!-- /nm-body -->
  </DetailSheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import DetailSheet from '../components/ui/DetailSheet.vue'
import { useSettings } from '../composables/useSettings'
import { API, apiFetch } from '../api'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

function close() {
  editingTypeId.value    = null
  editingTypeValue.value = ''
  editingKey.value       = null
  editingValue.value     = ''
  emailStatus.value      = null
  drilledApp.value       = null
  emit('update:modelValue', false)
}

const { settings, fetchSettings, updateSetting } = useSettings()
const serverTimezone = computed(() => settings.value.server_timezone ?? 'UTC')

// ── Per-type settings (loaded from backend) ───────────────────────────────────

const typeSettings = ref<Record<string, { enabled: boolean; custom_message: string | null }>>({})

async function fetchTypeSettings() {
  try {
    const res = await apiFetch(`${API}/premium/notification-types`)
    if (res.ok) typeSettings.value = await res.json()
  } catch { /* non-fatal */ }
}

// Demo flag (build-time constant). In the normal build this is the literal
// false, so the demo-only branches below dead-code eliminate.
const isDemo = __DEMO__
const emailStatus = ref<{ smtp: boolean; account1: boolean; account2: boolean; configured: boolean } | null>(null)

async function fetchEmailStatus() {
  try {
    const res = await apiFetch(`${API}/settings/email-status`)
    if (res.ok) emailStatus.value = await res.json()
  } catch { /* non-fatal */ }
}

watch(() => props.modelValue, (open) => {
  if (open) { fetchSettings(); fetchTypeSettings(); fetchEmailStatus() }
}, { immediate: true })

// ── Toggles ──────────────────────────────────────────────────────────────────

const notificationsLive = computed(() => settings.value.notifications_enabled !== '0')
const periodEnabled     = computed(() => settings.value.period_notifications_enabled !== '0')
const pantryEnabled     = computed(() => settings.value.pantry_notifications_enabled === '1')
const periodLive        = computed(() => notificationsLive.value && periodEnabled.value)
const pantryLive        = computed(() => notificationsLive.value && pantryEnabled.value)

const allOnFlash  = ref(false)
const testSending   = ref(false)
const testCountdown = ref(0)
const testResult    = ref<'sent' | 'error' | null>(null)

async function sendTestEmail() {
  // DEMO GATE: sending a real email needs the server's SMTP config.
  if (__DEMO__) { import('../composables/useDemo').then(m => m.openDemoFeature('test-email')); return }
  if (testSending.value || testCountdown.value > 0) return
  testSending.value = true
  try {
    const res = await apiFetch(`${API}/premium/test-email`, { method: 'POST' })
    testResult.value = res.ok ? 'sent' : 'error'
  } catch {
    testResult.value = 'error'
  }
  testSending.value   = false
  testCountdown.value = 10
  const timer = setInterval(() => {
    testCountdown.value--
    if (testCountdown.value <= 0) {
      clearInterval(timer)
      testResult.value = null
    }
  }, 1000)
}

// ── Per-type toggle state ─────────────────────────────────────────────────────

function isTypeEnabled(id: string): boolean {
  const row = typeSettings.value[id]
  return row ? row.enabled : true
}

async function toggleType(id: string) {
  const next = !isTypeEnabled(id)
  typeSettings.value = {
    ...typeSettings.value,
    [id]: { ...typeSettings.value[id], enabled: next, custom_message: typeSettings.value[id]?.custom_message ?? null }
  }
  await apiFetch(`${API}/premium/notification-types/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: next })
  })
}


async function enableAll() {
  updateSetting('notifications_enabled', '1')
  updateSetting('period_notifications_enabled', '1')
  updateSetting('pantry_notifications_enabled', '1')
  await apiFetch(`${API}/premium/notification-types/reset-all`, { method: 'PATCH' })
  await fetchTypeSettings()
  allOnFlash.value = true
  setTimeout(() => { allOnFlash.value = false }, 2000)
}

function togglePeriod() {
  updateSetting('period_notifications_enabled', periodEnabled.value ? '0' : '1')
}
function togglePantry() {
  updateSetting('pantry_notifications_enabled', pantryEnabled.value ? '0' : '1')
}

// ── Notification type lists ──────────────────────────────────────────────────

const PERIOD_TYPES = [
  { id: 'period_due_3d',           label: 'Period due in 3 days',       when: '3 days before predicted start',       message: "Just a heads up, your period is predicted to start in 3 days. Take care of yourself." },
  { id: 'period_due_2d',           label: 'Period due in 2 days',       when: '2 days before predicted start',       message: "Your period is predicted to start in 2 days. Make sure you're stocked up." },
  { id: 'period_due_1d',           label: 'Period due tomorrow',        when: '1 day before predicted start',        message: "Your period is predicted to start tomorrow. You've got this." },
  { id: 'pms_window',              label: 'PMS window starting',        when: '5 days before predicted start',       message: "Your PMS window is starting. Be gentle with yourself this week." },
  { id: 'period_overdue_3d',       label: 'Period 3 days late',         when: 'When period is 3 days overdue',       message: "Your period is now 3 days late. If you haven't already, it may be worth noting." },
  { id: 'irregular_cycle',         label: 'Irregular cycles',           when: 'Weekly while cycles are irregular',   message: "Your recent cycles have been irregular. No action needed, just keeping you in the loop." },
  { id: 'fertile_window_tomorrow', label: 'Fertile window tomorrow',    when: 'Day before fertile window opens',     message: "Your fertile window opens tomorrow." },
  { id: 'fertile_window_start',    label: 'Fertile window starts',      when: 'When fertile window opens',           message: "Your fertile window has started today." },
  { id: 'ovulation_today',         label: 'Ovulation day',              when: 'On predicted ovulation date',         message: "Today is your predicted ovulation day." },
  { id: 'fertile_window_ending',   label: 'Last day of fertile window', when: 'On the last day of fertile window',   message: "Today is the last day of your fertile window." },
  { id: 'period_ended',            label: 'Period ended',               when: 'Within 3 days after period ends',     message: "Your period has ended. Hope you're feeling better." },
  { id: 'cycle_summary',           label: 'Cycle summary',              when: 'When a new period is logged',         message: "Your cycle summary is ready. Your last cycle was {duration} days." },
  { id: 'partner_period_starting', label: 'Partner: period starting',   when: '3 days before (sent to partner)',    message: "Just a heads up, her period is expected to start in 3 days." },
  { id: 'partner_fertile_window',  label: 'Partner: fertile window',    when: 'When window opens (sent to partner)', message: "Her fertile window has started today." },
  { id: 'partner_period_ended',    label: 'Partner: period ended',      when: 'After period ends - sent to partner', message: "Her period has ended." },
]

const PANTRY_TYPES = [
  { id: 'pantry_expiry_today', label: 'Expiring today', when: 'Items with today\'s expiry date',      message: "Some items in your pantry are expiring today: {items}." },
  { id: 'pantry_expiry_soon',  label: 'Expiring soon',  when: 'Items within your warning window',     message: "Some items in your pantry are expiring soon: {items}." },
  { id: 'pantry_expired',      label: 'Already expired', when: 'When a new item passes its expiry date', message: "Some items in your pantry have already expired: {items}." },
]

// ── App list + drill-in ─────────────────────────────────────────────────────

const APP_LIST = [
  { id: 'general', label: 'General',        color: '#888', detail: 'Greeting, sign-off, sender name' },
  { id: 'period',  label: 'Period Tracker',  color: '#D4537E', detail: '15 notification types' },
  { id: 'pantry',  label: 'Pantry',          color: '#f59e0b', detail: '3 notification types' },
]

const slideDirection = ref<'left' | 'right'>('left')
const drilledApp     = ref<string | null>(null)

function appLiveState(id: string): boolean {
  if (id === 'period') return periodLive.value
  if (id === 'pantry') return pantryLive.value
  return false
}

function toggleAppFromList(id: string) {
  if (id === 'period') togglePeriod()
  else if (id === 'pantry') togglePantry()
}

function drillInto(id: string) {
  slideDirection.value = 'left'
  drilledApp.value     = id
  editingTypeId.value  = null
  editingKey.value     = null
}

function drillBack() {
  slideDirection.value = 'right'
  drilledApp.value     = null
}

const drilledAppLabel = computed(() => {
  const a = APP_LIST.find(x => x.id === drilledApp.value)
  return a?.label ?? ''
})

const drilledAppLive = computed(() => {
  if (drilledApp.value === 'period') return periodLive.value
  if (drilledApp.value === 'pantry') return pantryLive.value
  return false
})

const drilledAppEnabled = computed(() => {
  if (drilledApp.value === 'period') return periodEnabled.value
  if (drilledApp.value === 'pantry') return pantryEnabled.value
  return false
})

function toggleDrilledApp() {
  if (drilledApp.value === 'period') togglePeriod()
  else if (drilledApp.value === 'pantry') togglePantry()
}

const drilledTypes = computed(() => {
  if (drilledApp.value === 'period') return PERIOD_TYPES
  if (drilledApp.value === 'pantry') return PANTRY_TYPES
  return []
})

const headerCount = computed(() => {
  if (drilledApp.value === 'period') return `${PERIOD_TYPES.length} types`
  if (drilledApp.value === 'pantry') return `${PANTRY_TYPES.length} types`
  if (drilledApp.value === 'general') return `${EMAIL_FIELDS.length} fields`
  const active = [periodLive, pantryLive].filter(v => v.value).length
  return active === 0 ? 'All paused' : `${active} of 2 active`
})

// ── Type edit panel animation ────────────────────────────────────────────────

function onPanelBeforeEnter(el: Element) {
  const h = el as HTMLElement
  h.style.height = '0'
  h.style.paddingBottom = '0'
}
function onPanelEnter(el: Element, done: () => void) {
  const h = el as HTMLElement
  h.style.height = 'auto'
  h.style.paddingBottom = ''
  const targetH = h.scrollHeight
  const targetPb = getComputedStyle(h).paddingBottom
  h.style.height = '0'
  h.style.paddingBottom = '0'
  void h.offsetHeight
  // Measure at full height without triggering a visible paint
  h.style.transition = 'none'
  h.style.height = targetH + 'px'
  h.style.paddingBottom = targetPb
  void h.offsetHeight // commit layout

  const scroll = (el.closest('.nm-fields-scroll') ?? el.closest('.nm-drill-body') ?? el.closest('.nm-type-scroll--list')) as HTMLElement | null
  const item   = el.parentElement as HTMLElement | null

  // Reset and animate — all synchronous so the browser paints once at the end
  h.style.height = '0'
  h.style.paddingBottom = '0'
  void h.offsetHeight
  h.style.transition = ''
  h.style.height = targetH + 'px'
  h.style.paddingBottom = targetPb

  // Keep the expanding item's bottom in view by reading live layout every
  // frame, so the scroll advances in exact lock-step with the height
  // transition. A one-shot smooth scrollBy runs on its own browser-defined
  // duration/easing (different on desktop vs mobile) and desyncs from the
  // CSS transition; tracking real layout per frame is consistent everywhere.
  let tracking = scroll != null && item != null
  if (tracking) {
    const track = () => {
      if (!tracking) return
      const overflow = item!.getBoundingClientRect().bottom - scroll!.getBoundingClientRect().bottom
      if (overflow > 0) scroll!.scrollTop += overflow
      requestAnimationFrame(track)
    }
    requestAnimationFrame(track)
  }

  el.addEventListener('transitionend', (e) => {
    if ((e as TransitionEvent).propertyName === 'height') {
      tracking = false
      done()
    }
  })
}
function onPanelLeave(el: Element, done: () => void) {
  const h = el as HTMLElement
  h.style.height = h.scrollHeight + 'px'
  h.style.paddingBottom = getComputedStyle(h).paddingBottom
  requestAnimationFrame(() => {
    h.style.height = '0'
    h.style.paddingBottom = '0'
    el.addEventListener('transitionend', (e) => {
      if ((e as TransitionEvent).propertyName === 'height') done()
    })
  })
}

// ── Per-type message editing ─────────────────────────────────────────────────

const editingTypeId    = ref<string | null>(null)
const editingTypeValue = ref('')

function startEditType(t: { id: string; message: string }) {
  if (editingTypeId.value === t.id) { editingTypeId.value = null; return }
  editingTypeId.value    = t.id
  editingTypeValue.value = typeSettings.value[t.id]?.custom_message ?? ''
}
async function saveEditType() {
  // DEMO GATE: saving a customised message needs a server to persist it.
  if (__DEMO__) { import('../composables/useDemo').then(m => m.openDemoFeature('notification-edit')); editingTypeId.value = null; return }
  const id  = editingTypeId.value!
  const msg = editingTypeValue.value.trim() || null
  typeSettings.value = {
    ...typeSettings.value,
    [id]: { ...typeSettings.value[id], enabled: isTypeEnabled(id), custom_message: msg }
  }
  await apiFetch(`${API}/premium/notification-types/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ custom_message: msg })
  })
  editingTypeId.value = null
}
function cancelEditType() { editingTypeId.value = null }

// ── Email preview ────────────────────────────────────────────────────────────

const previewGreeting    = computed(() => settings.value.notification_greeting    || 'love')
const previewSignoff     = computed(() => settings.value.notification_signoff     || 'Sent with love by your household app 💕')
const previewSenderName  = computed(() => settings.value.notification_sender_name || 'Grovely 💌')

// ── Email field editing ──────────────────────────────────────────────────────

const EMAIL_FIELDS = [
  { key: 'notification_greeting',    label: 'Greeting',     description: 'Name used to open each email',          placeholder: 'love' },
  { key: 'notification_signoff',     label: 'Sign-off',     description: 'Closing line at the bottom of emails',  placeholder: 'Sent with love by your household app 💕' },
  { key: 'notification_sender_name', label: 'Sender name',  description: 'Name shown in the From field',          placeholder: 'Grovely 💌' },
]

const editingKey   = ref<string | null>(null)
const editingValue = ref('')

function currentValue(key: string, placeholder: string): string {
  return settings.value[key] || placeholder
}
function startEdit(key: string) {
  if (editingKey.value === key) { editingKey.value = null; return }
  editingKey.value = key
  editingValue.value = settings.value[key] ?? ''
}
function saveEdit(key: string) {
  // DEMO GATE: saving an edited notification field needs a server to persist it.
  if (__DEMO__) { import('../composables/useDemo').then(m => m.openDemoFeature('notification-edit')); editingKey.value = null; return }
  updateSetting(key, editingValue.value)
  editingKey.value = null
}
function cancelEdit() {
  editingKey.value = null
}
</script>

<style scoped>
/* Shell, handle, header and subtitle are all provided by DetailSheet
   (subtitle-style="plain" for the descriptive line). */

/* ── Email warning ───────────────────────────────────────────────────────── */
.nm-email-warning {
  display: flex; align-items: flex-start; gap: 8px;
  margin: 0; padding: 10px 14px;
  background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;
  font-size: 11px; color: #92400e; line-height: 1.5;
  flex-shrink: 0;
}
.nm-email-warning--soft {
  background: #fefce8; border-color: #fef08a; color: #a16207;
}
.nm-email-warning code {
  background: #fef3c7; border-radius: 3px; padding: 0 3px;
  font-size: 10px; font-family: monospace;
}

/* ── Body (DetailSheet provides outer padding; no own scroll) ────────────── */
.nm-body {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; gap: 16px;
}
.nm-sections { display: flex; flex-direction: column; gap: 16px; }

/* ── Section ─────────────────────────────────────────────────────────────── */
.nm-section { display: flex; flex-direction: column; gap: 8px; }
.nm-section-head { display: flex; align-items: center; gap: 8px; }
.nm-section-label {
  font-size: 10px; font-weight: 700; color: #bbb;
  letter-spacing: 0.07em; text-transform: uppercase; margin: 0;
}

/* ── Status pill ─────────────────────────────────────────────────────────── */
.nm-status-pill {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  border-radius: 99px; padding: 2px 8px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
  min-width: 66px;
}
.nm-status-pill--live   { background: #DCFCE7; color: #15803D; }
.nm-status-pill--paused { background: #F5F5F5; color: #aaa; }
.nm-status-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: currentColor; flex-shrink: 0;
}

/* ── List card ───────────────────────────────────────────────────────────── */
.nm-list { border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; }

.nm-row {
  padding: 12px 14px;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #f0f0f0; gap: 12px;
}
.nm-row:last-child { border-bottom: none; }
.nm-row--stub { opacity: 0.5; }
.nm-row--editing { flex-direction: column; align-items: stretch; gap: 8px; }
.nm-row--expand { background: #fafafa; }
.nm-row--expand:hover { background: #f5f5f5; }

/* ── Fields ──────────────────────────────────────────────────────────────── */
.nm-field-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.nm-field-label { font-size: 13px; color: #333; }
.nm-field-value { font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── All-on button ───────────────────────────────────────────────────────── */
.nm-all-on-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  border-radius: 99px; padding: 2px 8px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
  border: none; cursor: pointer; transition: background 0.2s, color 0.2s;
  background: #FBEAF0; color: #993556;
  min-width: 68px;
}
.nm-all-on-btn .nm-status-dot { background: #993556; flex-shrink: 0; }
.nm-all-on-btn:hover { background: #f7dae6; }
.nm-all-on-btn--done { background: #DCFCE7; color: #15803D; }
.nm-all-on-btn--done:hover { background: #DCFCE7; color: #15803D; }
.nm-all-on-btn--hidden { visibility: hidden; pointer-events: none; }

/* ── Toggle ──────────────────────────────────────────────────────────────── */
.nm-toggle {
  width: 40px; height: 22px; border-radius: 11px;
  background: #e0e0e0; position: relative;
  transition: background 0.2s; flex-shrink: 0;
}
.nm-toggle.on { background: #D4537E; }
.nm-knob {
  position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.nm-toggle.on .nm-knob { transform: translateX(18px); }

/* ── Time input ──────────────────────────────────────────────────────────── */
.nm-time-input {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  text-align: right; padding: 2px 0; outline: none; width: 90px;
}

/* ── App card ────────────────────────────────────────────────────────────── */
.nm-app-card {
  border: 1px solid #f0f0f0; border-radius: 12px; overflow: visible;
}
.nm-app-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px; gap: 12px; background: #fff;
  border-radius: 12px 12px 0 0;
}
.nm-app-header-right { display: flex; align-items: center; gap: 10px; }

/* ── App header title ───────────────────────────────────────────────────── */
.nm-app-header-title {
  font-size: 13px; font-weight: 600; color: #333; padding: 6px 0;
}

/* ── Dest row (app list entries) ────────────────────────────────────────── */
.nm-dest-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px;
}
.nm-dest-row-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.nm-dest-row-body--clickable { cursor: pointer; }
.nm-dest-row-line { display: flex; align-items: center; gap: 6px; }
.nm-dest-name { font-size: 12px; color: #444; font-weight: 500; }
.nm-dest-detail { font-size: 11px; color: #bbb; }
.nm-dest-chev { cursor: pointer; flex-shrink: 0; }

/* ── Section head left ──────────────────────────────────────────────────── */
.nm-section-head-left { display: flex; align-items: center; gap: 8px; flex: 1; }

/* ── Status pill spacer ─────────────────────────────────────────────────── */
.nm-status-pill--spacer { visibility: hidden; }

/* ── Locked icon ────────────────────────────────────────────────────────── */
.nm-type-icon--locked { cursor: default !important; }
.nm-type-icon--locked:hover { opacity: 1 !important; }

/* ── Type scroll modes ──────────────────────────────────────────────────── */
.nm-type-scroll--list { overflow-y: auto; }
.nm-type-scroll--drill { overflow-y: hidden; display: flex; flex-direction: column; }

/* ── Drill-in header ────────────────────────────────────────────────────── */
.nm-drill-head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; flex-shrink: 0;
  border-bottom: 1px solid #f0f0f0; background: #fafafa;
}
.nm-back-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 99px;
  background: #fff; border: 1px solid #e0e0e0;
  cursor: pointer; flex-shrink: 0; transition: background 0.15s;
}
.nm-back-chip:hover { background: #FBEAF0; }
.nm-drill-title { font-size: 13px; font-weight: 600; color: #333; flex: 1; min-width: 0; }
.nm-drill-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* ── Drill body ─────────────────────────────────────────────────────────── */
.nm-drill-body { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }

/* ── General inner ──────────────────────────────────────────────────────── */
.nm-general-inner { display: flex; flex-direction: column; flex: 1; min-height: 0; }

/* ── Type list ───────────────────────────────────────────────────────────── */
.nm-type-scroll {
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
  border-radius: 0 0 12px 12px;
  height: 380px; overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: #e0e0e0 transparent;
  display: flex; flex-direction: column;
  overscroll-behavior: none;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
.nm-type-scroll::-webkit-scrollbar { width: 4px; }
.nm-type-scroll::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 99px; }

.nm-type-item {
  border-bottom: 1px solid #f0f0f0;
}
.nm-type-item:last-child { border-bottom: none; }

.nm-type-row {
  padding: 9px 14px;
  display: flex; align-items: center; gap: 10px;
}
.nm-type-row--field { align-items: center; }
.nm-type-icon { cursor: pointer; flex-shrink: 0; transition: opacity 0.15s; }
.nm-type-icon:hover { opacity: 0.7; }
.nm-type-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.nm-type-name { font-size: 12px; color: #444; }
.nm-type-when { font-size: 11px; color: #bbb; }

/* ── Type edit panel ─────────────────────────────────────────────────────── */
.nm-type-edit-panel {
  padding: 0 14px 12px 39px;
}
.nm-type-edit-panel--field {
  padding-left: 14px;
  border-bottom: 1px solid #f0f0f0;
  display: flex; flex-direction: column; gap: 8px;
  background: #fafafa;
}

.nm-type-textarea {
  width: 100%; box-sizing: border-box;
  border: 1px solid #e0e0e0; border-radius: 8px;
  padding: 8px 10px; font-size: 12px; color: #333;
  outline: none; resize: none; height: 72px;
  font-family: inherit; line-height: 1.6; background: #fff;
  transition: border-color 0.15s;
}
.nm-type-textarea:focus { border-color: #bbb; }
.nm-type-textarea::placeholder { color: #ccc; }

.nm-type-edit-footer {
  display: flex; justify-content: flex-end; gap: 6px;
}

.nm-type-cancel-btn {
  padding: 4px 12px; border-radius: 99px;
  font-size: 11px; font-weight: 600; color: #aaa;
  background: #fff; border: 1px solid #e0e0e0;
  cursor: pointer; transition: background 0.15s;
}
.nm-type-cancel-btn:hover { background: #f5f5f5; color: #777; }

.nm-type-save-btn {
  padding: 4px 14px; border-radius: 99px;
  font-size: 11px; font-weight: 600; color: #fff;
  background: #666; border: none;
  cursor: pointer; transition: background 0.15s;
}
.nm-type-save-btn:hover { background: #444; }

/* ── Type edit transition ─────────────────────────────────────────────────── */
.nm-type-edit-panel {
  transition: height 0.25s ease, padding-bottom 0.25s ease;
  overflow: hidden;
}


.nm-test-btn {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 99px; padding: 2px 0;
  width: 38px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
  background: #fff; color: #888; border: 1px solid #e0e0e0;
  cursor: pointer; flex-shrink: 0; transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.nm-test-btn:not(:disabled):hover { background: #f5f5f5; color: #555; }
.nm-test-btn--sending { opacity: 0.6; cursor: default; }
.nm-test-btn--sent    { background: #DCFCE7; color: #15803D; border-color: #bbf7d0; }
.nm-test-btn--error   { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }

.nm-type-edit-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 3px;
  border-radius: 99px; padding: 2px 10px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
  background: #fff; color: #888; border: 1px solid #e0e0e0;
  cursor: pointer; flex-shrink: 0; transition: background 0.15s, color 0.15s;
}
.nm-type-edit-btn:hover { background: #f5f5f5; color: #555; }

.nm-fields-scroll {
  flex: 1; min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: #e0e0e0 transparent;
}
.nm-fields-scroll::-webkit-scrollbar { width: 4px; }
.nm-fields-scroll::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 99px; }

/* ── Email preview ───────────────────────────────────────────────────────── */
.nm-email-preview {
  flex-shrink: 0;
  padding: 12px 14px 14px;
  display: flex; flex-direction: column; gap: 8px;
  border-top: 1px solid #f0f0f0;
}

.nm-preview-label {
  font-size: 10px; font-weight: 700; color: #ccc;
  letter-spacing: 0.07em; text-transform: uppercase; margin: 0;
}

.nm-preview-card {
  border: 1px solid #efefef; border-radius: 10px;
  padding: 12px 14px; background: #fff;
  display: flex; flex-direction: column; gap: 6px;
  overflow: hidden; min-width: 0;
}

.nm-preview-from {
  font-size: 10px; color: #bbb; margin: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.nm-preview-from span { color: #888; font-weight: 600; }

.nm-preview-line {
  font-size: 12px; color: #555; margin: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.nm-preview-body {
  font-size: 12px; color: #888; margin: 0; line-height: 1.5;
  border-left: 2px solid #f0f0f0; padding-left: 8px;
}

.nm-preview-signoff {
  font-size: 11px; color: #bbb; margin: 0; padding-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ── Coming soon chip ────────────────────────────────────────────────────── */
.nm-soon {
  background: #f5f5f5; color: #bbb;
  border: 1px solid #ececec; border-radius: 5px;
  padding: 2px 8px; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0;
}

/* ── App content wrapper ─────────────────────────────────────────────────── */
.nm-app-content { overflow: hidden; }

/* ── App slide transition ────────────────────────────────────────────────── */
.nm-slide-left-enter-active,
.nm-slide-left-leave-active,
.nm-slide-right-enter-active,
.nm-slide-right-leave-active {
  transition: transform 0.22s ease, opacity 0.18s ease;
}
.nm-slide-left-enter-from  { transform: translateX(32px); opacity: 0; }
.nm-slide-left-leave-to    { transform: translateX(-32px); opacity: 0; }
.nm-slide-right-enter-from { transform: translateX(-32px); opacity: 0; }
.nm-slide-right-leave-to   { transform: translateX(32px); opacity: 0; }

</style>
