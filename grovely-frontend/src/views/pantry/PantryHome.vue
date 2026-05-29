<template>
  <AppLayout panel-bg="#EAF7F0" panel-border="#B8E6D0">
    <PantryShoppingList @moved="inventoryRef?.reload()" />
    <template #col2>
      <PantryInventory ref="inventoryRef" />
    </template>
    <template #col3>
      <PantryPremiumPanel />
    </template>
  </AppLayout>
</template>

<script setup>
import { ref } from 'vue'
import AppLayout from '../../components/AppLayout.vue'
import PantryShoppingList from './PantryShoppingList.vue'
import PantryInventory from './PantryInventory.vue'
import PantryPremiumPanel from './PantryPremiumPanel.vue'

const inventoryRef = ref(null)
</script>
