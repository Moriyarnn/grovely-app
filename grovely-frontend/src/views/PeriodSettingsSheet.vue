<template>
  <DetailSheet
    :open="open"
    theme="neutral"
    size="large"
    title="Period Tracker"
    subtitle="App settings"
    subtitle-style="plain"
    @update:open="$emit('update:open', $event)"
  >
    <div class="aps-list">

      <div class="aps-row aps-row--col">
        <span class="aps-label">Flow color</span>
        <div class="aps-flow-color">
          <div class="aps-flow-swatches">
            <div v-for="s in flowSwatches" :key="s.label" class="aps-swatch-item">
              <div class="aps-swatch-dot" :style="{ background: s.bg }" />
              <span class="aps-swatch-label">{{ s.label }}</span>
            </div>
          </div>
          <v-color-picker
            class="aps-hue-only"
            :model-value="flowColorHex"
            @update:model-value="onPickColor"
            mode="hex"
            hide-canvas
            hide-inputs
            width="100%"
            elevation="0"
          />
        </div>
      </div>

      <div class="aps-row" @click="toggleFertileWindow" style="cursor:pointer">
        <span class="aps-label">Show fertile window on calendar</span>
        <div class="aps-toggle" :class="{ on: preferences.period_show_fertile_window !== '0' }">
          <div class="aps-knob" />
        </div>
      </div>

      <div v-if="isOwner" class="aps-row" @click="toggleIrregular" style="cursor:pointer">
        <div class="aps-label-group">
          <span class="aps-label">Irregular cycles</span>
          <span class="aps-sublabel">Widens predictions, suppresses overdue alerts</span>
        </div>
        <div class="aps-toggle" :class="{ on: preferences.period_irregular === '1' }">
          <div class="aps-knob" />
        </div>
      </div>

      <div v-if="isOwner" class="aps-row">
        <div class="aps-label-group">
          <span class="aps-label">Cycle length seed</span>
          <span class="aps-sublabel">Optional - used until 4+ cycles are logged</span>
        </div>
        <input
          type="number"
          class="aps-number-input"
          min="15"
          max="60"
          placeholder="—"
          :value="preferences.period_cycle_seed ?? ''"
          @change="e => updatePreference('period_cycle_seed', (e.target as HTMLInputElement).value)"
        />
      </div>

      <div v-if="isOwner" class="aps-row" @click="togglePartnerNotes" style="cursor:pointer">
        <span class="aps-label">Partner can read notes</span>
        <div class="aps-toggle" :class="{ on: settings.partner_can_read_notes === '1' }">
          <div class="aps-knob" />
        </div>
      </div>

    </div>

    <div v-if="errMsg" class="aps-snackbar">{{ errMsg }}</div>
  </DetailSheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailSheet from '../components/ui/DetailSheet.vue'
import { getUser } from '../api'
import { useSettings } from '../composables/useSettings'
import { usePreferences } from '../composables/usePreferences'

defineProps<{ open: boolean }>()
defineEmits<{ (e: 'update:open', v: boolean): void }>()

const isOwner = getUser()?.role === 'owner1'
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

// Flow color is stored as a single hue (default 335 = the original pink,
// the 50% point of the old 290–380 bar). The native picker lets the user
// choose any color; we keep only its hue and re-derive the 4 intensities
// with fixed saturation/lightness, so the scale stays legible and the
// calendar tint never breaks regardless of the pick.
const DEFAULT_HUE = 335

const flowHue = computed(() => parseInt(preferences.value.flow_hue ?? String(DEFAULT_HUE), 10))

const flowSwatches = computed(() => [
  { label: 'Spotting', bg: `hsl(${flowHue.value}, 50%, 80%)` },
  { label: 'Light',    bg: `hsl(${flowHue.value}, 55%, 74%)` },
  { label: 'Medium',   bg: `hsl(${flowHue.value}, 65%, 58%)` },
  { label: 'Heavy',    bg: `hsl(${flowHue.value}, 80%, 42%)` },
])

// Native <input type="color"> needs a hex; show the representative
// (Medium) color for the current hue.
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
function hexToHue(hex: string): number {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return flowHue.value // greyscale pick — keep current hue
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return Math.round(h)
}

const flowColorHex = computed(() => hslToHex(flowHue.value, 65, 58))

function onPickColor(v: string | { hex?: string }) {
  const hex = typeof v === 'string' ? v : (v?.hex ?? '')
  if (!/^#?[0-9a-fA-F]{6}/.test(hex)) return
  const hue = hexToHue(hex)
  document.documentElement.style.setProperty('--flow-hue', String(hue))
  updatePreference('flow_hue', String(hue))
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
.aps-row--col { flex-direction: column; align-items: flex-start; }

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

.aps-number-input {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  text-align: right; padding: 2px 0; outline: none; width: 48px;
}
.aps-number-input::placeholder { color: #ccc; }

/* Flow color */
.aps-flow-color { width: 100%; margin-top: 10px; }
.aps-flow-swatches { display: flex; gap: 6px; margin-bottom: 4px; }
.aps-swatch-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.aps-swatch-dot { width: 100%; height: 20px; border-radius: 6px; transition: background 0.1s; }
.aps-swatch-label { font-size: 9px; color: #aaa; text-transform: capitalize; letter-spacing: 0.02em; }

/* Vuetify color picker — keep only the hue bar, strip all chrome */
.aps-hue-only {
  width: 100% !important;
  min-width: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  padding: 0 !important;
}
.aps-hue-only :deep(.v-color-picker-canvas),
.aps-hue-only :deep(.v-color-picker-preview__dot),
.aps-hue-only :deep(.v-color-picker-preview__eye-dropper),
.aps-hue-only :deep(.v-color-picker-preview__alpha),
.aps-hue-only :deep(.v-color-picker-edit) { display: none !important; }
.aps-hue-only :deep(.v-color-picker__controls) { padding: 0; overflow: visible; }
.aps-hue-only :deep(.v-color-picker-preview) { margin: 0; width: 100%; overflow: visible; }
.aps-hue-only :deep(.v-color-picker-preview__sliders) {
  padding: 0; gap: 0; width: 100%; overflow: visible;
}
.aps-hue-only :deep(.v-color-picker-preview__track) {
  margin: 0; width: 100%; max-width: none; overflow: visible;
}

/* Snackbar */
.aps-snackbar {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 500;
  white-space: nowrap; z-index: 9999; pointer-events: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  background: #c0392b; color: #fff;
}
</style>
