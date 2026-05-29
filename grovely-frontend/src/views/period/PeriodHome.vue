<template>
  <AppLayout>
    <PeriodCalendar />
    <template #col2>
      <PeriodDetail />
    </template>
    <template #col3>
      <PeriodPremiumPanel />
    </template>
  </AppLayout>
</template>

<script setup>
import AppLayout from '../../components/AppLayout.vue'
import PeriodCalendar from './PeriodCalendar.vue'
import PeriodDetail from './PeriodDetail.vue'
import PeriodPremiumPanel from './PeriodPremiumPanel.vue'
</script>
