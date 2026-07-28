# Feedback

Grovely feedback is an optional, explicit way to report a bug, suggest a feature, or share other product feedback. It is separate from household data and is not required for ordinary local use.

## Privacy contract

- Feedback is sent only after a person chooses **Send feedback**.
- The browser sends the selected category and the entered message. An email address is included only when the person chooses to provide one for a reply.
- The browser encrypts the message and optional email before submission. The public feedback Worker stores ciphertext and cannot decrypt it.
- Grovely does not attach or store household data, account names, license information, installed version, usage data, logs, device identifiers, or IP addresses.
- Feedback is not used for advertising, profiling, or product-usage tracking.
- The Worker keeps aggregate monthly counts by category only. Those counts are not linked to a person or installation.
- Submissions and monthly totals are deleted within 12 months. An owner can delete an encrypted submission sooner once it has been handled.
- Cloudflare processes normal connection metadata needed to deliver and protect the public service. Grovely's Worker code does not read or store that metadata.
- The form warns people not to include passwords, access tokens, backups, health information, or other sensitive information.

Any change affecting encryption, retention, reply handling, aggregate counts, anti-abuse controls, or automatic metadata requires a review of this contract before it is implemented.

## Architecture

```text
Grovely desktop form or demo form
  -> explicit Send action
  -> browser-side ECDH P-256 and AES-GCM encryption
  -> public Feedback Worker
  -> encrypted Cloudflare D1 submission storage
```

The public endpoint has no household identity, authentication cookie, or browser credential. The request omits credentials and suppresses the referrer. A selected category remains plaintext so the Worker can maintain the agreed aggregate category totals; message and optional email are encrypted.

The owner export endpoint returns ciphertext only. A future private, local-only feedback inbox will retrieve and decrypt entries using a private key that never enters Cloudflare, the Worker, Docker, or Git.

## Interface

The initial form is desktop-only. `DesktopShell` shows a feedback panel above the existing support message for both licensed and unlicensed users. The panel links to GitHub Issues so people can check whether a bug or feature request already exists.

The form is always visible in the desktop shell. It cannot send until a build includes the public feedback endpoint and public encryption key. Those values are public build configuration, not per-household settings or credentials.

Feedback encryption requires a secure browser context. Self-hosted instances need HTTPS; `localhost` is supported for local development and UAT. The public demo is served over HTTPS.

## UAT status

Completed:

- Prepared an uncommitted public Feedback Worker source repository with a narrow public submission endpoint, encrypted D1 schema, retention cleanup, protected ciphertext export, and public configuration example.
- Added browser-side encryption, explicit feedback form, privacy disclosure, GitHub Issues link, payload limits, and focused frontend tests.
- Created a separate UAT Worker and D1 database behind `feedback-uat.grovely.org`.
- Added the strongest available UAT Cloudflare edge rate limit: six requests per ten seconds with a ten-second block.
- Rebuilt Grovely UAT with the UAT public endpoint and public encryption key.
- Submitted one controlled UAT message from the desktop form. The Worker returned success and D1 stored one row with category `bug`, an 87-character ephemeral public key, a 16-character IV, and nonzero ciphertext. No readable message was stored.
- Deleted the UAT submission and its test-only monthly category total after verification.

Local validation completed before the UAT submission:

- Focused feedback encryption tests passed.
- Frontend type-check passed.
- Frontend production build passed.
- UAT frontend returned `200 OK`; the UAT backend reported healthy.

## Remaining work

1. Improve the user-facing error shown when a feedback form is opened from an insecure browser origin. The current browser error correctly blocks encryption, but the form should explain that feedback requires HTTPS or `localhost`.
2. Decide and document the production Cloudflare anti-abuse rule. The UAT account allowed only a short six-requests-per-ten-seconds rule, not the intended three submissions per ten minutes. Do not replace it with CAPTCHA, Worker-side IP handling, fingerprinting, or persistent request logging without reviewing this contract.
3. Test the demo build through a separate Pages preview using the UAT feedback service. Do not temporarily point the live `try.grovely.org` demo at UAT storage.
4. Create and validate the production Feedback Worker, production D1 database, custom domain, owner secret, retention schedule, and production edge protection after UAT and review are complete.
5. Compile the final public endpoint and public key into the official frontend image and demo build. Regular self-hosted users must not need to add feedback values to their environment files after updating.
6. Verify a production Docker installation and `try.grovely.org` separately after the production service is ready.
7. Add the final public privacy wording to the application README and other affected public documentation, subject to review and implementation matching the contract.
8. Build the private local feedback inbox as a later feature. It should fetch ciphertext, decrypt only on the owner's computer, support handled-and-delete, and never be publicly hosted.

## Operational notes

- Keep the private ECDH key outside Cloudflare, Docker, environment files, and Git.
- Keep the Worker owner token in Cloudflare's secret storage only.
- Never commit real `wrangler.toml`, Worker secrets, private keys, database IDs, or local environment files.
- Do not deploy or commit the feedback work until the application and Worker are complete together.
