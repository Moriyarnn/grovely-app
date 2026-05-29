<template>
  <div class="list-controls" :style="themeVars">

    <!-- ── Compact layout ── -->
    <template v-if="layout === 'compact'">

      <!-- Row 1: search bar, panel buttons on the right -->
      <div class="compact-bar">
        <div class="compact-search" :class="{ 'compact-search--focused': focused }">
          <v-icon size="13" :color="colors.mid">mdi-magnify</v-icon>
          <input
            v-model="search"
            class="search-input"
            :placeholder="placeholder"
            autocomplete="off"
            @focus="focused = true"
            @blur="focused = false"
          />
          <button v-if="search" class="search-clear" @click="search = ''" tabindex="-1">
            <v-icon size="12" :color="colors.mid">mdi-close</v-icon>
          </button>
        </div>

        <button
          v-if="visibleFilterOptions.length > 1"
          class="panel-btn"
          :class="{ 'panel-btn--active': activePanel === 'filter', 'panel-btn--dirty': !!activeFilter }"
          @click="activePanel = 'filter'"
          title="Filter by category"
        >
          <v-icon size="15" :color="activePanel === 'filter' || activeFilter ? colors.accent : colors.mid">mdi-tune-variant</v-icon>
          <span v-if="activeFilter" class="panel-btn-dot" />
        </button>

        <button
          v-if="sortOptions.length > 0"
          class="panel-btn"
          :class="{ 'panel-btn--active': activePanel === 'sort', 'panel-btn--dirty': isNonDefaultSort }"
          @click="activePanel = 'sort'"
          title="Sort"
        >
          <v-icon size="15" :color="activePanel === 'sort' || isNonDefaultSort ? colors.accent : colors.mid">mdi-sort-variant</v-icon>
          <span v-if="isNonDefaultSort" class="panel-btn-dot" />
        </button>
      </div>

      <!-- Row 2: pills — animated swap between category and sort. Dir arrow always visible. -->
      <div v-if="visibleFilterOptions.length > 1 || sortOptions.length > 0" class="pills-row">
        <div class="pills-scroll">
          <Transition name="pills-swap" mode="out-in">

            <div v-if="activePanel === 'filter' && visibleFilterOptions.length > 1" key="filter" class="pills-group">
              <button
                class="chip"
                :class="{ 'chip--active': !activeFilter }"
                @click="activeFilter = null"
              >All</button>
              <button
                v-for="opt in visibleFilterOptions"
                :key="opt.value"
                class="chip"
                :class="{ 'chip--active': activeFilter === opt.value }"
                @click="activeFilter = activeFilter === opt.value ? null : opt.value"
              >{{ opt.label }}</button>
            </div>

            <div v-else-if="activePanel === 'sort' && sortOptions.length > 0" key="sort" class="pills-group">
              <button
                v-for="opt in sortOptions"
                :key="opt.key"
                class="sort-btn"
                :class="{ 'sort-btn--active': activeSort === opt.key }"
                @click="setSort(opt.key)"
              >{{ opt.label }}</button>
            </div>

          </Transition>
        </div>

        <button
          v-if="sortOptions.length > 0"
          class="dir-btn"
          @click="flipDir"
          :title="sortDir === 'asc' ? 'Ascending' : 'Descending'"
        >
          <v-icon size="13" :color="colors.accent">{{ sortDir === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
        </button>
      </div>

    </template>

    <!-- ── Expanded layout: stacked rows ── -->
    <template v-else>
      <div class="search-row" :class="{ 'search-row--focused': focused }">
        <v-icon size="14" :color="colors.mid" class="search-icon">mdi-magnify</v-icon>
        <input
          v-model="search"
          class="search-input"
          :placeholder="placeholder"
          autocomplete="off"
          @focus="focused = true"
          @blur="focused = false"
        />
        <button v-if="search" class="search-clear" @click="search = ''" tabindex="-1">
          <v-icon size="12" :color="colors.mid">mdi-close</v-icon>
        </button>
      </div>

      <div v-if="visibleFilterOptions.length > 1" class="pills-row">
        <div class="pills-scroll">
          <div class="pills-group">
            <button
              class="chip"
              :class="{ 'chip--active': !activeFilter }"
              @click="activeFilter = null"
            >All</button>
            <button
              v-for="opt in visibleFilterOptions"
              :key="opt.value"
              class="chip"
              :class="{ 'chip--active': activeFilter === opt.value }"
              @click="activeFilter = activeFilter === opt.value ? null : opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>
      </div>

      <div v-if="sortOptions.length > 0" class="pills-row">
        <div class="pills-scroll">
          <div class="pills-group">
            <button
              v-for="opt in sortOptions"
              :key="opt.key"
              class="sort-btn"
              :class="{ 'sort-btn--active': activeSort === opt.key }"
              @click="setSort(opt.key)"
            >{{ opt.label }}</button>
          </div>
        </div>
        <button class="dir-btn" @click="flipDir" :title="sortDir === 'asc' ? 'Ascending' : 'Descending'">
          <v-icon size="13" :color="colors.accent">{{ sortDir === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
        </button>
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ search: '', filter: null, sort: null, sortDir: 'asc' }),
  },
  filterOptions: { type: Array,  default: () => [] },
  items:         { type: Array,  default: () => [] },
  sortOptions:   { type: Array,  default: () => [] },
  placeholder:   { type: String, default: 'Search…' },
  layout: {
    type: String,
    default: 'expanded',
    validator: v => ['compact', 'expanded'].includes(v),
  },
  theme: {
    type: String,
    default: 'green',
    validator: v => ['green', 'pink', 'amber', 'blue'].includes(v),
  },
})

const emit = defineEmits(['update:modelValue'])

const THEMES = {
  green: { accent: '#2E7D52', mid: '#6BA888', border: '#C8E8D8', bg: '#EAF7F0', searchBg: '#f4faf7', hoverBg: '#f0faf5', dirHover: '#d4f0e4', text: '#1A4D35' },
  pink:  { accent: '#993556', mid: '#c4728e', border: '#e8b4c4', bg: '#FBEAF0', searchBg: '#fdf5f8', hoverBg: '#f8eef3', dirHover: '#f0d4de', text: '#3D1520' },
  amber: { accent: '#b45309', mid: '#d4844a', border: '#f5d78a', bg: '#FFF8E7', searchBg: '#fffcf0', hoverBg: '#fffbea', dirHover: '#f5e9c0', text: '#3d2000' },
  blue:  { accent: '#1565c0', mid: '#5e92d8', border: '#b8d4f0', bg: '#e3f2fa', searchBg: '#f0f7fd', hoverBg: '#e8f3fb', dirHover: '#c8e4f5', text: '#0d2a4d' },
}

const colors    = computed(() => THEMES[props.theme] ?? THEMES.green)
const themeVars = computed(() => ({
  '--lc-accent':    colors.value.accent,
  '--lc-mid':       colors.value.mid,
  '--lc-border':    colors.value.border,
  '--lc-bg':        colors.value.bg,
  '--lc-search-bg': colors.value.searchBg,
  '--lc-hover-bg':  colors.value.hoverBg,
  '--lc-dir-hover': colors.value.dirHover,
  '--lc-text':      colors.value.text,
}))

const focused      = ref(false)
const search       = ref(props.modelValue.search  ?? '')
const activeFilter = ref(props.modelValue.filter  ?? null)
const activeSort   = ref(props.modelValue.sort    ?? props.sortOptions[0]?.key ?? null)
const sortDir      = ref(props.modelValue.sortDir ?? 'asc')

const activePanel  = ref(props.filterOptions.length > 0 ? 'filter' : 'sort')

const visibleFilterOptions = computed(() => {
  if (!props.items.length) return props.filterOptions
  const present = new Set(props.items.map(i => i.category ?? i.type ?? i.filter))
  return props.filterOptions.filter(o => present.has(o.value))
})

const isNonDefaultSort = computed(() => {
  const defaultKey = props.sortOptions[0]?.key
  const defaultDir = props.sortOptions[0]?.defaultDir ?? 'asc'
  return activeSort.value !== defaultKey || sortDir.value !== defaultDir
})

function setSort(key) {
  if (activeSort.value === key) return
  activeSort.value = key
  sortDir.value = props.sortOptions.find(o => o.key === key)?.defaultDir ?? 'asc'
}

function flipDir() {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
}

watch([search, activeFilter, activeSort, sortDir], () => {
  emit('update:modelValue', {
    search:  search.value,
    filter:  activeFilter.value,
    sort:    activeSort.value,
    sortDir: sortDir.value,
  })
})
</script>

<style scoped>
.list-controls {
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex-shrink: 0;
}

/* ── Compact: top bar ──────────────────────────────────── */
.compact-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.compact-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--lc-search-bg);
  border: 1.5px solid var(--lc-border);
  border-radius: 10px;
  padding: 6px 10px;
  min-width: 0;
  transition: border-color 0.15s;
}
.compact-search--focused { border-color: var(--lc-accent); }

.panel-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1.5px solid var(--lc-border);
  background: var(--lc-search-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}
.panel-btn:hover        { background: var(--lc-hover-bg); }
.panel-btn--active      { background: var(--lc-bg); border-color: var(--lc-accent); }
.panel-btn--dirty       { border-color: var(--lc-accent); }

.panel-btn-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--lc-accent);
}

/* ── Shared: pills row ─────────────────────────────────── */
.pills-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 38px;
}

.pills-scroll {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;
  height: 38px;
  box-sizing: border-box;
  padding-bottom: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--lc-border) transparent;
  touch-action: pan-x;
}
.pills-scroll::-webkit-scrollbar         { height: 3px; }
.pills-scroll::-webkit-scrollbar-track   { background: transparent; }
.pills-scroll::-webkit-scrollbar-thumb   { border-radius: 99px; background: var(--lc-border); }
.pills-scroll::-webkit-scrollbar-thumb:hover { background: var(--lc-mid); }

.pills-group {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* ── Pill swap transition ───────────────────────────────── */
.pills-swap-enter-active,
.pills-swap-leave-active { transition: opacity 0.12s ease; }
.pills-swap-enter-from,
.pills-swap-leave-to     { opacity: 0; }

/* ── Expanded: full-width search row ───────────────────── */
.search-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--lc-search-bg);
  border: 1.5px solid var(--lc-border);
  border-radius: 10px;
  padding: 7px 10px;
  transition: border-color 0.15s;
}
.search-row--focused { border-color: var(--lc-accent); }
.search-icon { flex-shrink: 0; }

/* Shared: input + clear */
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: var(--lc-text);
  min-width: 0;
}
.search-input::placeholder { color: color-mix(in srgb, var(--lc-mid) 60%, transparent); }

.search-clear {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  opacity: 0.7;
  transition: opacity 0.1s;
}
.search-clear:hover { opacity: 1; }

/* Shared: chips */
.chip {
  flex-shrink: 0;
  padding: 4px 11px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--lc-border);
  background: #fff;
  color: var(--lc-mid);
  cursor: pointer;
  letter-spacing: 0.01em;
  white-space: nowrap;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.chip:hover:not(.chip--active) { background: var(--lc-hover-bg); }
.chip--active { background: var(--lc-accent); color: #fff; border-color: var(--lc-accent); }

/* Shared: sort buttons */
.sort-btn {
  flex-shrink: 0;
  padding: 4px 11px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--lc-border);
  background: #fff;
  color: var(--lc-mid);
  cursor: pointer;
  white-space: nowrap;
  letter-spacing: 0.01em;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.sort-btn:hover:not(.sort-btn--active) { background: var(--lc-hover-bg); }
.sort-btn--active { background: var(--lc-bg); color: var(--lc-accent); border-color: var(--lc-accent); }

/* Shared: dir arrow */
.dir-btn {
  width: 26px;
  height: 26px;
  border-radius: 99px;
  border: 1px solid var(--lc-border);
  background: var(--lc-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.1s;
}
.dir-btn:hover { background: var(--lc-dir-hover); }
</style>
