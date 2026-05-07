<template>
  <div class="inventory-root">

    <p class="col-label">Pantry</p>

    <!-- Stats summary card -->
    <div class="stats-card">
      <p class="stats-card-title">Pantry Summary</p>
      <div class="stats-row">
        <span class="stats-label">Total items</span>
        <span class="stats-value">{{ items.length }}</span>
      </div>
      <div class="stats-row">
        <span class="stats-label">Expiring soon</span>
        <span class="stats-value" :class="{ 'stats-value--warn': expiringSoonCount > 0 }">{{ expiringSoonCount }}</span>
      </div>
      <div class="stats-row">
        <span class="stats-label">Expired</span>
        <span class="stats-value" :class="{ 'stats-value--danger': expiredCount > 0 }">{{ expiredCount }}</span>
      </div>
    </div>

    <!-- Inventory card — scrollable, fills available space -->
    <div class="inventory-card">
      <p class="inventory-title">Inventory</p>
      <AppScroller theme="green" class="items-area" ref="itemsArea">
        <div v-if="!loading && items.length === 0" class="empty-state">
          <v-icon size="32" color="#a8c5b0">mdi-fridge-outline</v-icon>
          <p class="empty-title">Pantry is empty</p>
          <p class="empty-sub">Check items off your shopping list to stock it up</p>
        </div>
        <TransitionGroup :name="animEnabled ? 'item-scale' : ''">
          <SwipeableListItem
            v-for="item in items"
            :key="item.id"
            :actions="itemActions(item)"
            :itemId="item.id"
            :borderColor="expiryBorderColor(item)"
            class="pantry-swipe-wrapper"
          >
            <div class="pantry-item" :class="expiryClass(item)" @click="openItemSheet(item)">
              <div class="pantry-item-main">
                <span class="pantry-name">{{ item.name }}</span>
                <span class="pantry-item-right">
                  <span v-if="item.category" class="cat-chip" :style="{ background: catChipBg(item.category), color: catChipColor(item.category) }">{{ catLabel(item.category) }}</span>
                  <span class="pantry-qty-col">{{ displayQty(item) }}</span>
                </span>
              </div>
              <div class="pantry-meta" :style="{ visibility: !item.expiry_date && !item.notes ? 'hidden' : 'visible' }">
                <div class="pantry-meta-left" :style="{ visibility: item.expiry_date ? 'visible' : 'hidden' }">
                  <v-icon size="11" :color="expiryIconColor(item)">mdi-calendar-clock</v-icon>
                  <span class="expiry-label">{{ expiryLabel(item) }}</span>
                  <span class="expiry-date">{{ formatExpiryDate(item) }}</span>
                </div>
                <div class="pantry-meta-right" :style="{ visibility: item.notes ? 'visible' : 'hidden' }">{{ item.notes }}</div>
              </div>
            </div>
          </SwipeableListItem>
        </TransitionGroup>
      </AppScroller>
    </div>

    <!-- Item detail sheet -->
    <DetailSheet
      :open="sheetOpen"
      @update:open="closeItemSheet"
      :title="sheetItem?.name ?? ''"
      :subtitle="sheetItem ? (catLabel(sheetItem.category) + (displayQty(sheetItem) ? ' · ' + displayQty(sheetItem) : '')) : ''"
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
              <div class="view-value-box" :class="{ 'view-value-empty': sheetItem.amount == null }">
                {{ sheetItem.amount != null ? clampQty(sheetItem.amount, sheetItem.unit, 14) : '—' }}
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
              <div class="view-value-box" :class="[{ 'view-value-empty': !sheetItem.expiry_date }, expiryClass(sheetItem) ? `view-value-box--${expiryClass(sheetItem)}` : '']">
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
            <NotesField v-model="sheetForm.notes" mode="edit" theme="green" :max="300" placeholder="e.g. opened, keep refrigerated" />
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
          <IconAction
            v-if="sheetMode === 'view'"
            icon="mdi-check-circle-outline"
            label="Mark used"
            color="#2E7D52"
            bg="#EAF7F0"
            border="#B8E6D0"
            @click="openConsumeDialog(sheetItem, 'use')"
          />
          <IconAction
            v-if="sheetMode === 'view'"
            icon="mdi-trash-can-outline"
            label="Mark wasted"
            color="#8B5A00"
            bg="#FFF8E7"
            border="#F5D78A"
            @click="openConsumeDialog(sheetItem, 'waste')"
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

    <!-- Expired counter — always visible -->
    <div class="expired-card" :class="{ 'expired-card--clean': expiredCount === 0 }">
      <p class="expired-card-label">Expiry</p>
      <template v-if="expiredCount > 0">
        <button class="expired-header" @click="expiredOpen = !expiredOpen">
          <v-icon size="14" color="#b45309">mdi-alert-outline</v-icon>
          <span class="expired-title">{{ expiredCount }} expired item{{ expiredCount > 1 ? 's' : '' }} in pantry</span>
          <v-icon size="14" color="#b45309" :style="{ transform: expiredOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }">mdi-chevron-down</v-icon>
        </button>
        <AppScroller v-if="expiredOpen" theme="green" class="expired-list">
          <li v-for="item in expiredItems" :key="item.id" class="expired-item">
            <span class="expired-name">{{ item.name }}</span>
            <span class="expired-ago">{{ expiryLabel(item) }}</span>
          </li>
        </AppScroller>
      </template>
      <template v-else>
        <div class="expired-clean">
          <v-icon size="14" color="#16a34a">mdi-check-circle-outline</v-icon>
          <span class="expired-clean-text">No expired items — pantry is fresh</span>
        </div>
      </template>
    </div>


    <ConfirmDialog
      :open="showDeleteConfirm"
      @update:open="showDeleteConfirm = $event"
      icon="mdi-delete-outline"
      title="Delete this item?"
      :loading="sheetDeleting"
      @confirm="confirmDelete"
    >{{ deleteTarget?.name }}<br>{{ deleteTarget?.expiry_date ? formatExpiryDate(deleteTarget) : 'No expiry date set' }} · {{ displayQty(deleteTarget) || 'No quantity set' }}<br><span style="font-size:11px;color:#c0392b;">This is permanent and won't count toward pantry history.</span></ConfirmDialog>

    <ConfirmDialog
      :open="consumeOpen"
      @update:open="consumeOpen = $event"
      :icon="consumeAction === 'use' ? 'mdi-check-circle-outline' : 'mdi-trash-can-outline'"
      :iconColor="consumeAction === 'use' ? '#2E7D52' : '#8B5A00'"
      :title="consumeAction === 'use' ? 'How much did you use?' : 'How much was wasted?'"
      :confirmLabel="consumeIsAll ? (consumeAction === 'use' ? 'Mark all used' : 'Mark all wasted') : (consumeAction === 'use' ? 'Mark used' : 'Mark wasted')"
      loadingLabel="Marking..."
      :confirmColor="consumeAction === 'use' ? '#2E7D52' : '#8B5A00'"
      :loading="consumeLoading"
      :theme="consumeAction === 'use' ? 'green' : 'amber'"
      :descMaxLines="3"
      @confirm="confirmConsume"
    >{{ consumeItem?.name }}
      <template #content>
        <div v-if="consumeItem?.amount != null" class="consume-row">
          <input
            v-model="consumeAmount"
            type="number"
            min="0"
            step="any"
            class="consume-amount-input"
            placeholder="Amount"
          />
          <select v-model="consumeUnit" class="consume-unit-select">
            <option v-for="u in compatibleUnits(consumeItem.unit, consumeItem.density, consumeItem.density_unit)" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>
        <div v-if="consumeItem?.amount != null" class="consume-density-hint" :class="consumeItem.density ? 'consume-density-hint--set' : 'consume-density-hint--unset'">
          <v-icon v-if="consumeItem.density" size="12" color="#2E7D52">mdi-check-circle-outline</v-icon>
          <v-icon v-else size="12" color="#6BA888">mdi-information-outline</v-icon>
          <span>{{ consumeDensityHint }}</span>
        </div>
        <p class="consume-desc-text">{{ consumeDescription }}</p>
      </template>
    </ConfirmDialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { API, apiFetch } from '../../api'
import DetailSheet from '@/components/ui/DetailSheet.vue'
import IconAction from '@/components/ui/IconAction.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AppScroller from '@/components/ui/AppScroller.vue'
import SwipeableListItem from '@/components/ui/SwipeableListItem.vue'
import NotesField from '@/components/ui/NotesField.vue'
import { usePreferences } from '../../composables/usePreferences'
import { CURRENCIES } from '../../constants/currencies'
import { PANTRY_UNITS, DENSITY_UNITS, convertToUnit, compatibleUnits } from '@/constants/units'
import { clampNumber, clampPrice, clampQty } from '@/constants/format'

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
  produce:   { bg: '#e8f5ec', text: '#2e7d52' },
  dairy:     { bg: '#e3f2fa', text: '#1565c0' },
  meat:      { bg: '#fdecea', text: '#c62828' },
  bakery:    { bg: '#fdf3e7', text: '#e65100' },
  frozen:    { bg: '#ede7f6', text: '#4527a0' },
  dry_goods: { bg: '#efebe9', text: '#4e342e' },
  other:     { bg: '#f5f5f5', text: '#616161' },
}
function catLabel(val) { return CATEGORIES.find(c => c.value === val)?.label ?? val }

function catChipBg(val)    { return CAT_COLORS[val]?.bg    ?? '#f5f5f5' }
function catChipColor(val) { return CAT_COLORS[val]?.text  ?? '#616161' }
function displayQty(item, budget = 8) {
  if (!item || item.amount == null) return ''
  return clampQty(item.amount, item.unit, budget)
}

const { preferences, fetchPreferences } = usePreferences()

const pantrySymbol = computed(() => {
  const cur = preferences.value.pantry_currency ?? 'USD'
  if (cur === 'OTHER') return preferences.value.pantry_currency_custom_symbol ?? ''
  return CURRENCIES.find(c => c.value === cur)?.symbol ?? '$'
})

const items = ref([])
const loading = ref(true)
const animEnabled = ref(false)
const itemsArea = ref(null)

let touchStartY = 0
function onItemsAreaTouchStart(e) { touchStartY = e.touches[0].clientY }
function onItemsAreaTouchMove(e) {
  if (itemsArea.value?.scrollTop === 0 && e.touches[0].clientY > touchStartY) {
    e.preventDefault()
  }
}

const expiredOpen = ref(false)

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

function expiryBorderColor(item) {
  const cls = expiryClass(item)
  if (cls === 'expiry--soon')      return '#fbbf24'
  if (cls === 'expiry--very-soon') return '#fb923c'
  if (cls === 'expiry--today')     return '#f87171'
  if (cls === 'expiry--expired')   return '#e0e0e0'
  return undefined
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

function formatExpiryDate(item) {
  if (!item.expiry_date) return ''
  const d = new Date(item.expiry_date + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function expiryLabel(item) {
  const days = daysUntilExpiry(item)
  if (days === null) return ''
  if (days < 0)  return `Expired ${Math.abs(days)}d ago`
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Tomorrow'
  return `${days}d left`
}

const expiredItems = computed(() =>
  items.value.filter(i => {
    const days = daysUntilExpiry(i)
    return days !== null && days < 0
  })
)
const expiredCount = computed(() => expiredItems.value.length)
const expiringSoonCount = computed(() =>
  items.value.filter(i => {
    const days = daysUntilExpiry(i)
    return days !== null && days >= 0 && days <= 7
  }).length
)

async function load() {
  animEnabled.value = false
  loading.value = true
  const res = await apiFetch(`${API}/pantry`)
  if (res.ok) items.value = await res.json()
  loading.value = false
  await nextTick()
  animEnabled.value = true
}

onMounted(() => {
  load()
  fetchPreferences()
  itemsArea.value?.$el?.addEventListener('touchstart', onItemsAreaTouchStart, { passive: true })
  itemsArea.value?.$el?.addEventListener('touchmove', onItemsAreaTouchMove, { passive: false })
})
onUnmounted(() => {
  itemsArea.value?.$el?.removeEventListener('touchstart', onItemsAreaTouchStart)
  itemsArea.value?.$el?.removeEventListener('touchmove', onItemsAreaTouchMove)
})
defineExpose({ reload: load })

// ── Item detail sheet ─────────────────────────────────────────────────────────

const sheetItem = ref(null)
const sheetOpen = ref(false)
const sheetMode = ref('view')
const sheetForm = ref({ name: '', quantity: '', category: 'other', expiry_date: '', notes: '', price: '', amount: '', unit: '', density: '', density_unit: 'g/ml' })
const sheetSaving = ref(false)
const sheetDeleting = ref(false)
const showDeleteConfirm = ref(false)
const deleteTarget = ref(null)
const consumeOpen = ref(false)
const consumeAction = ref('use')
const consumeItem = ref(null)
const consumeAmount = ref('')
const consumeUnit = ref('g')
const consumeLoading = ref(false)

const consumeRemainder = computed(() => {
  if (!consumeItem.value || consumeItem.value.amount == null) return null
  const consumed = parseFloat(consumeAmount.value) || 0
  if (!consumed) return consumeItem.value.amount
  const itemUnit = consumeItem.value.unit
  const convertedConsumed = convertToUnit(consumed, consumeUnit.value, itemUnit, consumeItem.value.density, consumeItem.value.density_unit)
  if (convertedConsumed === null) return null
  return parseFloat((consumeItem.value.amount - convertedConsumed).toPrecision(8))
})
const consumeIsAll = computed(() =>
  consumeItem.value?.amount == null || consumeAmount.value === '' || consumeAmount.value === null
)
const consumeWillRemove = computed(() => {
  if (consumeItem.value?.amount == null) return true
  if (consumeIsAll.value) return true
  return consumeRemainder.value !== null && consumeRemainder.value <= 0
})
const consumeDescription = computed(() => {
  if (!consumeItem.value) return ''
  const verb = consumeAction.value === 'use' ? 'used' : 'wasted'
  if (consumeItem.value.amount == null) {
    return `No tracked amount set — this will mark the item as ${verb} and remove it from your pantry.`
  }
  if (consumeIsAll.value) {
    const totalStr = clampNumber(consumeItem.value.amount, 8)
    return `${totalStr} ${consumeItem.value.unit} — the full amount will be removed from your pantry.`
  }
  const consumed = parseFloat(consumeAmount.value) || 0
  if (!consumed) return `Enter how much you ${verb}.`
  const itemUnit = consumeItem.value.unit
  const sameUnit = consumeUnit.value === itemUnit
  const convertedConsumed = convertToUnit(consumed, consumeUnit.value, itemUnit, consumeItem.value.density, consumeItem.value.density_unit)
  if (convertedConsumed === null) {
    return `Can't convert ${consumeUnit.value} to ${itemUnit} — please use a compatible unit.`
  }
  const remainder = parseFloat((consumeItem.value.amount - convertedConsumed).toPrecision(8))
  const consumedStr = clampNumber(consumed, 8)
  const convertedStr = clampNumber(convertedConsumed, 8)
  const remainderStr = clampNumber(remainder, 8)
  const subtractNote = sameUnit ? '' : ` (≈ ${convertedStr} ${itemUnit})`
  if (remainder <= 0) return `${consumedStr} ${consumeUnit.value}${subtractNote} will remove this item from your pantry.`
  return `${consumedStr} ${consumeUnit.value}${subtractNote} will be subtracted. Remainder: ${remainderStr} ${itemUnit}`
})
const consumeDensityHint = computed(() => {
  if (!consumeItem.value) return ''
  if (consumeItem.value.density && consumeItem.value.density_unit) {
    const densityStr = clampNumber(consumeItem.value.density, 8)
    return `Density ${densityStr} ${consumeItem.value.density_unit} — extra units available.`
  }
  const itemUnit = consumeItem.value.unit
  const isWeight = ['g', 'kg'].includes(itemUnit)
  const isVolume = ['ml', 'L', 'tsp', 'tbsp', 'cup'].includes(itemUnit)
  if (isWeight) return 'Set a density on this item to log uses in ml, L, tsp, tbsp, or cup.'
  if (isVolume) return 'Set a density on this item to log uses in g or kg.'
  return ''
})

function openItemSheet(item) {
  sheetItem.value = item
  sheetForm.value = {
    name:         item.name,
    quantity:     item.quantity ?? '',
    category:     item.category ?? 'other',
    expiry_date:  item.expiry_date ?? '',
    notes:        item.notes ?? '',
    price:        item.price ?? '',
    amount:       item.amount != null ? item.amount : '',
    unit:         item.unit ?? '',
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
    quantity:     sheetItem.value.quantity ?? '',
    category:     sheetItem.value.category ?? 'other',
    expiry_date:  sheetItem.value.expiry_date ?? '',
    notes:        sheetItem.value.notes ?? '',
    price:        sheetItem.value.price ?? '',
    amount:       sheetItem.value.amount != null ? sheetItem.value.amount : '',
    unit:         sheetItem.value.unit ?? '',
    density:      sheetItem.value.density != null ? String(sheetItem.value.density) : '',
    density_unit: sheetItem.value.density_unit ?? 'g/ml',
  }
}

async function saveItem() {
  if (!sheetForm.value.name.trim() || sheetSaving.value) return
  sheetSaving.value = true
  const densityProvided = sheetForm.value.density !== '' && parseFloat(sheetForm.value.density) > 0
  const res = await apiFetch(`${API}/pantry/${sheetItem.value.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:         sheetForm.value.name.trim(),
      quantity:     sheetForm.value.quantity.trim() || null,
      category:     sheetForm.value.category,
      expiry_date:  sheetForm.value.expiry_date || null,
      notes:        sheetForm.value.notes.trim() || null,
      price:        sheetForm.value.price !== '' ? parseFloat(sheetForm.value.price) : null,
      amount:       sheetForm.value.amount !== '' ? parseFloat(sheetForm.value.amount) : null,
      unit:         sheetForm.value.unit || null,
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

function deleteSheetItem() {
  deleteTarget.value = sheetItem.value
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (sheetDeleting.value || !deleteTarget.value) return
  sheetDeleting.value = true
  const res = await apiFetch(`${API}/pantry/${deleteTarget.value.id}`, { method: 'DELETE' })
  if (res.ok) {
    showDeleteConfirm.value = false
    items.value = items.value.filter(i => i.id !== deleteTarget.value.id)
    if (sheetItem.value?.id === deleteTarget.value.id) closeItemSheet()
    deleteTarget.value = null
  }
  sheetDeleting.value = false
}

function openConsumeDialog(item, action) {
  consumeItem.value = item
  consumeAction.value = action
  consumeAmount.value = ''
  consumeUnit.value = item?.unit || 'g'
  consumeOpen.value = true
}

async function confirmConsume() {
  if (consumeLoading.value || !consumeItem.value) return
  consumeLoading.value = true
  const res = await apiFetch(`${API}/pantry/${consumeItem.value.id}/consume`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consumed: consumeIsAll.value ? consumeItem.value.amount : (parseFloat(consumeAmount.value) || 0),
      consumedUnit: consumeIsAll.value ? consumeItem.value.unit : consumeUnit.value,
      action: consumeAction.value,
    }),
  })
  if (res.ok) {
    const data = await res.json()
    consumeOpen.value = false
    if (data.removed) {
      items.value = items.value.filter(i => i.id !== consumeItem.value.id)
      if (sheetItem.value?.id === consumeItem.value.id) closeItemSheet()
    } else {
      const idx = items.value.findIndex(i => i.id === consumeItem.value.id)
      if (idx !== -1) items.value[idx] = data.item
      if (sheetItem.value?.id === consumeItem.value.id) sheetItem.value = data.item
    }
  }
  consumeLoading.value = false
}

function itemActions(item) {
  return [
    {
      label: 'Delete',
      icon: 'mdi-delete-outline',
      color: '#c0392b',
      handler: () => { deleteTarget.value = item; showDeleteConfirm.value = true },
    },
    {
      label: 'Waste',
      icon: 'mdi-trash-can-outline',
      color: '#b45309',
      handler: () => openConsumeDialog(item, 'waste'),
    },
    {
      label: 'Use',
      icon: 'mdi-check-circle-outline',
      color: '#2E7D52',
      handler: () => openConsumeDialog(item, 'use'),
    },
  ]
}

function formatExpiry(date) {
  if (!date) return null
  const [y, m, d] = date.split('-')
  return `${d} / ${m} / ${y}`
}
</script>

<style scoped>
.inventory-root {
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
  .inventory-root { height: 100%; overflow-y: auto; }
}

.col-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6BA888;
  margin: 0;
  flex-shrink: 0;
}

/* Stats summary card */
.stats-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 14px 16px;
  flex-shrink: 0;
}

@media (min-width: 1280px) {
  .stats-card { min-height: 160px; }
}
.stats-card-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6BA888;
  margin: 0 0 10px;
}
.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 0;
  border-bottom: 1px solid var(--panel-border);
}
.stats-row:last-of-type { border-bottom: none; }
.stats-label {
  font-size: 12px;
  color: #6BA888;
}
.stats-value {
  font-size: 13px;
  font-weight: 500;
  color: #1A4D35;
}
.stats-value--warn  { color: #b45309; }
.stats-value--danger { color: #dc2626; }

/* Inventory card */
.inventory-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 14px 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}
.inventory-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6BA888;
  margin: 0 0 10px;
  flex-shrink: 0;
}

/* Items area */
.items-area {
  flex: 1;
  overscroll-behavior-y: contain;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  padding-right: 4px;
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
  line-height: 1.5;
}

/* Pantry items */
.pantry-item {
  background: #EAF7F0;
  border: 1px solid #C8E8D8;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: border-color 0.15s;
  flex-shrink: 0;
  cursor: pointer;
  justify-content: flex-start;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.pantry-item:hover { filter: brightness(0.97); }

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
}
.expiry--expired .pantry-qty-col { color: #b0b0b0; }
.expiry--expired .pantry-notes   { color: #b0b0b0; }
.expiry--expired .cat-chip {
  background: #eeeeee !important;
  color: #aaaaaa !important;
}

@keyframes pulse-red {
  0%, 100% { border-color: #f87171; }
  50% { border-color: #dc2626; }
}

.pantry-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pantry-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: #1A4D35;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.expiry--expired .pantry-name {
  text-decoration: line-through;
  color: #9e9e9e;
}

.pantry-item-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pantry-qty-col {
  width: 52px;
  flex-shrink: 0;
  text-align: right;
  font-size: 12px;
  color: #6BA888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pantry-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.pantry-meta-left {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.pantry-meta-right {
  flex: 1;
  min-width: 0;
  text-align: right;
  font-size: 11px;
  color: #6BA888;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.expiry-label {
  font-size: 11px;
  color: #6BA888;
}
.expiry--soon .expiry-label    { color: #b45309; }
.expiry--very-soon .expiry-label { color: #c2410c; }
.expiry--today .expiry-label   { color: #dc2626; }
.expiry--expired .expiry-label { color: #9e9e9e; }

.expiry-date {
  font-size: 11px;
  color: #a8c5b0;
  margin-left: 4px;
}
.expiry--soon .expiry-date,
.expiry--very-soon .expiry-date,
.expiry--today .expiry-date,
.expiry--expired .expiry-date { color: inherit; opacity: 0.7; }

/* Expired counter card */
.expired-card {
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}
.expired-card--clean {
  background: #f0fdf4;
  border-color: #86efac;
}
.expired-card-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #b45309;
  margin: 0;
  padding: 10px 12px 4px;
}
.expired-card--clean .expired-card-label {
  color: #16a34a;
}
.expired-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 10px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}
.expired-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
}
.expired-list {
  margin: 0;
  padding: 0 12px 10px 12px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
}
.expired-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-left: 2px solid #fcd34d;
  border-radius: 0 4px 4px 0;
  font-size: 12px;
}
.expired-name {
  color: #92400e;
  font-weight: 500;
  flex: 1;
}
.expired-ago {
  color: #b45309;
  font-size: 11px;
  white-space: nowrap;
}
.expired-clean {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 10px;
}
.expired-clean-text {
  font-size: 12px;
  font-weight: 600;
  color: #16a34a;
}


/* Category chip on inventory items */
.cat-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 99px;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

/* ── Item detail sheet ─────────────────────────────────────── */

.item-sheet-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.view-value-box--expiry--soon    { border-color: #fbbf24; background: #fffdf0; color: #b45309; }
.view-value-box--expiry--very-soon { border-color: #fb923c; background: #fff8f4; color: #c2410c; }
.view-value-box--expiry--today   { border-color: #f87171; background: #fff5f5; color: #dc2626; }
.view-value-box--expiry--expired { border-color: #e0e0e0; background: #f9f9f9; color: #9e9e9e; }

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

.item-edit-field--grow {
  flex: 1;
  display: flex;
  flex-direction: column;
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

.item-qty-row {
  display: flex;
  gap: 4px;
  overflow: hidden;
}
.item-qty-row .item-edit-input { flex: 1; min-width: 0; }
.item-qty-row .item-edit-input::-webkit-outer-spin-button,
.item-qty-row .item-edit-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.item-qty-row .item-edit-input { -moz-appearance: textfield; }
.item-edit-select--unit { flex: 0 0 70px; }

@media (max-width: 480px) {
  .item-edit-select--unit { flex: 0 0 72px; }
}

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
.item-price-input::-webkit-outer-spin-button,
.item-price-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.item-price-input { -moz-appearance: textfield; }

/* Swipe wrapper — overrides SwipeableListItem root so border-radius is applied */
.pantry-swipe-wrapper {
  border-radius: 8px;
  flex-shrink: 0;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

/* Consume dialog slot content */
.consume-row {
  display: flex;
  gap: 8px;
  width: 100%;
  margin-top: 4px;
}

.consume-amount-input {
  flex: 1;
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
.consume-amount-input:focus { border-color: #2E7D52; }
.consume-amount-input::-webkit-outer-spin-button,
.consume-amount-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.consume-amount-input { -moz-appearance: textfield; }

.consume-unit-select {
  width: 72px;
  border: 1.5px solid #B8E6D0;
  border-radius: 10px;
  padding: 9px 8px;
  font-size: 13px;
  color: #1A4D35;
  background: #fff;
  outline: none;
  cursor: pointer;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.consume-unit-select:focus { border-color: #2E7D52; }

.consume-desc-text {
  font-size: 12px;
  color: #6BA888;
  margin: 6px 0 0;
  text-align: center;
  line-height: 1.4;
  width: 100%;
  min-height: 50px;
}

.consume-density-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.4;
  width: 100%;
  min-height: 32px;
  box-sizing: border-box;
}
.consume-density-hint--unset {
  background: #f4f8f5;
  border: 1px solid #d8e4dd;
  color: #6BA888;
}
.consume-density-hint--set {
  background: #EAF7F0;
  border: 1px solid #B8E6D0;
  color: #2E7D52;
  font-weight: 500;
}

</style>
