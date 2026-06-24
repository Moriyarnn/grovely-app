<template>
  <AppToast
    :model-value="currentBubble ? currentBubble.text : null"
    :icon="currentBubble ? currentBubble.icon : undefined"
    icon-color="#993556"
    tone="pastel"
    placement="corner"
    :closeable="true"
    :duration="DISPLAY_MS"
    @update:model-value="onBubbleDismiss"
  />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import AppToast from './ui/AppToast.vue'
import { useRealtime } from '../composables/useRealtime'
import { usePreferences } from '../composables/usePreferences'

// Mounted in App.vue only when logged in. Owns the live-activity SSE connection
// for the session and renders the coalescing bubble queue.
const { currentBubble, onBubbleDismiss, connect, disconnect, DISPLAY_MS } = useRealtime()
const { fetchPreferences } = usePreferences()

onMounted(() => {
  fetchPreferences() // ensure live_activity_receive is loaded for the gate
  connect()
})
onBeforeUnmount(disconnect)
</script>
