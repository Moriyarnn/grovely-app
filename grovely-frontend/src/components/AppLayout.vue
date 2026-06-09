<template>
  <div class="app-layout" :class="{ 'app-layout--mobile': isMobile, 'app-layout--tablet': isTablet, 'app-layout--settling': (isMobile || isTablet) && isSettling }" :style="rootStyle" @touchend="onTouchEnd">

    <!-- Phone (<600px): full-width swipe through all panels -->
    <template v-if="isMobile">
      <div class="swipe-track" ref="swipeTrack" @scroll.passive="onScroll">
        <div class="swipe-panel"><slot /></div>
        <div v-if="hasCol2" class="swipe-panel"><slot name="col2" /></div>
        <div v-if="hasCol3" class="swipe-panel"><slot name="col3" /></div>
      </div>
      <div v-if="panelCount > 1" class="dots dots--mobile">
        <button
          v-for="i in panelCount" :key="i"
          class="dot" :class="{ 'dot--active': activeIndex === i - 1 }"
          @click="goTo(i - 1)"
        />
      </div>
    </template>

    <!-- Tablet (600px-1023px): 2-col grid, right col swipes col2↔col3 -->
    <template v-else-if="isTablet">
      <div class="app-main-panel"><slot /></div>
      <div v-if="hasCol2" class="app-side-panel" :class="{ 'app-side-panel--swiping': hasCol3 }">
        <template v-if="hasCol3">
          <div class="swipe-track swipe-track--inner" ref="swipeTrack" @scroll.passive="onScroll">
            <div class="swipe-panel"><slot name="col2" /></div>
            <div class="swipe-panel"><slot name="col3" /></div>
          </div>
          <div class="dots dots--inner">
            <button
              v-for="i in 2" :key="i"
              class="dot" :class="{ 'dot--active': activeIndex === i - 1 }"
              @click="goTo(i - 1)"
            />
          </div>
        </template>
        <template v-else>
          <slot name="col2" />
        </template>
      </div>
    </template>

    <!-- Desktop (>=1024px): 3-col grid, no swipe -->
    <template v-else>
      <div class="app-main-panel"><slot /></div>
      <div v-if="hasCol2" class="app-side-panel"><slot name="col2" /></div>
      <div v-if="hasCol3" class="app-side-panel"><slot name="col3" /></div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, useSlots, onMounted, onUnmounted, watch, nextTick, provide } from 'vue'

const props = defineProps({
  panelBg:     { type: String, default: '#fdf5f8' },
  panelBorder: { type: String, default: '#f0e8ec' },
})

const slots = useSlots()
const hasCol2 = computed(() => !!slots.col2)
const hasCol3 = computed(() => !!slots.col3)
const panelCount = computed(() => 1 + (hasCol2.value ? 1 : 0) + (hasCol3.value ? 1 : 0))

const isMobile = ref(typeof window !== 'undefined'
  ? window.matchMedia('(max-width: 1023px)').matches : false)
const isTablet = ref(typeof window !== 'undefined'
  ? window.matchMedia('(min-width: 1024px) and (max-width: 1439px)').matches : false)

let mqMobile, mqTablet
function updateBreakpoints() {
  isMobile.value = mqMobile.matches
  isTablet.value = mqTablet.matches
}

onMounted(() => {
  mqMobile = window.matchMedia('(max-width: 1023px)')
  mqTablet = window.matchMedia('(min-width: 1024px) and (max-width: 1439px)')
  mqMobile.addEventListener('change', updateBreakpoints)
  mqTablet.addEventListener('change', updateBreakpoints)
  window.visualViewport?.addEventListener('resize', onViewportResize)
})

onUnmounted(() => {
  mqMobile?.removeEventListener('change', updateBreakpoints)
  mqTablet?.removeEventListener('change', updateBreakpoints)
  window.visualViewport?.removeEventListener('resize', onViewportResize)
  clearTimeout(settleTimer)
})

// Track visual viewport height so layout follows URL bar smoothly
const mobileHeight = ref(typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 600)
const isSettling = ref(false)
let settleTimer = null

function onViewportResize() {
  mobileHeight.value = window.visualViewport?.height ?? window.innerHeight
}

function onTouchEnd() {
  isSettling.value = true
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => { isSettling.value = false }, 350)
}

// Swipe state
const swipeTrack = ref(null)
const activeIndex = ref(0)

function onScroll() {
  const el = swipeTrack.value
  if (!el) return
  activeIndex.value = Math.round(el.scrollLeft / el.clientWidth)
}

function goTo(index) {
  const el = swipeTrack.value
  if (!el) return
  el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  activeIndex.value = index
}

provide('appLayoutGoTo', goTo)

watch([isMobile, isTablet], async () => {
  activeIndex.value = 0
  await nextTick()
  swipeTrack.value?.scrollTo({ left: 0, behavior: 'instant' })
})

const cssVars = computed(() => ({
  '--panel-bg':     props.panelBg,
  '--panel-border': props.panelBorder,
}))

const rootStyle = computed(() => ({
  ...cssVars.value,
  ...((isMobile.value || isTablet.value) ? { height: mobileHeight.value + 'px' } : {}),
}))
</script>

<style scoped>
/* ── Mobile + Tablet shared layout ───────────────────────────── */
.app-layout--mobile,
.app-layout--tablet {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-layout--settling {
  transition: height 250ms ease-out;
}

/* ── Swipe track ─────────────────────────────────────────────── */
.swipe-track {
  display: flex;
  overflow-x: scroll;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  touch-action: pan-x;
}
.swipe-track::-webkit-scrollbar { display: none; }

.app-layout--mobile .swipe-track {
  flex: 1;
  min-height: 0;
}

.swipe-panel {
  width: 100%;
  flex-shrink: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  background: var(--panel-bg);
}

.app-layout--mobile .swipe-panel {
  height: 100%;
  overflow: hidden;
}

/* ── Dots ─────────────────────────────────────────────────────── */
.dots {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e0e0e0;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.dot--active {
  background: #993556;
  transform: scale(1.25);
}

.dots--mobile {
  flex-shrink: 0;
  padding: 10px 0 calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #f0f0f0;
}

/* ── Tablet (600px-1023px): 2-col grid ───────────────────────── */
@media (min-width: 1024px) and (max-width: 1439px) {
  .app-layout--tablet {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: stretch;
    height: 100dvh;
    padding: 0 1.25rem;
    box-sizing: border-box;
  }

  .app-main-panel {
    background: var(--panel-bg, #fdf5f8);
    border-radius: 16px;
    border: 1px solid var(--panel-border, #f0e8ec);
    min-height: 200px;
    margin-top: 1.25rem;
    margin-bottom: 1.25rem;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .app-main-panel::-webkit-scrollbar { display: none; }

  .app-side-panel {
    display: block;
    background: var(--panel-bg, #fdf5f8);
    border-radius: 16px;
    border: 1px solid var(--panel-border, #f0e8ec);
    min-height: 200px;
    margin-top: 1.25rem;
    margin-bottom: 1.25rem;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .app-side-panel::-webkit-scrollbar { display: none; }

  .app-side-panel--swiping {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .swipe-track--inner {
    flex: 1;
  }

  .dots--inner {
    flex-shrink: 0;
    padding: 8px 0;
    border-top: 1px solid var(--panel-border, #f0e8ec);
  }
}

/* ── Desktop (>=1440px): 3-col grid ──────────────────────────── */
@media (min-width: 1440px) {
  .app-layout {
    display: grid;
    grid-template-columns: 7fr 8fr 8fr;
    gap: 1rem;
    align-items: stretch;
    height: 100dvh;
    padding: 0 1.25rem;
    box-sizing: border-box;
  }

  .app-main-panel {
    background: var(--panel-bg, #fdf5f8);
    border-radius: 16px;
    border: 1px solid var(--panel-border, #f0e8ec);
    min-height: 200px;
    margin-top: 1.25rem;
    margin-bottom: 1.25rem;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .app-main-panel::-webkit-scrollbar { display: none; }

  .app-side-panel {
    display: block;
    background: var(--panel-bg, #fdf5f8);
    border-radius: 16px;
    border: 1px solid var(--panel-border, #f0e8ec);
    min-height: 200px;
    margin-top: 1.25rem;
    margin-bottom: 1.25rem;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .app-side-panel::-webkit-scrollbar { display: none; }
}
</style>
