<template>
  <div
    class="nf-wrap"
    :class="{ 'nf-wrap--fixed': isFixed }"
    :style="isFixed ? { minHeight: fixedHeight + 'px' } : undefined"
    :data-theme="theme"
  >
    <p v-if="mode === 'view'" class="nf-view" :class="{ 'nf-view--empty': !modelValue }">
      {{ displayText }}
    </p>
    <template v-else>
      <textarea
        class="nf-input"
        :value="modelValue"
        :maxlength="max"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
    </template>

    <!-- Fixed mode: the wrap height is constant, so the flex:1 field above
         absorbs whatever height the counter takes — view↔edit never resizes
         the sheet. The label expands into that space using the same
         measure-the-target-height / animate-into-reserved-space transition
         as the notification message editor panel. -->
    <Transition
      v-if="isFixed"
      appear
      @before-enter="onCounterBeforeEnter"
      @enter="onCounterEnter"
      @leave="onCounterLeave"
      @before-appear="onCounterBeforeEnter"
      @appear="onCounterEnter"
    >
      <div
        v-if="mode === 'edit'"
        class="nf-counter-panel"
      >
        <p
          class="nf-counter"
          :class="{ 'nf-counter--warn': remaining <= 20 }"
        >
          {{ modelValue?.length ?? 0 }} / {{ max }}
        </p>
      </div>
    </Transition>
    <p
      v-else-if="mode === 'edit'"
      class="nf-counter"
      :class="{ 'nf-counter--warn': remaining <= 20 }"
    >
      {{ modelValue?.length ?? 0 }} / {{ max }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  mode:       { type: String, default: 'view' },
  max:        { type: Number, default: 500 },
  placeholder: { type: String, default: 'Add a note…' },
  emptyText:  { type: String, default: 'No notes for this day' },
  theme:      { type: String, default: 'pink' },
  // Opt-in. When set (px), the field is a fixed size instead of growing
  // with content, and view/edit modes occupy the same height. Omit to
  // keep the original content-growing behaviour.
  fixedHeight: { type: Number, default: null },
})

defineEmits(['update:modelValue'])

const isFixed = computed(() => props.fixedHeight != null)

// Measure-the-target-height / animate-into-reserved-space transition,
// mirroring the notification message editor's expanding panel. The wrap
// height is fixed, so the flex:1 field above shrinks/grows by exactly the
// counter's height — the sheet never resizes on view↔edit toggle.
function onCounterBeforeEnter(el: Element) {
  ;(el as HTMLElement).style.height = '0'
}
function onCounterEnter(el: Element, done: () => void) {
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
function onCounterLeave(el: Element, done: () => void) {
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

const remaining = computed(() => props.max - (props.modelValue?.length ?? 0))

const displayText = computed(() => {
  if (!props.modelValue) return props.emptyText
  return props.modelValue.length > props.max
    ? props.modelValue.slice(0, props.max) + '…'
    : props.modelValue
})
</script>

<style scoped>
.nf-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  --nf-bg:          #FBEAF0;
  --nf-border:      #F4C0D1;
  --nf-text:        #72243E;
  --nf-muted:       #cca7b8;
  --nf-focus:       #D4537E;
}
.nf-wrap[data-theme="green"] {
  --nf-bg:          #EAF7F0;
  --nf-border:      #B8E6D0;
  --nf-text:        #1A4D35;
  --nf-muted:       #9ECDB6;
  --nf-focus:       #2E7D52;
}

/* Fixed mode: never grows with content (content scrolls inside), but DOES
   grow to fill a fixed-height sheet on desktop. The inline min-height is the
   floor (keeps it compact on mobile's content-sized sheet); flex:1 inherited
   from .nf-wrap lets it expand to absorb desktop slack. View and edit stay
   the same height because the wrap height is layout-driven, not content. */
.nf-wrap--fixed {
  overflow: hidden;
}

.nf-view {
  font-size: 13px;
  color: var(--nf-text);
  background: var(--nf-bg);
  border: 1px solid var(--nf-border);
  border-radius: 12px;
  padding: 10px 12px;
  margin: 0;
  line-height: 1.5;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  flex: 1;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  overflow: hidden;
}
/* Long notes scroll inside the fixed box rather than growing the sheet. */
.nf-wrap--fixed .nf-view { overflow-y: auto; }
.nf-view--empty { color: var(--nf-muted); font-style: italic; }

.nf-input {
  width: 100%;
  border: 1px solid var(--nf-border);
  border-radius: 12px;
  background: var(--nf-bg);
  padding: 10px 12px;
  font-size: 13px;
  color: var(--nf-text);
  resize: none;
  line-height: 1.5;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
}
.nf-input::placeholder { color: var(--nf-muted); }
.nf-input:focus { border-color: var(--nf-focus); }

.nf-counter {
  font-size: 11px;
  color: var(--nf-muted);
  text-align: right;
  margin: 4px 0 0;
  flex-shrink: 0;
}
.nf-counter--warn { color: var(--nf-focus); }

/* Expanding panel (fixed mode only) — same height-measure transition as
   the notification message editor. overflow:hidden so the label is clipped
   while the measured height animates 0 ↔ target. */
.nf-counter-panel {
  flex-shrink: 0;
  overflow: hidden;
  transition: height 0.25s ease;
}
.nf-counter-panel .nf-counter { margin: 4px 0 0; }
</style>
