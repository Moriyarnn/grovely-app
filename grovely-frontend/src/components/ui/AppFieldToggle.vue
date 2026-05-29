<template>
  <button
    class="app-field-toggle"
    :class="[`app-field-toggle--${theme}`, { 'app-field-toggle--on': modelValue }]"
    type="button"
    role="checkbox"
    :aria-checked="modelValue"
    @click.stop="$emit('update:modelValue', !modelValue)"
  >
    <span class="app-field-toggle-text">{{ label }}</span>
    <span class="app-field-toggle-box">
      <v-icon v-if="modelValue" size="9" color="#fff">mdi-check</v-icon>
    </span>
  </button>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  label:      { type: String,  required: true },
  theme:      { type: String,  default: 'green' },
})
defineEmits(['update:modelValue'])
</script>

<style scoped>
.app-field-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  user-select: none;
}

.app-field-toggle-text {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  transition: color 0.12s;
}

.app-field-toggle-box {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1.5px solid #d0d0d0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.12s, border-color 0.12s;
}

/* Unchecked */
.app-field-toggle--green .app-field-toggle-text { color: #6BA888; }
.app-field-toggle--green .app-field-toggle-box  { border-color: #B8E6D0; }
.app-field-toggle--pink  .app-field-toggle-text { color: #b0788e; }
.app-field-toggle--pink  .app-field-toggle-box  { border-color: #f0c8d8; }

/* Checked: green */
.app-field-toggle--green.app-field-toggle--on .app-field-toggle-box {
  background: #2E7D52;
  border-color: #2E7D52;
}
.app-field-toggle--green.app-field-toggle--on .app-field-toggle-text { color: #2E7D52; }

/* Checked: pink */
.app-field-toggle--pink.app-field-toggle--on .app-field-toggle-box {
  background: #993556;
  border-color: #993556;
}
.app-field-toggle--pink.app-field-toggle--on .app-field-toggle-text { color: #993556; }
</style>
