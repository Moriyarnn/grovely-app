<template>
  <Teleport to="body">
    <div
      class="cd-backdrop"
      :class="[`cd-backdrop--${theme}`, { 'cd-backdrop--visible': open }]"
      @click="$emit('update:open', false)"
    />
    <div class="cd-modal" :class="{ 'cd-modal--open': open }">
      <div class="cd-inner" :class="`cd-inner--${theme}`">
        <div class="cd-icon" :class="`cd-icon--${theme}`">
          <v-icon size="28" :color="iconColor">{{ icon }}</v-icon>
        </div>
        <p class="cd-title" :class="`cd-title--${theme}`">{{ title }}</p>
        <p
          class="cd-desc"
          :class="[`cd-desc--${theme}`, { 'cd-desc--clamped': descMaxLines > 0 }]"
          :style="descMaxLines > 0 ? { '--clamp-lines': String(descMaxLines) } : null"
        >
          <span v-if="descMaxLines > 0" class="cd-desc-clamp"><slot /></span>
          <slot v-else />
        </p>
        <slot name="content" />
        <div v-if="!hideActions" class="cd-actions">
          <button class="cd-cancel" :class="`cd-cancel--${theme}`" @click="$emit('update:open', false)">Cancel</button>
          <slot name="extra-action" />
          <button
            class="cd-confirm"
            :style="{ background: confirmColor }"
            :disabled="loading"
            @click="$emit('confirm')"
          >{{ loading ? loadingLabel : confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  open:         { type: Boolean, default: false },
  icon:         { type: String,  default: 'mdi-delete-outline' },
  iconColor:    { type: String,  default: '#c0392b' },
  title:        { type: String,  default: '' },
  confirmLabel: { type: String,  default: 'Yes, delete' },
  loadingLabel: { type: String,  default: 'Deleting...' },
  confirmColor: { type: String,  default: '#c0392b' },
  loading:      { type: Boolean, default: false },
  theme:        { type: String,  default: 'pink' },  // 'pink' | 'green' | 'amber'
  descMaxLines: { type: Number,  default: 0 },       // 0 = unlimited; >0 reserves N lines, ellipsis after
  hideActions:  { type: Boolean, default: false },   // hide default cancel/confirm row; use #content for custom actions
})
defineEmits(['update:open', 'confirm'])
</script>

<style scoped>
.cd-backdrop {
  position: fixed; inset: 0;
  z-index: 200;
  opacity: 0; pointer-events: none;
  transition: opacity 0.2s;
}
.cd-backdrop--visible { opacity: 1; pointer-events: all; }
.cd-backdrop--pink  { background: rgba(114,  36,  62, 0.25); }
.cd-backdrop--green { background: rgba( 26,  77,  53, 0.25); }
.cd-backdrop--amber { background: rgba(139,  90,   0, 0.20); }

.cd-modal {
  position: fixed; inset: 0;
  z-index: 201;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
  padding: 1.5rem;
}
.cd-modal--open { pointer-events: all; }

.cd-inner {
  background: #fff;
  border-radius: 20px;
  padding: 2rem 1.5rem 1.5rem;
  width: 100%; max-width: 340px;
  display: flex; flex-direction: column; align-items: center;
  gap: 0.6rem;
  transform: scale(0.92); opacity: 0;
  transition: transform 0.22s cubic-bezier(.4,0,.2,1), opacity 0.22s;
}
.cd-inner--pink  { box-shadow: 0 8px 40px rgba(114,  36,  62, 0.18); }
.cd-inner--green { box-shadow: 0 8px 40px rgba( 26,  77,  53, 0.18); }
.cd-inner--amber { box-shadow: 0 8px 40px rgba(139,  90,   0, 0.15); }
.cd-modal--open .cd-inner { transform: scale(1); opacity: 1; }

.cd-icon {
  width: 52px; height: 52px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 0.25rem;
}
.cd-icon--pink  { background: #fff0ee; border: 1px solid #f5c6c0; }
.cd-icon--green { background: #EAF7F0; border: 1px solid #B8E6D0; }
.cd-icon--amber { background: #FFF8E7; border: 1px solid #F5D78A; }

.cd-title {
  font-size: 16px; font-weight: 600;
  margin: 0; text-align: center;
}
.cd-title--pink  { color: #72243E; }
.cd-title--green { color: #1A4D35; }
.cd-title--amber { color: #6B4500; }

.cd-desc {
  font-size: 13px; margin: 0; text-align: center; line-height: 1.5;
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.cd-desc--pink  { color: #a0667a; }
.cd-desc--green { color: #6BA888; }
.cd-desc--amber { color: #B8860B; }

.cd-desc--clamped {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(var(--clamp-lines) * 1.5em);
  max-height: calc(var(--clamp-lines) * 1.5em);
  width: 100%;
}

.cd-desc-clamp {
  display: -webkit-box;
  -webkit-line-clamp: var(--clamp-lines, 3);
  -webkit-box-orient: vertical;
  overflow: hidden;
  width: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.cd-actions {
  display: flex; gap: 8px; margin-top: 0.75rem; width: 100%;
}

.cd-cancel {
  flex: 1; padding: 10px;
  border-radius: 20px;
  background: #fff; font-size: 13px;
  cursor: pointer; font-weight: 500;
  white-space: nowrap;
}
.cd-cancel--pink  { border: 1px solid #F4C0D1; color: #993556; }
.cd-cancel--green { border: 1px solid #B8E6D0; color: #2E7D52; }
.cd-cancel--amber { border: 1px solid #F5D78A; color: #8B5A00; }

.cd-confirm {
  flex: 1; padding: 10px;
  border-radius: 20px; border: none;
  font-size: 13px; color: #fff;
  cursor: pointer; font-weight: 500;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.cd-confirm:disabled { opacity: 0.6; cursor: default; }
</style>
