type ParsedVersion = {
  core: number[]
  prerelease: string[]
}

export type PublicReleaseLink = {
  key: 'github' | 'discord' | 'instagram' | 'website'
  label: string
  icon: string
  href: string | null
}

const PUBLIC_LINK_DEFINITIONS: Array<Omit<PublicReleaseLink, 'href'>> = [
  { key: 'github', label: 'GitHub', icon: 'mdi-github' },
  { key: 'discord', label: 'Discord', icon: 'mdi-discord' },
  { key: 'instagram', label: 'Instagram', icon: 'mdi-instagram' },
  { key: 'website', label: 'Grovely.org', icon: 'mdi-web' },
]

export function getPublicReleaseLinks (value: unknown): PublicReleaseLink[] {
  const links = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return PUBLIC_LINK_DEFINITIONS.map(definition => {
    const href = links[definition.key]
    if (typeof href !== 'string') return { ...definition, href: null }
    try {
      const parsed = new URL(href)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return { ...definition, href: null }
      return { ...definition, href }
    } catch {
      return { ...definition, href: null }
    }
  })
}

function parseVersion (version = ''): ParsedVersion {
  const [core = '', prerelease = ''] = version.replace(/^v/, '').split('-', 2)
  return {
    core: core.split('.').map(part => Number(part) || 0),
    prerelease: prerelease ? prerelease.split('.') : [],
  }
}

function compareIdentifier (left: string, right: string): number {
  const leftNumber = /^\d+$/.test(left)
  const rightNumber = /^\d+$/.test(right)
  if (leftNumber && rightNumber) return Number(left) - Number(right)
  if (leftNumber) return -1
  if (rightNumber) return 1
  return left.localeCompare(right)
}

export function isNewerVersion (latest?: string, current?: string): boolean {
  const left = parseVersion(latest)
  const right = parseVersion(current)
  for (let index = 0; index < Math.max(left.core.length, right.core.length); index++) {
    if ((left.core[index] || 0) !== (right.core[index] || 0)) return (left.core[index] || 0) > (right.core[index] || 0)
  }

  if (!left.prerelease.length || !right.prerelease.length) return !left.prerelease.length && Boolean(right.prerelease.length)
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index++) {
    const leftIdentifier = left.prerelease[index]
    const rightIdentifier = right.prerelease[index]
    if (leftIdentifier == null) return false
    if (rightIdentifier == null) return true
    const difference = compareIdentifier(leftIdentifier, rightIdentifier)
    if (difference !== 0) return difference > 0
  }
  return false
}

export function isSameVersion (left?: string, right?: string): boolean {
  if (!left || !right) return false
  return left.replace(/^v/, '') === right.replace(/^v/, '')
}

export function isCurrentOrNewerVersion (current?: string, latest?: string): boolean | null {
  if (!current || !latest) return null
  return !isNewerVersion(latest, current)
}
