<template>
  <div class="sv-root">

    <div class="sv-brand">
      <div class="sv-brand-icon">
        <v-icon size="22" color="#993556">mdi-cog-outline</v-icon>
      </div>
      <div class="sv-brand-body">
        <h1 class="sv-brand-title">Settings</h1>
        <p class="sv-brand-sub">Customize your experience</p>
      </div>
      <button class="sv-back-chip" @click="router.back()">
        <v-icon size="14" color="#993556">mdi-chevron-left</v-icon>
        Hub
      </button>
    </div>

    <div class="sv-divider" />

    <!-- GENERAL -->
    <div class="sv-section">
      <p class="sv-section-label">General</p>

      <div class="sv-subgroup">
        <p class="sv-sub-label">App Grid</p>
        <div class="sv-list">
          <div class="sv-row" @click="toggleReorder" style="cursor:pointer">
            <div class="sv-label-group">
              <span class="sv-label">App reordering</span>
              <span class="sv-sublabel">Hold any card to drag and rearrange</span>
            </div>
            <div class="sv-toggle" :class="{ on: preferences.app_reorder_enabled === '1' }">
              <div class="sv-knob" />
            </div>
          </div>
        </div>
      </div>

      <div class="sv-subgroup">
        <p class="sv-sub-label">Appearance</p>
        <div class="sv-list">
          <div class="sv-row sv-row--stub">
            <span class="sv-label">Language / locale</span>
            <span class="sv-soon">Coming soon</span>
          </div>
          <div class="sv-row sv-row--stub">
            <span class="sv-label">Dark mode</span>
            <span class="sv-soon">Coming soon</span>
          </div>
          <div class="sv-row sv-row--stub">
            <span class="sv-label">Themes</span>
            <span class="sv-soon">Coming soon</span>
          </div>
        </div>
      </div>

      <div class="sv-subgroup">
        <p class="sv-sub-label">Notifications</p>
        <div class="sv-list">
          <div class="sv-row">
            <span class="sv-label">Time of day</span>
            <input
              type="time"
              class="sv-time-input"
              :value="settings.notification_time ?? '08:00'"
              @change="e => saveSetting('notification_time', (e.target as HTMLInputElement).value)"
            />
          </div>
          <div class="sv-row sv-row--link" @click="notifMessagesOpen = true" style="cursor:pointer">
            <span class="sv-label">Notification messages</span>
            <v-icon size="16" color="#bbb">mdi-chevron-right</v-icon>
          </div>
        </div>
      </div>
    </div>

    <div class="sv-divider" />

    <!-- YOUR APPS -->
    <div class="sv-section">
      <p class="sv-section-label">Your Apps</p>

      <div class="sv-subgroup">
        <p class="sv-sub-label">Period Tracker</p>
        <div class="sv-list">

          <div class="sv-row" @click="togglePeriodNotifications" style="cursor:pointer">
            <span class="sv-label">Notifications</span>
            <div class="sv-toggle" :class="{ on: settings.period_notifications_enabled !== '0' }">
              <div class="sv-knob" />
            </div>
          </div>

          <div class="sv-row sv-row--col">
            <span class="sv-label">Flow color</span>
            <div class="sv-flow-color">
              <div class="sv-flow-swatches">
                <div v-for="s in flowSwatches" :key="s.label" class="sv-swatch-item">
                  <div class="sv-swatch-dot" :style="{ background: s.bg }" />
                  <span class="sv-swatch-label">{{ s.label }}</span>
                </div>
              </div>
              <div class="sv-hue-wrap">
                <div class="sv-hue-gradient" />
                <input type="range" class="sv-hue-slider" min="290" max="380" v-model.number="flowHue" />
              </div>
            </div>
          </div>

          <div class="sv-row" @click="toggleFertileWindow" style="cursor:pointer">
            <span class="sv-label">Show fertile window on calendar</span>
            <div class="sv-toggle" :class="{ on: preferences.period_show_fertile_window !== '0' }">
              <div class="sv-knob" />
            </div>
          </div>

<div v-if="isOwner" class="sv-row" @click="toggleIrregular" style="cursor:pointer">
            <div class="sv-label-group">
              <span class="sv-label">Irregular cycles</span>
              <span class="sv-sublabel">Widens predictions, suppresses overdue alerts</span>
            </div>
            <div class="sv-toggle" :class="{ on: preferences.period_irregular === '1' }">
              <div class="sv-knob" />
            </div>
          </div>

          <div v-if="isOwner" class="sv-row">
            <div class="sv-label-group">
              <span class="sv-label">Cycle length seed</span>
              <span class="sv-sublabel">Optional - used until 4+ cycles are logged</span>
            </div>
            <input
              type="number"
              class="sv-number-input"
              min="15"
              max="60"
              placeholder="—"
              :value="preferences.period_cycle_seed ?? ''"
              @change="e => updatePreference('period_cycle_seed', (e.target as HTMLInputElement).value)"
            />
          </div>

          <div v-if="isOwner" class="sv-row" @click="togglePartnerNotes" style="cursor:pointer">
            <span class="sv-label">Partner can read notes</span>
            <div class="sv-toggle" :class="{ on: settings.partner_can_read_notes === '1' }">
              <div class="sv-knob" />
            </div>
          </div>

        </div>
      </div>

      <div class="sv-subgroup">
        <p class="sv-sub-label">Pantry</p>
        <div class="sv-list">

          <div class="sv-row" @click="togglePantryNotifications" style="cursor:pointer">
            <span class="sv-label">Notifications</span>
            <div class="sv-toggle" :class="{ on: settings.pantry_notifications_enabled === '1' }">
              <div class="sv-knob" />
            </div>
          </div>

          <div class="sv-row">
            <div class="sv-label-group">
              <span class="sv-label">Expiry warning</span>
              <span class="sv-sublabel">Days before expiry to flag as expiring soon</span>
            </div>
            <div class="sv-segmented">
              <button
                v-for="d in [3, 5, 7]"
                :key="d"
                class="sv-seg-btn"
                :class="{ active: parseInt(settings.pantry_expiry_warning_days ?? '3') === d }"
                @click="saveSetting('pantry_expiry_warning_days', String(d))"
              >{{ d }}</button>
              <button
                class="sv-seg-btn"
                :class="{ active: isCustomExpiry }"
                @click="selectCustomExpiry"
              >Custom</button>
            </div>
          </div>

          <div v-if="isCustomExpiry" class="sv-row">
            <span class="sv-label">Custom days</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <input
                type="number"
                min="1"
                max="60"
                class="sv-number-input"
                :value="settings.pantry_expiry_warning_days"
                @change="e => saveSetting('pantry_expiry_warning_days', String(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1)))"
              />
              <span style="font-size:12px;color:#aaa;">days</span>
            </div>
          </div>

          <div class="sv-row" @click="toggleHideEmptyCategories" style="cursor:pointer">
            <span class="sv-label">Hide empty categories</span>
            <div class="sv-toggle" :class="{ on: preferences.pantry_hide_empty_categories === '1' }">
              <div class="sv-knob" />
            </div>
          </div>

          <div class="sv-row">
            <span class="sv-label">Currency</span>
            <select
              class="sv-select"
              :value="settings.pantry_currency ?? 'USD'"
              @change="e => saveSetting('pantry_currency', (e.target as HTMLInputElement).value)"
            >
              <option v-for="c in CURRENCIES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </div>

          <template v-if="(settings.pantry_currency ?? 'USD') === 'OTHER'">
            <div class="sv-row">
              <div class="sv-label-group">
                <span class="sv-label">Custom currency symbol</span>
                <span class="sv-sublabel">e.g. Kč, zł, kr</span>
              </div>
              <input
                class="sv-symbol-input"
                maxlength="4"
                placeholder="$"
                :value="settings.pantry_currency_custom_symbol ?? ''"
                @change="e => saveSetting('pantry_currency_custom_symbol', (e.target as HTMLInputElement).value)"
              />
            </div>
            <div class="sv-row">
              <div class="sv-label-group">
                <span class="sv-label">Custom currency name</span>
                <span class="sv-sublabel">e.g. Czech Koruna, Polish Złoty</span>
              </div>
              <input
                class="sv-symbol-input sv-symbol-input--wide"
                maxlength="32"
                placeholder="Currency"
                :value="settings.pantry_currency_custom_label ?? ''"
                @change="e => saveSetting('pantry_currency_custom_label', (e.target as HTMLInputElement).value)"
              />
            </div>
          </template>

        </div>
      </div>

      <div class="sv-subgroup">
        <p class="sv-sub-label">Other Apps</p>
        <div class="sv-list">
          <div class="sv-row sv-row--stub">
            <span class="sv-label">Recipes</span>
            <span class="sv-soon">Coming soon</span>
          </div>
          <div class="sv-row sv-row--stub">
            <span class="sv-label">Sleep Tracker</span>
            <span class="sv-soon">Coming soon</span>
          </div>
          <div class="sv-row sv-row--stub">
            <span class="sv-label">Exercise</span>
            <span class="sv-soon">Coming soon</span>
          </div>
        </div>
      </div>

    </div>

    <div class="sv-divider" />

    <!-- DATA & BACKUPS -->
    <div class="sv-section">
      <p class="sv-section-label">Data &amp; Backups</p>

      <div class="sv-subgroup">
        <p class="sv-sub-label">Manual</p>
        <div class="sv-list">

          <div class="sv-row sv-row--action" @click="onExport" style="cursor:pointer">
            <div class="sv-label-group">
              <span class="sv-label">Back up now</span>
              <span class="sv-sublabel">Download a full JSON snapshot of all your data</span>
            </div>
            <v-icon size="18" color="#bbb">mdi-download-outline</v-icon>
          </div>

          <div class="sv-row sv-row--action" @click="triggerRestore" style="cursor:pointer">
            <div class="sv-label-group">
              <span class="sv-label">Restore from backup</span>
              <span class="sv-sublabel">Your current data is saved automatically before restoring</span>
            </div>
            <v-icon size="18" color="#bbb">mdi-upload-outline</v-icon>
          </div>
          <input ref="restoreInput" type="file" accept=".json,application/json" style="display:none" @change="onRestoreFile" />

        </div>
      </div>

      <div class="sv-subgroup">
        <p class="sv-sub-label">Automatic</p>
        <div class="sv-list">
          <!-- PREMIUM GATE (frontend) -->
          <div class="sv-row sv-row--stub">
            <div class="sv-label-group">
              <span class="sv-label">Scheduled backups</span>
              <span class="sv-sublabel">Daily, weekly, or monthly — runs automatically</span>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <ComingSoonBadge theme="neutral" />
              <PremiumBadge theme="neutral" />
            </div>
          </div>
        </div>
      </div>

    </div>

    <NotificationMessagesModal v-model="notifMessagesOpen" />

    <!-- Backup result snackbar -->
    <div v-if="backupMsg" class="sv-snackbar" :class="backupMsgError ? 'sv-snackbar--error' : 'sv-snackbar--ok'">
      {{ backupMsg }}
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getUser, exportBackup, restoreBackup } from '../api'
import { useSettings } from '../composables/useSettings'
import { usePreferences } from '../composables/usePreferences'
import NotificationMessagesModal from './NotificationMessagesView.vue'
import { CURRENCIES } from '../constants/currencies'
import ComingSoonBadge from '../components/ui/ComingSoonBadge.vue'
import PremiumBadge from '../components/ui/PremiumBadge.vue'

const router = useRouter()
const isOwner = getUser()?.role === 'owner'
const { settings, fetchSettings, updateSetting } = useSettings()

async function saveSetting(key: string, value: string) {
  const err = await updateSetting(key, value)
  if (err) showMsg(err, true)
}
const { preferences, fetchPreferences, updatePreference } = usePreferences()
const notifMessagesOpen = ref(false)
const restoreInput = ref<HTMLInputElement | null>(null)
const backupMsg = ref('')
const backupMsgError = ref(false)

function showMsg(msg: string, isError = false) {
  backupMsg.value = msg
  backupMsgError.value = isError
  setTimeout(() => { backupMsg.value = '' }, 4000)
}

async function onExport() {
  try {
    await exportBackup()
    showMsg('Backup downloaded.')
  } catch {
    showMsg('Export failed — check your connection.', true)
  }
}

function triggerRestore() {
  restoreInput.value?.click()
}

async function onRestoreFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  ;(e.target as HTMLInputElement).value = ''
  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const result = await restoreBackup(parsed)
    const warn = result.warnings?.length ? ` (${result.warnings[0]})` : ''
    showMsg(`Restore complete.${warn}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Restore failed.'
    showMsg(msg, true)
  }
}

onMounted(async () => {
  await fetchSettings()
  await fetchPreferences()
})



const FLOW_LEVELS = [
  { value: 'Spotting', short: 'S' },
  { value: 'Light',    short: 'L' },
  { value: 'Medium',   short: 'M' },
  { value: 'Heavy',    short: 'H' },
]

const flowHue = computed({
  get: () => parseInt(preferences.value.flow_hue ?? '340', 10),
  set: (v) => {
    document.documentElement.style.setProperty('--flow-hue', String(v))
    updatePreference('flow_hue', String(v))
  }
})

const flowSwatches = computed(() => [
  { label: 'Spotting', bg: `hsl(${flowHue.value}, 50%, 80%)` },
  { label: 'Light',    bg: `hsl(${flowHue.value}, 55%, 74%)` },
  { label: 'Medium',   bg: `hsl(${flowHue.value}, 65%, 58%)` },
  { label: 'Heavy',    bg: `hsl(${flowHue.value}, 80%, 42%)` },
])

function toggleReorder() {
  updatePreference('app_reorder_enabled', preferences.value.app_reorder_enabled === '1' ? '0' : '1')
}
function togglePeriodNotifications() {
  saveSetting('period_notifications_enabled', settings.value.period_notifications_enabled !== '0' ? '0' : '1')
}
function toggleFertileWindow() {
  updatePreference('period_show_fertile_window', preferences.value.period_show_fertile_window !== '0' ? '0' : '1')
}
function toggleIrregular() {
  updatePreference('period_irregular', preferences.value.period_irregular === '1' ? '0' : '1')
}
function togglePartnerNotes() {
  saveSetting('partner_can_read_notes', settings.value.partner_can_read_notes === '1' ? '0' : '1')
}
function togglePantryNotifications() {
  saveSetting('pantry_notifications_enabled', settings.value.pantry_notifications_enabled === '1' ? '0' : '1')
}
const isCustomExpiry = computed(() =>
  ![3, 5, 7].includes(parseInt(settings.value.pantry_expiry_warning_days ?? '3', 10))
)
function selectCustomExpiry() {
  if (isCustomExpiry.value) return
  saveSetting('pantry_expiry_warning_days', '14')
}
function toggleHideEmptyCategories() {
  updatePreference('pantry_hide_empty_categories', preferences.value.pantry_hide_empty_categories === '1' ? '0' : '1')
}
</script>

<style scoped>
.sv-root {
  padding: 1.5rem 1.25rem 3rem;
  background: #f2f2f7;
  min-height: 100vh;
  box-sizing: border-box;
}

@media (min-width: 1280px) {
  .sv-root { padding: 2.5rem 3rem 4rem; }
}

/* Brand */
.sv-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 1.75rem; }

.sv-back-chip {
  margin-left: auto;
  display: inline-flex; align-items: center; gap: 1px;
  background: #fff; color: #993556;
  border: 1px solid #F4C0D1; border-radius: 99px;
  padding: 5px 12px 5px 8px;
  font-size: 12px; font-weight: 600;
  cursor: pointer; flex-shrink: 0;
  transition: background 0.15s;
}
.sv-back-chip:hover { background: #FBEAF0; }

@media (min-width: 1280px) {
  .sv-back-chip { display: none; }
}
.sv-brand-icon {
  width: 48px; height: 48px; background: #fff;
  border: 1.5px solid #F4C0D1; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; box-shadow: 0 2px 8px rgba(212, 83, 126, 0.08);
}
.sv-brand-title { font-size: 22px; font-weight: 600; color: #1a1a1a; margin: 0 0 3px; letter-spacing: -0.01em; }
.sv-brand-sub { font-size: 13px; color: #8e8e93; margin: 0; }

/* Structure */
.sv-divider { display: none; }
.sv-section { margin-bottom: 2rem; }

.sv-section-label {
  font-size: 17px; font-weight: 700; color: #1a1a1a;
  letter-spacing: -0.01em;
  margin: 0 0 12px 2px;
}

/* Subgroup: white card on gray */
.sv-subgroup { margin-bottom: 1rem; }
.sv-subgroup:last-child { margin-bottom: 0; }

.sv-sub-label {
  font-size: 11px; font-weight: 600; color: #8e8e93;
  letter-spacing: 0.04em; text-transform: uppercase;
  margin: 0 0 6px 4px;
}

/* List = white card */
.sv-list {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}

.sv-row {
  padding: 13px 16px; display: flex;
  justify-content: space-between; align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06); gap: 12px;
  background: #fff;
}
.sv-row:last-child { border-bottom: none; }
.sv-row--stub { opacity: 0.45; }
.sv-row--col { flex-direction: column; align-items: flex-start; }

.sv-label { font-size: 14px; color: #1a1a1a; }
.sv-label-group { display: flex; flex-direction: column; gap: 2px; }
.sv-sublabel { font-size: 12px; color: #8e8e93; }

.sv-soon {
  background: #f5f5f5; color: #bbb; border: 1px solid #ececec;
  border-radius: 5px; padding: 2px 8px; font-size: 10px;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0;
}

/* Toggle */
.sv-toggle {
  width: 36px; height: 20px; background: #ddd;
  border-radius: 10px; position: relative; cursor: pointer;
  transition: background 0.2s; flex-shrink: 0;
}
.sv-toggle.on { background: #D4537E; }
.sv-knob {
  width: 16px; height: 16px; background: white; border-radius: 50%;
  position: absolute; top: 2px; left: 2px; transition: left 0.2s;
}
.sv-toggle.on .sv-knob { left: 18px; }

/* Segmented */
.sv-segmented { display: flex; gap: 4px; flex-shrink: 0; }
.sv-seg-btn {
  min-width: 28px; height: 26px; padding: 0 8px;
  border-radius: 6px; border: 1px solid #e0e0e0;
  background: #f5f5f5; font-size: 12px; color: #888;
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.sv-seg-btn.active { background: #D4537E; border-color: #D4537E; color: #fff; }

/* Inputs */
.sv-time-input {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  text-align: right; padding: 2px 0; outline: none; width: 90px;
}
.sv-number-input {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  text-align: right; padding: 2px 0; outline: none; width: 48px;
}
.sv-number-input::placeholder { color: #ccc; }
.sv-select {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  padding: 2px 0; outline: none; max-width: 180px;
  appearance: none; -webkit-appearance: none;
  cursor: pointer;
}
.sv-symbol-input {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  text-align: right; padding: 2px 0; outline: none; width: 60px;
}
.sv-symbol-input::placeholder { color: #ccc; }
.sv-symbol-input--wide { width: 120px; }

/* Snackbar */
.sv-snackbar {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 500;
  white-space: nowrap; z-index: 9999; pointer-events: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}
.sv-snackbar--ok { background: #1a4d35; color: #fff; }
.sv-snackbar--error { background: #c0392b; color: #fff; }

/* Flow color */
.sv-flow-color { width: 100%; max-width: 380px; margin-top: 12px; }
.sv-flow-swatches { display: flex; gap: 10px; margin-bottom: 14px; }
.sv-swatch-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; }
.sv-swatch-dot { width: 100%; aspect-ratio: 1; border-radius: 10px; transition: background 0.1s; }
.sv-swatch-label { font-size: 10px; color: #aaa; text-transform: capitalize; letter-spacing: 0.03em; }

.sv-hue-wrap { position: relative; height: 36px; display: flex; align-items: center; }
.sv-hue-gradient {
  position: absolute; left: 0; right: 0; height: 9px; border-radius: 5px; pointer-events: none;
  background: linear-gradient(to right,
    hsl(290, 65%, 58%), hsl(310, 65%, 58%), hsl(330, 65%, 58%),
    hsl(350, 65%, 58%), hsl(370, 65%, 50%), hsl(380, 70%, 44%)
  );
}
.sv-hue-slider {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 100%; background: transparent;
  cursor: pointer; position: relative; z-index: 1; margin: 0;
}
.sv-hue-slider::-webkit-slider-runnable-track { height: 9px; background: transparent; border-radius: 5px; }
.sv-hue-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 26px; height: 26px; border-radius: 50%;
  background: #fff; border: 2px solid #ddd;
  box-shadow: 0 1px 6px rgba(0,0,0,0.2);
  margin-top: -9px; cursor: pointer;
}
.sv-hue-slider::-moz-range-track { height: 9px; background: transparent; border-radius: 5px; }
.sv-hue-slider::-moz-range-thumb {
  width: 26px; height: 26px; border-radius: 50%;
  background: #fff; border: 2px solid #ddd;
  box-shadow: 0 1px 6px rgba(0,0,0,0.2); cursor: pointer;
}
</style>
