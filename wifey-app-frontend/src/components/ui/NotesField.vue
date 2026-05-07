<template>
  <div class="nf-wrap" :data-theme="theme">
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
      <p class="nf-counter" :class="{ 'nf-counter--warn': remaining <= 20 }">
        {{ modelValue?.length ?? 0 }} / {{ max }}
      </p>
    </template>
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
})

defineEmits(['update:modelValue'])

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
</style>
