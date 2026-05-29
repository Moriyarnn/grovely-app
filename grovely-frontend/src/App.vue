<template>
  <v-app>
    <v-main>
      <DesktopShell v-if="route.name !== 'login'">
        <router-view v-slot="{ Component }">
          <Transition name="page-slide" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </router-view>
      </DesktopShell>
      <router-view v-else />
    </v-main>
    <Teleport to="body">
      <div v-if="envLabel" class="env-badge">{{ envLabel }}</div>
    </Teleport>
  </v-app>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import DesktopShell from './components/DesktopShell.vue'
const route = useRoute()
const env = import.meta.env.VITE_ENV
const envLabel = env === 'dev' ? 'DEV' : env === 'uat' ? 'UAT' : null
</script>

<style>
:root { --flow-hue: 335; }
html, body {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
</style>

<style>
/* ── Page slide transition ─────────────────────────────────────── */
.page-slide-enter-active { transition: opacity 130ms ease-out, transform 130ms ease-out; }
.page-slide-leave-active { transition: opacity 100ms ease-in,  transform 100ms ease-in; }
.page-slide-enter-from   { opacity: 0; transform: translateX(18px); }
.page-slide-leave-to     { opacity: 0; transform: translateX(-10px); }
</style>

<style>
.env-badge {
  position: fixed;
  bottom: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: 999px;
  pointer-events: none;
  z-index: 9999;
}
</style>
