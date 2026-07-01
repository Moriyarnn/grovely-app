// Stand-in for node:fs. The premium backups route requires it at module load,
// but only its server-only handlers (download / available / restore) call into
// it, and those are gated in the demo. Inert stubs are enough for the module to
// load; existsSync returning false means "no local snapshots", which the menu
// shows honestly.

export function existsSync(): boolean { return false }
export function readFileSync(): string { return '' }
export function readdirSync(): string[] { return [] }
export function statSync(): never { throw new Error('fs unavailable in demo') }
export function createReadStream(): never { throw new Error('fs unavailable in demo') }
export function mkdirSync(): void { /* no-op */ }
export function writeFileSync(): void { /* no-op */ }

export default {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  createReadStream,
  mkdirSync,
  writeFileSync,
}
