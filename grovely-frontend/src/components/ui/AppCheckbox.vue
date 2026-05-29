<template>
  <button
    class="app-checkbox"
    :class="[`app-checkbox--${theme}`, { 'app-checkbox--checked': modelValue }]"
    type="button"
    :aria-checked="modelValue"
    role="checkbox"
    @click.stop="$emit('update:modelValue', !modelValue)"
  >
    <v-icon v-if="modelValue" size="14">mdi-check</v-icon>
  </button>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  theme:      { type: String, default: 'green' },
})
defineEmits(['update:modelValue'])
</script>

<style scoped>
.app-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.12s, border-color 0.12s;
}

.app-checkbox--green {
  border-color: #B8E6D0;
  color: #fff;
}
.app-checkbox--green.app-checkbox--checked {
  background: #2E7D52;
  border-color: #2E7D52;
}

.app-checkbox--pink {
  border-color: #f0c8d8;
  color: #fff;
}
.app-checkbox--pink.app-checkbox--checked {
  background: #993556;
  border-color: #993556;
}
</style>
