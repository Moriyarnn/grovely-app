<template>
  <span class="coming-soon-badge" :class="`coming-soon-badge--${theme}`">Coming soon</span>
</template>

<script setup>
defineProps({
  theme: { type: String, default: 'green' }
})
</script>

<style scoped>
.coming-soon-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
  border: 1.5px solid;
}

.coming-soon-badge--green {
  background: #f4fbf7;
  border-color: #B8D8C8;
  color: #6BA888;
}

.coming-soon-badge--pink {
  background: #faf4f7;
  border-color: #d4c8d0;
  color: #b0a8b9;
}
</style>
