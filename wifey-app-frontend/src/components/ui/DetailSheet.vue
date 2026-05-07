<template>
  <Teleport to="body">
    <div
      class="ds-backdrop"
      :class="[`ds-backdrop--${theme}`, { 'ds-backdrop--visible': open }]"
      @pointerdown="$emit('update:open', false)"
    />
    <div
      class="ds-sheet"
      :class="[`ds-sheet--${theme}`, { 'ds-sheet--open': open }]"
    >
      <div class="ds-inner">
        <div class="ds-handle" />
        <div class="ds-header">
          <div class="ds-header-text">
            <p class="ds-title">{{ title }}</p>
            <p v-if="subtitle" class="ds-subtitle">{{ subtitle }}</p>
          </div>
          <slot name="header-extra" />
          <button class="ds-close" @click="$emit('update:open', false)">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>
        <div class="ds-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="ds-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  open:     { type: Boolean, default: false },
  title:    { type: String,  default: '' },
  subtitle: { type: String,  default: '' },
  theme:    { type: String,  default: 'pink' }
})
defineEmits(['update:open'])
</script>

<style scoped>
/* ── Backdrop ─────────────────────────────────────────────── */
.ds-backdrop {
  position: fixed; inset: 0;
  z-index: 100;
  opacity: 0; pointer-events: none;
  transition: opacity 0.3s;
}
.ds-backdrop--visible { opacity: 1; pointer-events: all; }
.ds-backdrop--pink  { background: rgba(114, 36, 62, 0.22); }
.ds-backdrop--green { background: rgba(26,  77, 53, 0.22); }

/* ── Sheet shell ──────────────────────────────────────────── */
.ds-sheet {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  background: #fff;
  border-radius: 20px 20px 0 0;
  z-index: 101;
  transform: translateY(105%);
  transition: transform 0.35s cubic-bezier(.4, 0, .2, 1);
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.ds-sheet--open { transform: translateY(0); }

.ds-sheet { scrollbar-width: thin; scrollbar-color: #d4d4d4 transparent; }
.ds-sheet--pink  { scrollbar-color: #F4C0D1 transparent; }
.ds-sheet--green { scrollbar-color: #B8E6D0 transparent; }

.ds-sheet::-webkit-scrollbar       { width: 5px; }
.ds-sheet::-webkit-scrollbar-track { background: transparent; }
.ds-sheet::-webkit-scrollbar-thumb { border-radius: 99px; background: #d4d4d4; }
.ds-sheet--pink::-webkit-scrollbar-thumb  { background: #F4C0D1; }
.ds-sheet--green::-webkit-scrollbar-thumb { background: #B8E6D0; }
.ds-sheet::-webkit-scrollbar-thumb:hover        { background: #adadad; }
.ds-sheet--pink::-webkit-scrollbar-thumb:hover  { background: #dfa0bb; }
.ds-sheet--green::-webkit-scrollbar-thumb:hover { background: #8eceb0; }

/* ── Inner padding ────────────────────────────────────────── */
.ds-inner {
  padding: 0 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* ── Body (fills space, pushes footer down) ───────────────── */
.ds-body { flex: 1; display: flex; flex-direction: column; min-height: 0; }

/* ── Handle (mobile only) ─────────────────────────────────── */
.ds-handle {
  width: 36px; height: 4px;
  border-radius: 2px;
  margin: 12px auto 16px;
  flex-shrink: 0;
}
.ds-sheet--pink  .ds-handle { background: #F4C0D1; }
.ds-sheet--green .ds-handle { background: #B8E6D0; }

/* ── Header ───────────────────────────────────────────────── */
.ds-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 1.25rem;
  gap: 8px;
  flex-shrink: 0;
}
.ds-header-text { flex: 1; min-width: 0; }
.ds-title    { font-size: 15px; font-weight: 600; margin: 0 0 2px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-subtitle { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ds-sheet--pink  .ds-title    { color: #72243E; }
.ds-sheet--pink  .ds-subtitle { color: #993556; }
.ds-sheet--green .ds-title    { color: #1A4D35; }
.ds-sheet--green .ds-subtitle { color: #2E7D52; }

/* ── Close button ─────────────────────────────────────────── */
.ds-close {
  flex-shrink: 0;
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: opacity 0.15s;
}
.ds-close:hover { opacity: 0.75; }
.ds-sheet--pink  .ds-close { border: 1px solid #F4C0D1; background: #FBEAF0; color: #993556; }
.ds-sheet--green .ds-close { border: 1px solid #B8E6D0; background: #EAF7F0; color: #2E7D52; }

/* ── Footer action bar ────────────────────────────────────── */
.ds-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 14px;
  margin-top: 16px;
  border-top: 1px solid;
  flex-shrink: 0;
}
.ds-sheet--pink  .ds-footer { border-color: #f0e8ec; }
.ds-sheet--green .ds-footer { border-color: #B8E6D0; }

/* ── Desktop: centered modal ──────────────────────────────── */
@media (min-width: 1280px) {
  .ds-sheet {
    bottom: auto; left: 50%; right: auto;
    top: 50%;
    width: min(600px, 90vw);
    height: min(640px, 88vh);
    border-radius: 20px;
    transform: translate(-50%, -50%) scale(0.94);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.22s cubic-bezier(.4, 0, .2, 1), opacity 0.22s;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.08);
  }
  .ds-sheet--open {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
    pointer-events: all;
  }
  .ds-handle { display: none; }
  .ds-inner  { padding: 1.75rem 2rem 2.25rem; }
  .ds-title  { font-size: 17px; }
}
</style>
