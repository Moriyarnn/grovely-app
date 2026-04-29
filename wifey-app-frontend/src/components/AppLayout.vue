<template>
  <div class="app-layout" :class="{ 'app-layout--mobile': isMobile, 'app-layout--settling': isMobile && isSettling }" :style="rootStyle" @touchend="onTouchEnd">

    <!-- Mobile (<1280px): full-width swipe through all panels -->
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

    <!-- Medium (1280–1599px): 2-col grid, right col swipes col2↔col3 -->
    <template v-else-if="isMedium">
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

    <!-- Large (≥1600px): 3-col grid, no swipe -->
    <template v-else>
      <div class="app-main-panel"><slot /></div>
      <div v-if="hasCol2" class="app-side-panel"><slot name="col2" /></div>
      <div v-if="hasCol3" class="app-side-panel app-side-panel--third"><slot name="col3" /></div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, useSlots, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  panelBg:     { type: String, default: '#fdf5f8' },
  panelBorder: { type: String, default: '#f0e8ec' },
})

const slots = useSlots()
const hasCol2 = computed(() => !!slots.col2)
const hasCol3 = computed(() => !!slots.col3)
const panelCount = computed(() => 1 + (hasCol2.value ? 1 : 0) + (hasCol3.value ? 1 : 0))

// Initialise synchronously so there's no layout flash on first paint
const isMobile = ref(typeof window !== 'undefined'
  ? window.matchMedia('(max-width: 1279px)').matches : false)
const isMedium = ref(typeof window !== 'undefined'
  ? window.matchMedia('(min-width: 1280px) and (max-width: 1599px)').matches : false)

let mqMobile, mqMedium
function updateBreakpoints() {
  isMobile.value = mqMobile.matches
  isMedium.value = mqMedium.matches
}

onMounted(() => {
  mqMobile = window.matchMedia('(max-width: 1279px)')
  mqMedium = window.matchMedia('(min-width: 1280px) and (max-width: 1599px)')
  mqMobile.addEventListener('change', updateBreakpoints)
  mqMedium.addEventListener('change', updateBreakpoints)
  window.visualViewport?.addEventListener('resize', onViewportResize)
})

onUnmounted(() => {
  mqMobile?.removeEventListener('change', updateBreakpoints)
  mqMedium?.removeEventListener('change', updateBreakpoints)
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
  // Briefly enable height transition so the final viewport jump animates instead of teleporting
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

// Reset to first panel when breakpoint changes
watch([isMobile, isMedium], async () => {
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
  ...(isMobile.value ? { height: mobileHeight.value + 'px' } : {}),
}))
</script>

<style scoped>
/* ── Mobile layout container ─────────────────────────────────── */
.app-layout--mobile {
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
  touch-action: pan-x; /* only claim horizontal gestures so vertical scroll reaches column roots */
}
.swipe-track::-webkit-scrollbar { display: none; }

/* Mobile: fill remaining height so dots sit at the bottom */
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

/* Mobile panels are bounded; column roots own vertical scrolling */
.app-layout--mobile .swipe-panel {
  height: 100%;
  overflow: hidden;
}

/* ── Dots shared ─────────────────────────────────────────────── */
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

/* ── Mobile dots: anchored to bottom of the flex layout ─────── */
.dots--mobile {
  flex-shrink: 0;
  padding: 10px 0 calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #f0f0f0;
}

/* ── Medium desktop (1280–1599px): 2-col grid ───────────────── */
@media (min-width: 1280px) {
  .app-layout {
    display: grid;
    grid-template-columns: minmax(0, 560px) 1fr;
    gap: 1rem;
    align-items: start;
    min-height: 100vh;
    padding: 0 1.25rem;
    box-sizing: border-box;
  }

  .app-main-panel {
    background: var(--panel-bg, #fdf5f8);
    border-radius: 16px;
    border: 1px solid var(--panel-border, #f0e8ec);
    min-height: 200px;
    margin-top: 1.25rem;
  }

  .app-side-panel {
    display: block;
    background: var(--panel-bg, #fdf5f8);
    border-radius: 16px;
    border: 1px solid var(--panel-border, #f0e8ec);
    min-height: 200px;
    margin-top: 1.25rem;
  }

  /* When right panel hosts an inner swiper */
  .app-side-panel--swiping {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .swipe-track--inner {
    flex: 1;
  }

  /* Desktop inner dots: sit at bottom of the right column card */
  .dots--inner {
    flex-shrink: 0;
    padding: 8px 0;
    border-top: 1px solid var(--panel-border, #f0e8ec);
  }
}

/* ── Large desktop (≥1600px): 3-col grid ───────────────────── */
@media (min-width: 1600px) {
  .app-layout {
    grid-template-columns: minmax(0, 560px) 1fr 1fr;
  }

  .app-side-panel--third {
    display: block;
  }
}
</style>
