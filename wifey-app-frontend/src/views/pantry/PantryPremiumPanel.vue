<template>
  <div class="premium-panel">
    <p class="premium-panel-title">Coming Soon</p>

    <div class="premium-card">
      <div class="premium-badge">
        <v-icon size="11" color="#b0a8b9">mdi-lock</v-icon>
        <span>Premium</span>
      </div>
      <p class="premium-card-title">Waste Tracking</p>
      <p class="premium-card-desc">Items marked as wasted are logged — monthly summary shows your most-wasted categories</p>
    </div>

    <div class="premium-card">
      <div class="premium-badge">
        <v-icon size="11" color="#b0a8b9">mdi-lock</v-icon>
        <span>Premium</span>
      </div>
      <p class="premium-card-title">Reorder Suggestions</p>
      <p class="premium-card-desc">Detects your average repurchase interval per item and nudges when you're likely running low</p>
    </div>

    <div class="premium-card">
      <div class="premium-badge">
        <v-icon size="11" color="#b0a8b9">mdi-lock</v-icon>
        <span>Premium</span>
      </div>
      <p class="premium-card-title">Recipe Crossover</p>
      <p class="premium-card-desc">Scores pantry items against available recipes, weighted toward what's expiring soonest</p>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.premium-panel {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: calc(100vh - 2.5rem);
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
  color: #9ECDB6;
  margin: 0;
  flex-shrink: 0;
}

.premium-card {
  position: relative;
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  border-radius: 14px;
  padding: 20px 20px 18px;
  opacity: 0.55;
  flex: 1;
}

.premium-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 6px;
  border: 1.5px solid #B8D8C8;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: #6BA888;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: #f4fbf7;
}

.premium-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #1A4D35;
  margin: 0 0 6px;
  padding-right: 80px;
}

.premium-card-desc {
  font-size: 12px;
  color: #6BA888;
  margin: 0;
  line-height: 1.5;
}
</style>
