import { describe, expect, it } from 'vitest'
import { isNewerVersion } from '../version'

describe('isNewerVersion', () => {
  it('orders release candidates and their final release correctly', () => {
    expect(isNewerVersion('v0.14.1-rc.2', 'v0.14.1-rc.1')).toBe(true)
    expect(isNewerVersion('v0.14.1', 'v0.14.1-rc.2')).toBe(true)
    expect(isNewerVersion('v0.14.1-rc.2', 'v0.14.1')).toBe(false)
  })
})
