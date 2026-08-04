import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import DemoExitDialog from '../DemoExitDialog.vue'
import { demoExitDialogOpen, openDemoExit } from '../../composables/useDemo'

const global = {
  stubs: {
    DetailSheet: {
      name: 'DetailSheet',
      props: {
        open: Boolean,
        title: String,
        showClose: { type: Boolean, default: true },
      },
      emits: ['update:open'],
      template: `
        <section v-if="open" :aria-label="title">
          <button data-testid="backdrop" @click="$emit('update:open', false)">Backdrop</button>
          <button v-if="showClose" data-testid="close" @click="$emit('update:open', false)">Close</button>
          <slot />
        </section>
      `,
    },
    VIcon: { template: '<span><slot /></span>' },
  },
}

describe('DemoExitDialog', () => {
  beforeEach(() => {
    demoExitDialogOpen.value = false
  })

  it('offers GitHub and landing-page actions when the demo exit opens', () => {
    openDemoExit()
    const wrapper = mount(DemoExitDialog, { global })

    expect(wrapper.text()).toContain('Thank you for trying Grovely')
    expect(wrapper.text()).toContain("Would you like to see Grovely's development continue?")
    expect(wrapper.text()).toContain(
      'A GitHub star helps more people discover the project and means a lot to us.',
    )
    expect(wrapper.find('[data-testid="close"]').exists()).toBe(false)

    const links = wrapper.findAll('a')
    expect(links).toHaveLength(2)
    expect(links[0]?.text()).toContain('View on GitHub')
    expect(links[0]?.attributes()).toMatchObject({
      href: 'https://github.com/grovely-org/grovely-app',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(links[1]?.text()).toBe('Back to grovely.org')
    expect(links[1]?.attributes('href')).toBe('https://grovely.org')
  })

  it('can be dismissed from the backdrop without leaving the demo', async () => {
    openDemoExit()
    const wrapper = mount(DemoExitDialog, { global })

    await wrapper.get('[data-testid="backdrop"]').trigger('click')

    expect(demoExitDialogOpen.value).toBe(false)
  })
})
