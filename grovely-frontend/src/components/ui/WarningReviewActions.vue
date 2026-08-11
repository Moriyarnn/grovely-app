<template>
  <template v-if="reviewState === 'excluded'">
    <IconAction icon="mdi-eye-outline" :label="reviewKind === 'missing-gap' ? 'Review interval' : 'Include'" color="#92400e" bg="#fef3c7" border="#fcd34d" :loading="loading === 'undo' ? 'Saving...' : ''" @click="undoReview" />
  </template>
  <template v-else-if="reviewState === null">
    <IconAction
      icon="mdi-eye-off-outline"
      :label="reviewKind === 'missing-gap' ? 'Exclude interval' : 'Exclude'"
      color="#92400e"
      bg="#fef3c7"
      border="#fcd34d"
      :loading="loading === 'excluded' ? 'Saving...' : ''"
      @click="pendingAction = 'excluded'"
    />
    <IconAction
      v-if="canConfirm"
      icon="mdi-eye-outline"
      :label="reviewKind === 'missing-gap' ? 'Confirm long cycle' : pairCycleId != null ? 'Confirm pair' : 'Confirm period'"
      color="#92400e"
      bg="#fef3c7"
      border="#fcd34d"
      :loading="loading === 'confirmed' ? 'Saving...' : ''"
      @click="pendingAction = 'confirmed'"
    />
  </template>
  <template v-else>
    <div class="wra-status">
      <v-icon size="12" color="#92400e">
        {{ reviewState === 'confirmed' ? 'mdi-eye-outline' : 'mdi-eye-off-outline' }}
      </v-icon>
      <span class="wra-status-label">{{ reviewState === 'confirmed' ? 'Confirmed' : 'Excluded' }}</span>
      <button class="wra-undo" @click="undoReview">{{ reviewKind === 'missing-gap' ? 'Review again' : 'Unconfirm' }}</button>
    </div>
  </template>

  <ConfirmDialog
    :open="pendingAction === 'excluded'"
    icon="mdi-eye-off-outline"
    iconColor="#92400e"
    :title="reviewKind === 'missing-gap' ? 'Exclude this interval?' : 'Exclude from predictions?'"
    :confirmLabel="reviewKind === 'missing-gap' ? 'Yes, exclude interval' : 'Yes, exclude it'"
    loadingLabel="Saving..."
    confirmColor="#b45309"
    theme="amber"
    :loading="loading === 'excluded'"
    @update:open="onDialogOpenChange"
    @confirm="submitReview('excluded')"
  >
    <template v-if="reviewKind === 'missing-gap'">
      Both periods stay in your history, but the {{ gapDays }}-day interval between them will be ignored when calculating cycle estimates and predictions.
    </template>
    <template v-else>
      {{ itemLabel }} will be kept in your history but ignored when calculating averages and predictions.
    </template>
  </ConfirmDialog>

  <ConfirmDialog
    v-if="canConfirm"
    :open="pendingAction === 'confirmed'"
    icon="mdi-eye-outline"
    iconColor="#92400e"
    :title="reviewKind === 'missing-gap' ? 'Confirm one long cycle?' : 'Confirm as real?'"
    :confirmLabel="reviewKind === 'missing-gap' ? 'Yes, include interval' : 'Yes, it happened'"
    loadingLabel="Saving..."
    confirmColor="#b45309"
    theme="amber"
    :loading="loading === 'confirmed'"
    @update:open="onDialogOpenChange"
    @confirm="submitReview('confirmed')"
  >
    <template v-if="reviewKind === 'missing-gap'">
      This {{ gapDays }}-day interval will be included in your cycle estimates and predictions as one long cycle.
    </template>
    <template v-else-if="pairCycleId != null">
      This pair will be included in your predictions, even though the gap looks unusual.
    </template>
    <template v-else>
      This period will be included in your averages and predictions, even though its duration looks unusual.
    </template>
  </ConfirmDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconAction from './IconAction.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { API, apiFetch } from '@/api'

const props = defineProps<{
  itemId: number
  reviewState: string | null
  endpoint: string       // e.g. `/period/cycles/5/review`
  itemLabel: string      // e.g. "Aug 8" — used in dialog body
  pairCycleId?: number | null
  canConfirm?: boolean
  reviewKind?: 'cycle' | 'missing-gap'
  gapDays?: number | null
}>()

const emit = defineEmits<{ reviewed: [] }>()

const pendingAction = ref<string | null>(null)
const loading = ref<string | null>(null)

function onDialogOpenChange(open: boolean) {
  if (!open) pendingAction.value = null
}

async function submitReview(state: string) {
  loading.value = state
  try {
    await apiFetch(`${API}/${props.endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewState: state,
        pairCycleId: state === 'confirmed' && props.reviewKind !== 'missing-gap' ? props.pairCycleId : undefined,
        gapDays: props.reviewKind === 'missing-gap' ? props.gapDays : undefined
      })
    })
    emit('reviewed')
  } finally {
    loading.value = null
    pendingAction.value = null
  }
}

async function undoReview() {
  loading.value = 'undo'
  try {
    await apiFetch(`${API}/${props.endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewState: null,
        gapDays: props.reviewKind === 'missing-gap' ? props.gapDays : undefined
      })
    })
    emit('reviewed')
  } finally {
    loading.value = null
  }
}
</script>

<style scoped>
.wra-status {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
}
.wra-status-label {
  font-size: 11px;
  font-weight: 600;
  color: #555;
}
.wra-undo {
  font-size: 11px;
  color: #993556;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  margin-left: 2px;
}
</style>
