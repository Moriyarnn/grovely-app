import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppCheckbox from '../AppCheckbox.vue'

const global = {
  stubs: {
    VIcon: { template: '<span data-testid="icon"><slot /></span>' },
  },
}

describe('AppCheckbox', () => {
  it('renders an unchecked checkbox by default', () => {
    const wrapper = mount(AppCheckbox, { global })

    expect(wrapper.attributes('role')).toBe('checkbox')
    expect(wrapper.attributes('aria-checked')).toBe('false')
    expect(wrapper.classes()).toContain('app-checkbox--green')
    expect(wrapper.find('[data-testid="icon"]').exists()).toBe(false)
  })

  it('renders its checked state and selected theme', () => {
    const wrapper = mount(AppCheckbox, {
      props: { modelValue: true, theme: 'pink' },
      global,
    })

    expect(wrapper.attributes('aria-checked')).toBe('true')
    expect(wrapper.classes()).toContain('app-checkbox--checked')
    expect(wrapper.classes()).toContain('app-checkbox--pink')
    expect(wrapper.find('[data-testid="icon"]').text()).toBe('mdi-check')
  })

  it('emits the opposite model value when clicked', async () => {
    const wrapper = mount(AppCheckbox, {
      props: { modelValue: false },
      global,
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })
})
