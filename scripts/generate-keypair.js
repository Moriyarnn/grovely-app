/**
 * One-time RSA keypair generation for Grovely license signing.
 *
 * Run once per signing key, locally, offline:
 *   node scripts/generate-keypair.js --out /path/to/external/drive --kid k1
 *
 * --out  Directory where the private key will be written. Must be outside the
 *        repo — an external drive or dedicated secure folder. Required.
 * --kid  Key id for this signing key (default "k1"). Becomes the public key's
 *        filename and is stamped into each license header so the verifier knows
 *        which key to check. Use a fresh kid (k2, k3, ...) to rotate.
 *
 * Outputs:
 *   <--out>/<kid>.private.pem        — NEVER commit. Back up to a password
 *                                      manager AND a physical offline drive.
 *   grovely-backend/keys/<kid>.pem   — Commit. Baked into the Docker image.
 *                                      Old <kid>.pem files stay until their
 *                                      licenses expire, enabling clean rotation.
 *
 * Key spec: RSA-4096, PKCS#8 private, SPKI public, PEM encoding.
 * Licenses are signed with RS256 (RSA + SHA-256). Verification is fully
 * offline — the public key is the only thing needed to verify any license.
 */

const { generateKeyPairSync, randomBytes, createSign, createVerify } = require('crypto');
const fs   = require('fs');
const path = require('path');

// --- parse args ---
const args = process.argv.slice(2);

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

const outArgRaw = getArg('--out');
const kid       = getArg('--kid') || 'k1';

if (!/^[A-Za-z0-9_-]+$/.test(kid)) {
  console.error(`ERROR: --kid "${kid}" may contain only letters, numbers, dashes, or underscores.`);
  process.exit(1);
}

if (!outArgRaw) {
  console.error('Usage: node scripts/generate-keypair.js --out /path/to/external/drive');
  console.error('\nERROR: --out is required. Point it at a directory outside this repo.');
  console.error('Example (Windows): node scripts/generate-keypair.js --out D:\\keys');
  console.error('Example (Linux):   node scripts/generate-keypair.js --out /media/usb/grovely');
  process.exit(1);
}

// --- paths ---
const outDir         = path.resolve(outArgRaw);
const PRIVATE_KEY_PATH = path.join(outDir, `${kid}.private.pem`);
const PUBLIC_KEY_PATH  = path.join(__dirname, '..', 'grovely-backend', 'keys', `${kid}.pem`);

// --- guards ---
if (!fs.existsSync(outDir)) {
  console.error(`ERROR: Output directory does not exist: "${outDir}"`);
  console.error('Check that your external drive is mounted and the path is correct.');
  process.exit(1);
}

if (fs.existsSync(PRIVATE_KEY_PATH)) {
  console.error(`ERROR: a private key already exists at "${PRIVATE_KEY_PATH}".`);
  console.error(`Pick a different --kid to add a new signing key, or delete it to regenerate "${kid}".`);
  process.exit(1);
}

if (fs.existsSync(PUBLIC_KEY_PATH)) {
  console.error(`ERROR: grovely-backend/keys/${kid}.pem already exists.`);
  console.error('Pick a different --kid to add a new signing key, or delete both files to regenerate.');
  console.error('WARNING: deleting a public key invalidates every license still signed by it.');
  process.exit(1);
}

// --- generate ---
console.log('Generating RSA-4096 keypair (this takes a moment)...');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// --- write ---
fs.mkdirSync(path.dirname(PUBLIC_KEY_PATH), { recursive: true });

fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);

// --- verify the pair is consistent before finishing ---
const testPayload = randomBytes(32).toString('hex');
const signer   = createSign('SHA256');
const verifier = createVerify('SHA256');
signer.update(testPayload);
const signature = signer.sign(privateKey, 'base64');
verifier.update(testPayload);
const ok = verifier.verify(publicKey, signature, 'base64');

if (!ok) {
  console.error('FATAL: keypair self-check failed — keys do not match. Deleting both, re-run from scratch.');
  fs.unlinkSync(PRIVATE_KEY_PATH);
  fs.unlinkSync(PUBLIC_KEY_PATH);
  process.exit(1);
}

// --- done ---
console.log('\nKeypair generated and verified.\n');
console.log(`  kid          →  ${kid}`);
console.log(`  private key  →  ${PRIVATE_KEY_PATH}`);
console.log(`  public key   →  grovely-backend/keys/${kid}.pem`);
console.log('\nNext steps:');
console.log('  1. Copy the private key to a second safe location (password manager secure note)');
console.log(`  2. Commit grovely-backend/keys/${kid}.pem`);
console.log('  3. Rebuild Docker images so the public key is baked in');
console.log('  4. To issue a license:');
console.log(`       node scripts/generate-license.js --email customer@example.com --plan annual --kid ${kid} --key "${PRIVATE_KEY_PATH}"`);
