// Stand-in for the backups engine (backups/index.js). The real engine drives
// node-cron, the S3/WebDAV SDKs and the filesystem - all server-only. In the
// demo, the premium backups ROUTE file (routes/premium/backups.js) runs for
// real against the in-browser DB: its /status and /history endpoints are real
// SQL against log_system_backups. Only these engine internals are stubbed.
//
// settings.js calls rescheduleBackups after a settings change (no-op here).

export function startBackups() { /* no-op */ }
export function rescheduleBackups() { /* no-op */ }

// ── Read side: used by the route's /status endpoint ────────────────────────
// The demo has no remote backup env (S3/WebDAV), so both targets diagnose as
// absent and only "Local" shows in the menu - honest for a no-server demo.
export function getConfiguredTargets(): string[] { return [] }
export function describeTargets(): unknown[] { return [] }
export function diagnoseTargets() {
  return {
    s3:     { state: 'absent', missing: [] as string[] },
    webdav: { state: 'absent', missing: [] as string[] },
  }
}
export const MIN_COMPATIBLE_SCHEMA = 8
export function getBackupDir(): string { return '' }

// ── Write / transfer side ──────────────────────────────────────────────────
// These back the route's run-now / restore / download endpoints, which are
// gated on the frontend in the demo and never reached. They exist only so the
// route module's destructured import resolves.
export async function runBackup(): Promise<never> { throw new Error('Backups are server-only') }
export async function restoreFromSnapshot(): Promise<never> { throw new Error('Backups are server-only') }
export async function listTarget(): Promise<unknown[]> { return [] }
export async function downloadFromTarget(): Promise<never> { throw new Error('Backups are server-only') }

export default {
  startBackups,
  rescheduleBackups,
  getConfiguredTargets,
  describeTargets,
  diagnoseTargets,
  MIN_COMPATIBLE_SCHEMA,
  getBackupDir,
  runBackup,
  restoreFromSnapshot,
  listTarget,
  downloadFromTarget,
}
