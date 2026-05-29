<template>
  <div class="premium-panel">
    <p class="premium-panel-title">Coming Soon</p>

    <div class="premium-card">
      <div class="premium-badges">
        <ComingSoonBadge theme="pink" />
        <PremiumBadge theme="pink" />
      </div>
      <p class="premium-card-title">Cycle Correlation</p>
      <p class="premium-card-desc">See how your cycle length and symptoms shift over months</p>
    </div>

    <div class="premium-card">
      <div class="premium-badges">
        <ComingSoonBadge theme="pink" />
        <PremiumBadge theme="pink" />
      </div>
      <p class="premium-card-title">Symptom Pattern Predictions</p>
      <p class="premium-card-desc">Get warned a day early based on your logged patterns</p>
    </div>

    <div class="premium-card">
      <div class="premium-badges">
        <ComingSoonBadge theme="pink" />
        <PremiumBadge theme="pink" />
      </div>
      <p class="premium-card-title">Cycle Data Export</p>
      <p class="premium-card-desc">Export your full cycle history as CSV or PDF — ready to share with a doctor or therapist</p>
    </div>

    <div class="premium-card">
      <div class="premium-badges">
        <ComingSoonBadge theme="pink" />
        <PremiumBadge theme="pink" />
      </div>
      <p class="premium-card-title">Fertility Signal Logging</p>
      <p class="premium-card-desc">Log basal body temperature and LH surge tests to confirm ovulation directly, improving prediction accuracy beyond calendar math</p>
    </div>
  </div>
</template>

<script setup>
import ComingSoonBadge from '@/components/ui/ComingSoonBadge.vue'
import PremiumBadge from '@/components/ui/PremiumBadge.vue'
</script>

<style scoped>
.premium-panel {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: calc(100dvh - 2.5rem);
  box-sizing: border-box;
}

@media (max-width: 1279px) {
  .premium-panel { height: 100%; overflow-y: auto; min-height: unset; }
}

.premium-panel-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #c8b8c5;
  margin: 0;
  flex-shrink: 0;
}

.premium-card {
  position: relative;
  background: #fdf5f8;
  border: 1px solid #f0e0e8;
  border-radius: 14px;
  padding: 20px 20px 18px;
  opacity: 0.55;
  flex: 1;
}

.premium-badges {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  gap: 4px;
}

.premium-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #72243E;
  margin: 0 0 6px;
  padding-right: 150px;
}

.premium-card-desc {
  font-size: 12px;
  color: #b0788e;
  margin: 0;
  line-height: 1.5;
}
</style>
