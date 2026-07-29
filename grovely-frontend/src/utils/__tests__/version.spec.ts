import { describe, expect, it } from 'vitest'
import { isCurrentOrNewerVersion, isNewerVersion, isSameVersion } from '../version'

describe('isNewerVersion', () => {
  it('orders release candidates and their final release correctly', () => {
    expect(isNewerVersion('v0.14.1-rc.2', 'v0.14.1-rc.1')).toBe(true)
    expect(isNewerVersion('v0.14.1', 'v0.14.1-rc.2')).toBe(true)
    expect(isNewerVersion('v0.14.1-rc.2', 'v0.14.1')).toBe(false)
  })
})

describe('isSameVersion', () => {
  it('matches the release manifest version with the backend package version', () => {
    expect(isSameVersion('v0.14.1-rc.4', '0.14.1-rc.4')).toBe(true)
    expect(isSameVersion('v0.14.1-rc.4', '0.14.1-rc.3')).toBe(false)
    expect(isSameVersion('v0.14.1-rc.4', '')).toBe(false)
  })
})

describe('isCurrentOrNewerVersion', () => {
  it('keeps a demo that is ahead of the published stable release marked current', () => {
    expect(isCurrentOrNewerVersion('v0.14.2', 'v0.14.1')).toBe(true)
    expect(isCurrentOrNewerVersion('v0.14.2', 'v0.14.2')).toBe(true)
    expect(isCurrentOrNewerVersion('v0.14.2', 'v0.14.3')).toBe(false)
    expect(isCurrentOrNewerVersion('v0.14.2', undefined)).toBeNull()
  })
})
