<template>
  <div class="shopping-root">

    <!-- Header -->
    <div class="shopping-header">
      <h1 class="shopping-title">Shopping List</h1>
      <button class="back-chip back-chip--mobile-only" @click="$router.back()">
        <v-icon size="14" color="#2E7D52">mdi-chevron-left</v-icon>
        Hub
      </button>
    </div>

    <!-- Add item form -->
    <form class="add-form" @submit.prevent="addItem">
      <div class="add-row">
        <input
          v-model="newName"
          class="add-input"
          placeholder="Add item…"
          maxlength="120"
          autocomplete="off"
        />
        <button type="submit" class="add-btn" :disabled="!newName.trim() || adding">
          <v-icon size="18">mdi-plus</v-icon>
        </button>
      </div>
      <div class="add-meta">
        <input
          v-model="newQuantity"
          class="meta-input"
          placeholder="Qty (e.g. 2 kg)"
          maxlength="40"
          autocomplete="off"
        />
        <select v-model="newCategory" class="meta-select">
          <option v-for="cat in CATEGORIES" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
        </select>
      </div>
    </form>

    <!-- Empty state -->
    <div v-if="!loading && items.length === 0" class="empty-state">
      <v-icon size="32" color="#a8c5b0">mdi-cart-outline</v-icon>
      <p class="empty-title">Your list is empty</p>
      <p class="empty-sub">Add the first item above</p>
    </div>

    <!-- Unchecked items grouped by category -->
    <div v-for="cat in activeCategories" :key="cat" class="category-group">
      <div class="category-header">
        <span class="category-dot" :style="{ background: catColor(cat) }"></span>
        {{ catLabel(cat) }}
      </div>
      <div
        v-for="item in uncheckedByCategory[cat]"
        :key="item.id"
        class="list-item"
      >
        <button class="check-btn" @click="toggleChecked(item)" :aria-label="'Check ' + item.name">
          <v-icon size="18" color="#a8c5b0">mdi-checkbox-blank-circle-outline</v-icon>
        </button>
        <span class="item-name">{{ item.name }}</span>
        <span v-if="item.quantity" class="item-qty">{{ item.quantity }}</span>
        <button class="delete-btn" @click="deleteItem(item.id)" aria-label="Remove">
          <v-icon size="15" color="#c4b8bc">mdi-close</v-icon>
        </button>
      </div>
    </div>

    <!-- Move-to-pantry sheet -->
    <Teleport to="body">
      <div v-if="moveTarget" class="move-overlay" @click.self="closeMoveSheet">
        <div class="move-sheet">
          <p class="move-title">Move to pantry?</p>
          <p class="move-item-name">{{ moveTarget.name }}<span v-if="moveTarget.quantity" class="move-item-qty"> · {{ moveTarget.quantity }}</span></p>
          <div class="move-fields">
            <label class="move-label">Expiry date <span class="move-optional">(optional)</span></label>
            <input v-model="moveExpiry" type="date" class="move-input" />
            <label class="move-label">Notes <span class="move-optional">(optional)</span></label>
            <input v-model="moveNotes" class="move-input" placeholder="e.g. opened, in freezer" maxlength="120" />
          </div>
          <div class="move-actions">
            <button class="move-btn move-btn--secondary" @click="justCheckOff" :disabled="moving">Just check off</button>
            <button class="move-btn move-btn--primary" @click="moveToPantry" :disabled="moving">Move to pantry</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Done section -->
    <div v-if="checkedItems.length" class="category-group">
      <div class="category-header done-header">
        <span class="category-dot" style="background: #9ebbab"></span>
        Done
        <button class="clear-btn" @click="clearChecked">Clear</button>
      </div>
      <div
        v-for="item in checkedItems"
        :key="item.id"
        class="list-item list-item--checked"
      >
        <button class="check-btn" @click="toggleChecked(item)" :aria-label="'Uncheck ' + item.name">
          <v-icon size="18" color="#5a9a72">mdi-checkbox-marked-circle</v-icon>
        </button>
        <span class="item-name item-name--checked">{{ item.name }}</span>
        <span v-if="item.quantity" class="item-qty item-qty--checked">{{ item.quantity }}</span>
        <button class="delete-btn" @click="deleteItem(item.id)" aria-label="Remove">
          <v-icon size="15" color="#c4b8bc">mdi-close</v-icon>
        </button>
      </div>
    </div>


  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { API, apiFetch } from '../../api'

const CATEGORIES = [
  { value: 'produce',   label: 'Produce' },
  { value: 'dairy',     label: 'Dairy' },
  { value: 'meat',      label: 'Meat' },
  { value: 'bakery',    label: 'Bakery' },
  { value: 'frozen',    label: 'Frozen' },
  { value: 'dry_goods', label: 'Dry Goods' },
  { value: 'other',     label: 'Other' },
]

const CAT_COLORS = {
  produce:   '#4caf7d',
  dairy:     '#42a5d6',
  meat:      '#e06060',
  bakery:    '#d4914a',
  frozen:    '#7e7ecf',
  dry_goods: '#a08060',
  other:     '#9e9e9e',
}

const CAT_ORDER = CATEGORIES.map(c => c.value)

const emit = defineEmits(['moved'])

const items = ref([])
const loading = ref(true)
const adding = ref(false)
const moving = ref(false)

const newName = ref('')
const newQuantity = ref('')
const newCategory = ref('other')

const moveTarget = ref(null)
const moveExpiry = ref('')
const moveNotes = ref('')

const uncheckedItems = computed(() => items.value.filter(i => !i.checked))
const checkedItems = computed(() => items.value.filter(i => i.checked))

const activeCategories = computed(() => {
  const cats = new Set(uncheckedItems.value.map(i => i.category))
  return CAT_ORDER.filter(c => cats.has(c))
})

const uncheckedByCategory = computed(() => {
  const map = {}
  for (const cat of CAT_ORDER) {
    map[cat] = uncheckedItems.value.filter(i => i.category === cat)
  }
  return map
})

function catLabel(cat) {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

function catColor(cat) {
  return CAT_COLORS[cat] ?? '#9e9e9e'
}

async function load() {
  loading.value = true
  const res = await apiFetch(`${API}/pantry/list`)
  if (res.ok) items.value = await res.json()
  loading.value = false
}

async function addItem() {
  if (!newName.value.trim() || adding.value) return
  adding.value = true
  const res = await apiFetch(`${API}/pantry/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: newName.value.trim(),
      quantity: newQuantity.value.trim() || null,
      category: newCategory.value,
    }),
  })
  if (res.ok) {
    const item = await res.json()
    items.value.push(item)
    newName.value = ''
    newQuantity.value = ''
    newCategory.value = 'other'
  }
  adding.value = false
}

async function toggleChecked(item) {
  if (!item.checked) {
    moveTarget.value = item
    return
  }
  const res = await apiFetch(`${API}/pantry/list/${item.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checked: 0 }),
  })
  if (res.ok) {
    const updated = await res.json()
    const idx = items.value.findIndex(i => i.id === item.id)
    if (idx !== -1) items.value[idx] = updated
  }
}

async function justCheckOff() {
  const item = moveTarget.value
  const res = await apiFetch(`${API}/pantry/list/${item.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checked: 1 }),
  })
  if (res.ok) {
    const updated = await res.json()
    const idx = items.value.findIndex(i => i.id === item.id)
    if (idx !== -1) items.value[idx] = updated
  }
  closeMoveSheet()
}

async function moveToPantry() {
  const item = moveTarget.value
  moving.value = true
  const res = await apiFetch(`${API}/pantry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: item.name,
      quantity: item.quantity || null,
      category: item.category || 'other',
      expiry_date: moveExpiry.value || null,
      notes: moveNotes.value.trim() || null,
    }),
  })
  if (res.ok) {
    await apiFetch(`${API}/pantry/list/${item.id}`, { method: 'DELETE' })
    items.value = items.value.filter(i => i.id !== item.id)
    emit('moved')
  }
  moving.value = false
  closeMoveSheet()
}

function closeMoveSheet() {
  moveTarget.value = null
  moveExpiry.value = ''
  moveNotes.value = ''
}

async function deleteItem(id) {
  const res = await apiFetch(`${API}/pantry/list/${id}`, { method: 'DELETE' })
  if (res.ok) items.value = items.value.filter(i => i.id !== id)
}

async function clearChecked() {
  const res = await apiFetch(`${API}/pantry/list/checked`, { method: 'DELETE' })
  if (res.ok) items.value = items.value.filter(i => !i.checked)
}

onMounted(load)
</script>

<style scoped>
.shopping-root {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: calc(100vh - 2.5rem);
  box-sizing: border-box;
}

@media (max-width: 1279px) {
  .shopping-root { height: 100%; overflow-y: auto; min-height: unset; }
}

/* Header */
.shopping-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.back-chip {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 1px;
  background: #fff;
  color: #2E7D52;
  border: 1px solid #B8E6D0;
  border-radius: 99px;
  padding: 5px 12px 5px 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.back-chip:hover { background: #EAF7F0; }

.shopping-title {
  font-size: 22px;
  font-weight: 700;
  color: #1A4D35;
  margin: 0;
  line-height: 1.2;
  flex: 1;
}

@media (min-width: 1280px) {
  .back-chip--mobile-only { display: none; }
}

/* Add form */
.add-form {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.add-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.add-input {
  flex: 1;
  border: 1.5px solid var(--panel-border);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 14px;
  color: #1A4D35;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
}
.add-input:focus {
  border-color: #2E7D52;
}
.add-input::placeholder {
  color: #6BA888;
}

.add-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #2E7D52;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  transition: background 0.15s;
}
.add-btn:hover:not(:disabled) {
  background: #1e6b42;
}
.add-btn:disabled {
  background: #6BA888;
  cursor: default;
}

.add-meta {
  display: flex;
  gap: 8px;
}

.meta-input {
  flex: 1;
  border: 1.5px solid var(--panel-border);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: #1A4D35;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
}
.meta-input:focus {
  border-color: #2E7D52;
}
.meta-input::placeholder {
  color: #6BA888;
}

.meta-select {
  border: 1.5px solid var(--panel-border);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: #1A4D35;
  background: #fff;
  outline: none;
  cursor: pointer;
}

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
}

/* Category groups */
.category-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6BA888;
  padding: 2px 4px 6px;
}

.done-header {
  margin-top: 4px;
}

.category-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.clear-btn {
  margin-left: auto;
  background: none;
  border: 1px solid #B8E6D0;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #6BA888;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: background 0.15s;
}
.clear-btn:hover {
  background: #d4f0e4;
}

/* List items */
.list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  transition: filter 0.15s;
}
.list-item:hover {
  filter: brightness(0.96);
}

.list-item--checked {
  opacity: 0.7;
}

.check-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  font-size: 14px;
  color: #1A4D35;
}
.item-name--checked {
  text-decoration: line-through;
  color: #6BA888;
}

.item-qty {
  font-size: 12px;
  color: #6BA888;
  white-space: nowrap;
}
.item-qty--checked {
  color: #9ECDB6;
}

.delete-btn {
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
.list-item:hover .delete-btn {
  opacity: 1;
}

/* Move-to-pantry sheet */
.move-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 0 0 env(safe-area-inset-bottom, 0);
}

.move-sheet {
  background: #fff;
  border-radius: 20px 20px 0 0;
  padding: 24px 20px 32px;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.move-title {
  font-size: 16px;
  font-weight: 700;
  color: #1A4D35;
  margin: 0;
}

.move-item-name {
  font-size: 15px;
  color: #2E7D52;
  font-weight: 600;
  margin: 0;
  padding: 10px 12px;
  background: #EAF7F0;
  border-radius: 10px;
}

.move-item-qty {
  font-weight: 400;
  color: #6BA888;
  font-size: 13px;
}

.move-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.move-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6BA888;
}

.move-optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: #a8c5b0;
}

.move-input {
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
.move-input:focus {
  border-color: #2E7D52;
}

.move-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.move-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s, opacity 0.15s;
}
.move-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.move-btn--secondary {
  background: #EAF7F0;
  color: #2E7D52;
}
.move-btn--secondary:hover:not(:disabled) {
  background: #d4f0e4;
}

.move-btn--primary {
  background: #2E7D52;
  color: #fff;
}
.move-btn--primary:hover:not(:disabled) {
  background: #1e6b42;
}
</style>
