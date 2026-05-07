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
        <div class="add-meta-field">
          <span class="add-meta-label">Price <span class="add-meta-optional">(optional)</span></span>
          <div class="meta-price-box">
            <span class="meta-price-symbol">{{ pantrySymbol }}</span>
            <input
              v-model="newPrice"
              type="number"
              step="0.01"
              min="0"
              class="meta-price-input"
              placeholder="0.00"
            />
          </div>
        </div>
        <div class="add-meta-field add-meta-field--qty">
          <span class="add-meta-label">Quantity <span class="add-meta-optional">(optional)</span></span>
          <div class="meta-qty-row">
            <input
              v-model="newAmount"
              class="meta-input meta-input--qty"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              autocomplete="off"
            />
            <select v-model="newUnit" class="meta-select meta-select--unit">
              <option v-for="u in PANTRY_UNITS" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
        </div>
      </div>
      <div class="add-meta">
        <div class="add-meta-field" style="flex: 1; min-width: 0;">
          <span class="add-meta-label">Category</span>
          <select v-model="newCategory" class="meta-select meta-select--category">
            <option v-for="cat in CATEGORIES" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
          </select>
        </div>
        <div class="add-meta-field" style="flex: 1; min-width: 0;">
          <span class="add-meta-label">Density <span class="add-meta-optional">(optional)</span></span>
          <div class="meta-qty-row">
            <input
              v-model="newDensity"
              class="meta-input meta-input--qty"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              autocomplete="off"
            />
            <select v-model="newDensityUnit" class="meta-select meta-select--unit">
              <option v-for="u in DENSITY_UNITS" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
        </div>
      </div>
    </form>

    <AppScroller theme="green" class="items-area">

      <!-- Empty state -->
      <div v-if="showEmpty" class="empty-state">
        <v-icon size="32" color="#a8c5b0">mdi-cart-outline</v-icon>
        <p class="empty-title">Your list is empty</p>
        <p class="empty-sub">Add the first item above</p>
      </div>

      <!-- Unchecked items grouped by category -->
      <TransitionGroup name="cat-slide" tag="div" class="cat-list">
      <div v-for="cat in activeCategories" :key="cat" class="category-group">
        <div class="category-header">
          <span class="category-dot" :style="{ background: catColor(cat) }"></span>
          {{ catLabel(cat) }}
        </div>
        <TransitionGroup name="item-scale">
          <SwipeableListItem
            v-for="item in uncheckedByCategory[cat]"
            :key="item.id"
            :actions="[{ label: 'Delete', icon: 'mdi-close', color: '#c0392b', handler: () => deleteItem(item.id) }]"
            :itemId="item.id"
            class="list-swipe-wrapper"
          >
            <div
              class="list-item"
              :class="{ 'hold-pending': holdPendingId === item.id, 'list-item--selected': selectMode && isSelected(item.id) }"
              @pointerdown="onItemPointerDown(item)"
              @pointerup="onItemPointerUp"
              @pointercancel="onItemPointerUp"
              @pointerleave="onItemPointerLeave"
              @contextmenu.prevent
              @click="onItemClick(item.id)"
            >
              <AppCheckbox v-if="selectMode" :model-value="isSelected(item.id)" @update:model-value="toggleSelection(item.id)" />
              <button v-else class="check-btn" @click.stop="toggleChecked(item)" :aria-label="'Check ' + item.name">
                <v-icon size="18" color="#a8c5b0">mdi-checkbox-blank-circle-outline</v-icon>
              </button>
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.amount != null" class="item-qty">{{ clampQty(item.amount, item.unit, 9) }}</span>
            <span v-else-if="item.quantity" class="item-qty">{{ item.quantity }}</span>
              <span v-if="item.price != null" class="item-price">{{ pantrySymbol }}&nbsp;{{ clampPrice(item.price, 5) }}</span>
              <button v-if="!selectMode" class="delete-btn" @click.stop="deleteItem(item.id)" aria-label="Remove">
                <v-icon size="15" color="#c4b8bc">mdi-close</v-icon>
              </button>
            </div>
          </SwipeableListItem>
        </TransitionGroup>
      </div>
      </TransitionGroup>

      <!-- Done section -->
      <div v-if="checkedItems.length" class="category-group">
        <div class="category-header done-header">
          <span class="category-dot" style="background: #9ebbab"></span>
          Done
          <button class="clear-btn" @click="clearChecked">Clear</button>
        </div>
        <TransitionGroup name="item-scale">
          <div
            v-for="item in checkedItems"
            :key="item.id"
            class="list-item list-item--checked"
          >
            <button class="check-btn" @click="toggleChecked(item)" :aria-label="'Uncheck ' + item.name">
              <v-icon size="18" color="#5a9a72">mdi-checkbox-marked-circle</v-icon>
            </button>
            <span class="item-name item-name--checked">{{ item.name }}</span>
            <span v-if="item.amount != null" class="item-qty item-qty--checked">{{ clampQty(item.amount, item.unit, 9) }}</span>
            <span v-else-if="item.quantity" class="item-qty item-qty--checked">{{ item.quantity }}</span>
            <span v-if="item.price != null" class="item-price item-price--checked">{{ pantrySymbol }}&nbsp;{{ clampPrice(item.price, 5) }}</span>
            <button class="delete-btn" @click="deleteItem(item.id)" aria-label="Remove">
              <v-icon size="15" color="#c4b8bc">mdi-close</v-icon>
            </button>
          </div>
        </TransitionGroup>
      </div>

    </AppScroller>

    <!-- Bottom action bar -->
    <div v-if="uncheckedItems.length > 0" class="bottom-bar">
      <template v-if="!selectMode">
        <button class="bar-btn bar-btn--primary" @click="openMoveSheet(uncheckedItems)">Move all to pantry</button>
        <div v-if="estimatedTotal > 0" class="bar-total-pill">
          <span class="bar-total-label">Cart total</span>
          <span class="bar-total-value" :title="`${pantrySymbol} ${estimatedTotal.toFixed(2)}`">{{ pantrySymbol }}&nbsp;{{ clampPrice(estimatedTotal, 8) }}</span>
        </div>
      </template>
      <template v-else>
        <div class="bar-select-top">
          <button class="bar-text-btn" @click="exitSelectMode">Cancel</button>
          <span class="bar-count">{{ selectedCount }} selected</span>
          <button class="bar-text-btn" @click="selectAll">Select all</button>
        </div>
        <div class="bar-select-actions">
          <button class="bar-btn bar-btn--danger" :disabled="selectedCount === 0" @click="deleteSelected">
            Delete{{ selectedCount > 0 ? ` (${selectedCount})` : '' }}
          </button>
          <button class="bar-btn bar-btn--primary" :disabled="selectedCount === 0" @click="openMoveSheet(uncheckedItems.filter(i => selectedIds.has(i.id)))">
            Move{{ selectedCount > 0 ? ` (${selectedCount})` : '' }}
          </button>
        </div>
      </template>
    </div>

    <!-- Item detail sheet -->
    <DetailSheet
      :open="sheetOpen"
      @update:open="closeItemSheet"
      :title="sheetItem?.name ?? ''"
      :subtitle="sheetItem ? (catLabel(sheetItem.category) + (sheetItem.amount != null ? ' · ' + clampQty(sheetItem.amount, sheetItem.unit, 9) : (sheetItem.quantity ? ' · ' + sheetItem.quantity : ''))) : ''"
      theme="green"
    >
      <div v-if="sheetItem" class="item-sheet-body">

        <!-- VIEW mode -->
        <template v-if="sheetMode === 'view'">
          <div class="view-name-row">
            <div class="view-section view-section--name">
              <span class="view-section-label">Name</span>
              <div class="view-value-box">{{ sheetItem.name }}</div>
            </div>
            <div class="view-section view-section--price">
              <span class="view-section-label">Price</span>
              <div class="view-value-box" :class="{ 'view-value-empty': sheetItem.price == null }">
                {{ sheetItem.price != null ? `${pantrySymbol} ${clampPrice(sheetItem.price, 7)}` : '—' }}
              </div>
            </div>
          </div>
          <div class="view-inline-row">
            <div class="view-section">
              <span class="view-section-label">Quantity</span>
              <div class="view-value-box" :class="{ 'view-value-empty': sheetItem.amount == null && !sheetItem.quantity }">
                {{ sheetItem.amount != null ? clampQty(sheetItem.amount, sheetItem.unit, 14) : (sheetItem.quantity || '—') }}
              </div>
            </div>
            <div class="view-section">
              <span class="view-section-label">Density</span>
              <div class="view-value-box" :class="{ 'view-value-empty': sheetItem.density == null }">
                {{ sheetItem.density != null ? clampQty(sheetItem.density, sheetItem.density_unit, 14) : '—' }}
              </div>
            </div>
          </div>
          <div class="view-inline-row">
            <div class="view-section">
              <span class="view-section-label">Category</span>
              <div class="view-value-box">{{ catLabel(sheetItem.category) }}</div>
            </div>
            <div class="view-section">
              <span class="view-section-label">Expiry</span>
              <div class="view-value-box" :class="{ 'view-value-empty': !sheetItem.expiry_date }">
                {{ sheetItem.expiry_date ? formatExpiry(sheetItem.expiry_date) : '—' }}
              </div>
            </div>
          </div>
          <div class="view-section view-section--grow">
            <span class="view-section-label">Notes</span>
            <NotesField :model-value="sheetItem.notes ?? ''" mode="view" theme="green" empty-text="No notes for this item" />
          </div>
        </template>

        <!-- EDIT mode -->
        <template v-else>
          <div class="edit-name-row">
            <div class="item-edit-field item-edit-field--name">
              <label class="item-edit-label">Name</label>
              <input
                v-model="sheetForm.name"
                class="item-edit-input"
                placeholder="Item name"
                maxlength="120"
                autocomplete="off"
              />
            </div>
            <div class="item-edit-field item-edit-field--price">
              <label class="item-edit-label">Price <span class="item-edit-optional">(optional)</span></label>
              <div class="item-price-box">
                <span class="item-price-symbol">{{ pantrySymbol }}</span>
                <input
                  v-model="sheetForm.price"
                  type="number"
                  step="0.01"
                  min="0"
                  class="item-price-input"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <div class="edit-inline-row">
            <div class="item-edit-field">
              <label class="item-edit-label">Quantity <span class="item-edit-optional">(optional)</span></label>
              <div class="item-qty-row">
                <input
                  v-model="sheetForm.amount"
                  type="number"
                  min="0"
                  step="any"
                  class="item-edit-input"
                  placeholder="0"
                  autocomplete="off"
                />
                <select v-model="sheetForm.unit" class="item-edit-select item-edit-select--unit">
                  <option v-for="u in PANTRY_UNITS" :key="u" :value="u">{{ u }}</option>
                </select>
              </div>
            </div>
            <div class="item-edit-field">
              <label class="item-edit-label">Density <span class="item-edit-optional">(optional)</span></label>
              <div class="item-qty-row">
                <input
                  v-model="sheetForm.density"
                  type="number"
                  min="0"
                  step="any"
                  class="item-edit-input"
                  placeholder="0"
                  autocomplete="off"
                />
                <select v-model="sheetForm.density_unit" class="item-edit-select item-edit-select--unit">
                  <option v-for="u in DENSITY_UNITS" :key="u" :value="u">{{ u }}</option>
                </select>
              </div>
            </div>
          </div>
          <div class="edit-inline-row">
            <div class="item-edit-field">
              <label class="item-edit-label">Category</label>
              <select v-model="sheetForm.category" class="item-edit-select">
                <option v-for="cat in CATEGORIES" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
              </select>
            </div>
            <div class="item-edit-field">
              <label class="item-edit-label">Expiry <span class="item-edit-optional">(optional)</span></label>
              <input
                v-model="sheetForm.expiry_date"
                type="date"
                class="item-edit-input item-edit-input--date"
              />
            </div>
          </div>
          <div class="item-edit-field item-edit-field--grow">
            <label class="item-edit-label">Notes <span class="item-edit-optional">(optional)</span></label>
            <NotesField v-model="sheetForm.notes" mode="edit" theme="green" :max="300" placeholder="e.g. check brand, get organic" />
          </div>
        </template>

      </div>

      <template #footer>
        <div class="item-sheet-footer-left">
          <IconAction
            icon="mdi-delete-outline"
            label="Delete item"
            color="#c0392b"
            bg="#fbeaea"
            border="#f5c6c6"
            :loading="sheetDeleting ? 'Deleting...' : ''"
            :disabled="sheetDeleting"
            @click="deleteSheetItem"
          />
          <IconAction
            v-if="sheetMode === 'view'"
            icon="mdi-pencil"
            label="Edit item"
            color="#2E7D52"
            bg="#EAF7F0"
            border="#B8E6D0"
            @click="switchToEdit"
          />
        </div>
        <div v-if="sheetMode === 'edit'" class="item-sheet-footer-right">
          <button class="item-btn-cancel" @click="cancelEdit">Cancel</button>
          <button class="item-btn-save" @click="saveItem" :disabled="sheetSaving || !sheetForm.name.trim()">
            {{ sheetSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </template>
    </DetailSheet>

    <!-- Unified move-to-pantry sheet -->
    <DetailSheet
      :open="moveSheetOpen"
      @update:open="closeMoveSheet"
      title="Move to pantry"
      :subtitle="`${moveItems.length} item${moveItems.length !== 1 ? 's' : ''}`"
      theme="green"
    >
      <AppScroller theme="green" class="move-list">
        <div v-for="item in moveItems" :key="item.id" class="move-list-item">
          <div class="move-item-info">
            <span class="move-item-name">{{ item.name }}</span>
            <span v-if="item.amount != null" class="move-item-qty">{{ clampQty(item.amount, item.unit, 9) }}</span>
            <span v-else-if="item.quantity" class="move-item-qty">{{ item.quantity }}</span>
          </div>
          <div class="move-item-expiry-field">
            <label class="move-expiry-label">Expiry <span class="move-expiry-optional">(optional)</span></label>
            <input
              v-model="moveExpiries[item.id]"
              type="date"
              class="move-expiry-input"
            />
          </div>
        </div>
      </AppScroller>

      <template #footer>
        <button class="move-sheet-cancel" @click="closeMoveSheet" :disabled="moveLoading">Cancel</button>
        <button class="move-sheet-confirm" @click="confirmMove" :disabled="moveLoading">
          {{ moveLoading ? 'Moving…' : `Move ${moveItems.length} item${moveItems.length !== 1 ? 's' : ''}` }}
        </button>
      </template>
    </DetailSheet>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { API, apiFetch } from '../../api'
import AppScroller from '@/components/ui/AppScroller.vue'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import SwipeableListItem from '@/components/ui/SwipeableListItem.vue'
import DetailSheet from '@/components/ui/DetailSheet.vue'
import IconAction from '@/components/ui/IconAction.vue'
import NotesField from '@/components/ui/NotesField.vue'
import { usePreferences } from '../../composables/usePreferences'
import { CURRENCIES } from '../../constants/currencies'
import { PANTRY_UNITS, DENSITY_UNITS } from '../../constants/units'
import { clampPrice, clampQty } from '../../constants/format'

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

const newName = ref('')
const newCategory = ref('other')
const newAmount = ref('')
const newUnit = ref('pcs')
const newPrice = ref('')
const newDensity = ref('')
const newDensityUnit = ref('g/ml')

const { preferences, fetchPreferences } = usePreferences()

const pantrySymbol = computed(() => {
  const cur = preferences.value.pantry_currency ?? 'USD'
  if (cur === 'OTHER') return preferences.value.pantry_currency_custom_symbol ?? ''
  return CURRENCIES.find(c => c.value === cur)?.symbol ?? '$'
})

const uncheckedItems = computed(() => items.value.filter(i => !i.checked))
const checkedItems = computed(() => items.value.filter(i => i.checked))

const estimatedTotal = computed(() =>
  uncheckedItems.value
    .filter(i => i.price != null)
    .reduce((sum, i) => sum + i.price, 0)
)

const showEmpty = ref(false)
watch(
  () => items.value.length === 0 && !loading.value,
  (isEmpty) => {
    if (isEmpty) setTimeout(() => { showEmpty.value = true }, 200)
    else showEmpty.value = false
  },
  { immediate: true }
)

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
  const densityProvided = newDensity.value !== '' && parseFloat(newDensity.value) > 0
  const res = await apiFetch(`${API}/pantry/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: newName.value.trim(),
      category: newCategory.value,
      amount: newAmount.value !== '' ? parseFloat(newAmount.value) : null,
      unit: newAmount.value !== '' ? newUnit.value : null,
      price: newPrice.value !== '' ? parseFloat(newPrice.value) : null,
      density: densityProvided ? parseFloat(newDensity.value) : null,
      density_unit: densityProvided ? newDensityUnit.value : null,
    }),
  })
  if (res.ok) {
    const item = await res.json()
    items.value.push(item)
    newName.value = ''
    newCategory.value = 'other'
    newAmount.value = ''
    newUnit.value = 'pcs'
    newPrice.value = ''
    newDensity.value = ''
    newDensityUnit.value = 'g/ml'
  }
  adding.value = false
}

async function toggleChecked(item) {
  if (!item.checked) {
    openMoveSheet([item])
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


async function deleteItem(id) {
  const res = await apiFetch(`${API}/pantry/list/${id}`, { method: 'DELETE' })
  if (res.ok) items.value = items.value.filter(i => i.id !== id)
}

async function clearChecked() {
  const res = await apiFetch(`${API}/pantry/list/checked`, { method: 'DELETE' })
  if (res.ok) items.value = items.value.filter(i => !i.checked)
}

// ── Item detail sheet ─────────────────────────────────────────────────────────

const sheetItem = ref(null)
const sheetOpen = ref(false)
const sheetMode = ref('view')
const sheetForm = ref({ name: '', category: 'other', expiry_date: '', price: '', notes: '', amount: '', unit: 'pcs', density: '', density_unit: 'g/ml' })
const sheetSaving = ref(false)
const sheetDeleting = ref(false)

function openItemSheet(item) {
  sheetItem.value = item
  sheetForm.value = {
    name:         item.name,
    category:     item.category ?? 'other',
    expiry_date:  item.expiry_date ?? '',
    price:        item.price != null ? String(item.price) : '',
    notes:        item.notes ?? '',
    amount:       item.amount != null ? String(item.amount) : '',
    unit:         item.unit ?? 'pcs',
    density:      item.density != null ? String(item.density) : '',
    density_unit: item.density_unit ?? 'g/ml',
  }
  sheetMode.value = 'view'
  sheetOpen.value = true
}

function closeItemSheet() {
  sheetOpen.value = false
  sheetItem.value = null
  sheetMode.value = 'view'
}

function switchToEdit() {
  sheetMode.value = 'edit'
}

function cancelEdit() {
  sheetMode.value = 'view'
  sheetForm.value = {
    name:         sheetItem.value.name,
    category:     sheetItem.value.category ?? 'other',
    expiry_date:  sheetItem.value.expiry_date ?? '',
    price:        sheetItem.value.price != null ? String(sheetItem.value.price) : '',
    notes:        sheetItem.value.notes ?? '',
    amount:       sheetItem.value.amount != null ? String(sheetItem.value.amount) : '',
    unit:         sheetItem.value.unit ?? 'pcs',
    density:      sheetItem.value.density != null ? String(sheetItem.value.density) : '',
    density_unit: sheetItem.value.density_unit ?? 'g/ml',
  }
}

async function saveItem() {
  if (!sheetForm.value.name.trim() || sheetSaving.value) return
  sheetSaving.value = true
  const densityProvided = sheetForm.value.density !== '' && parseFloat(sheetForm.value.density) > 0
  const res = await apiFetch(`${API}/pantry/list/${sheetItem.value.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:         sheetForm.value.name.trim(),
      category:     sheetForm.value.category,
      expiry_date:  sheetForm.value.expiry_date || null,
      price:        sheetForm.value.price !== '' ? sheetForm.value.price : null,
      notes:        sheetForm.value.notes.trim() || null,
      amount:       sheetForm.value.amount !== '' ? parseFloat(sheetForm.value.amount) : null,
      unit:         sheetForm.value.amount !== '' ? sheetForm.value.unit : null,
      density:      densityProvided ? parseFloat(sheetForm.value.density) : null,
      density_unit: densityProvided ? sheetForm.value.density_unit : null,
    }),
  })
  if (res.ok) {
    const updated = await res.json()
    const idx = items.value.findIndex(i => i.id === sheetItem.value.id)
    if (idx !== -1) items.value[idx] = updated
    sheetItem.value = updated
    sheetMode.value = 'view'
  }
  sheetSaving.value = false
}

async function deleteSheetItem() {
  if (sheetDeleting.value) return
  sheetDeleting.value = true
  const res = await apiFetch(`${API}/pantry/list/${sheetItem.value.id}`, { method: 'DELETE' })
  if (res.ok) {
    items.value = items.value.filter(i => i.id !== sheetItem.value.id)
    closeItemSheet()
  }
  sheetDeleting.value = false
}

function formatExpiry(date) {
  if (!date) return null
  const [y, m, d] = date.split('-')
  return `${d} / ${m} / ${y}`
}


// ── Multi-select ──────────────────────────────────────────────────────────────

const selectMode = ref(false)
const selectedIds = ref(new Set())
const holdPendingId = ref(null)
const holdVibrateTimer = ref(null)
const holdTimer = ref(null)
let holdJustActivated = false

const selectedCount = computed(() => selectedIds.value.size)

function isSelected(id) {
  return selectedIds.value.has(id)
}

function onItemPointerDown(item) {
  if (selectMode.value) return
  holdVibrateTimer.value = setTimeout(() => {
    holdPendingId.value = item.id
  }, 250)
  holdTimer.value = setTimeout(() => {
    clearHoldTimers()
    holdJustActivated = true
    selectMode.value = true
    selectedIds.value = new Set([item.id])
  }, 500)
}

function onItemPointerUp() {
  clearHoldTimers()
}

function onItemPointerLeave() {
  if (holdVibrateTimer.value || holdTimer.value) clearHoldTimers()
}

function clearHoldTimers() {
  clearTimeout(holdVibrateTimer.value)
  clearTimeout(holdTimer.value)
  holdVibrateTimer.value = null
  holdTimer.value = null
  holdPendingId.value = null
}

function onItemClick(id) {
  if (holdJustActivated) { holdJustActivated = false; return }
  if (selectMode.value) { toggleSelection(id); return }
  const item = items.value.find(i => i.id === id)
  if (item && !item.checked) openItemSheet(item)
}

function toggleSelection(id) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

function selectAll() {
  selectedIds.value = new Set(uncheckedItems.value.map(i => i.id))
}

function exitSelectMode() {
  selectMode.value = false
  selectedIds.value = new Set()
}

// ── Move-to-pantry sheet ──────────────────────────────────────────────────────

const moveSheetOpen = ref(false)
const moveItems = ref([])
const moveExpiries = ref({})
const moveLoading = ref(false)

function openMoveSheet(itemsToMove) {
  moveItems.value = itemsToMove
  moveExpiries.value = Object.fromEntries(
    itemsToMove.map(i => [i.id, i.expiry_date ?? ''])
  )
  moveSheetOpen.value = true
}

function closeMoveSheet() {
  moveSheetOpen.value = false
  moveItems.value = []
  moveExpiries.value = {}
}

async function confirmMove() {
  moveLoading.value = true
  for (const item of moveItems.value) {
    await apiFetch(`${API}/pantry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:         item.name,
        category:     item.category || 'other',
        expiry_date:  moveExpiries.value[item.id] || null,
        amount:       item.amount ?? null,
        unit:         item.unit ?? null,
        density:      item.density ?? null,
        density_unit: item.density_unit ?? null,
      }),
    })
    await apiFetch(`${API}/pantry/list/${item.id}`, { method: 'DELETE' })
    items.value = items.value.filter(i => i.id !== item.id)
  }
  emit('moved')
  moveLoading.value = false
  closeMoveSheet()
  exitSelectMode()
}

async function deleteSelected() {
  const ids = [...selectedIds.value]
  for (const id of ids) {
    await apiFetch(`${API}/pantry/list/${id}`, { method: 'DELETE' })
    items.value = items.value.filter(i => i.id !== id)
  }
  exitSelectMode()
}

onMounted(() => { load(); fetchPreferences() })
</script>

<style scoped>
.shopping-root {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: calc(100vh - 2.5rem);
  overflow: hidden;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 1279px) {
  .shopping-root { height: 100%; overflow: visible; }
}

.items-area {
  flex: 1;
  overscroll-behavior-y: contain;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  padding-right: 4px;
  box-sizing: border-box;
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
  align-items: flex-end;
}

.add-meta-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.add-meta-field--qty {
  flex: 1;
  min-width: 0;
}

.add-meta-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6BA888;
  padding-left: 2px;
}

.add-meta-optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: #a8c5b0;
}

.meta-qty-row {
  display: flex;
  gap: 4px;
}

.meta-price-box {
  display: flex;
  align-items: center;
  gap: 3px;
  border: 1.5px solid var(--panel-border);
  border-radius: 8px;
  padding: 7px 10px;
  background: #fff;
  width: 90px;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.meta-price-box:focus-within {
  border-color: #2E7D52;
}

.meta-price-symbol {
  font-size: 12px;
  font-weight: 600;
  color: #2E7D52;
  flex-shrink: 0;
}

.meta-price-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 12px;
  color: #1A4D35;
  padding: 0;
}
.meta-price-input::placeholder { color: #6BA888; }
.meta-price-input::-webkit-outer-spin-button,
.meta-price-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.meta-price-input { -moz-appearance: textfield; }

.meta-input[type="number"]::-webkit-outer-spin-button,
.meta-input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.meta-input[type="number"] { -moz-appearance: textfield; }

.meta-input {
  border: 1.5px solid var(--panel-border);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: #1A4D35;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
  min-width: 0;
}
.meta-input:focus {
  border-color: #2E7D52;
}
.meta-input::placeholder {
  color: #6BA888;
}
.meta-input--qty {
  flex: 1;
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
  min-width: 0;
}
.meta-select--unit {
  flex: 0 0 64px;
}
.meta-select--category {
  width: 100%;
  border: 1.5px solid var(--panel-border);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: #1A4D35;
  background: #fff;
  outline: none;
  cursor: pointer;
  box-sizing: border-box;
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

.cat-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
.list-swipe-wrapper {
  border-radius: 10px;
}

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

.list-item--selected {
  background: #d4f0e4;
  border-color: #2E7D52;
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
  min-width: 0;
  font-size: 14px;
  color: #1A4D35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-name--checked {
  text-decoration: line-through;
  color: #6BA888;
}

.item-qty {
  font-size: 12px;
  color: #6BA888;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-qty--checked {
  color: #9ECDB6;
}

.item-price {
  font-size: 12px;
  font-weight: 700;
  color: #2E7D52;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-price--checked {
  color: #9ECDB6;
  text-decoration: line-through;
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

/* Bottom action bar */
.bottom-bar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-select-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bar-count {
  font-size: 12px;
  font-weight: 600;
  color: #6BA888;
}

.bar-text-btn {
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 600;
  color: #2E7D52;
  cursor: pointer;
  padding: 4px 2px;
}

.bar-select-actions {
  display: flex;
  gap: 8px;
}

.bar-btn {
  flex: 1;
  padding: 11px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.bar-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.bar-btn--primary {
  background: #EAF7F0;
  color: #2E7D52;
  border: 1px solid #B8E6D0;
}
.bar-btn--primary:hover:not(:disabled) { background: #d4f0e4; }

.bar-btn--danger {
  background: #fbeaea;
  color: #c0392b;
}
.bar-btn--danger:hover:not(:disabled) { background: #f5d5d5; }

/* Move-to-pantry sheet content */
.move-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.move-list-item {
  padding: 10px 12px;
  background: #EAF7F0;
  border: 1.5px solid #B8E6D0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.move-item-info {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.move-item-name {
  font-size: 14px;
  font-weight: 600;
  color: #1A4D35;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.move-item-qty {
  font-size: 12px;
  color: #6BA888;
}

.move-item-expiry-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.move-expiry-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6BA888;
  padding-left: 2px;
}

.move-expiry-optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: #a8c5b0;
}

.move-expiry-input {
  width: 100%;
  border: 1.5px solid #B8E6D0;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  color: #1A4D35;
  background: #fff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
  cursor: pointer;
}
.move-expiry-input:focus { border-color: #2E7D52; }
.move-expiry-input::-webkit-calendar-picker-indicator {
  opacity: 0.5;
  cursor: pointer;
  filter: invert(40%) sepia(40%) saturate(400%) hue-rotate(100deg);
}

.move-sheet-cancel {
  background: none;
  border: 1px solid #B8E6D0;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #2E7D52;
  cursor: pointer;
  transition: background 0.15s;
}
.move-sheet-cancel:hover:not(:disabled) { background: #EAF7F0; }
.move-sheet-cancel:disabled { opacity: 0.4; cursor: default; }

.move-sheet-confirm {
  flex: 1;
  background: #2E7D52;
  border: none;
  border-radius: 10px;
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.move-sheet-confirm:hover:not(:disabled) { background: #1e6b42; }
.move-sheet-confirm:disabled { opacity: 0.4; cursor: default; }

/* ── Item detail sheet ───────────────────────────────────────── */
.item-sheet-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 420px;
}

.view-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.view-section--grow {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.view-inline-row {
  display: flex;
  gap: 8px;
}

.view-inline-row .view-section {
  flex: 1;
  min-width: 0;
}

.view-name-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.view-section--name {
  flex: 1;
  min-width: 0;
}

.view-section--price {
  flex: 0 0 110px;
  min-width: 0;
}

.edit-name-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.item-edit-field--name {
  flex: 1;
  min-width: 0;
}

.item-edit-field--price {
  flex: 0 0 110px;
  min-width: 0;
}


.view-section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6BA888;
  padding-left: 2px;
  margin: 0 0 5px;
}

.view-value-box {
  padding: 10px 12px;
  background: #EAF7F0;
  border: 1.5px solid #B8E6D0;
  border-radius: 12px;
  font-size: 13px;
  color: #1A4D35;
  font-weight: 500;
  line-height: 1.5;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-width: 0;
}


.view-value-empty {
  color: #9ECDB6;
  font-weight: 400;
  font-style: italic;
}

.edit-inline-row {
  display: flex;
  gap: 8px;
}

.edit-inline-row .item-edit-field {
  flex: 1;
  min-width: 0;
}


.item-edit-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.item-edit-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6BA888;
  padding-left: 2px;
  margin: 0 0 5px;
}

.item-edit-optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: #a8c5b0;
}

.item-edit-input,
.item-edit-select {
  width: 100%;
  border: 1.5px solid #B8E6D0;
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  color: #1A4D35;
  background: #EAF7F0;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.item-edit-input:focus,
.item-edit-select:focus {
  border-color: #2E7D52;
}

.item-edit-input::placeholder { color: #9ECDB6; }

.item-edit-select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236BA888'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 30px;
  cursor: pointer;
}

.item-price-input::-webkit-outer-spin-button,
.item-price-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.item-price-input { -moz-appearance: textfield; }

.item-edit-input--date {
  cursor: pointer;
}
.item-edit-input--date::-webkit-datetime-edit {
  padding: 0;
}
.item-edit-input--date::-webkit-datetime-edit-fields-wrapper {
  padding: 0;
}
.item-edit-input--date::-webkit-calendar-picker-indicator {
  opacity: 0.5;
  cursor: pointer;
  filter: invert(40%) sepia(40%) saturate(400%) hue-rotate(100deg);
  margin-left: auto;
  padding: 0;
}

.item-qty-row {
  display: flex;
  gap: 4px;
  overflow: hidden;
}
.item-qty-row .item-edit-input { flex: 1; min-width: 0; }
.item-edit-select--unit { flex: 0 0 70px; }

.item-price-box {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #EAF7F0;
  border: 1.5px solid #B8E6D0;
  border-radius: 12px;
  padding: 10px 12px;
  transition: border-color 0.15s;
}
.item-price-box:focus-within { border-color: #2E7D52; }

.item-price-symbol {
  font-size: 13px;
  font-weight: 600;
  color: #2E7D52;
  flex-shrink: 0;
}

.item-price-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  font-weight: 500;
  color: #1A4D35;
  padding: 0;
}
.item-price-input::placeholder { color: #9ECDB6; }

.bar-total-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 11px 16px;
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  border-radius: 12px;
  flex-shrink: 0;
  min-width: 0;
}

.bar-total-label {
  font-size: 14px;
  font-weight: 600;
  color: #2E7D52;
  white-space: nowrap;
  flex-shrink: 0;
}

.bar-total-value {
  font-size: 14px;
  font-weight: 700;
  color: #2E7D52;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  text-align: right;
}

.item-sheet-footer-left {
  display: flex;
  gap: 20px;
  align-items: flex-end;
}

.item-sheet-footer-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.item-btn-cancel {
  background: none;
  border: 1px solid #B8E6D0;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #2E7D52;
  cursor: pointer;
  transition: background 0.15s;
}
.item-btn-cancel:hover { background: #EAF7F0; }

.item-btn-save {
  background: #2E7D52;
  border: none;
  border-radius: 10px;
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.item-btn-save:hover:not(:disabled) { background: #1e6b42; }
.item-btn-save:disabled { opacity: 0.4; cursor: default; }

.item-edit-field--grow {
  flex: 1;
  display: flex;
  flex-direction: column;
}

</style>
