<template>
  <DetailSheet
    :open="demoExitDialogOpen"
    theme="pink"
    elevated
    hug-content
    :show-close="false"
    @update:open="demoExitDialogOpen = $event"
  >
    <div class="de-body">
      <div class="de-icon-wrap">
        <v-icon size="28" color="#993556">mdi-star-outline</v-icon>
      </div>

      <p class="de-headline">Thank you for trying Grovely</p>
      <p class="de-copy">
        Would you like to see Grovely's development continue?<br />
        A GitHub star helps more people discover the project and means a lot to us.
      </p>

      <div class="de-actions">
        <a
          class="de-action de-action--primary"
          href="https://github.com/grovely-org/grovely-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <v-icon size="18">mdi-github</v-icon>
          View on GitHub
          <v-icon size="15">mdi-arrow-top-right</v-icon>
        </a>
        <a class="de-action de-action--secondary" href="https://grovely.org">
          Back to grovely.org
        </a>
      </div>
    </div>
  </DetailSheet>
</template>

<script setup lang="ts">
import DetailSheet from './ui/DetailSheet.vue'
import { demoExitDialogOpen } from '../composables/useDemo'
</script>

<style scoped>
.de-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 6px;
}

.de-icon-wrap {
  width: 56px;
  height: 56px;
  border: 1px solid #f4c0d1;
  border-radius: 50%;
  background: #fbeaf0;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
}

.de-headline {
  margin: 0;
  color: #72243e;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-align: center;
}

.de-copy {
  margin: 0 auto;
  max-width: 440px;
  color: #66545b;
  font-size: 13.5px;
  line-height: 1.55;
  text-align: center;
}

.de-actions {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 4px;
}

.de-action {
  min-height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 650;
  text-decoration: none;
  transition:
    filter 0.15s,
    transform 0.05s,
    background 0.15s;
}

.de-action:hover {
  filter: brightness(1.03);
}
.de-action:active {
  transform: scale(0.99);
}

.de-action--primary {
  background: #24292f;
  color: #fff;
}

.de-action--secondary {
  border: 1px solid #f4c0d1;
  background: #fff;
  color: #993556;
}

.de-action--secondary:hover {
  background: #fff7fa;
}

@media (min-width: 640px) {
  .de-actions {
    flex-direction: row;
  }

  .de-action {
    flex: 1;
  }
}
</style>
