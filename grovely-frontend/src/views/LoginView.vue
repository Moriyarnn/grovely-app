<template>
  <div class="login-root">

    <!-- Desktop: left branding panel -->
    <div class="login-branding" aria-hidden="true">
      <div class="branding-inner">
        <div class="branding-icon">
          <v-icon size="32" color="#D4537E">mdi-home-heart</v-icon>
        </div>
        <h1 class="branding-title">Grovely</h1>
        <p class="branding-tagline">Your private household hub.<br>Period tracking, groceries, and more — just for the two of you.</p>

        <div class="branding-chips">
          <div class="branding-chip" v-for="chip in chips" :key="chip.label" :style="{ background: chip.bg, borderColor: chip.border }">
            <v-icon size="13" :color="chip.iconColor">{{ chip.icon }}</v-icon>
            <span :style="{ color: chip.labelColor }">{{ chip.label }}</span>
          </div>
        </div>

        <p class="branding-note">
          <v-icon size="12" color="#bbb">mdi-lock-outline</v-icon>
          No telemetry. Your data stays on your server.
        </p>
      </div>
    </div>

    <!-- Login form -->
    <div class="login-form-panel">
      <div class="login-card">

        <!-- Mobile-only header -->
        <div class="mobile-header">
          <div class="mobile-icon">
            <v-icon size="24" color="#D4537E">mdi-home-heart</v-icon>
          </div>
          <h1 class="mobile-title">Grovely</h1>
        </div>

        <h2 class="form-heading">Welcome back</h2>
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
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { API, setToken, setUser } from '../api'
import { usePreferences } from '../composables/usePreferences'

const router = useRouter()
const { fetchPreferences } = usePreferences()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const chips = [
  { label: 'Period tracker', icon: 'mdi-heart-pulse', bg: '#FBEAF0', border: '#F4C0D1', iconColor: '#993556', labelColor: '#72243E' },
  { label: 'Sleep tracker',  icon: 'mdi-sleep',       bg: '#EDF0FB', border: '#B8C2F0', iconColor: '#3D52A0', labelColor: '#2B3A7A' },
]

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
  min-height: 100dvh;
  background: #fafafa;
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
    background: linear-gradient(160deg, #fff5f8 0%, #fdf0f5 40%, #f5f0fe 100%);
    border-right: 1px solid #f0e0e8;
    padding: 3rem;
  }
}

.branding-inner {
  max-width: 380px;
}

.branding-icon {
  width: 56px;
  height: 56px;
  background: #fff;
  border: 1.5px solid #F4C0D1;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
  box-shadow: 0 2px 8px rgba(212, 83, 126, 0.08);
}

.branding-title {
  font-size: 28px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 0.6rem;
  letter-spacing: -0.01em;
}

.branding-tagline {
  font-size: 15px;
  color: #666;
  line-height: 1.6;
  margin: 0 0 1.75rem;
}

.branding-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 1.75rem;
}

.branding-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 20px;
  border: 1.5px solid;
  font-size: 12px;
  font-weight: 500;
}

.branding-note {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #bbb;
  margin: 0;
}

/* ── Form panel ─────────────────────────────────────────────── */
.login-form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.25rem;
}

@media (min-width: 768px) {
  .login-form-panel {
    flex: 0 0 420px;
    padding: 3rem 3rem;
  }
}

.login-card {
  width: 100%;
  max-width: 360px;
}

/* ── Mobile header ──────────────────────────────────────────── */
.mobile-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2rem;
}

@media (min-width: 768px) {
  .mobile-header {
    display: none;
  }
}

.mobile-icon {
  width: 40px;
  height: 40px;
  background: #FBEAF0;
  border: 1.5px solid #F4C0D1;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

/* ── Form ───────────────────────────────────────────────────── */
.form-heading {
  font-size: 22px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px;
  letter-spacing: -0.01em;
}

.form-sub {
  font-size: 13px;
  color: #aaa;
  margin: 0 0 1.75rem;
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
