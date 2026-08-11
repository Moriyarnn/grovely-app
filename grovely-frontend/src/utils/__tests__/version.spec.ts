import { describe, expect, it } from 'vitest'
import { getPublicReleaseLinks, isCurrentOrNewerVersion, isNewerVersion, isSameVersion } from '../version'

describe('getPublicReleaseLinks', () => {
  it('keeps configured HTTPS links in display order', () => {
    expect(getPublicReleaseLinks({
      website: 'https://grovely.org',
      discord: 'https://discord.gg/grovely',
      instagram: 'https://www.instagram.com/grovely',
      github: 'https://github.com/grovely-org/grovely-app',
    })).toEqual([
      { key: 'github', label: 'GitHub', icon: 'mdi-github', href: 'https://github.com/grovely-org/grovely-app' },
      { key: 'discord', label: 'Discord', icon: 'mdi-discord', href: 'https://discord.gg/grovely' },
      { key: 'instagram', label: 'Instagram', icon: 'mdi-instagram', href: 'https://www.instagram.com/grovely' },
      { key: 'website', label: 'Grovely.org', icon: 'mdi-web', href: 'https://grovely.org' },
    ])
  })

  it('keeps unavailable slots but removes malformed, credentialed, and non-HTTPS destinations', () => {
    expect(getPublicReleaseLinks({
      github: 'javascript:alert(1)',
      discord: 'https://user:secret@discord.gg/grovely',
      instagram: 'http://instagram.com/grovely',
      website: 'not a URL',
    }).map(link => link.href)).toEqual([null, null, null, null])
    expect(getPublicReleaseLinks(null)).toEqual([
      { key: 'github', label: 'GitHub', icon: 'mdi-github', href: null },
      { key: 'discord', label: 'Discord', icon: 'mdi-discord', href: null },
      { key: 'instagram', label: 'Instagram', icon: 'mdi-instagram', href: null },
      { key: 'website', label: 'Grovely.org', icon: 'mdi-web', href: null },
    ])
  })
})

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
