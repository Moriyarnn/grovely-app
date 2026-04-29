<template>
  <div class="inventory-root">

    <div class="inv-header">
      <p class="col-label">Pantry</p>
      <button class="wizard-btn" @click="wizardOpen = true">
        <v-icon size="14">mdi-plus</v-icon>
        Add items
      </button>
    </div>

    <!-- Expiring soon banner -->
    <div v-if="expiringSoon.length" class="expiry-banner">
      <v-icon size="14" color="#b45309">mdi-alert-outline</v-icon>
      <span class="banner-text">{{ expiringSoon.length }} item{{ expiringSoon.length > 1 ? 's' : '' }} expiring soon</span>
    </div>

    <!-- Stats bar -->
    <div v-if="items.length" class="stats-bar">
      <span class="stat">{{ items.length }} item{{ items.length > 1 ? 's' : '' }}</span>
      <span v-if="expiringSoon.length" class="stat stat--warn">· {{ expiringSoon.length }} expiring soon</span>
    </div>

    <!-- Empty state -->
    <div v-if="!loading && items.length === 0" class="empty-state">
      <v-icon size="32" color="#a8c5b0">mdi-fridge-outline</v-icon>
      <p class="empty-title">Pantry is empty</p>
      <p class="empty-sub">Check items off your shopping list to stock it up</p>
    </div>

    <!-- Pantry items -->
    <div v-for="item in items" :key="item.id" class="pantry-item" :class="expiryClass(item)">
      <div class="pantry-item-main">
        <span class="pantry-name">{{ item.name }}</span>
        <span v-if="item.quantity" class="pantry-qty">{{ item.quantity }}</span>
      </div>
      <div v-if="item.expiry_date" class="pantry-expiry">
        <v-icon size="11" :color="expiryIconColor(item)">mdi-calendar-clock</v-icon>
        <span class="expiry-label">{{ expiryLabel(item) }}</span>
      </div>
      <div v-if="item.notes" class="pantry-notes">{{ item.notes }}</div>
    </div>

    <!-- Shopping wizard overlay -->
    <Teleport to="body">
      <div v-if="wizardOpen" class="wizard-overlay" @click.self="closeWizard">
        <div class="wizard-sheet">
          <div class="wizard-header">
            <p class="wizard-title">Add items to pantry</p>
            <button class="wizard-close" @click="closeWizard" aria-label="Close">
              <v-icon size="18" color="#6BA888">mdi-close</v-icon>
            </button>
          </div>

          <!-- Entry form -->
          <form class="wizard-form" @submit.prevent="queueItem">
            <input v-model="wizName" class="wizard-input" placeholder="Item name" maxlength="120" autocomplete="off" ref="wizNameInput" />
            <div class="wizard-meta">
              <input v-model="wizQty" class="wizard-input wizard-input--sm" placeholder="Qty (e.g. 500g)" maxlength="40" autocomplete="off" />
              <input v-model="wizExpiry" type="date" class="wizard-input wizard-input--sm" />
            </div>
            <button type="submit" class="wizard-add-btn" :disabled="!wizName.trim()">
              <v-icon size="16">mdi-plus</v-icon>
              Add to list
            </button>
          </form>

          <!-- Queue -->
          <div v-if="wizQueue.length" class="wizard-queue">
            <p class="wizard-queue-label">Ready to add ({{ wizQueue.length }})</p>
            <div v-for="(q, i) in wizQueue" :key="i" class="wizard-queue-item">
              <span class="wizard-q-name">{{ q.name }}</span>
              <span v-if="q.quantity" class="wizard-q-meta">{{ q.quantity }}</span>
              <span v-if="q.expiry_date" class="wizard-q-meta">exp {{ q.expiry_date }}</span>
              <button class="wizard-q-remove" @click="wizQueue.splice(i, 1)" aria-label="Remove">
                <v-icon size="13" color="#c4b8bc">mdi-close</v-icon>
              </button>
            </div>
          </div>

          <div class="wizard-footer">
            <p v-if="!wizQueue.length" class="wizard-empty-hint">Add at least one item to continue</p>
            <button class="wizard-done-btn" :disabled="!wizQueue.length || wizSaving" @click="saveWizard">
              {{ wizSaving ? 'Saving…' : `Done — add ${wizQueue.length} item${wizQueue.length !== 1 ? 's' : ''}` }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Expiry legend -->
    <div class="legend-card">
      <p class="legend-title">Expiry states</p>
      <div class="legend-row">
        <span class="legend-dot legend-dot--fresh"></span>
        <span class="legend-text">Fresh — over 7 days</span>
      </div>
      <div class="legend-row">
        <span class="legend-dot legend-dot--soon"></span>
        <span class="legend-text">Expiring soon — 4–7 days</span>
      </div>
      <div class="legend-row">
        <span class="legend-dot legend-dot--very-soon"></span>
        <span class="legend-text">Expiring very soon — 1–3 days</span>
      </div>
      <div class="legend-row">
        <span class="legend-dot legend-dot--today"></span>
        <span class="legend-text">Expires today</span>
      </div>
      <div class="legend-row">
        <span class="legend-dot legend-dot--expired"></span>
        <span class="legend-text">Expired</span>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { API, apiFetch } from '../../api'

const items = ref([])
const loading = ref(true)

const wizardOpen = ref(false)
const wizName = ref('')
const wizQty = ref('')
const wizExpiry = ref('')
const wizQueue = ref([])
const wizSaving = ref(false)
const wizNameInput = ref(null)

function queueItem() {
  if (!wizName.value.trim()) return
  wizQueue.value.push({
    name: wizName.value.trim(),
    quantity: wizQty.value.trim() || null,
    expiry_date: wizExpiry.value || null,
  })
  wizName.value = ''
  wizQty.value = ''
  wizExpiry.value = ''
  nextTick(() => wizNameInput.value?.focus())
}

async function saveWizard() {
  if (!wizQueue.value.length || wizSaving.value) return
  wizSaving.value = true
  const today = new Date().toISOString().split('T')[0]
  for (const entry of wizQueue.value) {
    await apiFetch(`${API}/pantry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, bought_date: today }),
    })
  }
  wizSaving.value = false
  closeWizard()
  await load()
}

function closeWizard() {
  wizardOpen.value = false
  wizName.value = ''
  wizQty.value = ''
  wizExpiry.value = ''
  wizQueue.value = []
}

function daysUntilExpiry(item) {
  if (!item.expiry_date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(item.expiry_date + 'T00:00:00')
  return Math.round((expiry - today) / 86400000)
}

function expiryClass(item) {
  const days = daysUntilExpiry(item)
  if (days === null) return ''
  if (days < 0)  return 'expiry--expired'
  if (days === 0) return 'expiry--today'
  if (days <= 3)  return 'expiry--very-soon'
  if (days <= 7)  return 'expiry--soon'
  return ''
}

function expiryIconColor(item) {
  const days = daysUntilExpiry(item)
  if (days === null) return '#a8c5b0'
  if (days < 0)  return '#9e9e9e'
  if (days === 0) return '#dc2626'
  if (days <= 3)  return '#ea580c'
  if (days <= 7)  return '#d97706'
  return '#a8c5b0'
}

function expiryLabel(item) {
  const days = daysUntilExpiry(item)
  if (days === null) return ''
  if (days < 0)  return `Expired ${Math.abs(days)}d ago`
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Tomorrow'
  return `${days}d left`
}

const expiringSoon = computed(() =>
  items.value.filter(i => {
    const days = daysUntilExpiry(i)
    return days !== null && days >= 0 && days <= 3
  })
)

async function load() {
  loading.value = true
  const res = await apiFetch(`${API}/pantry`)
  if (res.ok) items.value = await res.json()
  loading.value = false
}

onMounted(load)
defineExpose({ reload: load })
</script>

<style scoped>
.inventory-root {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: calc(100vh - 2.5rem);
  box-sizing: border-box;
}

@media (max-width: 1279px) {
  .inventory-root { height: 100%; overflow-y: auto; min-height: unset; }
}

.inv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.col-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6BA888;
  margin: 0;
}

.wizard-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #2E7D52;
  cursor: pointer;
  transition: filter 0.15s;
}
.wizard-btn:hover {
  filter: brightness(0.95);
}

/* Banner */
.expiry-banner {
  display: flex;
  align-items: center;
  gap: 7px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 10px;
  padding: 10px 12px;
  flex-shrink: 0;
}
.banner-text {
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
}

/* Stats */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #6BA888;
  padding: 0 2px;
  flex-shrink: 0;
}
.stat { font-weight: 500; }
.stat--warn { color: #b45309; font-weight: 600; }

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 3rem 1rem;
  text-align: center;
}
.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #1A4D35;
  margin: 0;
}
.empty-sub {
  font-size: 13px;
  color: #6BA888;
  margin: 0;
  line-height: 1.5;
}

/* Pantry items */
.pantry-item {
  background: #EAF7F0;
  border: 1px solid #C8E8D8;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 0.15s;
}

.pantry-item.expiry--soon {
  border-color: #fbbf24;
  background: #fffdf0;
}
.pantry-item.expiry--very-soon {
  border-color: #fb923c;
  background: #fff8f4;
}
.pantry-item.expiry--today {
  border-color: #f87171;
  background: #fff5f5;
  animation: pulse-red 2s infinite;
}
.pantry-item.expiry--expired {
  border-color: #e0e0e0;
  background: #f9f9f9;
  opacity: 0.6;
}

@keyframes pulse-red {
  0%, 100% { border-color: #f87171; }
  50% { border-color: #dc2626; }
}

.pantry-item-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.pantry-name {
  font-size: 14px;
  color: #1A4D35;
  font-weight: 500;
}
.expiry--expired .pantry-name {
  text-decoration: line-through;
  color: #9e9e9e;
}

.pantry-qty {
  font-size: 12px;
  color: #6BA888;
}

.pantry-expiry {
  display: flex;
  align-items: center;
  gap: 4px;
}
.expiry-label {
  font-size: 11px;
  color: #6BA888;
}
.expiry--soon .expiry-label    { color: #b45309; }
.expiry--very-soon .expiry-label { color: #c2410c; }
.expiry--today .expiry-label   { color: #dc2626; }
.expiry--expired .expiry-label { color: #9e9e9e; }

.pantry-notes {
  font-size: 11px;
  color: #6BA888;
  font-style: italic;
}

/* Legend */
.legend-card {
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  border-radius: 14px;
  padding: 14px 16px;
  margin-top: auto;
  flex-shrink: 0;
}
.legend-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6BA888;
  margin: 0 0 10px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.legend-text {
  font-size: 12px;
  color: #1A4D35;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.legend-dot--fresh     { background: #C8E8D8; }
.legend-dot--soon      { background: #fbbf24; }
.legend-dot--very-soon { background: #fb923c; }
.legend-dot--today     { background: #f87171; }
.legend-dot--expired   { background: #e0e0e0; }

/* Wizard */
.wizard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 0 0 env(safe-area-inset-bottom, 0);
}

.wizard-sheet {
  background: #fff;
  border-radius: 20px 20px 0 0;
  padding: 24px 20px 32px;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 85vh;
  overflow-y: auto;
}

.wizard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wizard-title {
  font-size: 16px;
  font-weight: 700;
  color: #1A4D35;
  margin: 0;
}

.wizard-close {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 8px;
}
.wizard-close:hover {
  background: #EAF7F0;
}

.wizard-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wizard-meta {
  display: flex;
  gap: 8px;
}

.wizard-input {
  width: 100%;
  border: 1.5px solid #B8E6D0;
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 14px;
  color: #1A4D35;
  background: #fff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.wizard-input:focus {
  border-color: #2E7D52;
}
.wizard-input::placeholder {
  color: #6BA888;
}
.wizard-input--sm {
  font-size: 12px;
}

.wizard-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  border-radius: 10px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #2E7D52;
  cursor: pointer;
  transition: background 0.15s;
}
.wizard-add-btn:hover:not(:disabled) {
  background: #d4f0e4;
}
.wizard-add-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.wizard-queue {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wizard-queue-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6BA888;
  margin: 0;
}

.wizard-queue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #EAF7F0;
  border: 1px solid #C8E8D8;
  border-radius: 8px;
}

.wizard-q-name {
  flex: 1;
  font-size: 13px;
  color: #1A4D35;
  font-weight: 500;
}

.wizard-q-meta {
  font-size: 11px;
  color: #6BA888;
  white-space: nowrap;
}

.wizard-q-remove {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  opacity: 0.5;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.wizard-q-remove:hover {
  opacity: 1;
}

.wizard-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wizard-empty-hint {
  font-size: 12px;
  color: #a8c5b0;
  text-align: center;
  margin: 0;
}

.wizard-done-btn {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  background: #2E7D52;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.wizard-done-btn:hover:not(:disabled) {
  background: #1e6b42;
}
.wizard-done-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
