const fs  = require('fs');
const path = require('path');
const jwt  = require('jsonwebtoken');

// Every *.pem in keys/ is a trusted signing key, indexed by `kid` (the filename
// without the extension). Trusting a MAP of keys instead of a single one is what
// makes clean key rotation possible: a new signing key is dropped in as a new
// file, and old keys keep validating their already-issued licenses until those
// expire. No customer has to re-key just because we rotated.
//
// If the directory is missing or empty, all premium routes return 402.
const KEYS_DIR = path.join(__dirname, '..', 'keys');

function loadPublicKeys() {
  const map = new Map();
  let files = [];
  try {
    files = fs.readdirSync(KEYS_DIR).filter(f => f.endsWith('.pem'));
  } catch (err) {
    console.error('[license] WARNING: Could not read keys directory at', KEYS_DIR);
    console.error('[license]', err.message);
    return map;
  }
  for (const file of files) {
    try {
      const pem = fs.readFileSync(path.join(KEYS_DIR, file), 'utf8');
      if (!pem.includes('PUBLIC KEY')) {
        console.error(`[license] WARNING: keys/${file} is not a valid PEM public key — skipped.`);
        continue;
      }
      // kid = filename without ".pem". e.g. keys/k1.pem -> "k1".
      map.set(path.basename(file, '.pem'), pem);
    } catch (err) {
      console.error(`[license] WARNING: Could not read keys/${file}:`, err.message);
    }
  }
  return map;
}

const publicKeys = loadPublicKeys();

if (publicKeys.size === 0) {
  console.error('[license] WARNING: No public keys loaded from', KEYS_DIR);
  console.error('[license] All premium routes will return 402 until this is resolved.');
}

// License validity is evaluated once when the server starts, not on every
// request. LICENSE_KEY is an env var — it only changes on restart anyway.
// This avoids re-running JWT crypto on every premium API call.
let licenseValid   = false;
let licensePayload = null;

(function evaluateLicense() {
  const raw = process.env.LICENSE_KEY;

  if (!raw) {
    // No key set — normal for free-tier installs. No warning needed.
    return;
  }

  if (publicKeys.size === 0) {
    // No public keys loaded above — already warned.
    return;
  }

  // Decode the header (without verifying) to learn which signing key the
  // license claims to be signed by, then verify against that exact key.
  let kid = null;
  try {
    kid = jwt.decode(raw, { complete: true })?.header?.kid ?? null;
  } catch {
    console.error('[license] License key is malformed. Premium features are locked.');
    return;
  }

  // Resolve the public key:
  //   - by kid when the token carries one and we trust that kid;
  //   - fall back to the sole configured key for a legacy token with no kid;
  //   - otherwise refuse (unknown kid, or ambiguous with multiple keys).
  let publicKey = null;
  if (kid && publicKeys.has(kid)) {
    publicKey = publicKeys.get(kid);
  } else if (!kid && publicKeys.size === 1) {
    publicKey = publicKeys.values().next().value;
  } else if (kid) {
    console.error(`[license] License key references an unknown signing key (kid="${kid}"). Premium features are locked.`);
    return;
  } else {
    console.error('[license] License key has no key id but multiple signing keys are configured — cannot disambiguate. Premium features are locked.');
    return;
  }

  try {
    // algorithms is pinned to RS256 explicitly.
    // Without this, an attacker could craft an HS256 token using the public
    // key as the HMAC secret and pass verification. Pinning rejects anything
    // not signed with the RSA private key.
    licensePayload = jwt.verify(raw, publicKey, { algorithms: ['RS256'] });
    licenseValid   = true;

    const expiry = new Date(licensePayload.exp * 1000).toISOString().split('T')[0];
    console.log(`[license] Valid license loaded — plan: ${licensePayload.plan}, expires: ${expiry}${kid ? `, kid: ${kid}` : ''}`);
  } catch (err) {
    // Log the category of failure so the operator can act, but never log the
    // raw token — it's a credential and doesn't belong in logs.
    if (err.name === 'TokenExpiredError') {
      const expiry = new Date(err.expiredAt).toISOString().split('T')[0];
      console.error(`[license] License key expired on ${expiry}. Premium features are locked.`);
    } else if (err.name === 'JsonWebTokenError') {
      console.error('[license] License key is invalid or tampered. Premium features are locked.');
    } else {
      console.error('[license] License verification failed:', err.message);
    }
  }
})();

// Middleware applied to the entire /api/premium prefix.
// Returns 402 with no details — the client should show the premium gate UI.
// Never exposes why the check failed (expired vs. missing vs. tampered).
function requireLicense(req, res, next) {
  if (!licenseValid) {
    return res.status(402).json({ error: 'license_required' });
  }
  next();
}

module.exports = { requireLicense, licensePayload };
