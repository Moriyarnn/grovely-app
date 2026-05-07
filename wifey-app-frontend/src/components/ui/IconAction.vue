<template>
  <div ref="rootEl" class="ia-root" @mouseenter="onHover" @mouseleave="onLeave">
    <button
      class="ia-btn"
      :style="{ '--ia-bg': disabled ? '#f8fafc' : bg, '--ia-border': disabled ? '#e2e8f0' : border }"
      :disabled="disabled"
      @click="$emit('click')"
    >
      <v-icon :size="16" :color="disabled ? '#94a3b8' : color">{{ icon }}</v-icon>
    </button>
    <span class="ia-label" :class="{ 'ia-label--muted': disabled }" :style="{ color: disabled ? undefined : color }">
      {{ loading || label }}
    </span>

    <Teleport to="body">
      <Transition name="ia-bubble-fade">
        <div
          v-if="bubbleVisible && hoverMessage"
          ref="bubbleEl"
          class="ia-bubble"
          :style="{ left: bubbleX + 'px', top: bubbleY + 'px', '--ia-bubble-bg': color, '--ia-arrow-left': arrowLeft }"
        >
          {{ hoverMessage }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
  icon:         { type: String,  required: true },
  label:        { type: String,  required: true },
  color:        { type: String,  default: '#993556' },
  bg:           { type: String,  default: '#FBEAF0' },
  border:       { type: String,  default: '#f1a1b0' },
  disabled:     { type: Boolean, default: false },
  loading:      { type: String,  default: '' },
  hoverMessage: { type: String,  default: '' }
})
defineEmits(['click'])

const rootEl = ref(null)
const bubbleEl = ref(null)
const bubbleVisible = ref(false)
const bubbleX = ref(0)
const bubbleY = ref(0)
const arrowLeft = ref('50%')
let hideTimer = null

const MARGIN = 8

async function onHover() {
  if (!props.hoverMessage) return
  if (hideTimer) clearTimeout(hideTimer)

  const rect = rootEl.value?.getBoundingClientRect()
  if (!rect) return

  const iconCenterX = rect.left + rect.width / 2
  bubbleX.value = iconCenterX
  bubbleY.value = rect.top
  arrowLeft.value = '50%'
  bubbleVisible.value = true

  await nextTick()

  const bRect = bubbleEl.value?.getBoundingClientRect()
  if (!bRect) return

  // bubble is rendered centered on iconCenterX — check if it overflows viewport
  const halfW = bRect.width / 2
  const minX = MARGIN + halfW
  const maxX = window.innerWidth - MARGIN - halfW

  const clampedX = Math.max(minX, Math.min(iconCenterX, maxX))
  if (clampedX !== iconCenterX) {
    // shift the arrow to still point at the icon
    const offset = iconCenterX - clampedX
    arrowLeft.value = `calc(50% + ${offset}px)`
    bubbleX.value = clampedX
  }
}

function onLeave() {
  hideTimer = setTimeout(() => { bubbleVisible.value = false }, 150)
}
</script>

<style scoped>
.ia-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.ia-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--ia-bg, #FBEAF0);
  border: 1px solid var(--ia-border, #f1a1b0);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s;
}
.ia-btn--disabled,
.ia-btn:disabled { cursor: default; }
.ia-btn:not(:disabled):hover { opacity: 0.75; }
.ia-label {
  font-size: 10px;
  text-align: center;
  white-space: nowrap;
}
.ia-label--muted { color: #94a3b8; }
</style>

<style>
.ia-bubble {
  position: fixed;
  transform: translate(-50%, calc(-100% - 10px));
  background: var(--ia-bubble-bg, #993556);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 11px;
  border-radius: 14px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 9999;
  letter-spacing: 0.01em;
}
.ia-bubble::after {
  content: '';
  position: absolute;
  top: 100%;
  left: var(--ia-arrow-left, 50%);
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--ia-bubble-bg, #993556);
  border-bottom: none;
}

.ia-bubble-fade-enter-active { transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.22, 1, 0.36, 1); }
.ia-bubble-fade-leave-active { transition: opacity 0.15s ease; }
.ia-bubble-fade-enter-from { opacity: 0; transform: translate(-50%, calc(-100% - 6px)); }
.ia-bubble-fade-enter-to   { opacity: 1; transform: translate(-50%, calc(-100% - 10px)); }
.ia-bubble-fade-leave-from { opacity: 1; }
.ia-bubble-fade-leave-to   { opacity: 0; }
</style>
