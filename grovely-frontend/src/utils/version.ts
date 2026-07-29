type ParsedVersion = {
  core: number[]
  prerelease: string[]
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
