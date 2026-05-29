<template>
  <DetailSheet
    :open="open"
    title="Premium feature"
    :theme="theme"
    @update:open="$emit('update:open', $event)"
  >
    <div class="pg-body">
      <div class="pg-icon-wrap" :class="`pg-icon-wrap--${theme}`">
        <v-icon size="28" :color="iconColor">mdi-lock-outline</v-icon>
      </div>

      <p class="pg-headline">Smart features, fairly priced.</p>
      <p class="pg-sub">
        The app stays free. One key keeps your whole household covered.
      </p>

      <div class="pg-included" :class="`pg-included--${theme}`">
        <p class="pg-included-title">What's included today</p>
        <ul class="pg-included-list">
          <li>
            <v-icon size="14" :color="iconColor">mdi-check</v-icon>
            <span>Email notifications + partner heads-ups</span>
          </li>
          <li>
            <v-icon size="14" :color="iconColor">mdi-check</v-icon>
            <span>Scheduled backups (local + remote)</span>
          </li>
          <li>
            <v-icon size="14" :color="iconColor">mdi-check</v-icon>
            <span>Cycle phase card with personalized math</span>
          </li>
          <li>
            <v-icon size="14" :color="iconColor">mdi-check</v-icon>
            <span>Adjust Cycle: hold-drag to resize. Pantry: Smart Autofill with price history</span>
          </li>
        </ul>
        <p class="pg-included-note">
          Launching small - each app's premium card shows what's coming next.
          The price holds as more lands.
        </p>
      </div>

      <div class="pg-price" :class="`pg-price--${theme}`">
        <div class="pg-price-row">
          <span class="pg-price-amount">$20</span>
          <span class="pg-price-period">/ year</span>
          <span class="pg-price-alt">monthly also available</span>
        </div>
        <span class="pg-price-promise">Future features come at no extra cost.</span>
      </div>

      <a
        :href="pricingUrl"
        target="_blank"
        rel="noopener"
        class="pg-cta"
        :class="`pg-cta--${theme}`"
      >
        Get a license
        <v-icon size="16">mdi-arrow-top-right</v-icon>
      </a>

      <div class="pg-trust">
        <v-icon size="14" :color="iconColor">mdi-shield-check-outline</v-icon>
        <span>License verifies locally with RSA - no phone-home, no runtime server check.</span>
      </div>

      <p class="pg-how-inline">
        After you have a key: add <code>LICENSE_KEY=...</code> to <code>.env</code>, then <code>docker compose restart</code>.
      </p>
    </div>
  </DetailSheet>
</template>

<script setup>
import { computed } from 'vue'
import DetailSheet from './ui/DetailSheet.vue'

const props = defineProps({
  open:  { type: Boolean, default: false },
  theme: { type: String,  default: 'pink' },
})

defineEmits(['update:open'])

const pricingUrl = 'https://grovely.app/pricing'

const iconColor = computed(() => ({
  pink:    '#993556',
  green:   '#2E7D52',
  neutral: '#475569',
}[props.theme] ?? '#993556'))
</script>

<style scoped>
.pg-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 6px;
}

.pg-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
}
.pg-icon-wrap--pink    { background: #FBEAF0; border: 1px solid #F4C0D1; }
.pg-icon-wrap--green   { background: #EAF7F0; border: 1px solid #B8E6D0; }
.pg-icon-wrap--neutral { background: #F1F5F9; border: 1px solid #CBD5E1; }

.pg-headline {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  text-align: center;
  letter-spacing: -0.01em;
}

.pg-sub {
  font-size: 13px;
  color: #666;
  margin: 0;
  text-align: center;
  line-height: 1.5;
}

.pg-included {
  border-radius: 12px;
  padding: 14px 16px;
}
.pg-included--pink    { background: #fdf5f8; border: 1px solid #f0e8ec; }
.pg-included--green   { background: #EAF7F0; border: 1px solid #B8E6D0; }
.pg-included--neutral { background: #F8FAFC; border: 1px solid #E2E8F0; }

.pg-included-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin: 0 0 8px;
  color: #999;
}

.pg-included-list {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.pg-included-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #333;
  line-height: 1.35;
}

.pg-included-list li :deep(.v-icon) {
  flex-shrink: 0;
}

.pg-included-note {
  font-size: 11.5px;
  color: #999;
  margin: 0;
  font-style: italic;
  line-height: 1.4;
}

.pg-price {
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: 1px solid;
}
.pg-price--pink    { background: #fff; border-color: #F4C0D1; }
.pg-price--green   { background: #fff; border-color: #B8E6D0; }
.pg-price--neutral { background: #fff; border-color: #CBD5E1; }

.pg-price-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.pg-price-amount {
  font-size: 26px;
  font-weight: 800;
  color: #1a1a1a;
  letter-spacing: -0.02em;
}

.pg-price-period {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.pg-price-alt {
  font-size: 11.5px;
  color: #999;
  margin-left: 4px;
}

.pg-price-promise {
  font-size: 12px;
  color: #555;
  font-weight: 500;
  margin-top: 2px;
}

.pg-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: filter 0.15s, transform 0.05s;
}
.pg-cta:hover { filter: brightness(1.05); }
.pg-cta:active { transform: scale(0.99); }
.pg-cta--pink    { background: #993556; color: #fff; }
.pg-cta--green   { background: #2E7D52; color: #fff; }
.pg-cta--neutral { background: #2E7D52; color: #fff; }

.pg-trust {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: #666;
  line-height: 1.3;
  padding: 0 4px;
}

.pg-trust :deep(.v-icon) {
  flex-shrink: 0;
}

.pg-how-inline {
  font-size: 11.5px;
  color: #888;
  line-height: 1.5;
  margin: 0;
  text-align: center;
  padding: 0 4px;
}

.pg-how-inline code {
  font-size: 10.5px;
  background: rgba(0,0,0,0.05);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: monospace;
  color: #666;
}
</style>
