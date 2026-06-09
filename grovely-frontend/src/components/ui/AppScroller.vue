<template>
  <div class="app-scroller" :class="[`app-scroller--${theme}`, { 'app-scroller--always': alwaysVisible }]">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  theme?: 'pink' | 'green' | 'neutral'
  alwaysVisible?: boolean
}>(), {
  theme: 'neutral',
  alwaysVisible: false
})
</script>

<style>
.app-scroller {
  overflow-y: auto;
  overflow-x: hidden;
}

.app-scroller.app-scroller--always {
  scrollbar-width: thin;
  scrollbar-color: #d4d4d4 transparent;
}

.app-scroller--always.app-scroller--pink  { scrollbar-color: #F4C0D1 transparent; }
.app-scroller--always.app-scroller--green { scrollbar-color: #B8E6D0 transparent; }

.app-scroller--always::-webkit-scrollbar       { width: 5px; }
.app-scroller--always::-webkit-scrollbar-track { background: transparent; }

.app-scroller--always::-webkit-scrollbar-thumb {
  border-radius: 99px;
  background: #d4d4d4;
}
.app-scroller--always.app-scroller--pink::-webkit-scrollbar-thumb  { background: #F4C0D1; }
.app-scroller--always.app-scroller--green::-webkit-scrollbar-thumb { background: #B8E6D0; }

.app-scroller--always::-webkit-scrollbar-thumb:hover        { background: #adadad; }
.app-scroller--always.app-scroller--pink::-webkit-scrollbar-thumb:hover  { background: #dfa0bb; }
.app-scroller--always.app-scroller--green::-webkit-scrollbar-thumb:hover { background: #8eceb0; }
</style>
