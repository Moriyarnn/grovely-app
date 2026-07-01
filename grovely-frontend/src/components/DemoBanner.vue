<template>
  <Teleport to="body">
    <div v-if="visible" class="demo-banner">
      <v-icon size="14" class="demo-banner__shield">mdi-shield-check-outline</v-icon>
      <span class="demo-banner__text">Runs entirely in your browser</span>
      <span class="demo-banner__sep">·</span>
      <a class="demo-banner__link" href="https://grovely.org" target="_blank" rel="noopener">
        grovely.org
        <v-icon size="12">mdi-arrow-top-right</v-icon>
      </a>
      <button class="demo-banner__close" aria-label="Hide" @click="visible = false">
        <v-icon size="14">mdi-close</v-icon>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// Demo-only persistent trust strip. Mounted async + __DEMO__-gated from App.vue
// so it is dead-code eliminated from the normal build. States plainly that the
// demo never leaves the tab (the key signal for the privacy-minded audience) and
// links out to grovely.org. Dismissable for small screens; a refresh restores it
// since the whole demo resets on reload.
import { ref } from 'vue'

const visible = ref(true)
</script>

<style scoped>
.demo-banner {
  position: fixed;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: calc(100vw - 24px);
  padding: 6px 8px 6px 12px;
  background: #fff;
  border: 1px solid #F3D7E2;
  border-radius: 999px;
  box-shadow: 0 4px 16px rgba(153, 53, 86, 0.16);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  z-index: 9998;
}
.demo-banner__shield { color: #993556; flex-shrink: 0; }
.demo-banner__text {
  color: #5a4750;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}
.demo-banner__sep { color: #d9c2cb; }
.demo-banner__link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #993556;
  font-weight: 700;
  text-decoration: none;
  flex-shrink: 0;
}
.demo-banner__link:hover { text-decoration: underline; }
.demo-banner__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 2px;
  padding: 2px;
  border: none;
  background: transparent;
  color: #b89aa6;
  cursor: pointer;
  border-radius: 999px;
  flex-shrink: 0;
}
.demo-banner__close:hover { color: #993556; background: #FBEAF0; }
</style>
