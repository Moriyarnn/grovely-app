import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import PantryAutocomplete from './PantryAutocomplete.vue'
import { apiFetch } from '../../api'

vi.mock('../../api', () => ({
  API: '/api',
  apiFetch: vi.fn(),
}))

describe('PantryAutocomplete', () => {
  it('preserves the saved category when a free autocomplete result is selected', async () => {
    const row = { id: 1, name: 'Milk', category: 'dairy', last_added_at: '2026-08-08T00:00:00Z' }
    vi.mocked(apiFetch).mockResolvedValue({ ok: true, json: async () => [row] } as Response)

    const wrapper = mount(PantryAutocomplete, {
      props: { modelValue: '', isPremium: false },
      global: { stubs: { PremiumBadge: true, 'v-icon': true } },
    })

    await wrapper.find('input').trigger('focus')
    await flushPromises()
    await wrapper.find('.pac-row').trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual([row])
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Milk'])
  })
})
