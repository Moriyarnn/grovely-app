<template>
  <div class="shopping-root">

    <!-- Header -->
    <div class="shopping-header">
      <h1 class="shopping-title">Shopping List</h1>
      <!-- ?? tutorial button -->
      <button class="help-icon-btn" @click="tutorialOpen = true" aria-label="Open tutorial">
        <v-icon size="20" color="#2E7D52">mdi-help-circle</v-icon>
      </button>
      <!-- Premium ?? button — opens the Smart Autofill explainer -->
      <button
        v-if="isPremium"
        class="help-icon-btn help-icon-btn--premium"
        @click="premiumTutorialOpen = true"
        aria-label="Open premium features tutorial"
      >
        <v-icon size="20" color="#2E7D52">mdi-help-circle</v-icon>
        <span class="premium-corner-badge">
          <v-icon size="9" color="#fff">mdi-lock-open-outline</v-icon>
        </span>
      </button>
      <button class="back-chip back-chip--mobile-only" @click="$router.back()">
        <v-icon size="14" color="#2E7D52">mdi-chevron-left</v-icon>
        Hub
      </button>
    </div>

    <!-- Add item form -->
    <form class="add-form" @submit.prevent="addItem">
      <div class="add-row">
        <PantryAutocomplete
          style="flex: 1; min-width: 0;"
          theme="green"
          v-model="newName"
          :is-premium="isPremium"
          :pantry-symbol="pantrySymbol"
          :pantry-decimals="pantryDecimals"
          @select="onAutocompleteSelect"
          @open-premium-gate="premiumGateOpen = true"
        />
        <button type="submit" class="add-btn" :disabled="!newName.trim() || adding">
          <v-icon size="18">mdi-plus</v-icon>
        </button>
      </div>
      <div class="add-meta add-meta--two">
        <div class="add-meta-field add-meta-field--qty">
          <div class="add-meta-label-row">
            <span class="add-meta-label">Quantity <span class="add-meta-optional">(optional)</span></span>
            <AppFieldToggle v-model="newQtyIsPieces" @update:model-value="onAddQtyModeToggle" label="pcs" theme="green" />
          </div>
          <div class="meta-qty-transition-wrap">
            <Transition :name="`qty-swap-${addQtySlideDir}`" mode="out-in">
              <div v-if="!newQtyIsPieces" key="amount" class="meta-qty-row">
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
              <div v-else key="pieces" class="meta-qty-row">
                <div class="meta-pieces-box meta-pieces-box--wide">
                  <span class="meta-pieces-prefix">×</span>
                  <input
                    v-model="newPieces"
                    type="number"
                    min="1"
                    step="1"
                    class="meta-pieces-input"
                    placeholder="1"
                    autocomplete="off"
                  />
                </div>
              </div>
            </Transition>
          </div>
        </div>
        <div class="add-meta-field add-meta-field--category" :style="newQtyIsPieces ? { opacity: 0.4, pointerEvents: 'none' } : (!newUnit ? { opacity: 0.4, pointerEvents: 'none' } : {})">
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
      <div class="add-meta add-meta--three">
        <!-- Price — flex 2 -->
        <div class="add-meta-field add-meta-field--price">
          <div class="add-meta-label-row">
            <span class="add-meta-label">Price <span class="add-meta-optional"><span class="price-opt--mobile">(o.)</span><span class="price-opt--desktop">{{ addFormPiecesCount > 1 ? '(opt.)' : '(optional)' }}</span></span></span>
            <Transition name="tot-toggle">
              <AppFieldToggle v-if="addFormPiecesCount > 1" v-model="newPriceIsTotal" label="∑" theme="green" />
            </Transition>
          </div>
          <div class="meta-qty-row">
            <div class="meta-price-box" @click="addPriceInput?.focus()">
              <span class="meta-price-symbol">{{ pantrySymbol }}</span>
              <input
                ref="addPriceInput"
                v-model="newPrice"
                type="number"
                step="0.01"
                min="0"
                class="meta-price-input"
                :placeholder="pricePlaceholder"
              />
              <span v-if="addFormPiecesCount > 1" class="meta-price-suffix">
                <Transition name="price-suffix" mode="out-in">
                  <span v-if="newPriceIsTotal" key="total">= {{ pantrySymbol }}{{ unitPricePreview }}/pc</span>
                  <span v-else key="per">/pc</span>
                </Transition>
              </span>
            </div>
          </div>
          <!-- Premium price delta: shows ±difference vs last recorded price after autofill -->
          <div v-if="priceDelta !== null" class="price-delta" :class="priceDelta > 0 ? 'price-delta--up' : 'price-delta--down'">
            {{ priceDelta > 0 ? '+' : '' }}{{ pantrySymbol }}&nbsp;{{ Math.abs(priceDelta).toFixed(pantryDecimals) }}
          </div>
        </div>

        <!-- Store — flex 1 -->
        <div class="add-meta-field add-meta-field--store">
          <span class="add-meta-label">Store <span class="add-meta-optional">(optional)</span></span>
          <input
            v-model="newStore"
            class="meta-input meta-input--store"
            type="text"
            placeholder="Store…"
            maxlength="60"
            autocomplete="off"
          />
        </div>

        <!-- Category — flex 1 -->
        <div class="add-meta-field add-meta-field--category">
          <span class="add-meta-label">Category</span>
          <select v-model="newCategory" class="meta-select meta-select--category">
            <option v-for="cat in CATEGORIES" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
          </select>
        </div>
      </div>
    </form>

    <div class="items-area">

      <ListControls
        :model-value="{ search: searchQuery, filter: null, sort: null, sortDir: 'asc' }"
        @update:model-value="searchQuery = $event.search"
        :filter-options="[]"
        :sort-options="[]"
        theme="green"
        placeholder="Search shopping list…"
        class="shopping-search"
      />

      <AppScroller theme="green" class="items-scroller">

        <!-- Empty state -->
        <div v-if="showEmpty" class="empty-state">
          <v-icon size="32" color="#a8c5b0">mdi-cart-outline</v-icon>
          <p class="empty-title">Your list is empty</p>
          <p class="empty-sub">Add the first item above</p>
        </div>
        <div v-else-if="showSearchEmpty" class="empty-state">
          <v-icon size="32" color="#a8c5b0">mdi-magnify</v-icon>
          <p class="empty-title">No items found</p>
          <p class="empty-sub">Try a different search</p>
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
                <div class="item-name-wrap">
                  <span class="item-name">{{ item.name }}</span>
                  <span v-if="displayPieces(item.pieces)" class="pieces-badge">{{ displayPieces(item.pieces) }}</span>
                </div>
                <span v-if="item.quantity && item.amount == null" class="item-qty">{{ item.quantity }}</span>
                <span v-if="item.price != null" class="item-price">{{ pantrySymbol }}&nbsp;{{ clampPrice(item.price, 5, pantryDecimals) }}{{ (item.pieces ?? 1) >= 2 ? '/pc' : '' }}</span>
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
              <div class="item-name-wrap">
                <span class="item-name item-name--checked">{{ item.name }}</span>
                <span v-if="displayPieces(item.pieces)" class="pieces-badge pieces-badge--checked">{{ displayPieces(item.pieces) }}</span>
              </div>
              <span v-if="item.quantity && item.amount == null" class="item-qty item-qty--checked">{{ item.quantity }}</span>
              <span v-if="item.price != null" class="item-price item-price--checked">{{ pantrySymbol }}&nbsp;{{ clampPrice(item.price, 5, pantryDecimals) }}{{ (item.pieces ?? 1) >= 2 ? '/pc' : '' }}</span>
              <button class="delete-btn" @click="deleteItem(item.id)" aria-label="Remove">
                <v-icon size="15" color="#c4b8bc">mdi-close</v-icon>
              </button>
            </div>
          </TransitionGroup>
        </div>

      </AppScroller>
    </div>

    <!-- Bottom action bar -->
    <div v-if="allUncheckedItems.length > 0" class="bottom-bar">
      <template v-if="!selectMode">
        <button class="bar-btn bar-btn--primary" @click="openMoveSheet(allUncheckedItems)">Move all to pantry</button>
        <div v-if="estimatedTotal > 0" class="bar-total-pill">
          <span class="bar-total-label">Cart total</span>
          <span class="bar-total-value" :title="`${pantrySymbol} ${estimatedTotal.toFixed(pantryDecimals)}`">{{ pantrySymbol }}&nbsp;{{ clampPrice(estimatedTotal, 8, pantryDecimals) }}</span>
        </div>
      </template>
      <template v-else>
        <div class="bar-select-actions">
          <button class="bar-btn bar-btn--danger" :disabled="selectedCount === 0" @click="deleteSelected">
            Delete{{ selectedCount > 0 ? ` (${selectedCount})` : '' }}
          </button>
          <button class="bar-btn bar-btn--primary" :disabled="selectedCount === 0" @click="openMoveSheet(allUncheckedItems.filter(i => selectedIds.has(i.id)))">
            Move{{ selectedCount > 0 ? ` (${selectedCount})` : '' }}
          </button>
        </div>
        <div class="bar-select-foot">
          <button class="bar-text-btn" @click="exitSelectMode">Cancel</button>
          <div class="bar-total-pill bar-total-pill--compact" :class="{ 'bar-total-pill--empty': selectedCount === 0 }">
            <template v-if="selectedCount === 0">
              <span class="bar-total-label bar-total-label--empty">Tap items to select</span>
            </template>
            <template v-else>
              <span class="bar-total-label">Selected total</span>
              <span class="bar-total-value" :title="`${pantrySymbol} ${selectedTotal.toFixed(pantryDecimals)}`">{{ pantrySymbol }}&nbsp;{{ clampPrice(selectedTotal, 8, pantryDecimals) }}</span>
            </template>
          </div>
          <button class="bar-text-btn" @click="selectAll">Select all</button>
        </div>
      </template>
    </div>

    <!-- Item detail sheet -->
    <DetailSheet
      :open="sheetOpen"
      @update:open="closeItemSheet"
      mobile-height="80vh"
      :title="sheetItem?.name ?? ''"
      :subtitle="sheetItem ? (catLabel(sheetItem.category) + (sheetItem.amount != null ? ' · ' + clampQty(sheetItem.amount * (sheetItem.pieces ?? 1), sheetItem.unit, 10) : (sheetItem.quantity ? ' · ' + sheetItem.quantity : '')) + (sheetItem.pieces >= 2 ? ' · ' + displayPieces(sheetItem.pieces) : '')) : ''"
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
                <template v-if="sheetItem.price != null"><span class="view-price-symbol">{{ pantrySymbol }}</span>{{ clampPrice(sheetItem.price, 7, pantryDecimals) }}<span v-if="sheetItem.pieces != null && sheetItem.amount == null" class="view-price-pc">/pc</span></template>
                <template v-else>—</template>
              </div>
            </div>
          </div>
          <div class="view-inline-row">
            <div class="view-section">
              <span class="view-section-label">Quantity</span>
              <div class="view-value-box" :class="{ 'view-value-empty': sheetItem.amount == null && sheetItem.pieces == null && !sheetItem.quantity }">
                {{ sheetItem.amount != null ? clampQty(sheetItem.amount, sheetItem.unit, 14) : (sheetItem.pieces != null ? sheetItem.pieces + ' pcs' : (sheetItem.quantity || '—')) }}
              </div>
            </div>
            <div class="view-section">
              <span class="view-section-label">Density</span>
              <div class="view-value-box" :class="{ 'view-value-empty': sheetItem.density == null }">
                {{ sheetItem.density != null ? clampQty(sheetItem.density, sheetItem.density_unit, 13) : '—' }}
              </div>
            </div>
          </div>
          <div class="view-inline-row view-inline-row--three">
            <div class="view-section view-section--expiry">
              <span class="view-section-label">Expiry</span>
              <div class="view-value-box" :class="{ 'view-value-empty': !sheetItem.expiry_date }">
                {{ sheetItem.expiry_date ? formatExpiry(sheetItem.expiry_date) : '—' }}
              </div>
            </div>
            <div class="view-section view-section--store">
              <span class="view-section-label">Store</span>
              <div class="view-value-box" :class="{ 'view-value-empty': !sheetItem.store }">
                {{ sheetItem.store || '—' }}
              </div>
            </div>
            <div class="view-section view-section--category">
              <span class="view-section-label">Category</span>
              <div class="view-value-box">{{ catLabel(sheetItem.category) }}</div>
            </div>
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
              <div class="item-edit-label-row">
                <label class="item-edit-label">Price <span class="item-edit-optional">(optional)</span></label>
                <Transition appear name="edit-toggle">
                  <AppFieldToggle v-if="sheetFormPiecesCount > 1" :model-value="sheetPriceIsTotal" @update:model-value="onSheetPriceTotalToggle" label="∑" theme="green" />
                </Transition>
              </div>
              <div class="item-price-box">
                <span class="item-price-symbol">{{ pantrySymbol }}</span>
                <input
                  v-model="sheetForm.price"
                  type="number"
                  :step="pantryDecimals === 0 ? '1' : '0.01'"
                  min="0"
                  class="item-price-input"
                  :placeholder="pricePlaceholder"
                />
                <span v-if="sheetFormPiecesCount > 1" class="item-price-suffix">
                  <Transition name="price-suffix" mode="out-in">
                    <span v-if="sheetPriceIsTotal" key="total">= {{ pantrySymbol }}{{ sheetUnitPricePreview }}/pc</span>
                    <span v-else key="per">/pc</span>
                  </Transition>
                </span>
              </div>
            </div>
          </div>
          <div class="edit-inline-row edit-row--qty-density">
            <div class="item-edit-field">
              <div class="item-edit-label-row">
                <label class="item-edit-label">Quantity <span class="item-edit-optional">(optional)</span></label>
                <Transition appear name="edit-toggle">
                  <AppFieldToggle v-model="sheetQtyIsPieces" @update:model-value="onSheetQtyModeToggle" label="pcs" theme="green" />
                </Transition>
              </div>
              <div class="meta-qty-transition-wrap">
                <Transition :name="`qty-swap-${sheetQtySlideDir}`" mode="out-in">
                  <div v-if="!sheetQtyIsPieces" key="amount" class="item-qty-row">
                    <input
                      v-model="sheetForm.amount"
                      type="number"
                      min="0"
                      step="any"
                      class="item-edit-input"
                      placeholder="0"
                      autocomplete="off"
                    />
                    <Transition appear name="edit-ctrl">
                      <select v-model="sheetForm.unit" class="item-edit-select item-edit-select--unit item-edit-select--qty-unit">
                        <option v-for="u in PANTRY_UNITS" :key="u" :value="u">{{ u }}</option>
                      </select>
                    </Transition>
                  </div>
                  <div v-else key="pieces" class="item-qty-row">
                    <div class="item-pieces-box item-pieces-box--full">
                      <span class="item-pieces-prefix">×</span>
                      <input
                        v-model="sheetForm.pieces"
                        type="number"
                        min="1"
                        step="1"
                        class="item-pieces-input"
                        placeholder="1"
                        autocomplete="off"
                      />
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
            <div class="item-edit-field" :style="sheetQtyIsPieces ? { opacity: 0.4, pointerEvents: 'none' } : (!sheetForm.unit ? { opacity: 0.4, pointerEvents: 'none' } : {})">
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
                <Transition appear name="edit-ctrl">
                  <select v-model="sheetForm.density_unit" class="item-edit-select item-edit-select--unit">
                    <option v-for="u in DENSITY_UNITS" :key="u" :value="u">{{ u }}</option>
                  </select>
                </Transition>
              </div>
            </div>
          </div>
          <div class="edit-inline-row edit-inline-row--three">
            <div class="item-edit-field item-edit-field--expiry">
              <label class="item-edit-label">Expiry <span class="item-edit-optional">(optional)</span></label>
              <input
                v-model="sheetForm.expiry_date"
                type="date"
                class="item-edit-input item-edit-input--date"
              />
            </div>
            <div class="item-edit-field item-edit-field--store">
              <label class="item-edit-label">Store <span class="item-edit-optional">(optional)</span></label>
              <input
                v-model="sheetForm.store"
                type="text"
                class="item-edit-input"
                placeholder="Store…"
                maxlength="80"
                autocomplete="off"
              />
            </div>
            <div class="item-edit-field item-edit-field--category">
              <label class="item-edit-label">Category</label>
              <select v-model="sheetForm.category" class="item-edit-select">
                <option v-for="cat in CATEGORIES" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
              </select>
            </div>
          </div>
        </template>

        <!-- Notes — persistent across view/edit so the counter expand
             transition fires both entering AND leaving edit (an ancestor
             swap would prevent the leave animation). -->
        <div class="item-edit-field item-edit-field--grow">
          <label class="item-edit-label">
            Notes <span v-if="sheetMode === 'edit'" class="item-edit-optional">(optional)</span>
          </label>
          <NotesField
            :mode="sheetMode"
            :model-value="sheetMode === 'edit' ? sheetForm.notes : (sheetItem.notes ?? '')"
            @update:model-value="sheetForm.notes = $event"
            theme="green"
            :max="300"
            placeholder="e.g. check brand, get organic"
            empty-text="No notes for this item"
            :fixed-height="150"
          />
        </div>

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
            <span v-if="mergeHint(item)" class="move-item-hint">
              <v-icon size="11" color="#2E7D52">mdi-merge</v-icon>
              {{ mergeHint(item) }}
            </span>
            <span v-else-if="item.amount != null" class="move-item-qty">{{ clampQty(item.amount * (item.pieces ?? 1), item.unit, 9) }}</span>
            <span v-else-if="item.pieces != null" class="move-item-qty">{{ item.pieces }} pcs</span>
            <span v-else-if="item.quantity" class="move-item-qty">{{ item.quantity }}</span>
            <div class="move-expiry-wrap">
              <span class="move-expiry-label">Expiry</span>
              <span v-if="moveSuggested[item.id]" class="move-expiry-suggested">
                <v-icon size="11" color="#2E7D52">mdi-lightbulb-on-outline</v-icon>
                Suggested
              </span>
              <input
                v-model="moveExpiries[item.id]"
                @input="moveSuggested[item.id] = false"
                type="date"
                class="move-expiry-input"
                :class="{ 'move-expiry-input--empty': !moveExpiries[item.id] }"
              />
            </div>
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

    <!-- PREMIUM GATE (frontend) — autocomplete "More options with Store Price Analytics" -->
    <PremiumGate :open="premiumGateOpen" @update:open="premiumGateOpen = $event" theme="pink" />

    <!-- Onboarding tutorial (also triggered by ?? button) -->
    <PantryOnboardingTutorial :force-open="tutorialOpen" @close="onTutorialClose" />

    <!-- Premium tutorial — Smart Autofill explainer -->
    <PantryPremiumTutorial
      v-if="isPremium"
      :force-open="premiumTutorialOpen"
      :auto-show="onboardingSeenOnMount"
      @close="premiumTutorialOpen = false"
    />

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { API, apiFetch } from '../../api'
import AppScroller from '@/components/ui/AppScroller.vue'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import AppFieldToggle from '@/components/ui/AppFieldToggle.vue'
import SwipeableListItem from '@/components/ui/SwipeableListItem.vue'
import DetailSheet from '@/components/ui/DetailSheet.vue'
import IconAction from '@/components/ui/IconAction.vue'
import NotesField from '@/components/ui/NotesField.vue'
import ListControls from '@/components/ui/ListControls.vue'
import PantryAutocomplete from '@/components/pantry/PantryAutocomplete.vue'
import PremiumGate from '@/components/PremiumGate.vue'
import PantryOnboardingTutorial from './PantryOnboardingTutorial.vue'
import PantryPremiumTutorial from './PantryPremiumTutorial.vue'
import { useSettings } from '../../composables/useSettings'
import { useLicense } from '../../composables/useLicense'
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
  { value: 'beverages', label: 'Beverages' },
  { value: 'other',     label: 'Other' },
]

const CAT_COLORS = {
  produce:   '#4caf7d',
  dairy:     '#42a5d6',
  meat:      '#e06060',
  bakery:    '#d4914a',
  frozen:    '#7e7ecf',
  dry_goods: '#a08060',
  beverages: '#26b5c8',
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
const newUnit = ref('g')
const newPrice = ref('')
const newPriceIsTotal = ref(false)
const addPriceInput = ref(null)
const newPieces = ref('')
const newDensity = ref('')
const newDensityUnit = ref('g/ml')
const newStore = ref('')

// Price delta — set when premium autocomplete autofills the price field.
// Cleared when the user types a new name or resets the form.
const autofilledPrice    = ref(null)
const premiumGateOpen    = ref(false)

// Tutorial state — mirrors the pattern in PeriodCalendar
const tutorialOpen          = ref(false)
const premiumTutorialOpen   = ref(false)
// If the user has already seen the onboarding at mount time, the premium tutorial
// can auto-show immediately on unlock. If not, we chain it after onboarding closes.
const onboardingSeenOnMount = !!localStorage.getItem('grovely_pantry_onboarding_done')

function onTutorialClose() {
  tutorialOpen.value = false
  // After onboarding ends, start the premium tutorial if unlocked and not seen yet
  if (isPremium.value && !localStorage.getItem('grovely_pantry_premium_autofill_done')) {
    premiumTutorialOpen.value = true
  }
}

const { licenseActive, fetchLicenseStatus } = useLicense()
const isPremium = computed(() => licenseActive.value === true)

// Price delta computed from watching newPrice vs the autofilled baseline
const priceDelta = computed(() => {
  if (autofilledPrice.value == null) return null
  const entered = parseFloat(newPrice.value)
  if (isNaN(entered)) return null
  const delta = entered - autofilledPrice.value
  if (Math.abs(delta) < 0.001) return null
  return delta
})

// When user manually changes the name, clear the autofill baseline
watch(newName, () => { autofilledPrice.value = null })

function displayPieces(pieces) {
  if (!pieces || pieces < 2) return null
  return pieces > 999 ? '×999+' : `×${pieces}`
}

const { settings, fetchSettings } = useSettings()

const pantrySymbol = computed(() => {
  const cur = settings.value.pantry_currency ?? 'USD'
  if (cur === 'OTHER') return settings.value.pantry_currency_custom_symbol ?? ''
  return CURRENCIES.find(c => c.value === cur)?.symbol ?? '$'
})
const pantryDecimals = computed(() => {
  const cur = settings.value.pantry_currency ?? 'USD'
  if (cur === 'OTHER') return parseInt(settings.value.pantry_currency_custom_decimals ?? '2', 10)
  return CURRENCIES.find(c => c.value === cur)?.decimals ?? 2
})
const pricePlaceholder = computed(() => pantryDecimals.value === 0 ? '0' : '0.00')

const addFormPiecesCount = computed(() => {
  const n = parseInt(newPieces.value)
  return !isNaN(n) && n > 1 ? n : 1
})
const unitPriceClampBudget = computed(() => {
  const len = newPrice.value ? String(newPrice.value).length : 0
  if (window.innerWidth > 767) {
    return Math.max(2, 5 - Math.max(0, len - 4))
  }
  if (len <= 5) return 4
  if (len <= 7) return 3
  return 2
})
const unitPricePreview = computed(() => {
  const p = parseFloat(newPrice.value)
  const n = addFormPiecesCount.value
  if (isNaN(p) || p <= 0 || n < 2) return (0).toFixed(pantryDecimals.value)
  return clampPrice(p / n, unitPriceClampBudget.value, pantryDecimals.value)
})

const searchQuery = ref('')

const allUncheckedItems = computed(() =>
  items.value.filter(i => !i.checked)
)

const uncheckedItems = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return allUncheckedItems.value.filter(i => !q || i.name.toLowerCase().includes(q))
})
const checkedItems = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return items.value.filter(i => i.checked && (!q || i.name.toLowerCase().includes(q)))
})

const estimatedTotal = computed(() =>
  allUncheckedItems.value
    .filter(i => i.price != null)
    .reduce((sum, i) => sum + i.price * (i.pieces ?? 1), 0)
)

const selectedTotal = computed(() =>
  allUncheckedItems.value
    .filter(i => i.price != null && selectedIds.value.has(i.id))
    .reduce((sum, i) => sum + i.price * (i.pieces ?? 1), 0)
)

const showSearchEmpty = computed(() =>
  !loading.value &&
  items.value.length > 0 &&
  searchQuery.value.trim() !== '' &&
  uncheckedItems.value.length === 0 &&
  checkedItems.value.length === 0
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
  // In PCS mode an empty pieces field means "1 piece", not "no quantity" —
  // default to 1 and null out amount/unit so the item saves as a pieces item.
  const piecesMode = newQtyIsPieces.value
  const piecesNum = parseInt(newPieces.value)
  const res = await apiFetch(`${API}/pantry/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: newName.value.trim(),
      category: newCategory.value,
      amount: piecesMode ? null : (newAmount.value !== '' ? parseFloat(newAmount.value) : null),
      unit: piecesMode ? null : (newAmount.value !== '' ? newUnit.value : null),
      price: newPrice.value !== '' && parseFloat(newPrice.value) > 0
        ? parseFloat(newPrice.value) / (newPriceIsTotal.value && addFormPiecesCount.value > 1 ? addFormPiecesCount.value : 1)
        : null,
      pieces: piecesMode
        ? (!isNaN(piecesNum) && piecesNum >= 1 ? piecesNum : 1)
        : (newPieces.value !== '' ? parseInt(newPieces.value) : null),
      density: !piecesMode && densityProvided ? parseFloat(newDensity.value) : null,
      density_unit: !piecesMode && densityProvided ? newDensityUnit.value : null,
      store: newStore.value.trim() || null,
    }),
  })
  if (res.ok) {
    const item = await res.json()
    items.value.push(item)
    newName.value = ''
    newCategory.value = 'other'
    newAmount.value = ''
    newUnit.value = 'g'
    newPrice.value = ''
    newPriceIsTotal.value = false
    newPieces.value = ''
    newDensity.value = ''
    newDensityUnit.value = 'g/ml'
    newQtyIsPieces.value = false
    newStore.value = ''
    autofilledPrice.value = null
    stashAddAmount.value       = ''
    stashAddUnit.value         = 'g'
    stashAddPieces.value       = ''
    stashAddPriceIsTotal.value = false
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
const sheetForm = ref({ name: '', category: 'other', expiry_date: '', price: '', notes: '', amount: '', unit: 'g', pieces: '', density: '', density_unit: 'g/ml', store: '' })
const sheetSaving = ref(false)
const sheetDeleting = ref(false)
const sheetPriceIsTotal = ref(false)
const newQtyIsPieces = ref(false)
const addQtySlideDir = ref('right')
const sheetQtyIsPieces = ref(false)
const sheetQtySlideDir = ref('right')

// Hard toggle: clear the inactive mode's fields so derived state
// (addFormPiecesCount, TOT toggle visibility) tracks the active mode only.
// Stash the cleared value so flipping back restores what the user had.
const stashAddAmount        = ref('')
const stashAddUnit          = ref('g')
const stashAddPieces        = ref('')
const stashAddPriceIsTotal  = ref(false)
function onAddQtyModeToggle(val) {
  addQtySlideDir.value = val ? 'right' : 'left'
  if (val) {
    stashAddAmount.value = newAmount.value
    stashAddUnit.value   = newUnit.value
    newAmount.value = ''
    newUnit.value   = 'g'
    newPieces.value = stashAddPieces.value
    newPriceIsTotal.value = stashAddPriceIsTotal.value
  } else {
    stashAddPieces.value       = newPieces.value
    stashAddPriceIsTotal.value = newPriceIsTotal.value
    newPieces.value = ''
    newPriceIsTotal.value = false
    newAmount.value = stashAddAmount.value
    newUnit.value   = stashAddUnit.value
  }
}

const stashSheetAmount        = ref('')
const stashSheetUnit          = ref('g')
const stashSheetPieces        = ref('')
const stashSheetPriceIsTotal  = ref(false)
function onSheetQtyModeToggle(val) {
  sheetQtySlideDir.value = val ? 'right' : 'left'
  if (val) {
    stashSheetAmount.value = sheetForm.value.amount
    stashSheetUnit.value   = sheetForm.value.unit
    sheetForm.value.amount = ''
    sheetForm.value.unit   = 'g'
    sheetForm.value.pieces = stashSheetPieces.value
    sheetPriceIsTotal.value = stashSheetPriceIsTotal.value
  } else {
    stashSheetPieces.value       = sheetForm.value.pieces
    stashSheetPriceIsTotal.value = sheetPriceIsTotal.value
    sheetForm.value.pieces = ''
    sheetPriceIsTotal.value = false
    sheetForm.value.amount = stashSheetAmount.value
    sheetForm.value.unit   = stashSheetUnit.value
  }
}

const sheetFormPiecesCount = computed(() => {
  const n = parseInt(sheetForm.value.pieces)
  return !isNaN(n) && n > 1 ? n : 1
})
const sheetUnitPriceClampBudget = computed(() => {
  const len = sheetForm.value.price ? String(sheetForm.value.price).length : 0
  if (window.innerWidth > 767) {
    return Math.max(2, 5 - Math.max(0, len - 4))
  }
  if (len <= 5) return 4
  if (len <= 7) return 3
  return 2
})
const sheetUnitPricePreview = computed(() => {
  const p = parseFloat(sheetForm.value.price)
  const n = sheetFormPiecesCount.value
  if (isNaN(p) || p <= 0 || n < 2) return (0).toFixed(pantryDecimals.value)
  return clampPrice(p / n, sheetUnitPriceClampBudget.value, pantryDecimals.value)
})

// When TOT is on, the price field represents the total. If the user changes
// pieces, the per-piece price should stay fixed — so scale total by the
// new/old pieces ratio. Without this, total stays constant while per-piece
// silently drifts, and flipping TOT off afterwards shows a surprising value.
watch(() => sheetForm.value.pieces, (newVal, oldVal) => {
  if (!sheetPriceIsTotal.value) return
  const oldN = parseInt(oldVal)
  const newN = parseInt(newVal)
  if (isNaN(oldN) || isNaN(newN) || oldN < 2 || newN < 2) return
  const p = parseFloat(sheetForm.value.price)
  if (isNaN(p) || p <= 0) return
  sheetForm.value.price = String(roundPrice(p * (newN / oldN), Math.max(pantryDecimals.value, 2)))
})

function openItemSheet(item) {
  sheetItem.value = item
  sheetForm.value = {
    name:         item.name,
    category:     item.category ?? 'other',
    expiry_date:  item.expiry_date ?? '',
    price:        item.price != null ? String(item.price) : '',
    notes:        item.notes ?? '',
    amount:       item.amount != null ? String(item.amount) : '',
    unit:         item.unit ?? 'g',
    pieces:       item.pieces != null ? String(item.pieces) : '',
    density:      item.density != null ? String(item.density) : '',
    density_unit: item.density_unit ?? 'g/ml',
    store:        item.store ?? '',
  }
  sheetQtyIsPieces.value = item.pieces != null && item.amount == null
  sheetMode.value = 'view'
  sheetOpen.value = true
}

function closeItemSheet() {
  sheetOpen.value = false
  sheetItem.value = null
  sheetMode.value = 'view'
}

function roundPrice(x, decimals) {
  return Number(x.toFixed(decimals))
}

// Edit sheet opens with a stored per-piece value, so TOT must convert the
// displayed number on toggle — otherwise save's ÷pieces would shrink the
// stored value on every edit→TOT→save cycle. Add-form keeps TOT display-only
// because its field starts empty and the user types a fresh number.
function onSheetPriceTotalToggle(val) {
  const n = sheetFormPiecesCount.value
  const p = parseFloat(sheetForm.value.price)
  if (n > 1 && !isNaN(p) && p > 0) {
    sheetForm.value.price = val
      ? String(roundPrice(p * n, Math.max(pantryDecimals.value, 2)))
      : String(roundPrice(p / n, 4))
  }
  sheetPriceIsTotal.value = val
}

function switchToEdit() {
  // Rebuild the form from the item (source of truth, stored per-piece)
  // so a prior edit/save can't leave a stale total in sheetForm.price.
  sheetForm.value = {
    name:         sheetItem.value.name,
    category:     sheetItem.value.category ?? 'other',
    expiry_date:  sheetItem.value.expiry_date ?? '',
    price:        sheetItem.value.price != null ? String(sheetItem.value.price) : '',
    notes:        sheetItem.value.notes ?? '',
    amount:       sheetItem.value.amount != null ? String(sheetItem.value.amount) : '',
    unit:         sheetItem.value.unit ?? 'g',
    pieces:       sheetItem.value.pieces != null ? String(sheetItem.value.pieces) : '',
    density:      sheetItem.value.density != null ? String(sheetItem.value.density) : '',
    density_unit: sheetItem.value.density_unit ?? 'g/ml',
    store:        sheetItem.value.store ?? '',
  }
  // Stored price is already per-piece — show it as-is with ∑ tot. off
  // so edit → save round-trips unchanged. The toggle stays available
  // for re-entering a fresh total.
  sheetPriceIsTotal.value = false
  sheetQtyIsPieces.value = sheetItem.value.pieces != null && sheetItem.value.amount == null
  // Reset stash so values from a previous edit don't leak into this item
  stashSheetAmount.value       = ''
  stashSheetUnit.value         = 'g'
  stashSheetPieces.value       = ''
  stashSheetPriceIsTotal.value = false
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
    unit:         sheetItem.value.unit ?? 'g',
    pieces:       sheetItem.value.pieces != null ? String(sheetItem.value.pieces) : '',
    density:      sheetItem.value.density != null ? String(sheetItem.value.density) : '',
    density_unit: sheetItem.value.density_unit ?? 'g/ml',
    store:        sheetItem.value.store ?? '',
  }
  sheetQtyIsPieces.value = sheetItem.value.pieces != null && sheetItem.value.amount == null
}

async function saveItem() {
  if (!sheetForm.value.name.trim() || sheetSaving.value) return
  sheetSaving.value = true
  const densityProvided = sheetForm.value.density !== '' && parseFloat(sheetForm.value.density) > 0
  // In PCS mode the item is measured in whole pieces — an empty field means
  // "1 piece", not "no quantity". Default to 1 and null out amount/unit so
  // flipping an amount item to PCS reliably turns it into a pieces item.
  const piecesMode = sheetQtyIsPieces.value
  const piecesNum = parseInt(sheetForm.value.pieces)
  const res = await apiFetch(`${API}/pantry/list/${sheetItem.value.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:         sheetForm.value.name.trim(),
      category:     sheetForm.value.category,
      expiry_date:  sheetForm.value.expiry_date || null,
      price:        sheetForm.value.price !== '' && parseFloat(sheetForm.value.price) > 0
                      ? parseFloat(sheetForm.value.price) / (sheetPriceIsTotal.value && sheetFormPiecesCount.value > 1 ? sheetFormPiecesCount.value : 1)
                      : null,
      notes:        sheetForm.value.notes.trim() || null,
      amount:       piecesMode ? null : (sheetForm.value.amount !== '' ? parseFloat(sheetForm.value.amount) : null),
      unit:         piecesMode ? null : (sheetForm.value.amount !== '' ? sheetForm.value.unit : null),
      pieces:       piecesMode
                      ? (!isNaN(piecesNum) && piecesNum >= 1 ? piecesNum : 1)
                      : (sheetForm.value.pieces !== '' ? parseInt(sheetForm.value.pieces) : null),
      density:      !piecesMode && densityProvided ? parseFloat(sheetForm.value.density) : null,
      density_unit: !piecesMode && densityProvided ? sheetForm.value.density_unit : null,
      store:        sheetForm.value.store.trim() || null,
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
  if (holdJustActivated) {
    requestAnimationFrame(() => { holdJustActivated = false })
  }
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
const moveInventory = ref([])  // snapshot of pantry for merge hints
const moveSuggested = ref({})  // item.id -> true when expiry was auto-suggested from history
async function openMoveSheet(itemsToMove) {
  moveItems.value = itemsToMove
  moveExpiries.value = Object.fromEntries(
    itemsToMove.map(i => [i.id, i.expiry_date ?? ''])
  )
  moveSuggested.value = {}
  moveSheetOpen.value = true
  // Fetch inventory to compute merge hints — best-effort, non-blocking
  try {
    const res = await apiFetch(`${API}/pantry`)
    if (res.ok) moveInventory.value = await res.json()
  } catch { moveInventory.value = [] }
  // Pre-fill expiry from past shelf life for items the user hasn't dated yet, so
  // they aren't guessing. Best-effort and overridable — just a default. Fetched in
  // parallel so dates appear together rather than trickling in one by one.
  await Promise.all(itemsToMove
    .filter(item => !moveExpiries.value[item.id])
    .map(async item => {
      try {
        const res = await apiFetch(`${API}/pantry/suggest-expiry?name=${encodeURIComponent(item.name)}`)
        if (!res.ok) return
        const { suggested_expiry_date } = await res.json()
        if (suggested_expiry_date && !moveExpiries.value[item.id]) {
          moveExpiries.value[item.id] = suggested_expiry_date
          moveSuggested.value[item.id] = true
        }
      } catch { /* leave blank */ }
    }))
}

// Returns a hint string when this item would merge into an existing pantry row,
// mirroring the backend merge logic in routes/pantry/pantry.js POST.
function mergeHint(item) {
  if (!moveInventory.value.length) return null
  const lname = item.name.toLowerCase()
  // Items only merge when the chosen expiry matches an existing row's (null == null).
  const chosenExpiry = moveExpiries.value[item.id] || null

  if (item.amount != null && item.unit) {
    // Amount-type: backend matches name + unit + expiry (any amount), adds on top
    const adding = item.amount * (item.pieces ?? 1)
    const match = moveInventory.value.find(p =>
      p.name.toLowerCase() === lname &&
      p.unit === item.unit &&
      p.amount != null &&
      (p.expiry_date || null) === chosenExpiry
    )
    if (!match) return null
    return `Adds ${clampQty(adding, item.unit, 9)} to existing`
  } else {
    // Pieces-type (or default pieces = 1): backend matches name + expiry, any pieces row
    const adding = item.pieces ?? 1
    const match = moveInventory.value.find(p =>
      p.name.toLowerCase() === lname &&
      p.pieces != null &&
      p.status === 'active' &&
      (p.expiry_date || null) === chosenExpiry
    )
    if (!match) return null
    return `Adds ${adding} to existing`
  }
}

function closeMoveSheet() {
  moveSheetOpen.value = false
  moveItems.value = []
  moveExpiries.value = {}
  moveInventory.value = []
  moveSuggested.value = {}
}

async function confirmMove() {
  moveLoading.value = true
  for (const item of moveItems.value) {
    let amount = null, unit = null, pieces = null
    if (item.amount != null && item.unit) {
      amount = item.amount * (item.pieces ?? 1)
      unit = item.unit
    } else if (item.pieces != null) {
      pieces = item.pieces
    } else {
      pieces = 1
    }
    await apiFetch(`${API}/pantry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:         item.name,
        category:     item.category || 'other',
        expiry_date:  moveExpiries.value[item.id] || null,
        amount,
        unit,
        price:        item.price ?? null,
        pieces,
        density:      item.density ?? null,
        density_unit: item.density_unit ?? null,
        store:        item.store ?? null,
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

// Handle autocomplete suggestion selection.
// Free: only the name is emitted. Premium: full row autofills all form fields.
function onAutocompleteSelect(row) {
  newName.value = row.name

  if (!isPremium.value) return

  // Autofill amount/pieces
  if (row.amount != null && row.unit) {
    newAmount.value    = String(row.amount)
    newUnit.value      = row.unit
    newDensity.value   = row.density != null ? String(row.density) : ''
    newDensityUnit.value = row.density_unit ?? 'g/ml'
    newPieces.value    = ''
    newQtyIsPieces.value = false
  } else if (row.pieces != null) {
    newPieces.value    = String(row.pieces)
    newAmount.value    = ''
    newUnit.value      = 'g'
    newDensity.value   = ''
    newDensityUnit.value = 'g/ml'
    newQtyIsPieces.value = true
  }

  // Autofill price + store, set delta baseline
  if (row.price != null) {
    newPrice.value    = String(row.price)
    autofilledPrice.value = row.price
  }
  newStore.value = row.store ?? ''
}

onMounted(() => { load(); fetchSettings(); fetchLicenseStatus() })
</script>

<style scoped>
.shopping-root {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: calc(100dvh - 2.5rem);
  overflow: hidden;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 1023px) {
  .shopping-root { height: 100%; overflow-y: auto; }
}

.shopping-search { flex-shrink: 0; }

.bar-select-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.bar-select-foot .bar-text-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex-shrink: 0;
  border: 1px solid #B8E6D0;
  background: #EAF7F0;
  border-radius: 12px;
  padding: 8px 14px;
  transition: background 0.15s;
}
.bar-select-foot .bar-text-btn:hover { background: #d4f0e4; }
.bar-total-pill--compact {
  flex: 1;
  padding: 7px 14px;
}
.bar-total-pill--compact .bar-total-label,
.bar-total-pill--compact .bar-total-value { font-size: 13px; }
.bar-total-pill--compact .bar-total-label { font-weight: 600; }
.bar-total-pill--compact .bar-total-value { font-weight: 700; }
.bar-total-label--empty {
  width: 100%;
  text-align: center;
}
.bar-total-pill--empty {
  background: #f1f8f4;
  border-color: #cfe8db;
}
.bar-total-pill--empty .bar-total-label {
  color: #6BA888;
  font-weight: 500;
}

.items-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  padding: 12px 8px 12px 12px;
  box-sizing: border-box;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  gap: 8px;
  overflow: hidden;
}

.items-scroller {
  flex: 1;
  overscroll-behavior-y: contain;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  padding-right: 4px;
}

/* Header */
.shopping-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* Help (?) icon buttons — mirrors PeriodCalendar .settings-icon-btn */
.help-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  padding: 2px;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.65;
  transition: opacity 0.15s;
}
.help-icon-btn:hover { opacity: 1; }

/* Premium variant — unlocked-lock corner badge */
.help-icon-btn--premium { position: relative; }
.help-icon-btn--premium .premium-corner-badge {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #2E7D52;
  border: 1.5px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
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
}

@media (min-width: 1024px) {
  .back-chip--mobile-only { display: none; }
}

/* Add form */
.add-form {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.add-row {
  display: flex;
  gap: 5px;
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
  box-sizing: border-box;
  height: 41px;
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
  gap: 5px;
  align-items: flex-end;
}

.add-meta-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.add-meta-field--half {
  flex: 0 0 calc(50% - 2.5px);
  min-width: 0;
}

.add-meta-field--price {
  flex: 0 0 calc(50% - 61.5px);
  min-width: 0;
}

/* Two-column row: Quantity (1/2) | Density (1/2) */
.add-meta--two { align-items: flex-start; }
.add-meta--two .add-meta-field--qty      { flex: 1; min-width: 0; }
.add-meta--two .add-meta-field--category { flex: 1; min-width: 0; }

/* Three-column row: Price (1/4) | Store (1/4) | Category (1/2) */
.add-meta--three { align-items: flex-start; }
.add-meta--three .add-meta-field--price    { flex: 1; min-width: 0; }
.add-meta--three .add-meta-field--store    { flex: 1; min-width: 0; }
.add-meta--three .add-meta-field--category { flex: 2; min-width: 0; }

.meta-input--store {
  width: 100%;
  box-sizing: border-box;
  height: 36px;
}

/* Price delta label — premium autocomplete autofill feedback */
.price-delta {
  font-size: 11px;
  font-weight: 600;
  padding-left: 2px;
  margin-top: 2px;
  letter-spacing: 0.01em;
}
.price-delta--up   { color: #c0392b; }
.price-delta--down { color: #27ae60; }

.add-meta-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

/* ∑ tot. toggle fade — same curve as price-suffix, but absolute on leave so
   the label row doesn't reflow while it's fading out */
.tot-toggle-enter-active,
.tot-toggle-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.tot-toggle-enter-from   { opacity: 0; transform: translateY(-4px); }
.tot-toggle-leave-to     { opacity: 0; transform: translateY(4px); }
.tot-toggle-leave-active { position: absolute; right: 0; top: 50%; margin-top: -8px; }

.add-meta-field--category {
  flex: 1;
  min-width: 0;
}

.add-meta-field--pieces {
  flex: 0 0 64px;
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

.meta-qty-transition-wrap {
  overflow: hidden;
  width: 100%;
}

.meta-qty-row {
  display: flex;
  gap: 5px;
  width: 100%;
}

/* PCS / amount toggle slide */
.qty-swap-right-enter-active,
.qty-swap-right-leave-active,
.qty-swap-left-enter-active,
.qty-swap-left-leave-active {
  transition: transform 0.18s ease, opacity 0.15s ease;
}
.qty-swap-right-enter-from { transform: translateX(16px); opacity: 0; }
.qty-swap-right-leave-to   { transform: translateX(-16px); opacity: 0; }
.qty-swap-left-enter-from  { transform: translateX(-16px); opacity: 0; }
.qty-swap-left-leave-to    { transform: translateX(16px); opacity: 0; }

/* Edit-mode unit selects ("bars") slide+fade in horizontally when the
   detail sheet enters edit mode — same feel as the qty-swap. appear-*
   falls back to enter-* classes, so this covers both the initial
   edit-entry appearance and any later mount. The leave mirrors the enter
   so the select slides back out when its row is removed. */
.edit-ctrl-enter-active,
.edit-ctrl-leave-active { transition: transform 0.18s ease, opacity 0.15s ease; }
.edit-ctrl-enter-from,
.edit-ctrl-leave-to     { transform: translateX(16px); opacity: 0; }

/* Edit-mode toggles (pcs, ∑ tot.) use the softer vertical fade of the
   price "/pc" suffix instead of the horizontal slide. The leave mirrors
   the enter so the toggle fades back up when it's removed (e.g. flipping
   ∑ tot. off drops the piece count to 1 and hides the toggle). */
.edit-toggle-enter-active,
.edit-toggle-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.edit-toggle-enter-from,
.edit-toggle-leave-to     { opacity: 0; transform: translateY(-4px); }

/* ∑ tot. suffix fade */
.meta-price-suffix { overflow: hidden; }
.price-suffix-enter-active,
.price-suffix-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.price-suffix-enter-from { opacity: 0; transform: translateY(-4px); }
.price-suffix-leave-to   { opacity: 0; transform: translateY(4px); }

.meta-price-box {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
  min-width: 0;
  height: 36px;
  box-sizing: border-box;
  border: 1.5px solid var(--panel-border);
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
  transition: border-color 0.15s;
  cursor: text;
}
.meta-price-box:focus-within { border-color: #2E7D52; }

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
  height: 100%;
}
.meta-price-input::placeholder { color: #6BA888; }

.meta-price-suffix {
  font-size: 11px;
  color: #6BA888;
  flex-shrink: 0;
  max-width: 72px;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
}
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
  height: 36px;
  box-sizing: border-box;
}
.meta-input:focus {
  border-color: #2E7D52;
}
.meta-input::placeholder {
  color: #6BA888;
}
.meta-input--qty {
  flex: 1 0 52px;
}
.meta-pieces-box.meta-pieces-box--wide {
  flex: 1;
  width: 100%;
}
.meta-pieces-box.meta-pieces-box--wide .meta-pieces-input {
  width: auto;
  flex: 1;
  min-width: 0;
}
.meta-density-group {
  display: flex;
  gap: 5px;
  flex: 1;
  min-width: 0;
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
  height: 36px;
  box-sizing: border-box;
}
.meta-select--unit {
  flex: 0 1 64px;
  min-width: 44px;
}
.meta-pieces-box {
  display: flex;
  align-items: center;
  gap: 2px;
  border: 1.5px solid var(--panel-border);
  border-radius: 8px;
  padding: 7px 8px;
  background: #fff;
  flex: 0 0 54px;
  height: 36px;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.meta-pieces-box:focus-within { border-color: #2E7D52; }

.meta-pieces-prefix {
  font-size: 12px;
  font-weight: 700;
  color: #2E7D52;
  flex-shrink: 0;
}

.meta-pieces-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 12px;
  color: #1A4D35;
  padding: 0;
  width: 28px;
}
.meta-pieces-input::placeholder { color: #6BA888; }
.meta-pieces-input::-webkit-outer-spin-button,
.meta-pieces-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.meta-pieces-input { -moz-appearance: textfield; }

.meta-select--category {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  line-height: 1;
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

.item-name-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.item-name {
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
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-qty--checked {
  color: #9ECDB6;
}

.pieces-badge {
  font-size: 11px;
  font-weight: 700;
  color: #2E7D52;
  background: #d4f0e4;
  border-radius: 99px;
  padding: 1px 6px;
  white-space: nowrap;
  flex-shrink: 0;
}
.pieces-badge--checked {
  color: #9ECDB6;
  background: #eaf7f0;
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
  border: 1px solid #f0c5c5;
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
  align-items: center;
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

.move-item-hint {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 500;
  color: #2E7D52;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.move-expiry-wrap {
  position: relative;
  flex: 0 0 138px;
  min-width: 0;
}

.move-expiry-label {
  position: absolute;
  top: -1px;
  left: 10px;
  transform: translateY(-50%);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6BA888;
  background: #EAF7F0;
  padding: 0 3px;
  pointer-events: none;
  z-index: 1;
}

.move-expiry-suggested {
  position: absolute;
  top: -1px;
  right: 10px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  font-size: 9px;
  font-weight: 600;
  color: #2E7D52;
  background: #EAF7F0;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1;
}

.move-expiry-input {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  min-width: 0;
  border: 1.5px solid #B8E6D0;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #1A4D35;
  background: #fff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
  cursor: pointer;
}
.move-expiry-input--empty {
  color: #6BA888;
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
  min-height: 0;
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
  min-height: 0;
}

.view-inline-row {
  display: flex;
  gap: 5px;
  align-items: flex-end;
}

.view-inline-row .view-section {
  flex: 1;
  min-width: 0;
}

.view-inline-row--three .view-section--expiry   { flex: 1; min-width: 0; }
.view-inline-row--three .view-section--store    { flex: 1; min-width: 0; }
.view-inline-row--three .view-section--category { flex: 2; min-width: 0; }

.view-name-row {
  display: flex;
  gap: 5px;
  align-items: flex-end;
}

.view-section--name {
  flex: 1;
  min-width: 0;
}

.view-section--price {
  flex: 0 0 calc(50% - 130px);
  min-width: 0;
}

.edit-name-row {
  display: flex;
  gap: 5px;
  align-items: flex-end;
}

.item-edit-field--name {
  flex: 1;
  min-width: 0;
}

.item-edit-field--price {
  flex: 0 0 calc(50% - 130px);
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
  /* content height = 40 - 3 (border) - 20 (padding) = 17px.
     Matching line-height vertically centres the single line so it
     sits at the same Y as the centred text in <input> edit fields. */
  line-height: 17px;
  height: 40px;
  box-sizing: border-box;
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

/* mirror the edit-mode symbol/value gap (.item-price-box gap: 4px) so
   the spacing is identical between view and edit */
.view-price-symbol {
  font-weight: 600;
  color: #2E7D52;
  margin-right: 4px;
}
.view-price-pc {
  font-size: 11px;
  color: #6BA888;
  margin-left: auto;
  padding-left: 4px;
}
.view-section--price .view-value-box {
  display: flex;
  align-items: center;
}

.edit-inline-row {
  display: flex;
  gap: 5px;
  align-items: flex-end;
}

.edit-inline-row .item-edit-field {
  flex: 1;
  min-width: 0;
}

.edit-row--qty-density > .item-edit-field {
  flex: 0 0 calc(50% - 2.5px);
  min-width: 0;
}

.edit-inline-row--three .item-edit-field--expiry   { flex: 1; min-width: 0; }
.edit-inline-row--three .item-edit-field--store    { flex: 1; min-width: 0; }
.edit-inline-row--three .item-edit-field--category { flex: 2; min-width: 0; }

.item-pieces-box {
  display: flex;
  align-items: center;
  gap: 2px;
  border: 1.5px solid #B8E6D0;
  border-radius: 12px;
  padding: 10px 6px;
  background: #EAF7F0;
  flex: 0 0 48px;
  height: 40px;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.item-pieces-box--full {
  flex: 1;
}
.item-pieces-box:focus-within { border-color: #2E7D52; }

.item-pieces-prefix {
  font-size: 13px;
  font-weight: 700;
  color: #2E7D52;
  flex-shrink: 0;
}

.item-pieces-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  font-weight: 500;
  color: #1A4D35;
  padding: 0;
  width: 22px;
}
.item-pieces-input::placeholder { color: #9ECDB6; }
.item-pieces-input::-webkit-outer-spin-button,
.item-pieces-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.item-pieces-input { -moz-appearance: textfield; }

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
  height: 40px;
  box-sizing: border-box;
  color: #1A4D35;
  background: #EAF7F0;
  outline: none;
  transition: border-color 0.15s;
  overflow: hidden;
}

.item-edit-input:focus,
.item-edit-select:focus {
  border-color: #2E7D52;
}

.item-edit-input::placeholder { color: #9ECDB6; }
.item-edit-input[type="number"]::-webkit-outer-spin-button,
.item-edit-input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.item-edit-input[type="number"] { -moz-appearance: textfield; }

.item-edit-select {
  /* unlike <input>, <select> honors line-height for vertical text
     position — pin it to the content height so the closed value sits
     at the same Y as the view box (and the edit inputs). */
  line-height: 17px;
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
  -webkit-appearance: none;
  appearance: none;
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
  gap: 5px;
  min-width: 0;
  width: 100%;
}
.item-qty-row .item-edit-input { flex: 1 0 56px; }
.item-edit-select--unit { flex: 0 0 78px; min-width: 0; }

.item-edit-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}
.item-edit-label-row .item-edit-label {
  margin: 0;
}
.item-price-suffix {
  font-size: 11px;
  color: #6BA888;
  flex-shrink: 0;
  max-width: 72px;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
}

.item-price-box {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #EAF7F0;
  border: 1.5px solid #B8E6D0;
  border-radius: 12px;
  padding: 10px 12px;
  height: 40px;
  box-sizing: border-box;
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
  min-height: 0;
}

@media (max-width: 767px) {
  .meta-select--unit {
    flex: 0 1 67px;
    min-width: 44px;
  }
  .meta-pieces-box {
    flex: 0 0 48px;
    padding: 7px 6px;
  }
  .meta-pieces-box.meta-pieces-box--wide {
    flex: 1;
    padding: 7px 10px;
  }
  .meta-pieces-input {
    width: 22px;
  }
  .add-meta-field--price {
    flex: 0 0 calc(50% - 55.5px);
  }
  .edit-inline-row--three .item-edit-field--expiry,
  .view-inline-row--three .view-section--expiry {
    flex: 1;
  }
  .item-edit-field--price,
  .view-section--price {
    flex: 0 0 40%;
  }
  .item-edit-select--qty-unit {
    flex: 0 1 74px;
    min-width: 50px;
  }
}

/* Mobile-only vs desktop-only price optional text */
.price-opt--desktop { display: none; }
@media (min-width: 768px) {
  .price-opt--mobile  { display: none; }
  .price-opt--desktop { display: inline; }
}

/* Add form: append " tot." to ∑ toggle label on desktop */
@media (min-width: 768px) {
  .add-meta-field--price :deep(.app-field-toggle-text)::after { content: ' tot.'; }
  .item-edit-field--price :deep(.app-field-toggle-text)::after { content: ' tot.'; }
}
</style>
