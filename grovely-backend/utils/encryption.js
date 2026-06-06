/**
 * Private data: encryption at rest + read gating, driven by one registry.
 *
 * Some columns must stay private to the account that owns them and be hidden
 * from the other account - even inside a backup file. Two problems to solve:
 *
 *   1. Backups contain raw rows, so a private column would leak to anyone who
 *      can export one. We store these columns encrypted, so a backup carries
 *      ciphertext: it restores perfectly (the key lives on the server) but the
 *      other account cannot read it.
 *   2. API responses must not reveal a private column to the partner unless the
 *      owner allows it. The partner gets a read-only view; each private field
 *      names the setting that controls whether the partner may read it.
 *
 * Everything private is declared once in PRIVATE_FIELDS. To make a new column
 * private between the two accounts, add a row here - encryption, the startup
 * catch-up, and read gating all follow automatically. "Notes" is just the first
 * two entries; nothing in this module is notes-specific.
 *
 * Key: a single 32-byte Data Encryption Key in data/encryption.key, generated
 * once on first run (mode 0600), same lifecycle as data/secret.key. It is NOT
 * included in backups (that would defeat the purpose), so migrating to a fresh
 * server means copying this file across - just like secret.key.
 *
 * Format: `enc:v1:<base64(iv | authTag | ciphertext)>` using AES-256-GCM with a
 * fresh random 12-byte IV per value. `decrypt` passes through anything without
 * the marker, so legacy plaintext rows and future format versions stay safe.
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const KEY_PATH = path.join(__dirname, '..', 'data', 'encryption.key')
const MARKER = 'enc:v1:'
const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

// The single registry of private fields. Each entry is encrypted at rest and,
// for the partner account (owner2), revealed only when `partnerSetting` is on.
// owner1 always sees its own private fields.
const PRIVATE_FIELDS = [
  { table: 'cycle_days', column: 'notes', partnerSetting: 'partner_can_read_notes' },
  { table: 'gap_day_logs', column: 'notes', partnerSetting: 'partner_can_read_notes' },
]

let key = null

function loadKey () {
  if (key) return key
  if (fs.existsSync(KEY_PATH)) {
    key = Buffer.from(fs.readFileSync(KEY_PATH, 'utf8').trim(), 'hex')
    if (key.length !== 32) throw new Error('data/encryption.key is not a 32-byte hex key')
  } else {
    fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true })
    key = crypto.randomBytes(32)
    fs.writeFileSync(KEY_PATH, key.toString('hex'), { mode: 0o600 })
    console.log('✅ Generated data encryption key and saved to data/encryption.key')
  }
  return key
}

function isEncrypted (value) {
  return typeof value === 'string' && value.startsWith(MARKER)
}

// Encrypt a string. null/undefined/'' pass through unchanged, and an
// already-encrypted value is returned as-is so calls are idempotent.
function encrypt (plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext
  if (isEncrypted(plaintext)) return plaintext
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, loadKey(), iv)
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return MARKER + Buffer.concat([iv, tag, ct]).toString('base64')
}

// Decrypt a stored value. Non-marked values (legacy plaintext, null) pass
// through. On any failure (wrong/missing key, tampering) returns null rather
// than throwing or leaking ciphertext.
function decrypt (value) {
  if (!isEncrypted(value)) return value
  try {
    const buf = Buffer.from(value.slice(MARKER.length), 'base64')
    const iv = buf.subarray(0, IV_LEN)
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const ct = buf.subarray(IV_LEN + TAG_LEN)
    const decipher = crypto.createDecipheriv(ALGO, loadKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

function partnerSettingEnabled (db, settingKey) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey)
  return row?.value === '1'
}

/**
 * Decrypt and gate the private fields of `table` on a row or array of rows,
 * in place. owner1 sees all of them; owner2 sees a field only when its
 * `partnerSetting` is on, otherwise it is nulled. Returns `rows` for chaining.
 *
 * This is the backend enforcement of the partner-visibility settings - the
 * frontend hint alone was bypassable by calling the API directly.
 */
function revealPrivateFields (db, req, table, rows) {
  const fields = PRIVATE_FIELDS.filter(f => f.table === table)
  if (fields.length === 0 || !rows) return rows

  const isOwner = req.user?.role === 'owner1'
  // Resolve each field's visibility once, not per row.
  const allowed = {}
  for (const f of fields) {
    allowed[f.column] = isOwner || partnerSettingEnabled(db, f.partnerSetting)
  }

  const list = Array.isArray(rows) ? rows : [rows]
  for (const r of list) {
    if (!r) continue
    for (const f of fields) {
      if (f.column in r) r[f.column] = allowed[f.column] ? decrypt(r[f.column]) : null
    }
  }
  return rows
}

/**
 * Encrypt any not-yet-encrypted values across every PRIVATE_FIELDS column.
 * Idempotent - rows already carrying the marker are skipped. Run at startup (to
 * migrate existing plaintext) and after a restore (an older backup may hold
 * plaintext). Returns the number of values encrypted.
 */
function encryptExistingRows (db) {
  let total = 0
  for (const { table, column } of PRIVATE_FIELDS) {
    let rows
    try {
      rows = db.prepare(`SELECT id, ${column} AS val FROM ${table} WHERE ${column} IS NOT NULL AND ${column} != ''`).all()
    } catch {
      continue // table not present yet
    }
    const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`)
    const tx = db.transaction(() => {
      for (const r of rows) {
        if (isEncrypted(r.val)) continue
        update.run(encrypt(r.val), r.id)
        total++
      }
    })
    tx()
  }
  return total
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  revealPrivateFields,
  encryptExistingRows,
  PRIVATE_FIELDS,
}
