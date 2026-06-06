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

      <Transition
        @before-enter="onExpandBeforeEnter"
        @enter="onExpandEnter"
        @leave="onExpandLeave"
      >
        <div v-if="isCustomExpiry" class="aps-expand">
          <div class="aps-row">
            <span class="aps-label">Expiry warning custom days</span>
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
        </div>
      </Transition>



    </div>

    <div v-if="errMsg" class="aps-snackbar">{{ errMsg }}</div>
  </DetailSheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailSheet from '../components/ui/DetailSheet.vue'
import { useSettings } from '../composables/useSettings'

defineProps<{ open: boolean }>()
defineEmits<{ (e: 'update:open', v: boolean): void }>()

const { settings, updateSetting } = useSettings()

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

function onExpandBeforeEnter(el: Element) {
  (el as HTMLElement).style.height = '0'
}
function onExpandEnter(el: Element, done: () => void) {
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
function onExpandLeave(el: Element, done: () => void) {
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


.aps-segmented { display: flex; gap: 4px; flex-shrink: 0; }
.aps-seg-btn {
  min-width: 28px; height: 26px; padding: 0 8px;
  border-radius: 6px; border: 1px solid #e0e0e0;
  background: #f5f5f5; font-size: 12px; color: #888;
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.aps-seg-btn.active { background: #D4537E; border-color: #D4537E; color: #fff; }

.aps-expand {
  overflow: hidden;
  transition: height 0.25s ease;
}

.aps-number-input {
  border: none; border-bottom: 1px solid #e0e0e0;
  background: transparent; font-size: 13px; color: #333;
  text-align: right; padding: 2px 0; outline: none; width: 48px;
}
.aps-number-input::placeholder { color: #ccc; }

.aps-snackbar {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 500;
  white-space: nowrap; z-index: 9999; pointer-events: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  background: #c0392b; color: #fff;
}
</style>
