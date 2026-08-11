import { shallowMount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HubView from '../HubView.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../../components/ui/AppToast.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../components/SummaryStrip.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../components/MainScreen.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../components/FeedbackPanel.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../components/PremiumGate.vue', () => ({ default: { template: '<div />' } }))

vi.mock('../../api', () => ({
  API: '/api',
  apiFetch: vi.fn(),
  getUser: () => ({ username: 'Owner', role: 'owner1' }),
  clearToken: vi.fn(),
  clearUser: vi.fn(),
  setToken: vi.fn(),
  setUser: vi.fn(),
}))

vi.mock('../../composables/usePreferences', () => {
  const preferences = ref({})
  return {
    usePreferences: () => ({
      preferences,
      fetchPreferences: vi.fn(),
      updatePreference: vi.fn(),
      resetCache: vi.fn(),
    }),
  }
})

vi.mock('../../composables/useApps', () => ({
  apps: [{
    name: 'Period Tracker',
    active: true,
    route: '/period',
    icon: 'mdi-calendar',
    iconColor: '#993556',
    titleColor: '#993556',
    subColor: '#777',
    bg: '#fff',
    border: '#f0d6e0',
    badgeText: '#993556',
  }],
}))

vi.mock('../../composables/useAppStats', () => {
  const dynamicSubs = ref({})
  return {
    useAppStats: () => ({ dynamicSubs, fetchAppStats: vi.fn() }),
  }
})

vi.mock('../../composables/usePeriodData', () => ({
  usePeriodData: () => ({ resetView: vi.fn() }),
}))

vi.mock('../../composables/useLicense', () => {
  const licenseActive = ref(true)
  return {
    useLicense: () => ({ licenseActive, fetchLicenseStatus: vi.fn() }),
  }
})

vi.mock('../../services/feedback', () => ({
  feedbackConfig: () => ({
    endpoint: 'https://feedback.example.test',
    publicKey: 'configured',
    keyId: 'v1',
  }),
}))

vi.mock('../../composables/useDemo', () => ({ openDemoExit: vi.fn() }))

let reducedMotion = false

function mountHub() {
  return shallowMount(HubView, {
    global: {
      stubs: {
        FeedbackPanel: { template: '<div data-testid="feedback-card">Bug report or feature request?</div>' },
        VIcon: { template: '<span><slot /></span>' },
        Teleport: true,
      },
    },
  })
}

describe('HubView mobile footer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    reducedMotion = false
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('shows the thank-you card first and feedback after four seconds', async () => {
    const wrapper = mountHub()

    expect(wrapper.text()).toContain('Thanks for supporting Grovely.')
    expect(wrapper.find('[data-testid="feedback-card"]').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(4000)
    await nextTick()

    expect(wrapper.find('[data-testid="feedback-card"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('keeps the same order when reduced motion is enabled', async () => {
    reducedMotion = true
    const wrapper = mountHub()

    expect(wrapper.text()).toContain('Thanks for supporting Grovely.')
    expect(wrapper.find('[data-testid="feedback-card"]').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(4000)
    await nextTick()

    expect(wrapper.find('[data-testid="feedback-card"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
