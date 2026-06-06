<template>
  <Teleport to="body">
    <div
      class="ds-backdrop"
      :class="[`ds-backdrop--${theme}`, { 'ds-backdrop--visible': open }]"
      @pointerdown.prevent="$emit('update:open', false)"
    />
    <div
      class="ds-sheet"
      :class="[`ds-sheet--${theme}`, `ds-sheet--size-${size}`, `ds-sheet--scroll-${scroll}`, { 'ds-sheet--open': open, 'ds-sheet--mh': mobileHeight, 'ds-sheet--hug': hugContent }]"
      :style="mobileHeight ? { '--ds-mh': mobileHeight } : undefined"
    >
      <div class="ds-inner">
        <div class="ds-handle" />
        <div class="ds-header">
          <div class="ds-header-text">
            <p class="ds-title">{{ title }}</p>
            <p
              v-if="subtitle"
              class="ds-subtitle"
              :class="`ds-subtitle--${subtitleStyle}`"
            >{{ subtitle }}</p>
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
import { watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  open:     { type: Boolean, default: false },
  title:    { type: String,  default: '' },
  subtitle: { type: String,  default: '' },
  theme:    { type: String,  default: 'pink' },
  // Strictly opt-in. Omit (or 'default') = byte-for-byte the original
  // 600x640 desktop / 85vh mobile sizing. 'large' is for content-heavy
  // sheets (e.g. per-app settings). Adding a size here must never change
  // the default — existing consumers (PantryShoppingList et al.) rely on it.
  size:     { type: String,  default: 'default' }, // 'default' | 'large'
  // Strictly opt-in, same rule as `size`. 'sheet' (default) = the whole
  // sheet scrolls — required by PantryShoppingList/PremiumGate which have
  // NO inner scroller. 'contained' = sheet does not scroll; the body is a
  // flex container and inner content owns its own scroll zones (the
  // NotificationMessagesView pattern: pinned header + scrolling list).
  scroll:   { type: String,  default: 'sheet' }, // 'sheet' | 'contained'
  // 'label' (default) = uppercase, bold, letter-spaced — for short
  // metadata (e.g. PantryShoppingList "category · qty"). 'plain' =
  // normal-case descriptive sentence sitting tight under the title.
  subtitleStyle: { type: String, default: 'label' }, // 'label' | 'plain'
  // Strictly opt-in, same rule as `size`/`scroll`. When set (any CSS length,
  // e.g. '70vh'), the sheet takes this fixed height on mobile (<1280px)
  // instead of sizing to content — used to make sibling sheets the same
  // size. Empty (default) = original content-sized behaviour, untouched.
  // Sheet-level scroll is preserved (overflow-y stays auto), so the #143
  // small-screen scroll fallback still works.
  mobileHeight: { type: String, default: '' },
  // Strictly opt-in. When true, the desktop modal sizes to its content
  // (height: auto, capped at 88vh, still scrolls past that) instead of the
  // fixed min(640px, 88vh). Use for short sheets where the fixed height
  // would leave an awkward empty band. Default false = original sizing.
  hugContent: { type: Boolean, default: false }
})
defineEmits(['update:open'])

// ── Body scroll lock (mobile-safety, applied unconditionally) ──────────────
// Without this the page behind the sheet scrolls / rubber-bands on mobile.
// position:fixed drops scroll position, so we save and restore it.
let savedScrollY = 0

function lockBody() {
  savedScrollY = window.scrollY
  const b = document.body.style
  b.position = 'fixed'
  b.top      = `-${savedScrollY}px`
  b.left     = '0'
  b.right    = '0'
  b.width    = '100%'
  b.overflow = 'hidden'
}

function unlockBody() {
  const b = document.body.style
  b.position = ''
  b.top      = ''
  b.left     = ''
  b.right    = ''
  b.width    = ''
  b.overflow = ''
  window.scrollTo(0, savedScrollY)
}

// Capture-phase, non-passive: the body lock alone isn't enough on iOS
// Safari. Allow touch-scroll inside the sheet; block it on the backdrop.
function onDocTouchMove(e) {
  if (!props.open) return
  const el = e.target
  if (el && el.closest && el.closest('.ds-sheet')) return
  e.preventDefault()
}

watch(() => props.open, (open, prev) => {
  if (open === prev) return
  if (open) lockBody()
  else unlockBody()
})

onMounted(() => {
  document.addEventListener('touchmove', onDocTouchMove, { passive: false, capture: true })
  if (props.open) lockBody()
})

onBeforeUnmount(() => {
  document.removeEventListener('touchmove', onDocTouchMove, { capture: true })
  if (props.open) unlockBody()
})
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
.ds-backdrop--pink    { background: rgba(114, 36, 62, 0.22); }
.ds-backdrop--green   { background: rgba(26,  77, 53, 0.22); }
.ds-backdrop--neutral { background: rgba(0,   0,  0,  0.32); }

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
.ds-sheet--pink    { scrollbar-color: #F4C0D1 transparent; }
.ds-sheet--green   { scrollbar-color: #B8E6D0 transparent; }
/* Neutral: white sheet like the others; only accents go grey. */
.ds-sheet--neutral { scrollbar-color: #c7c7cc transparent; }

.ds-sheet::-webkit-scrollbar       { width: 5px; }
.ds-sheet::-webkit-scrollbar-track { background: transparent; }
.ds-sheet::-webkit-scrollbar-thumb { border-radius: 99px; background: #d4d4d4; }
.ds-sheet--pink::-webkit-scrollbar-thumb    { background: #F4C0D1; }
.ds-sheet--green::-webkit-scrollbar-thumb   { background: #B8E6D0; }
.ds-sheet--neutral::-webkit-scrollbar-thumb { background: #c7c7cc; }
.ds-sheet::-webkit-scrollbar-thumb:hover          { background: #adadad; }
.ds-sheet--pink::-webkit-scrollbar-thumb:hover    { background: #dfa0bb; }
.ds-sheet--green::-webkit-scrollbar-thumb:hover   { background: #8eceb0; }
.ds-sheet--neutral::-webkit-scrollbar-thumb:hover { background: #adadad; }

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
.ds-sheet--pink    .ds-handle { background: #F4C0D1; }
.ds-sheet--green   .ds-handle { background: #B8E6D0; }
.ds-sheet--neutral .ds-handle { background: #d4d4d4; }

/* ── Header ───────────────────────────────────────────────── */
.ds-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 1.25rem;
  gap: 8px;
  flex-shrink: 0;
}
.ds-header-text { flex: 1; min-width: 0; }
.ds-title    { font-size: 15px; font-weight: 600; margin: 0 0 2px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-subtitle { font-size: 11px; margin: 0; }
.ds-subtitle--label {
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ds-subtitle--plain {
  font-size: 12px; font-weight: 400; line-height: 1.4; margin-top: 3px;
}

.ds-sheet--pink    .ds-title    { color: #72243E; }
.ds-sheet--pink    .ds-subtitle { color: #993556; }
.ds-sheet--green   .ds-title    { color: #1A4D35; }
.ds-sheet--green   .ds-subtitle { color: #2E7D52; }
.ds-sheet--neutral .ds-title    { color: #1a1a1a; }
.ds-sheet--neutral .ds-subtitle { color: #8e8e93; }

/* ── Close button ─────────────────────────────────────────── */
.ds-close {
  flex-shrink: 0;
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: opacity 0.15s;
}
.ds-close:hover { opacity: 0.75; }
.ds-sheet--pink    .ds-close { border: 1px solid #F4C0D1; background: #FBEAF0; color: #993556; }
.ds-sheet--green   .ds-close { border: 1px solid #B8E6D0; background: #EAF7F0; color: #2E7D52; }
.ds-sheet--neutral .ds-close { border: 1px solid #e0e0e0; background: #f5f5f5; color: #555;    }

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
.ds-sheet--pink    .ds-footer { border-color: #f0e8ec; }
.ds-sheet--green   .ds-footer { border-color: #B8E6D0; }
.ds-sheet--neutral .ds-footer { border-color: #ececec; }

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

/* ── Size: large (opt-in only) ─────────────────────────────────
   'default' adds no rules, so omitting size leaves the original
   sizing untouched. 'large' is for content-heavy sheets. */
.ds-sheet--size-large { max-height: 92vh; }

@media (min-width: 1280px) {
  .ds-sheet--size-large {
    width: min(680px, 92vw);
    height: min(760px, 90vh);
  }
}

/* ── Scroll: contained (opt-in only) ───────────────────────────
   'sheet' (default) adds no rules — the whole sheet scrolls, which
   PantryShoppingList depends on for its tall edit form. (PremiumGate
   also uses the default but its content is short and never scrolls.)
   'contained' stops the sheet itself from scrolling and gives it a
   definite height on mobile so an inner region (e.g. NM's type list)
   owns the scroll while header/footer stay pinned. Desktop height
   comes from the size rules above; here we only suppress
   sheet-level scroll. */
.ds-sheet--scroll-contained { overflow: hidden; }
.ds-sheet--scroll-contained .ds-body { overflow: hidden; }

@media (max-width: 1279px) {
  .ds-sheet--scroll-contained { height: 88vh; }
}

/* ── Mobile fixed height (opt-in only) ─────────────────────────
   Only on mobile; desktop height comes from the size rules above.
   overflow-y stays auto (inherited from .ds-sheet) so the sheet
   still scrolls if content ever exceeds this height. */
@media (max-width: 1279px) {
  .ds-sheet--mh { height: var(--ds-mh); }
}

/* ── Desktop hug-content (opt-in only) ─────────────────────────
   Override the fixed desktop height so the modal sizes to content.
   Single-class selector, declared after the base .ds-sheet desktop
   rule, so it wins by source order. overflow-y stays auto, so very
   tall content still scrolls within the 88vh cap. */
@media (min-width: 1280px) {
  .ds-sheet--hug { height: auto; max-height: 88vh; }
}
</style>
