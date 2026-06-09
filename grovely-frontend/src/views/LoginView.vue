<template>
  <div class="login-root">

    <!-- Desktop: left branding panel -->
    <div class="login-branding" aria-hidden="true">
      <div class="branding-content">
        <div class="branding-header">
          <img :src="logoSide" alt="Grovely" class="branding-logo" />
          <h1 class="branding-headline">Your private household hub</h1>
          <p class="branding-sub">
            <v-icon size="16" color="#4ADE80" class="branding-sub-icon">mdi-shield-check-outline</v-icon>
            Self-hosted, open source, fully transparent.
          </p>
        </div>

        <div class="branding-hero-row">
          <div
            v-for="app in activeApps"
            :key="app.name"
            class="branding-hero"
            :style="{ borderColor: app.border }"
          >
            <div class="branding-hero-top">
              <div class="branding-hero-icon" :style="{ background: app.bg }">
                <v-icon size="28" :color="app.iconColor">{{ app.icon }}</v-icon>
              </div>
              <div class="branding-hero-text">
                <span class="branding-hero-name" :style="{ color: app.titleColor }">{{ app.name }}</span>
                <span class="branding-hero-tagline">{{ app.tagline }}</span>
              </div>
            </div>
            <div class="branding-hero-highlights">
              <span
                v-for="h in app.highlights"
                :key="h.label"
                class="branding-hero-chip"
                :class="{ 'branding-hero-chip--premium': h.premium && !premiumActive }"
                :style="{ background: (h.premium && !premiumActive) ? 'rgba(0,0,0,0.03)' : app.bg, color: (h.premium && !premiumActive) ? '#bbb' : app.subColor }"
              ><v-icon v-if="h.premium" size="11" :color="premiumActive ? app.subColor : '#bbb'" class="branding-chip-lock">{{ premiumActive ? 'mdi-lock-open-outline' : 'mdi-lock-outline' }}</v-icon>{{ h.label }}</span>
            </div>
          </div>
        </div>

        <div class="branding-bottom">
          <div class="branding-platform-row">
            <span class="branding-platform-pill">
              <v-icon size="14" color="#666">mdi-download-outline</v-icon>
              Manual backups
            </span>
            <span class="branding-platform-pill" :class="{ 'branding-platform-pill--premium': !premiumActive }">
              <v-icon v-if="!premiumActive" size="11" color="#bbb">mdi-lock-outline</v-icon>
              <v-icon v-else size="11" color="#4ADE80">mdi-lock-open-outline</v-icon>
              <v-icon size="14" :color="premiumActive ? '#666' : '#bbb'">mdi-cloud-sync-outline</v-icon>
              Automatic backups
            </span>
            <span class="branding-platform-pill" :class="{ 'branding-platform-pill--premium': !premiumActive }">
              <v-icon v-if="!premiumActive" size="11" color="#bbb">mdi-lock-outline</v-icon>
              <v-icon v-else size="11" color="#4ADE80">mdi-lock-open-outline</v-icon>
              <v-icon size="14" :color="premiumActive ? '#666' : '#bbb'">mdi-email-outline</v-icon>
              Email notifications
            </span>
          </div>

          <div class="branding-soon-row">
            <span class="branding-soon-label">Coming soon</span>
            <div class="branding-soon-pills">
              <div
                v-for="app in comingSoonApps"
                :key="app.name"
                class="branding-soon-pill"
              >
                <v-icon size="14" color="#b0acb4">{{ app.icon }}</v-icon>
                <span>{{ app.name }}</span>
              </div>
            </div>
          </div>

          <div class="branding-footer">
            <span class="branding-version">v0.12.6</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile: branded header -->
    <div class="mobile-hero">
      <img :src="logoStacked" alt="Grovely" class="mobile-logo" />
      <p class="mobile-tagline">Your private household hub</p>
      <div class="mobile-chips">
        <div class="mobile-chip" v-for="app in mobileApps" :key="app.name" :class="{ 'mobile-chip--inactive': !app.active }" :style="app.active ? { background: app.bg, borderColor: app.border } : {}">
          <v-icon size="13" :color="app.active ? app.iconColor : '#bbb'">{{ app.icon }}</v-icon>
          <span :style="{ color: app.active ? app.titleColor : '#bbb' }">{{ app.name }}</span>
        </div>
      </div>
    </div>

    <!-- Login form -->
    <div class="login-form-panel">
      <div class="form-content">
        <div class="form-header-spacer" aria-hidden="true"></div>

        <div class="login-card">
          <p class="form-sub">Sign in to your household</p>

          <form @submit.prevent="handleLogin" class="form-body">
            <div class="field-group">
              <label class="field-label">Username</label>
              <div class="field-input-wrap" :class="{ 'field-error': errorMsg && !username }">
                <v-icon size="16" color="#bbb" class="field-icon">mdi-account-outline</v-icon>
                <input
                  v-model="username"
                  type="text"
                  class="field-input"
                  placeholder="your username"
                  autocomplete="username"
                  autocapitalize="none"
                  spellcheck="false"
                  :disabled="loading"
                />
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Password</label>
              <div class="field-input-wrap" :class="{ 'field-error': errorMsg && !password }">
                <v-icon size="16" color="#bbb" class="field-icon">mdi-lock-outline</v-icon>
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="field-input"
                  placeholder="your password"
                  autocomplete="current-password"
                  :disabled="loading"
                />
                <button type="button" class="field-toggle" @click="showPassword = !showPassword" tabindex="-1">
                  <v-icon size="15" color="#bbb">{{ showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline' }}</v-icon>
                </button>
              </div>
            </div>

            <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

            <button type="submit" class="submit-btn" :class="{ loading }" :disabled="loading">
              <span v-if="!loading">Sign in</span>
              <v-progress-circular v-else indeterminate size="18" width="2" color="white" />
            </button>
          </form>

          <div class="form-footer">
            <div class="form-privacy">
              <v-icon size="13" color="#4ADE80">mdi-shield-check-outline</v-icon>
              <span>No telemetry. No cloud. Your data, your server.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile version -->
    <span class="mobile-version">v0.12.6</span>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API, setToken, setUser } from '../api'
import { usePreferences } from '../composables/usePreferences'
import logoSide from '../assets/Logo Side Login.png'
import logoStacked from '../assets/Logo Stacked Mobile.png'
import { apps } from '../composables/useApps'

const router = useRouter()
const { fetchPreferences } = usePreferences()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const premiumActive = ref(false)

onMounted(async () => {
  try {
    const res = await fetch(`${API}/license/active`)
    if (res.ok) {
      const data = await res.json()
      premiumActive.value = data.active
    }
  } catch {}
})
const loading = ref(false)
const errorMsg = ref('')

const loginApps = apps.filter(a => a.name !== 'Notion sync' && a.name !== 'And more...')
const mobileApps = loginApps

const heroFeatures: Record<string, { tagline: string, highlights: { label: string, premium?: boolean }[] }> = {
  'Period tracker': {
    tagline: 'Cycle tracking and predictions, fully private',
    highlights: [
      { label: 'Cycle predictions' },
      { label: 'Daily flow logging' },
      { label: 'Calendar view' },
      { label: 'Adjust cycle', premium: true },
    ],
  },
  'Pantry': {
    tagline: 'From shopping list to pantry, with expiry alerts',
    highlights: [
      { label: 'Shopping lists' },
      { label: 'Move to pantry' },
      { label: 'Expiry tracking' },
      { label: 'Smart autofill', premium: true },
    ],
  },
}
const activeApps = loginApps.filter(a => a.active).map(a => ({
  ...a,
  tagline: heroFeatures[a.name]?.tagline ?? '',
  highlights: heroFeatures[a.name]?.highlights ?? [],
}))
const comingSoonApps = loginApps.filter(a => !a.active && a.name !== 'Notion sync' && a.name !== 'And more...')

async function handleLogin() {
  errorMsg.value = ''
  if (!username.value || !password.value) {
    errorMsg.value = 'Please enter your username and password.'
    return
  }
  loading.value = true
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    })
    if (!res.ok) {
      errorMsg.value = 'Invalid username or password.'
      return
    }
    const data = await res.json()
    setToken(data.token)
    setUser({ username: data.username, role: data.role })
    await fetchPreferences()
    router.push('/')
  } catch {
    errorMsg.value = 'Unable to connect. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-root {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: linear-gradient(160deg, #fdf0f5 0%, #fdf0f5 50%, #f5f0fe 100%);
}

@media (min-width: 768px) {
  .login-root {
    flex-direction: row;
    height: 100dvh;
    overflow: hidden;
  }
}

/* ── Branding panel (desktop only) ─────────────────────────── */
.login-branding {
  display: none;
}

@media (min-width: 768px) {
  .login-branding {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, #fdf0f5 0%, #fdf0f5 50%, #f5f0fe 100%);
    padding: 3rem 3.5rem;
    overflow-y: auto;
  }
}

.branding-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

/* ── Header: logo, headline, subtitle ─────────────────────── */
.branding-header {
}

.branding-logo {
  height: 200px;
  width: auto;
  margin-bottom: 0.25rem;
}

.branding-headline {
  font-size: 30px;
  font-weight: 600;
  color: #2a2a2a;
  letter-spacing: -0.015em;
  line-height: 1.15;
  margin: 0 0 0.75rem;
  padding-left: 10px;
}

.branding-sub {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  margin: 0 0 0 10px;
  line-height: 1.4;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(74, 222, 128, 0.25);
  border-radius: 8px;
  padding: 8px 14px;
}

.branding-sub-icon {
  flex-shrink: 0;
}

/* ── Bottom section (pills + footer, pushed to bottom) ────── */
.branding-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Hero cards (active features) ─────────────────────────── */
.branding-hero-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.branding-hero {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.75);
  border: 1.5px solid;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.branding-hero-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.branding-hero-icon {
  width: 48px;
  height: 48px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.branding-hero-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.branding-hero-name {
  font-size: 16px;
  font-weight: 700;
}

.branding-hero-tagline {
  font-size: 13px;
  color: #888;
  line-height: 1.35;
}

.branding-hero-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.branding-hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
}

.branding-chip-lock {
  flex-shrink: 0;
}

/* ── Platform features strip ──────────────────────────────── */
.branding-platform-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.branding-platform-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.55);
  font-size: 12.5px;
  font-weight: 600;
  color: #666;
  white-space: nowrap;
}

.branding-platform-pill--premium {
  color: #bbb;
  background: rgba(255, 255, 255, 0.3);
}

/* ── Coming soon pills ────────────────────────────────────── */
.branding-soon-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.branding-soon-label {
  font-size: 12px;
  font-weight: 600;
  color: #bbb;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
}

.branding-soon-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.branding-soon-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 12.5px;
  font-weight: 500;
  color: #b0acb4;
  white-space: nowrap;
}

/* ── Footer ────────────────────────────────────────────────── */
.branding-footer {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.branding-version {
  font-size: 12px;
  color: #ccc;
  font-weight: 500;
}

/* ── Mobile hero ────────────────────────────────────────────── */
.mobile-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem 1.5rem 1rem;
}

@media (min-width: 768px) {
  .mobile-hero {
    display: none;
  }
}

/* 180px */
.mobile-logo {
  height: 160px;
  width: auto;
}

.mobile-tagline {
  font-size: 22px;
  font-weight: 500;
  color: #666;
  line-height: 1.35;
  margin: 0 0 1rem;
}

.mobile-chips {
  display: grid;
  grid-template-columns: repeat(3, auto);
  justify-content: center;
  gap: 8px;
}

.mobile-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 18px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.mobile-chip--inactive {
  background: #f5f5f5 !important;
  border-color: #e0e0e0 !important;
}

/* ── Mobile version ────────────────────────────────────────── */
.mobile-version {
  font-size: 12px;
  color: #ccc;
  font-weight: 500;
  text-align: center;
  padding-bottom: 1rem;
}

@media (min-width: 768px) {
  .mobile-version { display: none; }
}

/* ── Form panel ─────────────────────────────────────────────── */
.login-form-panel {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.25rem 1.5rem 2rem;
}

@media (min-width: 768px) {
  .login-form-panel {
    flex: 0 0 440px;
    align-items: flex-start;
    justify-content: center;
    padding: 3rem;
    padding-bottom: 2rem;
    background: #fdf8fa;
    overflow-y: auto;
  }
}

.form-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

@media (min-width: 768px) {
  .form-content {
    height: 100%;
    gap: 2.5rem;
  }
}

.form-header-spacer {
  display: none;
}

@media (min-width: 768px) {
  .form-header-spacer {
    display: block;
    width: 100%;
    height: 295px;
    flex-shrink: 1;
  }
}

.login-card {
  width: 100%;
  max-width: 360px;
  background: #fff;
  border: 1.5px solid #F4C0D1;
  border-radius: 14px;
  padding: 1.5rem;
}

@media (min-width: 768px) {
  .login-card {
    padding: 2rem;
    box-shadow: 0 2px 12px rgba(153, 53, 86, 0.06);
  }
}

/* ── Form footer (privacy line) ────────────────────────────── */
.form-footer {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #f0f0f0;
  text-align: center;
}

.form-privacy {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: #aaa;
}

/* ── Form ───────────────────────────────────────────────────── */
.form-sub {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 1.5rem;
  letter-spacing: -0.01em;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: #555;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.field-input-wrap {
  display: flex;
  align-items: center;
  background: #fff;
  border: 1.5px solid #e8e8e8;
  border-radius: 10px;
  padding: 0 12px;
  gap: 8px;
  transition: border-color 0.15s;
}

.field-input-wrap:focus-within {
  border-color: #D4537E;
}

.field-input-wrap.field-error {
  border-color: #f4a0b5;
}

.field-icon {
  flex-shrink: 0;
}

.field-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: #1a1a1a;
  background: transparent;
  padding: 11px 0;
  min-width: 0;
}

.field-input::placeholder {
  color: #ccc;
}

.field-input:disabled {
  opacity: 0.5;
}

.field-toggle {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.error-msg {
  font-size: 13px;
  color: #D4537E;
  margin: 0;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  background: #D4537E;
  color: white;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  transition: background 0.15s, opacity 0.15s;
  margin-top: 4px;
}

.submit-btn:hover:not(:disabled) {
  background: #c2446f;
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: default;
}
</style>
