<template>
  <Teleport to="body">
    <Transition name="app-toast">
      <div
        v-if="modelValue"
        class="app-toast"
        :style="{ background: bgColor }"
        @click="dismiss"
      >
        <v-icon v-if="icon" size="14" :color="iconColor">{{ icon }}</v-icon>
        <span>{{ modelValue }}</span>
        <v-icon
          v-if="closeable"
          size="14"
          color="rgba(255,255,255,0.6)"
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
  tone?:      'dark' | 'info'
  icon?:      string
  iconColor?: string
  closeable?: boolean
  duration?:  number
}>(), {
  tone:      'dark',
  closeable: false,
  duration:  4000,
})

const emit = defineEmits<{ (e: 'update:modelValue', v: null): void }>()

const bgColor = computed(() =>
  props.tone === 'info' ? 'rgba(45, 75, 60, 0.92)' : '#1a1a1a'
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
.app-toast-enter-active,
.app-toast-leave-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.app-toast-enter-from,
.app-toast-leave-to     { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
