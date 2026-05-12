<template>
  <span class="premium-badge" :class="`premium-badge--${theme}`">
    <v-icon size="11" :color="iconColor">mdi-lock</v-icon>
    Premium
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  theme: { type: String, default: 'green' }
})

const iconColor = computed(() => {
  if (props.theme === 'pink') return '#c4a8b8'
  if (props.theme === 'neutral') return '#b0b0b0'
  return '#8fbfa8'
})
</script>

<style scoped>
.premium-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
  border: 1.5px solid;
}

.premium-badge--green {
  background: #f4fbf7;
  border-color: #B8D8C8;
  color: #6BA888;
}

.premium-badge--pink {
  background: #faf4f7;
  border-color: #d4c8d0;
  color: #b0a8b9;
}

.premium-badge--neutral {
  background: #f5f5f5;
  border-color: #e0e0e0;
  color: #999;
}
</style>
