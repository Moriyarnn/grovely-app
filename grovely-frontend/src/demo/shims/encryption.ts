// Stand-in for the private-field encryption util. The real module uses
// node:crypto + a key file on disk, neither of which exists in the browser. The
// demo stores its throwaway data in plaintext and runs as owner1 (who always
// sees their own private fields), so encrypt/decrypt are identity and
// revealPrivateFields returns rows untouched. Signatures match the real module
// exactly so the route files call them unchanged.

export function encrypt<T>(plaintext: T): T { return plaintext }
export function decrypt<T>(value: T): T { return value }
export function isEncrypted() { return false }

export function partnerSettingEnabled(db: any, settingKey: string): boolean {
  try {
    const row = db?.prepare?.('SELECT value FROM settings WHERE key = ?').get(settingKey)
    return row?.value === '1'
  } catch {
    return false
  }
}

// owner1 sees every private field; the demo is always owner1, so just return
// the rows as-is (already plaintext).
export function revealPrivateFields<T>(_db: unknown, _req: unknown, _table: string, rows: T): T {
  return rows
}

export function encryptExistingRows() { return 0 }

export const PRIVATE_FIELDS = [
  { table: 'cycle_days', column: 'notes', partnerSetting: 'partner_can_read_notes' },
  { table: 'gap_day_logs', column: 'notes', partnerSetting: 'partner_can_read_notes' },
]

export default {
  encrypt,
  decrypt,
  isEncrypted,
  partnerSettingEnabled,
  revealPrivateFields,
  encryptExistingRows,
  PRIVATE_FIELDS,
}
