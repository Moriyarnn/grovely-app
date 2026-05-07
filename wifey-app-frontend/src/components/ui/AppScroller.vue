<template>
  <div class="app-scroller" :class="`app-scroller--${theme}`">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  theme?: 'pink' | 'green' | 'neutral'
}>(), {
  theme: 'neutral'
})
</script>

<style>
.app-scroller {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: #d4d4d4 transparent;
}

.app-scroller--pink  { scrollbar-color: #F4C0D1 transparent; }
.app-scroller--green { scrollbar-color: #B8E6D0 transparent; }

.app-scroller::-webkit-scrollbar       { width: 5px; }
.app-scroller::-webkit-scrollbar-track { background: transparent; }

.app-scroller::-webkit-scrollbar-thumb {
  border-radius: 99px;
  background: #d4d4d4;
}
.app-scroller--pink::-webkit-scrollbar-thumb  { background: #F4C0D1; }
.app-scroller--green::-webkit-scrollbar-thumb { background: #B8E6D0; }

.app-scroller::-webkit-scrollbar-thumb:hover        { background: #adadad; }
.app-scroller--pink::-webkit-scrollbar-thumb:hover  { background: #dfa0bb; }
.app-scroller--green::-webkit-scrollbar-thumb:hover { background: #8eceb0; }
</style>
