<template>
  <DetailSheet
    :open="demoDialogOpen"
    title="Available when you self-host"
    theme="neutral"
    elevated
    @update:open="demoDialogOpen = $event"
  >
    <div class="df-body">
      <div class="df-icon-wrap">
        <v-icon size="26" color="#475569">mdi-server-outline</v-icon>
      </div>

      <p class="df-headline">{{ demoFeature?.title }}</p>
      <p class="df-sub">{{ demoFeature?.body }}</p>

      <div class="df-privacy">
        <v-icon size="16" color="#2E7D52">mdi-shield-check-outline</v-icon>
        <span>
          This demo runs entirely in your browser, so it has no server to do this -
          which is exactly why your data never leaves this page.
        </span>
      </div>

      <a href="https://grovely.org" target="_blank" rel="noopener" class="df-cta">
        See how self-hosting works
        <v-icon size="16">mdi-arrow-top-right</v-icon>
      </a>
    </div>
  </DetailSheet>
</template>

<script setup lang="ts">
import DetailSheet from './ui/DetailSheet.vue'
import { demoDialogOpen, demoFeature } from '../composables/useDemo'
</script>

<style scoped>
.df-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 6px;
}

.df-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  background: #F1F5F9;
  border: 1px solid #CBD5E1;
}

.df-headline {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  text-align: center;
  letter-spacing: -0.01em;
}

.df-sub {
  font-size: 13px;
  color: #666;
  margin: 0;
  text-align: center;
  line-height: 1.5;
}

.df-privacy {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 12.5px;
  color: #1A4D35;
  line-height: 1.5;
}
.df-privacy :deep(.v-icon) { flex-shrink: 0; margin-top: 1px; }

.df-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  background: #2E7D52;
  color: #fff;
  transition: filter 0.15s, transform 0.05s;
}
.df-cta:hover { filter: brightness(1.05); }
.df-cta:active { transform: scale(0.99); }
</style>
