<template>
  <DetailSheet
    :open="open"
    theme="neutral"
    size="large"
    title="Pantry"
    subtitle="App settings"
    subtitle-style="plain"
    @update:open="$emit('update:open', $event)"
  >
    <div class="aps-list">

      <div class="aps-row">
        <div class="aps-label-group">
          <span class="aps-label">Expiry warning</span>
          <span class="aps-sublabel">Days before expiry to flag as expiring soon</span>
        </div>
        <div class="aps-segmented">
          <button
            v-for="d in [3, 5, 7]"
            :key="d"
            class="aps-seg-btn"
            :class="{ active: parseInt(settings.pantry_expiry_warning_days ?? '3') === d }"
            @click="saveSetting('pantry_expiry_warning_days', String(d))"
          >{{ d }}</button>
          <button
            class="aps-seg-btn"
            :class="{ active: isCustomExpiry }"
            @click="selectCustomExpiry"
          >Custom</button>
        </div>
      </div>

      <div v-if="isCustomExpiry" class="aps-row">
        <span class="aps-label">Custom days</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <input
            type="number"
            min="1"
            max="60"
            class="aps-number-input"
            :value="settings.pantry_expiry_warning_days"
            @change="e => saveSetting('pantry_expiry_warning_days', String(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1)))"
          />
          <span style="font-size:12px;color:#aaa;">days</span>
        </div>
      </div>

      <div class="aps-row" @click="toggleHideEmptyCategories" style="cursor:pointer">
        <span class="aps-label">Hide empty categories</span>
        <div class="aps-toggle" :class="{ on: preferences.pantry_hide_empty_categories === '1' }">
          <div class="aps-knob" />
        </div>
      </div>

      <div class="aps-row">
        <span class="aps-label">Currency</span>
        <select
          class="aps-select"
          :value="settings.pantry_currency ?? 'USD'"
          @change="e => saveSetting('pantry_currency', (e.target as HTMLInputElement).value)"
        >
          <option v-for="c in CURRENCIES" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </div>

      <template v-if="(settings.pantry_currency ?? 'USD') === 'OTHER'">
        <div class="aps-row">
          <div class="aps-label-group">
            <span class="aps-label">Custom currency symbol</span>
            <span class="aps-sublabel">e.g. Kč, zł, kr</span>
          </div>
          <input
            class="aps-symbol-input"
            maxlength="4"
            placeholder="$"
            :value="settings.pantry_currency_custom_symbol ?? ''"
            @change="e => saveSetting('pantry_currency_custom_symbol', (e.target as HTMLInputElement).value)"
          />
        </div>
        <div class="aps-row">
          <div class="aps-label-group">
            <span class="aps-label">Custom currency name</span>
            <span class="aps-sublabel">e.g. Czech Koruna, Polish Złoty</span>
          </div>
          <input
            class="aps-symbol-input aps-symbol-input--wide"
            maxlength="32"
            placeholder="Currency"
            :value="settings.pantry_currency_custom_label ?? ''"
            @change="e => saveSetting('pantry_currency_custom_label', (e.target as HTMLInputElement).value)"
          />
        </div>
      </template>

    </div>

    <div v-if="errMsg" class="aps-snackbar">{{ errMsg }}</div>
  </DetailSheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailSheet from '../components/ui/DetailSheet.vue'
import { useSettings } from '../composables/useSettings'
import { usePreferences } from '../composables/usePreferences'
import { CURRENCIES } from '../constants/currencies'

defineProps<{ open: boolean }>()
defineEmits<{ (e: 'update:open', v: boolean): void }>()

const { settings, updateSetting } = useSettings()
const { preferences, updatePreference } = usePreferences()

const errMsg = ref('')
function showErr(msg: string) {
  errMsg.value = msg
  setTimeout(() => { errMsg.value = '' }, 4000)
}

async function saveSetting(key: string, value: string) {
  const err = await updateSetting(key, value)
  if (err) showErr(err)
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
.aps-list {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.06);
}
.aps-row {
  padding: 13px 16px; display: flex;
  justify-content: space-between; align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06); gap: 12px;
  background: #fff;
}
.aps-row:last-child { border-bottom: none; }

.aps-label { font-size: 14px; color: #1a1a1a; }
.aps-label-group { display: flex; flex-direction: column; gap: 2px; }
.aps-sublabel { font-size: 12px; color: #8e8e93; }

.aps-toggle {
  width: 36px; height: 20px; background: #ddd;
  border-radius: 10px; position: relative; cursor: pointer;
  transition: background 0.2s; flex-shrink: 0;
}
.aps-toggle.on { background: #D4537E; }
.aps-knob {
  width: 16px; height: 16px; background: white; border-radius: 50%;
  position: absolute; top: 2px; left: 2px; transition: left 0.2s;
}
.aps-toggle.on .aps-knob { left: 18px; }

.aps-segmented { display: flex; gap: 4px; flex-shrink: 0; }
.aps-seg-btn {
  min-width: 28px; height: 26px; padding: 0 8px;
  border-radius: 6px; border: 1px solid #e0e0e0;
  background: #f5f5f5; font-size: 12px; color: #888;
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.aps-seg-btn.active { background: #D4537E; border-color: #D4537E; color: #fff; }

.aps-number-input {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  text-align: right; padding: 2px 0; outline: none; width: 48px;
}
.aps-number-input::placeholder { color: #ccc; }
.aps-select {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  padding: 2px 0; outline: none; max-width: 180px;
  appearance: none; -webkit-appearance: none;
  cursor: pointer;
}
.aps-symbol-input {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  text-align: right; padding: 2px 0; outline: none; width: 60px;
}
.aps-symbol-input::placeholder { color: #ccc; }
.aps-symbol-input--wide { width: 120px; }

.aps-snackbar {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 500;
  white-space: nowrap; z-index: 9999; pointer-events: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  background: #c0392b; color: #fff;
}
</style>
