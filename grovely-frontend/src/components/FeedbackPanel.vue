<template>
  <section class="feedback-panel" :class="{ 'feedback-panel--compact': compact }" aria-label="Send feedback" role="button" tabindex="0" @click="open = true" @keydown.enter="open = true" @keydown.space.prevent="open = true">
    <div class="feedback-panel-copy">
      <v-icon size="17" color="#993556">mdi-message-text-outline</v-icon>
      <div>
        <span v-if="compact">Would you like to see Grovely grow and improve?<br><span class="feedback-panel-link">Send us a bug report or feature request.</span><br>Any feedback is appreciated!</span>
        <span v-else>Would you like to see Grovely grow and improve?<br><span class="feedback-panel-link">Send us a bug report or feature request.</span><br>Any feedback is appreciated!</span>
      </div>
    </div>
  </section>

  <DetailSheet
    :open="open"
    title="Send feedback"
    subtitle="A note, idea, problem, or a little encouragement"
    subtitle-style="plain"
    theme="pink"
    hug-content
    compact-footer
    @update:open="open = $event"
  >
    <div ref="feedbackContentEl" class="feedback-content" :style="preservedContentHeight ? { height: `${preservedContentHeight}px`, flex: `0 0 ${preservedContentHeight}px` } : undefined">
      <Transition name="feedback-content-swap" mode="out-in">
        <form v-if="panelMode === 'form'" id="feedback-form" key="form" class="feedback-form" @submit.prevent="send">
        <p class="feedback-intro">
          For bugs and feature ideas, please <a href="https://github.com/grovely-org/grovely-app/issues" target="_blank" rel="noopener noreferrer">check existing GitHub issues first</a>.
        </p>

        <div class="feedback-field">
          <label class="feedback-label" for="feedback-category">Feedback type</label>
          <select id="feedback-category" v-model="category" class="feedback-select">
            <option value="bug">Bug report</option>
            <option value="feature-request">Feature request</option>
            <option value="greeting">Greeting</option>
            <option value="encouragement">Encouragement</option>
            <option value="other">Other feedback</option>
          </select>
        </div>

        <div class="feedback-field">
          <label class="feedback-label" for="feedback-message">Message</label>
          <textarea id="feedback-message" v-model.trim="message" class="feedback-textarea" :maxlength="feedbackLimits.message" :placeholder="`Enter up to ${feedbackLimits.message} characters of feedback here`" required />
          <p class="feedback-counter" :class="{ 'feedback-counter--warn': message.length >= feedbackLimits.message - 20 }">{{ message.length }} / {{ feedbackLimits.message }}</p>
        </div>

          <div class="feedback-field">
            <label class="feedback-label" for="feedback-email">Email for a reply <span>(optional)</span></label>
            <input id="feedback-email" v-model.trim="email" class="feedback-input" type="email" :maxlength="feedbackLimits.email" autocomplete="email" placeholder="you@example.com" />
            <p class="feedback-field-help">Add your email if you would be open to a reply about a resolution, status, or anything else.</p>
          </div>

          <input v-model="website" class="feedback-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" />

        </form>

        <div v-else key="info" class="feedback-info">
          <p class="feedback-info-title">About sending feedback</p>
          <p class="feedback-privacy">
            Feedback is sent only when you choose Send. Grovely sends the category and message you enter, plus your email only if you choose to include it for a reply.<br>
            No household data, account name, license information, installed version, usage data, logs, or device identifiers are attached automatically.
          </p>
          <p class="feedback-privacy">
            The message and optional email are encrypted in your browser before sending.<br>
            Feedback is not used for advertising, profiling, or product-usage tracking.<br>
            Grovely does not store IP addresses. Cloudflare processes normal connection metadata only to deliver and protect this public feedback service.<br><br>
            Please do not include passwords, access tokens, backups, health information, or other sensitive information.
          </p>
        </div>
      </Transition>

      <div v-if="panelMode === 'form'" class="feedback-status-area">
        <p class="feedback-status" :class="{ 'feedback-error': error, 'feedback-success': sent }" :role="error ? 'alert' : 'status'" aria-live="polite">
          {{ error || (sent ? 'Thanks. Your feedback has been sent.' : '') }}
        </p>
        <p v-if="!configured" class="feedback-unavailable">Feedback isn't available in this build.</p>
      </div>

    </div>

    <template #[footerSlot]>
      <div class="feedback-actions">
        <IconAction
          :icon="panelMode === 'form' ? 'mdi-information-outline' : 'mdi-message-text-outline'"
          :label="panelMode === 'form' ? 'Info' : 'Feedback'"
          @click="togglePanelMode"
        />
        <div v-if="panelMode === 'form'" class="feedback-send-action">
          <IconAction
            icon="mdi-send"
            :label="sending ? 'Sending...' : 'Send'"
            :disabled="sending || !configured || !message.trim()"
            @click="send"
          />
        </div>
      </div>
    </template>
  </DetailSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DetailSheet from './ui/DetailSheet.vue'
import IconAction from './ui/IconAction.vue'
import { feedbackConfig, feedbackLimits, submitFeedback, type FeedbackCategory } from '../services/feedback'

defineProps<{ compact?: boolean }>()

const open = ref(false)
const category = ref<FeedbackCategory>('bug')
const message = ref('')
const email = ref('')
const website = ref('')
const sending = ref(false)
const sent = ref(false)
const error = ref('')
const panelMode = ref<'form' | 'info'>('form')
const footerSlot = 'footer'
const feedbackContentEl = ref<HTMLElement | null>(null)
const preservedContentHeight = ref<number | null>(null)
const config = feedbackConfig()
const configured = computed(() => config !== null)

watch(open, (isOpen) => {
  if (!isOpen) {
    sent.value = false
    error.value = ''
    panelMode.value = 'form'
    preservedContentHeight.value = null
  }
})

function togglePanelMode() {
  if (panelMode.value === 'form') {
    preservedContentHeight.value = feedbackContentEl.value?.offsetHeight ?? null
    panelMode.value = 'info'
    return
  }

  panelMode.value = 'form'
}

async function send() {
  if (!config || !message.value || website.value) return

  sending.value = true
  error.value = ''
  sent.value = false
  try {
    await submitFeedback({ category: category.value, message: message.value, email: email.value || undefined }, config)
    message.value = ''
    email.value = ''
    sent.value = true
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Feedback could not be sent. Please try again later.'
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.feedback-panel { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 10px 12px; border: 1.5px solid #F4C0D1; border-radius: 10px; background: #FDF6F9; cursor: pointer; }
.feedback-panel:focus-visible { outline: 2px solid #993556; outline-offset: 2px; }
.feedback-panel-copy { display: flex; align-items: center; gap: 8px; min-width: 0; color: #993556; }
.feedback-panel-copy p { margin: 0 0 1px; font-size: 11px; font-weight: 700; line-height: 1.3; }
.feedback-panel-copy span { display: block; font-size: 10px; line-height: 1.3; }
.feedback-panel-link { display: inline !important; color: #7f2745; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
.feedback-panel--compact { box-sizing: border-box; min-height: 51px; margin-bottom: 0; padding: 8px 10px; }
.feedback-panel--compact .feedback-panel-copy p { font-size: 10px; }
.feedback-panel--compact .feedback-panel-copy span { font-size: 11px; line-height: 1.4; }
.feedback-content, .feedback-form, .feedback-info { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.feedback-form { flex: 0 0 auto; }
.feedback-intro, .feedback-privacy, .feedback-unavailable { color: #62565a; font-size: 13px; line-height: 1.5; }
.feedback-intro { margin: 0 0 16px; }
.feedback-intro a { color: #993556; font-weight: 700; }
.feedback-field { margin-bottom: 16px; }
.feedback-label { display: block; margin: 0 0 6px; color: #503b43; font-size: 12px; font-weight: 700; }
.feedback-label span { color: #85747a; font-weight: 400; }
.feedback-select, .feedback-textarea, .feedback-input { width: 100%; box-sizing: border-box; border: 1px solid #F4C0D1; border-radius: 12px; color: #72243E; background: #FBEAF0; font: inherit; font-size: 13px; padding: 10px 12px; }
.feedback-textarea { flex: 0 0 230px; height: 230px; resize: none; line-height: 1.5; }
.feedback-input::placeholder, .feedback-textarea::placeholder { color: #c697a9; opacity: 1; }
.feedback-select:focus, .feedback-textarea:focus, .feedback-input:focus { outline: 2px solid #e8a9bf; outline-offset: 1px; }
.feedback-honeypot { position: absolute; left: -9999px; }
.feedback-counter { margin: 5px 2px 0; color: #9b7080; font-size: 11px; line-height: 1.2; text-align: right; }
.feedback-counter--warn { color: #a52d48; font-weight: 700; }
.feedback-field-help { margin: 6px 2px 0; color: #8c6c78; font-size: 11px; line-height: 1.4; }
.feedback-info { display: flex; flex-direction: column; gap: 14px; }
.feedback-info-title { margin: 0; color: #72243E; font-size: 14px; font-weight: 700; }
.feedback-privacy { margin: 0; color: #62565a; font-size: 13px; line-height: 1.5; }
.feedback-status-area { flex-shrink: 0; }
.feedback-actions { display: flex; align-items: flex-end; justify-content: space-between; width: 100%; }
.feedback-send-action { display: flex; align-items: flex-end; }
.feedback-actions :deep(.ia-root) { width: 36px; }
.feedback-status { min-height: 18px; overflow: hidden; color: #62565a; font-size: 12px; line-height: 18px; margin: 8px 0; text-overflow: ellipsis; white-space: nowrap; }
.feedback-error { color: #a52d48; }
.feedback-success { color: #47734f; }
.feedback-unavailable { margin: 8px 0 0; font-size: 11px; }
.feedback-content-swap-enter-active, .feedback-content-swap-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.feedback-content-swap-enter-from { opacity: 0; transform: translateX(8px); }
.feedback-content-swap-leave-to { opacity: 0; transform: translateX(-8px); }
</style>
