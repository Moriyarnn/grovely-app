<template>
  <div class="sv-root">

    <div class="sv-brand">
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

      <div v-if="isDev" class="sv-subgroup">
        <p class="sv-sub-label">Dev</p>
        <div class="sv-list">
          <div class="sv-row" @click="resetHints" style="cursor:pointer">
            <span class="sv-label">Reset onboarding hints</span>
            <span class="sv-soon">Dev only</span>
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
          <div class="sv-row">
            <span class="sv-label">Currency</span>
            <select
              class="sv-select"
              :value="settings.pantry_currency ?? 'USD'"
              @change="e => updateSetting('pantry_currency', (e.target as HTMLInputElement).value)"
            >
              <option v-for="c in CURRENCIES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </div>
          <Transition
            @before-enter="onCurrencyBeforeEnter"
            @enter="onCurrencyEnter"
            @leave="onCurrencyLeave"
          >
            <div v-if="(settings.pantry_currency ?? 'USD') === 'OTHER'" class="sv-currency-expand">
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
                  @change="e => updateSetting('pantry_currency_custom_symbol', (e.target as HTMLInputElement).value)"
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
                  @change="e => updateSetting('pantry_currency_custom_label', (e.target as HTMLInputElement).value)"
                />
              </div>
              <div class="sv-row">
                <span class="sv-label">Custom currency decimals</span>
                <div class="sv-segmented">
                  <button
                    v-for="d in ['0', '2']"
                    :key="d"
                    class="sv-seg-btn"
                    :class="{ active: (settings.pantry_currency_custom_decimals ?? '2') === d }"
                    @click="updateSetting('pantry_currency_custom_decimals', d)"
                  >{{ d }}</button>
                </div>
              </div>
            </div>
          </Transition>
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

      <!-- PREMIUM GATE (frontend) -->
      <div class="sv-subgroup">
        <p class="sv-sub-label">Notifications</p>
        <div class="sv-list-wrap">
          <div class="sv-list" :class="{ 'sv-list--locked': notifLocked }">
            <div class="sv-row sv-row--link" @click="onNotifMessagesClick" style="cursor:pointer">
              <div class="sv-label-group">
                <span class="sv-label">Set up notifications</span>
                <span class="sv-sublabel">Set scheduling, edit messages individually, and manage per-app notifications</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <PremiumBadge v-if="licenseActive !== null" :unlocked="licenseActive === true" theme="neutral" />
                <v-icon size="16" color="#bbb">mdi-chevron-right</v-icon>
              </div>
            </div>
          </div>
          <div v-if="notifLocked" class="sv-list-lock-overlay" @click="premiumGateOpen = true" />
        </div>
      </div>
    </div>

    <div class="sv-divider" />

    <!-- YOUR APPS -->
    <div class="sv-section">
      <p class="sv-section-label">Your Apps</p>

      <div class="sv-subgroup">
        <div class="sv-list">
          <div class="sv-row sv-row--link" @click="periodSettingsOpen = true" style="cursor:pointer">
            <div class="sv-label-group">
              <span class="sv-label">Period Tracker</span>
              <span class="sv-sublabel">Flow color, fertile window, cycle settings</span>
            </div>
            <div class="sv-row-end">
              <v-icon size="16" color="#bbb">mdi-chevron-right</v-icon>
            </div>
          </div>
          <div class="sv-row sv-row--link" @click="pantrySettingsOpen = true" style="cursor:pointer">
            <div class="sv-label-group">
              <span class="sv-label">Pantry</span>
              <span class="sv-sublabel">Expiry warnings</span>
            </div>
            <div class="sv-row-end">
              <v-icon size="16" color="#bbb">mdi-chevron-right</v-icon>
            </div>
          </div>
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
          <div class="sv-row sv-row--stub">
            <span class="sv-label">Events</span>
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
        <div class="sv-list-wrap">
          <div class="sv-list" :class="{ 'sv-list--locked': backupsLocked }">
            <!-- PREMIUM GATE (frontend) -->
            <div class="sv-row sv-row--link" @click="onBackupsClick" style="cursor:pointer">
              <div class="sv-label-group">
                <span class="sv-label">Scheduled backups</span>
                <span class="sv-sublabel">Daily snapshots with retention and optional remote push</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <PremiumBadge v-if="licenseActive !== null" :unlocked="licenseActive === true" theme="neutral" />
                <v-icon size="16" color="#bbb">mdi-chevron-right</v-icon>
              </div>
            </div>
          </div>
          <div v-if="backupsLocked" class="sv-list-lock-overlay" @click="premiumGateOpen = true" />
        </div>
      </div>

    </div>

    <NotificationMessagesModal v-model="notifMessagesOpen" />
    <BackupsDetailSheet v-model="backupsSheetOpen" />
    <PeriodSettingsSheet :open="periodSettingsOpen" @update:open="periodSettingsOpen = $event" />
    <PantrySettingsSheet :open="pantrySettingsOpen" @update:open="pantrySettingsOpen = $event" />
    <PremiumGate :open="premiumGateOpen" theme="pink" @update:open="premiumGateOpen = $event" />

    <!-- Backup result snackbar -->
    <div v-if="backupMsg" class="sv-snackbar" :class="backupMsgError ? 'sv-snackbar--error' : 'sv-snackbar--ok'">
      {{ backupMsg }}
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { exportBackup, restoreBackup } from '../api'
import { useSettings } from '../composables/useSettings'
import { usePreferences } from '../composables/usePreferences'
import { useLicense } from '../composables/useLicense'
import { CURRENCIES } from '../constants/currencies'
import NotificationMessagesModal from './NotificationMessagesView.vue'
import BackupsDetailSheet from './BackupsDetailSheet.vue'
import PeriodSettingsSheet from './PeriodSettingsSheet.vue'
import PantrySettingsSheet from './PantrySettingsSheet.vue'
import PremiumGate from '../components/PremiumGate.vue'
import PremiumBadge from '../components/ui/PremiumBadge.vue'

const router = useRouter()
const { settings, fetchSettings, updateSetting } = useSettings()
const { preferences, fetchPreferences, updatePreference } = usePreferences()

const { licenseActive, fetchLicenseStatus } = useLicense()
const notifMessagesOpen = ref(false)
const backupsSheetOpen = ref(false)
const periodSettingsOpen = ref(false)
const pantrySettingsOpen = ref(false)
const premiumGateOpen = ref(false)

const notifLocked = computed(() => licenseActive.value === false)
const backupsLocked = computed(() => licenseActive.value === false)

function onNotifMessagesClick() {
  if (licenseActive.value === true) {
    notifMessagesOpen.value = true
  } else {
    premiumGateOpen.value = true
  }
}

function onBackupsClick() {
  if (licenseActive.value === true) {
    backupsSheetOpen.value = true
  } else {
    premiumGateOpen.value = true
  }
}
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
    await fetchSettings()
    await fetchPreferences()
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
  fetchLicenseStatus()
})

function onCurrencyBeforeEnter(el: Element) {
  (el as HTMLElement).style.height = '0'
}
function onCurrencyEnter(el: Element, done: () => void) {
  const h = el as HTMLElement
  h.style.height = 'auto'
  const target = h.scrollHeight
  h.style.height = '0'
  void h.offsetHeight
  h.style.height = target + 'px'
  h.addEventListener('transitionend', function onEnd(e) {
    if ((e as TransitionEvent).propertyName !== 'height') return
    h.removeEventListener('transitionend', onEnd)
    h.style.height = ''
    done()
  })
}
function onCurrencyLeave(el: Element, done: () => void) {
  const h = el as HTMLElement
  h.style.height = h.scrollHeight + 'px'
  void h.offsetHeight
  h.style.height = '0'
  h.addEventListener('transitionend', function onEnd(e) {
    if ((e as TransitionEvent).propertyName !== 'height') return
    h.removeEventListener('transitionend', onEnd)
    done()
  })
}

const isDev = import.meta.env.DEV
function resetHints() {
  localStorage.removeItem('grovely_reorder_hint_dismissed')
  showMsg('Hints reset — refresh to see them again.')
}



</script>

<style scoped>
.sv-root {
  padding: 1.5rem 1.25rem 3rem;
  background: #f2f2f7;
  min-height: 100dvh;
  box-sizing: border-box;
}

@media (min-width: 1024px) {
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

@media (min-width: 1024px) {
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

.sv-list-wrap { position: relative; }

.sv-list--locked { opacity: 0.42; pointer-events: none; }

.sv-list-lock-overlay {
  position: absolute; inset: 0;
  cursor: pointer; z-index: 1;
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

.sv-row-end { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
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

.sv-currency-expand {
  overflow: hidden;
  transition: height 0.25s ease;
}

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
