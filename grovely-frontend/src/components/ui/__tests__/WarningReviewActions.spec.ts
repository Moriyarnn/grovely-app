import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import WarningReviewActions from '../WarningReviewActions.vue'

const global = {
  stubs: {
    IconAction: {
      props: ['label'],
      template: '<button>{{ label }}</button>',
    },
    ConfirmDialog: {
      template: '<div><slot /></div>',
    },
  },
}

function mountActions({ pairCycleId, canConfirm = true, reviewState = null }: {
  pairCycleId?: number
  canConfirm?: boolean
  reviewState?: string | null
} = {}) {
  return mount(WarningReviewActions, {
    props: {
      itemId: 1,
      itemLabel: 'July 19 → July 21',
      reviewState,
      endpoint: 'period/cycles/1/review',
      pairCycleId,
      canConfirm,
    },
    global,
  })
}

describe('WarningReviewActions', () => {
  it('describes confirmation as a pair decision for a short-cycle warning', () => {
    const wrapper = mountActions({ pairCycleId: 2 })

    expect(wrapper.text()).toContain('Confirm pair')
    expect(wrapper.text()).toContain('This pair will be included in your predictions')
    expect(wrapper.text()).not.toContain('Confirm period')
  })

  it('describes confirmation as a period decision for a long-period warning', () => {
    const wrapper = mountActions()

    expect(wrapper.text()).toContain('Confirm period')
    expect(wrapper.text()).toContain('This period will be included in your averages and predictions')
    expect(wrapper.text()).not.toContain('Confirm pair')
  })

  it('allows a normal period to be excluded without offering confirmation', () => {
    const wrapper = mountActions({ canConfirm: false })

    expect(wrapper.text()).toContain('Exclude')
    expect(wrapper.text()).toContain('July 19 → July 21 will be kept in your history')
    expect(wrapper.text()).not.toContain('Confirm period')
    expect(wrapper.text()).not.toContain('Confirm pair')
    expect(wrapper.text()).not.toContain('Confirm as real?')
  })

  it('allows an arbitrarily excluded period to be restored', () => {
    const wrapper = mountActions({ canConfirm: false, reviewState: 'excluded' })

    expect(wrapper.text()).toContain('Include')
    expect(wrapper.text()).not.toContain('Unignore')
    expect(wrapper.text()).not.toContain('Exclude from predictions?')
  })
})
