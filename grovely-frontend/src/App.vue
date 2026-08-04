<template>
  <v-app>
    <v-main>
      <router-view v-slot="{ Component }">
        <Transition name="page-slide" mode="out-in">
          <div v-if="route.name === 'login'" key="login" class="login-transition-root">
            <component :is="Component" />
          </div>
          <DesktopShell v-else-if="showShell" key="app">
            <Transition name="page-slide" mode="out-in">
              <component :is="Component" :key="route.path" />
            </Transition>
          </DesktopShell>
        </Transition>
      </router-view>
    </v-main>
    <ActivityToast v-if="showShell" />
    <component :is="DemoFeatureDialog" v-if="DemoFeatureDialog" />
    <component :is="DemoExitDialog" v-if="DemoExitDialog" />
    <component :is="DemoBanner" v-if="DemoBanner && showShell" />
    <Teleport to="body">
      <div v-if="envLabel" class="env-badge">{{ envLabel }}</div>
    </Teleport>
  </v-app>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import DesktopShell from './components/DesktopShell.vue'
import ActivityToast from './components/ActivityToast.vue'
import { getToken } from './api'

// Demo-only: the "available when you self-host" dialog. Async + __DEMO__-gated
// so it (and its content) are dead-code eliminated from the normal build.
const DemoFeatureDialog = __DEMO__
  ? defineAsyncComponent(() => import('./components/DemoFeatureDialog.vue'))
  : null
// Demo-only exit prompt. Kept in a separate async chunk so its public links and
// engagement copy never ship in the normal self-hosted application bundle.
const DemoExitDialog = __DEMO__
  ? defineAsyncComponent(() => import('./components/DemoExitDialog.vue'))
  : null
// Demo-only persistent "runs entirely in your browser" trust strip. Same
// async + __DEMO__ gating so it is dead-code eliminated from the normal build.
const DemoBanner = __DEMO__
  ? defineAsyncComponent(() => import('./components/DemoBanner.vue'))
  : null
const route = useRoute()
const showShell = computed(() => route.name !== 'login' && !!getToken())
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
.login-transition-root { min-height: 100dvh; }
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
