/**
 * Generate a license key for a paying customer.
 *
 * Usage:
 *   node scripts/generate-license.js --email customer@example.com --plan annual --kid k1 --key D:\keys\k1.private.pem
 *
 * --email   Customer's email address (required)
 * --plan    annual | monthly (required)
 * --key     Absolute path to the private key on your external drive (required)
 * --kid     Key id; must match the keys/<kid>.pem baked into the image (default "k1")
 *
 * What this does:
 *   1. Validates all inputs strictly before touching the private key
 *   2. Signs an RS256 JWT with the full license payload
 *   3. Immediately verifies the token against the public key before printing
 *   4. Appends an audit entry to scripts/issued-licenses.log
 *   5. Prints LICENSE_KEY=<token> to stdout — clean for copy-paste
 *   6. Prints a human-readable summary to stderr
 *
 * One license covers the whole household — owner and partner both get
 * premium access. The key is not tied to any user role.
 *
 * Never run this inside Docker or on the server. Local only.
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');

const LOG_PATH = path.join(__dirname, 'issued-licenses.log');
const KEYS_DIR = path.join(__dirname, '..', 'grovely-backend', 'keys');

const PLAN_DURATIONS = { annual: 365, monthly: 30 };
const EMAIL_RE       = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEP            = '─'.repeat(64);

// ── helpers ────────────────────────────────────────────────────────────────

function err(msg, hint) {
  process.stderr.write(`\nERROR: ${msg}\n`);
  if (hint) process.stderr.write(`       ${hint}\n`);
  process.stderr.write('\n');
  process.exit(1);
}

function getArg(args, flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--')
    ? args[i + 1]
    : null;
}

// ── parse & validate args ──────────────────────────────────────────────────

const args    = process.argv.slice(2);
const email   = getArg(args, '--email');
const plan    = getArg(args, '--plan');
const keyPath = getArg(args, '--key');
const kid     = getArg(args, '--kid') || 'k1';

if (!email || !plan || !keyPath) {
  process.stderr.write([
    '',
    'Usage:',
    '  node scripts/generate-license.js --email customer@example.com --plan annual|monthly --key /path/to/private.pem [--kid k1]',
    '',
    'email, plan, and key are required. kid defaults to "k1".',
    '',
  ].join('\n'));
  process.exit(1);
}

if (!/^[A-Za-z0-9_-]+$/.test(kid)) {
  err(`--kid "${kid}" may contain only letters, numbers, dashes, or underscores.`);
}

if (!EMAIL_RE.test(email)) {
  err(`"${email}" is not a valid email address.`);
}

if (!PLAN_DURATIONS[plan]) {
  err(`--plan must be "annual" or "monthly", got "${plan}".`);
}

// ── load private key ───────────────────────────────────────────────────────

const privateKeyPath = path.resolve(keyPath);

if (!fs.existsSync(privateKeyPath)) {
  err(
    `Private key not found at "${privateKeyPath}".`,
    'Check that your external drive is mounted and the path is correct.'
  );
}

let privateKey;
try {
  privateKey = fs.readFileSync(privateKeyPath, 'utf8');
} catch (e) {
  err(`Could not read private key: ${e.message}`);
}

if (!privateKey.includes('PRIVATE KEY')) {
  err(
    `"${privateKeyPath}" does not look like a valid PEM private key.`,
    'Make sure --key points at the correct file.'
  );
}

// ── load public key (for self-verification) ────────────────────────────────

const PUBLIC_KEY_PATH = path.join(KEYS_DIR, `${kid}.pem`);

if (!fs.existsSync(PUBLIC_KEY_PATH)) {
  err(
    `Public key not found at grovely-backend/keys/${kid}.pem.`,
    'Run node scripts/generate-keypair.js with a matching --kid first.'
  );
}

let publicKey;
try {
  publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
} catch (e) {
  err(`Could not read public key: ${e.message}`);
}

// ── build payload ──────────────────────────────────────────────────────────

const durationDays = PLAN_DURATIONS[plan];
const now          = Math.floor(Date.now() / 1000);
const expiresAt    = now + durationDays * 24 * 60 * 60;
const jti          = crypto.randomUUID();

const payload = {
  iss:       'grovely',
  sub:       email,
  jti,
  plan,
  license_v: 1,
};

// ── sign ───────────────────────────────────────────────────────────────────

let token;
try {
  token = jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: `${durationDays}d`,
    keyid: kid,
  });
} catch (e) {
  err(`Failed to sign license: ${e.message}`);
}

// ── self-verify before sending ─────────────────────────────────────────────
// If the signed token can't be verified against the public key, something is
// wrong with the keypair. Never send a key that fails this check.

let verified;
try {
  verified = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
} catch (e) {
  err(
    `Self-verification failed — do not send this key. (${e.message})`,
    'The keypair may be mismatched. Re-run generate-keypair.js if this persists.'
  );
}

if (verified.sub !== email || verified.plan !== plan || verified.jti !== jti) {
  err('Self-verification passed but payload fields do not match. Do not send this key.');
}

// ── expiry sanity check ────────────────────────────────────────────────────

const expiresDate = new Date(expiresAt * 1000).toISOString().split('T')[0];
const issuedDate  = new Date(now * 1000).toISOString().split('T')[0];
const daysUntilExpiry = Math.floor((expiresAt - now) / 86400);

if (daysUntilExpiry < 28) {
  process.stderr.write(`\nWARNING: This key expires in only ${daysUntilExpiry} days (${expiresDate}). Verify the plan is correct.\n`);
}

// ── audit log ──────────────────────────────────────────────────────────────
// Append one line per issued license. Never delete this file.
// You will need it for renewals, revocations, and support.

const logEntry = JSON.stringify({
  issued:  issuedDate,
  expires: expiresDate,
  email,
  plan,
  jti,
}) + '\n';

try {
  fs.appendFileSync(LOG_PATH, logEntry, 'utf8');
} catch (e) {
  // Log failure is non-fatal but must be visible — warn loudly.
  process.stderr.write(`\nWARNING: Could not write to audit log: ${e.message}\n`);
  process.stderr.write(`         Record this manually: ${logEntry}`);
}

// ── output ─────────────────────────────────────────────────────────────────

process.stderr.write(`\n${SEP}\n`);
process.stderr.write(`  License issued\n`);
process.stderr.write(`${SEP}\n`);
process.stderr.write(`  Email    : ${email}\n`);
process.stderr.write(`  Plan     : ${plan}\n`);
process.stderr.write(`  Kid      : ${kid}\n`);
process.stderr.write(`  Issued   : ${issuedDate}\n`);
process.stderr.write(`  Expires  : ${expiresDate}  (${durationDays} days)\n`);
process.stderr.write(`  JTI      : ${jti}\n`);
process.stderr.write(`  Log      : ${LOG_PATH}\n`);
process.stderr.write(`${SEP}\n\n`);
process.stderr.write(`  Add this to the customer's .env:\n\n`);

process.stdout.write(`LICENSE_KEY=${token}\n`);

process.stderr.write(`\n${SEP}\n\n`);
