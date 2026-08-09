import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PantryAutocomplete from '@/components/pantry/PantryAutocomplete.vue'
import PantryShoppingList from './PantryShoppingList.vue'
import { apiFetch } from '../../api'

vi.mock('../../api', () => ({
  API: '/api',
  apiFetch: vi.fn(),
}))

describe('PantryShoppingList', () => {
  let listRows: unknown[]

  beforeEach(() => {
    localStorage.clear()
    listRows = []
    vi.mocked(apiFetch).mockImplementation(async (url, options) => {
      if (options?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 1 }) } as Response
      }
      if (url === '/api/license/status') {
        return { ok: true, json: async () => ({ active: true }) } as Response
      }
      if (url === '/api/settings') {
        return { ok: true, json: async () => ({ pantry_currency: 'USD' }) } as Response
      }
      return { ok: true, json: async () => listRows } as Response
    })
  })

  it('keeps an autocomplete price per piece after total price was selected', async () => {
    const wrapper = shallowMount(PantryShoppingList, {
      global: {
        stubs: {
          AppFieldToggle: false,
          PantryAutocomplete: false,
          'v-icon': true,
        },
      },
    })
    await flushPromises()

    await wrapper.find('.app-field-toggle').trigger('click')
    await wrapper.find('.meta-pieces-input').setValue('3')
    const totalToggle = wrapper.findAll('.app-field-toggle')[1]
    if (!totalToggle) throw new Error('Expected the total-price toggle')
    await totalToggle.trigger('click')

    wrapper.findComponent(PantryAutocomplete).vm.$emit('select', {
      name: 'Apples', category: 'produce', pieces: 3, price: 4.25,
    })
    await flushPromises()

    expect(totalToggle.attributes('aria-checked')).toBe('false')
    await wrapper.find('form').trigger('submit')

    expect(vi.mocked(apiFetch)).toHaveBeenLastCalledWith('/api/pantry/list', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"price":4.25'),
    }))
  })

  it('shows the price delta after changing an autocomplete price', async () => {
    const wrapper = shallowMount(PantryShoppingList, {
      global: {
        stubs: {
          AppFieldToggle: false,
          PantryAutocomplete: false,
          'v-icon': true,
        },
      },
    })
    await flushPromises()

    const autocomplete = wrapper.findComponent(PantryAutocomplete)
    autocomplete.vm.$emit('update:modelValue', 'Ketchup')
    autocomplete.vm.$emit('select', {
      name: 'Ketchup', category: 'other', price: 2290, store: 'Market A',
      lowest_recent_price: 2280, lowest_recent_store: 'Market B', recent_store_count: 2,
    })
    await flushPromises()

    expect(wrapper.text()).toContain('10.00 higher than the lowest recent price at Market B')
    await wrapper.find('.meta-price-input').setValue('2300')

    expect(wrapper.find('.price-delta').text()).toContain('You paid')
    expect(wrapper.find('.price-delta').text()).toContain('10.00 less for this item last time')
    expect(wrapper.find('.price-delta-amount').classes()).toContain('price-delta-amount--less')
    expect(wrapper.text()).toContain('20.00 higher than the lowest recent price at Market B')
  })

  it('compares a total price with the saved per-piece price', async () => {
    const wrapper = shallowMount(PantryShoppingList, {
      global: {
        stubs: {
          AppFieldToggle: false,
          PantryAutocomplete: false,
          'v-icon': true,
        },
      },
    })
    await flushPromises()

    const autocomplete = wrapper.findComponent(PantryAutocomplete)
    autocomplete.vm.$emit('update:modelValue', 'Ketchup')
    autocomplete.vm.$emit('select', { name: 'Ketchup', category: 'other', pieces: 3, price: 2290 })
    await flushPromises()
    const totalToggle = wrapper.findAll('.app-field-toggle')[1]
    if (!totalToggle) throw new Error('Expected the total-price toggle')
    await totalToggle.trigger('click')
    await wrapper.find('.meta-price-input').setValue('6900')

    expect(wrapper.find('.price-delta').text()).toContain('10.00 less for each item last time')
  })

  it('keeps the current store after adding and replaces it from autocomplete', async () => {
    const wrapper = shallowMount(PantryShoppingList, {
      global: {
        stubs: {
          AppFieldToggle: false,
          PantryAutocomplete: false,
          'v-icon': true,
        },
      },
    })
    await flushPromises()

    const autocomplete = wrapper.findComponent(PantryAutocomplete)
    autocomplete.vm.$emit('select', { name: 'Apples', category: 'produce', store: 'Corner Market' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect((wrapper.find('.meta-input--store').element as HTMLInputElement).value).toBe('Corner Market')

    autocomplete.vm.$emit('select', { name: 'Oranges', category: 'produce', store: 'Farm Shop' })
    await flushPromises()

    expect((wrapper.find('.meta-input--store').element as HTMLInputElement).value).toBe('Farm Shop')
  })

  it('does not rewrite an edit price when total price mode or pieces change', async () => {
    listRows = [{ id: 1, name: 'Apples', category: 'produce', price: 4.25, pieces: 3, checked: 0 }]
    const wrapper = shallowMount(PantryShoppingList, {
      global: {
        stubs: {
          AppFieldToggle: false,
          PantryAutocomplete: false,
          AppScroller: { template: '<div><slot /></div>' },
          SwipeableListItem: { template: '<div><slot /></div>' },
          DetailSheet: { template: '<div><slot /><slot name="footer" /></div>' },
          IconAction: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}</button>' },
          'v-icon': true,
        },
      },
    })
    await flushPromises()

    await wrapper.find('.list-item').trigger('click')
    await wrapper.findAll('button').find(button => button.text() === 'Edit item')!.trigger('click')

    expect((wrapper.find('.item-price-input').element as HTMLInputElement).value).toBe('4.25')
    await wrapper.find('.item-edit-field--price .app-field-toggle').trigger('click')
    await wrapper.find('.item-pieces-input').setValue('4')

    expect((wrapper.find('.item-price-input').element as HTMLInputElement).value).toBe('4.25')
  })
})
