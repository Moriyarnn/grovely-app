<template>
  <Teleport to="body">
    <Transition name="tutorial-fade">
      <div v-if="visible" class="tutorial-backdrop" :style="cssVars">
        <div class="tutorial-card" :class="{ 'tutorial-card--premium': variant === 'premium' }">

          <!-- Close — hidden for all tutorials so the storage key is always set on dismiss -->
          <button v-if="false" class="btn-close-x" @click="quickClose" aria-label="Close">
            <v-icon size="18" :color="t.iconMuted">mdi-close</v-icon>
          </button>

          <!-- Premium chip — direct, no theatre. Sits above the dots so it reads as a label, not a banner. -->
          <div v-if="variant === 'premium'" class="premium-chip">
            <v-icon size="11" :color="t.accent">mdi-lock-open-outline</v-icon>
            <span>Premium feature</span>
          </div>

          <!-- Dots — hidden when there's only one slide -->
          <div v-if="slideCount > 1" class="tutorial-dots">
            <span v-for="i in slideCount" :key="i" class="dot" :class="{ active: slide === i }" />
          </div>

          <!-- Slide content — caller renders via scoped slot -->
          <div ref="slideWrapper" class="slide-wrapper">
            <Transition name="slide-fx" mode="out-in"
              @before-leave="onBeforeLeave"
              @enter="onEnter"
              @after-enter="onAfterEnter">
              <div :key="slide" class="slide-content">
                <slot :slide="slide" />
              </div>
            </Transition>
          </div>

          <!-- Actions -->
          <div class="tutorial-actions">
            <button v-if="slide < slideCount" class="btn-skip" @click="dismiss">Skip</button>
            <button class="btn-next" @click="next">
              {{ slide < slideCount ? 'Next' : 'Got it' }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'

const props = defineProps({
  storageKey: { type: String, required: true },
  forceOpen:  { type: Boolean, default: false },
  slideCount: { type: Number, default: 1 },
  variant:    { type: String, default: 'normal' }, // 'normal' | 'premium'
  theme:      { type: [String, Object], default: 'rose' },
  // Auto-show on first visit when storageKey is unset. Defaults to true for normal variant,
  // false for premium (premium tutorials are opened explicitly when the license unlocks).
  autoShowFirstTime: { type: Boolean, default: null },
})
const emit = defineEmits(['close', 'slide-change'])

// ── Theme tokens ─────────────────────────────────────────────────
const THEMES = {
  rose: {
    backdrop:  'rgba(30, 8, 16, 0.62)',
    accent:    '#D4537E',
    accentDark:'#993556',
    accentText:'#72243E',
    textMuted: '#a06070',
    iconMuted: '#c0899b',
    dot:       '#f0d0dc',
    chipBg:    '#FBEAF0',
    chipBorder:'#f0c0d0',
    shadow:    '0 12px 44px rgba(180, 40, 80, 0.22)',
    btnHover:  '#b83d68',
    hoverBg:   '#f5e8ed',
  },
  mint: {
    backdrop:  'rgba(8, 28, 18, 0.62)',
    accent:    '#5ba37f',
    accentDark:'#3a7d5e',
    accentText:'#1f3d2e',
    textMuted: '#6f8a7a',
    iconMuted: '#8da89a',
    dot:       '#cfe5d7',
    chipBg:    '#EEF7F1',
    chipBorder:'#c8e0d1',
    shadow:    '0 12px 44px rgba(40, 110, 70, 0.22)',
    btnHover:  '#2f6a4d',
    hoverBg:   '#e8f3ec',
  },
}

const t = computed(() => {
  if (typeof props.theme === 'object') return { ...THEMES.rose, ...props.theme }
  return THEMES[props.theme] ?? THEMES.rose
})

// Expose as CSS variables so the scoped styles can be theme-driven without :style on every node
const cssVars = computed(() => ({
  '--tt-backdrop':   t.value.backdrop,
  '--tt-accent':     t.value.accent,
  '--tt-accent-dk':  t.value.accentDark,
  '--tt-accent-tx':  t.value.accentText,
  '--tt-text-mute':  t.value.textMuted,
  '--tt-icon-mute':  t.value.iconMuted,
  '--tt-dot':        t.value.dot,
  '--tt-chip-bg':    t.value.chipBg,
  '--tt-chip-br':    t.value.chipBorder,
  '--tt-shadow':     t.value.shadow,
  '--tt-btn-hover':  t.value.btnHover,
  '--tt-hover-bg':   t.value.hoverBg,
}))

// ── Visibility ────────────────────────────────────────────────────
const defaultAutoShow = props.autoShowFirstTime ?? (props.variant === 'normal')
const visible = ref(defaultAutoShow && !localStorage.getItem(props.storageKey))
const slide   = ref(1)

watch(() => props.forceOpen, (val) => {
  if (val) { visible.value = true; slide.value = 1; emit('slide-change', 1) }
})

watch(slide, (v) => emit('slide-change', v))

function next() {
  if (slide.value < props.slideCount) slide.value++
  else dismiss()
}

function dismiss() {
  visible.value = false
  localStorage.setItem(props.storageKey, '1')
  emit('close')
}

// Close without persisting (× button): user dismissed it without finishing.
// For consistency with the old behaviour we still persist on Skip but not on ×.
function quickClose() {
  visible.value = false
  emit('close')
}

// ── Slide height animation ───────────────────────────────────
const slideWrapper = ref(null)

function onBeforeLeave() {
  const w = slideWrapper.value
  if (w) w.style.height = w.scrollHeight + 'px'
}

function onEnter(el) {
  const w = slideWrapper.value
  if (!w) return
  nextTick(() => {
    w.style.height = el.scrollHeight + 'px'
  })
}

function onAfterEnter() {
  const w = slideWrapper.value
  if (w) w.style.height = 'auto'
}

onUnmounted(() => { /* no-op; consumers manage their own timers */ })
</script>

<style scoped>
/* ── Backdrop ─────────────────────────────────────────────────── */
.tutorial-backdrop {
  position: fixed;
  inset: 0;
  background: var(--tt-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 24px;
}

.tutorial-fade-enter-active,
.tutorial-fade-leave-active { transition: opacity 0.35s ease; }
.tutorial-fade-enter-from,
.tutorial-fade-leave-to     { opacity: 0; }

/* ── Card ─────────────────────────────────────────────────────── */
.tutorial-card {
  position: relative;
  background: #fff;
  border-radius: 26px;
  width: 100%;
  max-width: min(90vw, 480px);
  padding: clamp(30px, 5vh, 52px) clamp(24px, 6vw, 36px) clamp(24px, 4vh, 40px);
  box-shadow: var(--tt-shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(20px, 3vh, 34px);
}

/* Premium variant: subtle accent ring around the card — small but unmistakable */
.tutorial-card--premium {
  box-shadow: var(--tt-shadow), 0 0 0 1px var(--tt-chip-br);
}

.btn-close-x {
  position: absolute;
  top: 14px;
  right: 16px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-close-x:hover { background: var(--tt-hover-bg); }

/* ── Premium chip ─────────────────────────────────────────────── */
.premium-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--tt-chip-bg);
  border: 1px solid var(--tt-chip-br);
  border-radius: 999px;
  padding: 4px 10px 4px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--tt-accent-dk);
  margin-bottom: -8px; /* tighten gap to dots below; the card's own gap is generous */
}

/* ── Dots ─────────────────────────────────────────────────────── */
.tutorial-dots { display: flex; gap: 8px; }
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tt-dot);
  transition: background 0.25s, transform 0.25s;
}
.dot.active {
  background: var(--tt-accent);
  transform: scale(1.3);
}

/* ── Slide wrapper (height animation) ────────────────────────── */
.slide-wrapper {
  width: 100%;
  overflow: hidden;
  transition: height 0.35s ease;
}

/* ── Slide transition ─────────────────────────────────────────── */
.slide-fx-enter-active { transition: all 0.28s ease; }
.slide-fx-leave-active { transition: all 0.22s ease; }
.slide-fx-enter-from   { opacity: 0; transform: translateX(22px); }
.slide-fx-leave-to     { opacity: 0; transform: translateX(-22px); }

.slide-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  width: 100%;
}

/* ── Actions ──────────────────────────────────────────────────── */
.tutorial-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
  margin-top: 2px;
}
.btn-skip {
  font-size: 14px;
  color: var(--tt-icon-mute);
  background: none;
  border: none;
  cursor: pointer;
  padding: 9px 6px;
}
.btn-next {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: var(--tt-accent);
  border: none;
  border-radius: 22px;
  padding: 10px 28px;
  cursor: pointer;
  transition: background 0.18s;
}
.btn-next:active { background: var(--tt-btn-hover); }
</style>
