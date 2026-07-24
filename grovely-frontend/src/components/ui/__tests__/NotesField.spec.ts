import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import NotesField from '../NotesField.vue'

describe('NotesField', () => {
  it('shows the empty-state text in view mode', () => {
    const wrapper = mount(NotesField, {
      props: { emptyText: 'Nothing recorded' },
    })

    expect(wrapper.get('.nf-view').text()).toBe('Nothing recorded')
    expect(wrapper.get('.nf-view').classes()).toContain('nf-view--empty')
  })

  it('truncates view text that exceeds the maximum', () => {
    const wrapper = mount(NotesField, {
      props: { modelValue: 'abcdef', max: 4 },
    })

    expect(wrapper.get('.nf-view').text()).toBe('abcd…')
  })

  it('renders the edit counter and input constraints', () => {
    const wrapper = mount(NotesField, {
      props: {
        mode: 'edit',
        modelValue: 'abc',
        max: 10,
        placeholder: 'Write a note',
        theme: 'green',
      },
    })

    const input = wrapper.get('textarea')
    expect(input.attributes('maxlength')).toBe('10')
    expect(input.attributes('placeholder')).toBe('Write a note')
    expect(wrapper.get('.nf-counter').text()).toBe('3 / 10')
    expect(wrapper.get('.nf-wrap').attributes('data-theme')).toBe('green')
  })

  it('emits edited text through v-model', async () => {
    const wrapper = mount(NotesField, {
      props: { mode: 'edit', modelValue: '' },
    })

    await wrapper.get('textarea').setValue('Updated note')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Updated note']])
  })
})
