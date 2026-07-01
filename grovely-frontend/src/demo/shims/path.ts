// Stand-in for node:path. Same rationale as the fs shim: the premium backups
// route requires it at module load, but only its gated server-only handlers use
// it. A minimal POSIX-style implementation is plenty for the demo.

export function join(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/')
}
export function resolve(...parts: string[]): string {
  return join(...parts)
}
export function basename(p: string): string {
  return p.split('/').pop() ?? ''
}
export function dirname(p: string): string {
  return p.split('/').slice(0, -1).join('/')
}
export function extname(p: string): string {
  const b = basename(p)
  const i = b.lastIndexOf('.')
  return i > 0 ? b.slice(i) : ''
}

export default { join, resolve, basename, dirname, extname }
