<template>
  <Teleport to="body">
    <Transition name="nm-fade">
      <div v-if="modelValue" class="nm-overlay" @click.self="$emit('update:modelValue', false)">
        <div class="nm-sheet">

          <div class="nm-handle" />

          <div class="nm-header">
            <span class="nm-title">Notification Messages</span>
            <p class="nm-sub">Customize the text sent in email notifications</p>
          </div>

          <div class="nm-body">

            <!-- General -->
            <div class="nm-section">
              <div class="nm-section-head">
                <p class="nm-section-label">General</p>
                <span class="nm-status-pill" :class="notificationsLive ? 'nm-status-pill--live' : 'nm-status-pill--paused'">
                  <span class="nm-status-dot" />
                  {{ notificationsLive ? 'Notifications live' : 'Notifications paused' }}
                </span>
              </div>
              <div class="nm-list">
                <template v-for="field in GENERAL_FIELDS" :key="field.key">
                  <div v-if="editingKey !== field.key" class="nm-row">
                    <div class="nm-field-body">
                      <span class="nm-field-label">{{ field.label }}</span>
                      <span class="nm-field-value">{{ currentValue(field.key, field.placeholder) }}</span>
                    </div>
                    <button class="nm-edit-btn" @click="startEdit(field.key)">Edit</button>
                  </div>
                  <div v-else class="nm-row nm-row--editing">
                    <span class="nm-field-label">{{ field.label }}</span>
                    <textarea
                      class="nm-textarea"
                      v-model="editingValue"
                      :placeholder="field.placeholder"
                      rows="3"
                      autofocus
                    />
                    <div class="nm-edit-actions">
                      <button class="nm-save-btn" @click="saveEdit(field.key)">Save</button>
                      <button class="nm-cancel-btn" @click="cancelEdit">Cancel</button>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- Period Tracker -->
            <div class="nm-section">
              <div class="nm-section-head">
                <p class="nm-section-label">Period Tracker</p>
                <span class="nm-status-pill" :class="periodNotificationsLive ? 'nm-status-pill--live' : 'nm-status-pill--paused'">
                  <span class="nm-status-dot" />
                  {{ periodNotificationsLive ? 'Notifications live' : 'Notifications paused' }}
                </span>
              </div>
              <div class="nm-list">
                <div class="nm-row nm-row--stub">
                  <div class="nm-field-body">
                    <span class="nm-field-label">Custom subject line</span>
                    <span class="nm-field-value nm-field-value--placeholder">Period-specific email subjects</span>
                  </div>
                  <span class="nm-soon">Coming soon</span>
                </div>
                <div class="nm-row nm-row--stub">
                  <div class="nm-field-body">
                    <span class="nm-field-label">Message template</span>
                    <span class="nm-field-value nm-field-value--placeholder">Custom notification body</span>
                  </div>
                  <span class="nm-soon">Coming soon</span>
                </div>
              </div>
            </div>

            <!-- Pantry -->
            <div class="nm-section">
              <div class="nm-section-head">
                <p class="nm-section-label">Pantry</p>
              </div>
              <div class="nm-list">
                <div class="nm-row nm-row--stub">
                  <div class="nm-field-body">
                    <span class="nm-field-label">Expiry alerts</span>
                    <span class="nm-field-value nm-field-value--placeholder">Pantry notification messages</span>
                  </div>
                  <span class="nm-soon">Coming soon</span>
                </div>
              </div>
            </div>

            <!-- Other Apps -->
            <div class="nm-section">
              <p class="nm-section-label">Other Apps</p>
              <div class="nm-list">
                <div class="nm-row nm-row--stub">
                  <span class="nm-field-label">Recipes</span>
                  <span class="nm-soon">Coming soon</span>
                </div>
                <div class="nm-row nm-row--stub">
                  <span class="nm-field-label">Sleep Tracker</span>
                  <span class="nm-soon">Coming soon</span>
                </div>
                <div class="nm-row nm-row--stub">
                  <span class="nm-field-label">Exercise</span>
                  <span class="nm-soon">Coming soon</span>
                </div>
              </div>
            </div>

          </div>

          <div class="nm-footer">
            <button class="nm-close-btn" @click="$emit('update:modelValue', false)">Close</button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSettings } from '../composables/useSettings'

const props = defineProps<{ modelValue: boolean }>()
defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const { settings, fetchSettings, updateSetting } = useSettings()

watch(() => props.modelValue, (open) => { if (open) fetchSettings() }, { immediate: true })

const GENERAL_FIELDS = [
  { key: 'notification_greeting',    label: 'Greeting',     placeholder: 'love' },
  { key: 'notification_signoff',     label: 'Sign-off',     placeholder: 'Sent with love by your household app 💕' },
  { key: 'notification_sender_name', label: 'Sender name',  placeholder: 'Wifey App 💌' },
]

const editingKey   = ref<string | null>(null)
const editingValue = ref('')

function currentValue(key: string, placeholder: string): string {
  return settings.value[key] || placeholder
}

function startEdit(key: string) {
  editingKey.value = key
  editingValue.value = settings.value[key] ?? ''
}

function saveEdit(key: string) {
  updateSetting(key, editingValue.value)
  editingKey.value = null
}

function cancelEdit() {
  editingKey.value = null
}

const notificationsLive = computed(() => settings.value.notifications_enabled !== '0')

const periodNotificationsLive = computed(() =>
  settings.value.notifications_enabled !== '0' &&
  settings.value.period_notifications_enabled !== '0'
)
</script>

<style scoped>
/* Overlay */
.nm-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: flex-end; justify-content: center;
}

@media (min-width: 600px) {
  .nm-overlay { align-items: center; }
}

/* Sheet */
.nm-sheet {
  background: #fff;
  border-radius: 20px 20px 0 0;
  width: 100%; max-width: 480px;
  max-height: 88vh;
  display: flex; flex-direction: column;
  overflow: hidden;
}

@media (min-width: 600px) {
  .nm-sheet {
    border-radius: 18px;
    max-height: 82vh;
  }
}

/* Handle */
.nm-handle {
  width: 36px; height: 4px;
  background: #e0e0e0; border-radius: 2px;
  margin: 12px auto 0; flex-shrink: 0;
}

/* Header */
.nm-header {
  padding: 14px 20px 10px;
  flex-shrink: 0;
}
.nm-title {
  font-size: 16px; font-weight: 700; color: #1a1a1a; display: block;
}
.nm-sub {
  font-size: 12px; color: #aaa; margin: 3px 0 0;
}

/* Body */
.nm-body {
  flex: 1; overflow-y: auto;
  padding: 4px 16px 8px;
  display: flex; flex-direction: column; gap: 16px;
}

/* Footer */
.nm-footer {
  padding: 12px 16px 20px; flex-shrink: 0;
  border-top: 1px solid #f0f0f0;
}
.nm-close-btn {
  width: 100%; padding: 13px;
  border-radius: 12px; font-size: 15px; font-weight: 600;
  background: #f5f5f5; color: #555;
  border: none; cursor: pointer;
}
.nm-close-btn:hover { background: #ebebeb; }

/* Section */
.nm-section { display: flex; flex-direction: column; gap: 8px; }
.nm-section-head { display: flex; align-items: center; gap: 8px; }
.nm-section-label {
  font-size: 10px; font-weight: 700; color: #bbb;
  letter-spacing: 0.07em; text-transform: uppercase; margin: 0;
}

/* Status pill */
.nm-status-pill {
  display: inline-flex; align-items: center; gap: 4px;
  border-radius: 99px; padding: 2px 8px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
}
.nm-status-pill--live { background: #DCFCE7; color: #15803D; }
.nm-status-pill--paused { background: #F5F5F5; color: #aaa; }
.nm-status-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: currentColor; flex-shrink: 0;
}

/* List */
.nm-list {
  border: 1px solid #f0f0f0; border-radius: 12px;
  overflow: hidden;
}

.nm-row {
  padding: 12px 14px; display: flex;
  justify-content: space-between; align-items: center;
  border-bottom: 1px solid #f0f0f0; gap: 12px;
}
.nm-row:last-child { border-bottom: none; }
.nm-row--stub { opacity: 0.5; }
.nm-row--editing { flex-direction: column; align-items: stretch; gap: 8px; }

/* Field */
.nm-field-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.nm-field-label { font-size: 13px; color: #333; }
.nm-field-value { font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nm-field-value--placeholder { color: #ccc; font-style: italic; }

/* Edit */
.nm-edit-btn {
  font-size: 12px; font-weight: 600; color: #993556;
  background: #FBEAF0; border: 1px solid #F4C0D1;
  border-radius: 7px; padding: 4px 10px; cursor: pointer;
  flex-shrink: 0; transition: background 0.15s;
}
.nm-edit-btn:hover { background: #f7dae6; }

.nm-textarea {
  width: 100%; box-sizing: border-box;
  border: 1px solid #e8e8e8; border-radius: 8px;
  padding: 9px 10px; font-size: 13px; color: #333;
  outline: none; resize: vertical; min-height: 72px;
  font-family: inherit; line-height: 1.5;
  transition: border-color 0.15s;
}
.nm-textarea:focus { border-color: #D4537E; }
.nm-textarea::placeholder { color: #ccc; }

.nm-edit-actions { display: flex; gap: 8px; }
.nm-save-btn {
  flex: 1; padding: 9px; border-radius: 9px; font-size: 13px;
  font-weight: 600; background: #D4537E; color: #fff;
  border: none; cursor: pointer; transition: background 0.15s;
}
.nm-save-btn:hover { background: #c04070; }
.nm-cancel-btn {
  flex: 1; padding: 9px; border-radius: 9px; font-size: 13px;
  color: #888; background: #f5f5f5; border: 1px solid #e0e0e0;
  cursor: pointer; transition: background 0.15s;
}
.nm-cancel-btn:hover { background: #ebebeb; }

/* Coming soon */
.nm-soon {
  background: #f5f5f5; color: #bbb;
  border: 1px solid #ececec; border-radius: 5px;
  padding: 2px 8px; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0;
}

/* Transition */
.nm-fade-enter-active, .nm-fade-leave-active { transition: opacity 0.2s ease; }
.nm-fade-enter-from, .nm-fade-leave-to { opacity: 0; }
.nm-fade-enter-active .nm-sheet, .nm-fade-leave-active .nm-sheet { transition: transform 0.25s ease; }
.nm-fade-enter-from .nm-sheet, .nm-fade-leave-to .nm-sheet { transform: translateY(30px); }
</style>
