<template>
  <div class="swipe-root" @touchstart.passive="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
    <div
      class="swipe-content"
      :style="contentStyle"
      @click.capture="onContentClick"
    >
      <slot />
    </div>
    <div class="swipe-actions" :style="actionsStyle">
      <button
        v-for="(action, i) in actions"
        :key="i"
        class="swipe-action-btn"
        :style="{ background: action.color, borderColor: props.borderColor ?? 'var(--panel-border)' }"
        @click.stop="handleAction(action)"
      >
        <v-icon size="16" color="#fff">{{ action.icon }}</v-icon>
        <span>{{ action.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { activeSwipeId } from '@/composables/useSwipeGroup'

const props = defineProps<{
  actions: Array<{ label: string; icon: string; color: string; handler: () => void }>
  itemId: string | number
  actionWidth?: number
  borderColor?: string
}>()

const width = computed(() => (props.actionWidth ?? 80) * props.actions.length)

const offset = ref(0)
const isDragging = ref(false)

let startX = 0
let startY = 0
let startOffset = 0
let direction: 'h' | 'v' | null = null

watch(activeSwipeId, (id) => {
  if (id !== props.itemId) offset.value = 0
})

function close() {
  offset.value = 0
}

function onTouchStart(e: TouchEvent) {
  const touch = e.touches.item(0)
  if (!touch) return
  startX = touch.clientX
  startY = touch.clientY
  startOffset = offset.value
  direction = null
  isDragging.value = true
}

function onTouchMove(e: TouchEvent) {
  const touch = e.touches.item(0)
  if (!touch) return
  const dx = touch.clientX - startX
  const dy = touch.clientY - startY

  if (!direction) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    direction = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
  }

  if (direction === 'v') return

  e.preventDefault()

  const raw = startOffset - dx
  offset.value = Math.max(0, Math.min(width.value, raw))

  if (offset.value > 0 && activeSwipeId.value !== props.itemId) {
    activeSwipeId.value = props.itemId
  }
}

function onTouchEnd() {
  isDragging.value = false
  if (direction !== 'h') return

  const draggedRight = startOffset - offset.value
  const startedOpen = startOffset >= width.value * 0.5
  const snap = startedOpen ? draggedRight < 30 : offset.value > 30

  requestAnimationFrame(() => {
    if (snap) {
      offset.value = width.value
      activeSwipeId.value = props.itemId
    } else {
      offset.value = 0
    }
  })
}

function onContentClick(e: MouseEvent) {
  if (offset.value > 0) {
    e.stopPropagation()
    close()
  }
}

function handleAction(action: { handler: () => void }) {
  close()
  action.handler()
}

const contentStyle = computed<CSSProperties>(() => ({
  transform: `translateX(-${offset.value}px)`,
  transition: isDragging.value ? 'none' : 'transform 0.22s cubic-bezier(.4,0,.2,1)',
}))

const actionsStyle = computed<CSSProperties>(() => ({
  width: width.value + 'px',
  visibility: offset.value > 0 ? 'visible' : 'hidden',
}))
</script>

<style scoped>
.swipe-root {
  position: relative;
  overflow: hidden;
  touch-action: pan-y;
}

.swipe-content {
  position: relative;
  z-index: 1;
  will-change: transform;
}

.swipe-actions {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: stretch;
  padding: 0 0 0 4px;
  gap: 1px;
  box-sizing: border-box;
}

.swipe-action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  cursor: pointer;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  padding: 0 6px;
}

@media (min-width: 768px) {
  .swipe-actions {
    display: none;
  }
}
</style>
