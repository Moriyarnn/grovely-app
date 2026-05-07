<template>
  <teleport to="body">
    <transition name="sheet">
      <div v-if="modelValue" class="overlay" @click.self="$emit('update:modelValue', false)">
        <div class="sheet">
          <div class="handle" />
          <h2 class="sheet-title">Settings</h2>

          <p class="sheet-section-label">Flow Color</p>
          <div class="flow-color-section">
            <div class="flow-swatches-row">
              <div v-for="s in flowSwatches" :key="s.label" class="flow-swatch-item">
                <div class="flow-swatch-dot" :style="{ background: s.bg }">
                  <span class="flow-swatch-letter" :style="{ color: s.textColor }">{{ s.label[0] }}</span>
                </div>
                <span class="flow-swatch-label">{{ s.label }}</span>
              </div>
            </div>
            <div class="hue-slider-wrap">
              <div class="hue-track-gradient" />
              <input type="range" class="hue-slider" min="290" max="380" v-model.number="flowHue" />
            </div>
          </div>

          <p class="sheet-section-label">Notifications</p>
          <div class="prefs-list">
            <div class="pref-row" @click="toggleNotifications" style="cursor:pointer">
              <span class="pref-label">Email notifications</span>
              <div class="toggle" :class="{ on: settings.notifications_enabled !== '0' }">
                <div class="toggle-knob" />
              </div>
            </div>
            <div class="pref-row">
              <span class="pref-label">Remind me (days before period)</span>
              <div class="segmented">
                <button
                  v-for="d in [1, 2, 3]"
                  :key="d"
                  class="seg-btn"
                  :class="{ active: reminderDays === d }"
                  @click="setReminderDays(d)"
                >{{ d }}</button>
              </div>
            </div>
          </div>

          <p class="sheet-section-label">Notification Messages</p>
          <div class="prefs-list">
            <div class="pref-row pref-row--input">
              <span class="pref-label">Greeting</span>
              <input class="pref-input" :value="settings.notification_greeting" @change="e => updateSetting('notification_greeting', (e.target as HTMLInputElement).value)" placeholder="love" />
            </div>
            <div class="pref-row pref-row--input">
              <span class="pref-label">Sign-off</span>
              <input class="pref-input" :value="settings.notification_signoff" @change="e => updateSetting('notification_signoff', (e.target as HTMLInputElement).value)" placeholder="Sent with love by your household app 💕" />
            </div>
            <div class="pref-row pref-row--input">
              <span class="pref-label">Sender name</span>
              <input class="pref-input" :value="settings.notification_sender_name" @change="e => updateSetting('notification_sender_name', (e.target as HTMLInputElement).value)" placeholder="Wifey App 💌" />
            </div>
          </div>

          <p class="sheet-section-label">Period Tracker</p>
          <div class="prefs-list">
            <div v-if="isOwner" class="pref-row" @click="togglePartnerNotes" style="cursor:pointer">
              <span class="pref-label">Partner can read notes</span>
              <div class="toggle" :class="{ on: settings.partner_can_read_notes === '1' }">
                <div class="toggle-knob" />
              </div>
            </div>
          </div>

          <p class="sheet-section-label">App Grid</p>
          <div class="prefs-list">
            <div class="pref-row" @click="toggleReorder" style="cursor:pointer">
              <div class="pref-label-group">
                <span class="pref-label">App reordering</span>
                <span class="pref-sublabel">Hold any card to drag and rearrange</span>
              </div>
              <div class="toggle" :class="{ on: preferences.app_reorder_enabled === '1' }">
                <div class="toggle-knob" />
              </div>
            </div>
          </div>

          <button class="close-btn" @click="$emit('update:modelValue', false)">Close</button>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { getUser } from '../api'
import { useSettings } from '../composables/useSettings'
import { usePreferences } from '../composables/usePreferences'

const props = defineProps({ modelValue: Boolean })
defineEmits(['update:modelValue'])

watch(() => props.modelValue, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  document.body.style.position = open ? 'fixed' : ''
  document.body.style.width = open ? '100%' : ''
})

const isOwner = getUser()?.role === 'owner'
const { settings, fetchSettings, updateSetting } = useSettings()
const { preferences, fetchPreferences, updatePreference } = usePreferences()

onMounted(async () => {
  await fetchSettings()
  await fetchPreferences()
})

function togglePartnerNotes() {
  const next = settings.value.partner_can_read_notes === '1' ? '0' : '1'
  updateSetting('partner_can_read_notes', next)
}

function toggleReorder() {
  const next = preferences.value.app_reorder_enabled === '1' ? '0' : '1'
  updatePreference('app_reorder_enabled', next)
}

function toggleNotifications() {
  const next = settings.value.notifications_enabled !== '0' ? '0' : '1'
  updateSetting('notifications_enabled', next)
}

const reminderDays = computed(() => parseInt(settings.value.reminder_days ?? '3', 10))

function setReminderDays(d: number) {
  updateSetting('reminder_days', String(d))
}

const flowHue = computed({
  get: () => parseInt(preferences.value.flow_hue ?? '340', 10),
  set: (v) => {
    document.documentElement.style.setProperty('--flow-hue', String(v))
    updatePreference('flow_hue', String(v))
  }
})

const flowSwatches = computed(() => [
  { label: 'Spotting', bg: `hsl(${flowHue.value}, 50%, 80%)`,  textColor: '#fff' },
  { label: 'Light',    bg: `hsl(${flowHue.value}, 55%, 74%)`,  textColor: '#fff' },
  { label: 'Medium',   bg: `hsl(${flowHue.value}, 65%, 58%)`,  textColor: '#fff' },
  { label: 'Heavy',    bg: `hsl(${flowHue.value}, 80%, 42%)`,  textColor: '#fff' },
])
</script>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 200; display: flex; align-items: flex-end; justify-content: center; touch-action: none; }
.sheet { background: white; border-radius: 20px 20px 0 0; width: 100%; max-width: 480px; padding: 1.25rem 1.25rem 2.5rem; max-height: 85vh; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; scrollbar-width: thin; scrollbar-color: #d4d4d4 transparent; }
.sheet::-webkit-scrollbar       { width: 5px; }
.sheet::-webkit-scrollbar-track { background: transparent; }
.sheet::-webkit-scrollbar-thumb { border-radius: 99px; background: #d4d4d4; }
.sheet::-webkit-scrollbar-thumb:hover { background: #adadad; }
.handle { width: 36px; height: 4px; background: #e0e0e0; border-radius: 2px; margin: 0 auto 1.25rem; }
.sheet-title { font-size: 18px; font-weight: 500; margin: 0 0 1.25rem; }
.sheet-section-label { font-size: 10px; font-weight: 600; color: #bbb; letter-spacing: 0.07em; text-transform: uppercase; margin: 0 0 10px; }

.prefs-list { border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; margin-bottom: 1rem; }
.pref-row { padding: 13px 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f0f0f0; }
.pref-row:last-child { border-bottom: none; }
.pref-label { font-size: 13px; color: #333; }
.pref-action { font-size: 13px; color: #bbb; }
.toggle { width: 36px; height: 20px; background: #ddd; border-radius: 10px; position: relative; cursor: pointer; transition: background 0.2s; }
.toggle.on { background: #D4537E; }
.toggle-knob { width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: left 0.2s; }
.toggle.on .toggle-knob { left: 18px; }

/* Flow color section */
.flow-color-section { margin-bottom: 1.25rem; }
.flow-swatches-row { display: flex; gap: 8px; margin-bottom: 12px; }
.flow-swatch-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.flow-swatch-dot {
  width: 100%; aspect-ratio: 1; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.1s;
}
.flow-swatch-letter { font-size: 12px; font-weight: 700; line-height: 1; }
.flow-swatch-label { font-size: 9px; color: #aaa; text-transform: capitalize; letter-spacing: 0.03em; }

.hue-slider-wrap { position: relative; height: 28px; display: flex; align-items: center; }
.hue-track-gradient {
  position: absolute; left: 0; right: 0; height: 6px; border-radius: 3px; pointer-events: none;
  background: linear-gradient(to right,
    hsl(290, 65%, 58%), hsl(310, 65%, 58%), hsl(330, 65%, 58%),
    hsl(350, 65%, 58%), hsl(370, 65%, 50%), hsl(380, 70%, 44%)
  );
}
.hue-slider {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 100%; background: transparent; cursor: pointer; position: relative; z-index: 1; margin: 0;
}
.hue-slider::-webkit-slider-runnable-track { height: 6px; background: transparent; border-radius: 3px; }
.hue-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 22px; height: 22px; border-radius: 50%;
  background: #fff; border: 2px solid #ddd;
  box-shadow: 0 1px 5px rgba(0,0,0,0.18);
  margin-top: -8px; cursor: pointer;
}
.hue-slider::-moz-range-track { height: 6px; background: transparent; border-radius: 3px; }
.hue-slider::-moz-range-thumb {
  width: 22px; height: 22px; border-radius: 50%;
  background: #fff; border: 2px solid #ddd;
  box-shadow: 0 1px 5px rgba(0,0,0,0.18);
  cursor: pointer;
}

.segmented { display: flex; gap: 4px; }
.seg-btn { width: 28px; height: 26px; border-radius: 6px; border: 1px solid #e0e0e0; background: #f5f5f5; font-size: 12px; color: #888; cursor: pointer; transition: background 0.15s, color 0.15s; }
.seg-btn.active { background: #D4537E; border-color: #D4537E; color: #fff; }

.pref-row--input { align-items: center; gap: 12px; }
.pref-input { flex: 1; border: none; border-bottom: 1px solid #e8e8e8; background: transparent; font-size: 13px; color: #333; text-align: right; padding: 2px 0; outline: none; min-width: 0; }
.pref-input::placeholder { color: #ccc; }
.pref-label-group { display: flex; flex-direction: column; gap: 2px; }
.pref-sublabel { font-size: 11px; color: #bbb; }
.close-btn { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #e0e0e0; background: #f5f5f5; font-size: 14px; color: #555; cursor: pointer; }

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.25s ease; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.3s cubic-bezier(.4,0,.2,1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
</style>