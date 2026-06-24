<template>
  <Teleport to="body">
    <Transition name="app-toast">
      <div
        v-if="modelValue"
        class="app-toast"
        :class="{ 'app-toast--corner': placement === 'corner', 'app-toast--pastel': tone === 'pastel' }"
        :style="{ background: bgColor }"
        @click="dismiss"
      >
        <v-icon v-if="icon" size="14" :color="iconColor">{{ icon }}</v-icon>
        <span>{{ modelValue }}</span>
        <v-icon
          v-if="closeable"
          size="14"
          :color="closeColor"
          @click.stop="dismiss"
        >mdi-close</v-icon>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string | null
  tone?:      'dark' | 'info' | 'pastel'
  icon?:      string
  iconColor?: string
  closeable?: boolean
  duration?:  number
  // 'center' = bottom-center pill (default). 'corner' = bottom-center on phone,
  // bottom-right corner on desktop (>=1024px), clear of the DesktopShell nav.
  placement?: 'center' | 'corner'
}>(), {
  tone:      'dark',
  closeable: false,
  duration:  4000,
  placement: 'center',
})

const emit = defineEmits<{ (e: 'update:modelValue', v: null): void }>()

const bgColor = computed(() => {
  if (props.tone === 'pastel') return '#fff'
  if (props.tone === 'info') return 'rgba(45, 75, 60, 0.92)'
  return '#1a1a1a'
})

const closeColor = computed(() =>
  props.tone === 'pastel' ? 'rgba(153, 53, 86, 0.5)' : 'rgba(255,255,255,0.6)'
)

let timer: ReturnType<typeof setTimeout> | null = null

function dismiss() {
  if (timer) { clearTimeout(timer); timer = null }
  emit('update:modelValue', null)
}

watch(() => props.modelValue, (val) => {
  if (timer) { clearTimeout(timer); timer = null }
  if (val && props.duration > 0) {
    timer = setTimeout(dismiss, props.duration)
  }
}, { immediate: true })

onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>

<style scoped>
.app-toast {
  position: fixed; left: 50%; bottom: 24px;
  transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 16px; border-radius: 999px;
  color: #fff; font-size: 12px; font-weight: 500; line-height: 1.4;
  box-shadow: 0 6px 20px rgba(0,0,0,0.22);
  z-index: 9999; cursor: pointer; user-select: none;
  white-space: nowrap; max-width: calc(100vw - 40px);
  overflow: hidden; text-overflow: ellipsis;
}
/* Pastel tone: soft on-brand pink, matching the app's surfaces and back chips. */
.app-toast--pastel {
  color: #993556;
  font-weight: 600;
  border: 1px solid #f3cdda;
  box-shadow: 0 8px 24px rgba(153, 53, 86, 0.18);
}

.app-toast-enter-active,
.app-toast-leave-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.app-toast-enter-from,
.app-toast-leave-to     { opacity: 0; transform: translateX(-50%) translateY(8px); }

/* Desktop equivalent: anchor to the bottom-right corner, clear of the 350px
   DesktopShell nav on the left. Phone keeps the centered pill. */
@media (min-width: 1024px) {
  .app-toast--corner {
    left: auto; right: 24px; bottom: 24px;
    transform: none;
    max-width: 360px; white-space: normal;
  }
  .app-toast--corner.app-toast-enter-from,
  .app-toast--corner.app-toast-leave-to { transform: translateY(8px); }
}
</style>
