this file should be overwritten by using the lines as a base after every change

# Next Release — v0.15.0

Headline: v0.15.0 - system updates and encrypted feedback

## Features

### System updates

- Grovely System brings release awareness and user-confirmed application updates directly into Home for both household members. (0.14.1-rc.1)
- Home shows whether the installed release is current, a newer release is available, an update is reconnecting, or recovery needs attention, without exposing Docker commands, host paths, credentials, or snapshot locations. (0.14.1-rc.1)
- Optional daily release checks use a compact public cached feed and send no account, household, license, usage, installed-version, or other application identifier. Server administrators can disable scheduled checks while keeping manual checks available. (0.14.1-rc.1)
- A person explicitly confirms every update. Grovely System creates a local recovery snapshot, pulls only Grovely's published frontend and backend images, preserves local Compose and proxy configuration, and waits for container health checks before it considers the operation complete. (0.14.1-rc.1)
- The update request now acknowledges that work has started before the backend restarts, so Home can calmly show the reconnecting state instead of treating the intentional restart as a failed request. (0.14.2)
- Home reloads only after the restarted backend confirms the exact target version. This refreshes the new frontend bundle and its visible application version, rather than claiming success based only on a queued request. (0.14.2)
- Phase-specific diagnostics remain local to the household server and identify release-check, snapshot, image-pull, Compose, and health-check failures without logging credentials, environment values, household data, request bodies, or snapshot paths. (0.14.2)

### Feedback system

- Grovely now offers an explicit, encrypted feedback flow from self-hosted Home and the live demo. It stays separate from household data, the household backend, the updater, and application analytics. (#189) (0.14.2)
- People can send a bug report, feature request, greeting, encouragement, or other feedback. Bug reports and feature requests link to existing GitHub Issues first, helping avoid duplicate reports without requiring a GitHub account. (0.14.2)
- The feedback window follows Grovely's DetailSheet design with a welcoming fixed layout, a clear message limit, optional reply email, in-sheet privacy information, accessible Info and Send icon actions, and a close action available at every point. (0.14.2)
- Feedback explains what happened in plain language when a message cannot be prepared, the browser requires HTTPS, the service cannot be reached, the service is unavailable, a message is too long, or sending succeeds. The form reserves one stable line for that status so the layout does not jump. (0.14.2)
- The optional email field is used only when someone is open to a reply about a resolution, status, or anything else. Nothing is sent until a person explicitly chooses Send. (0.14.2)
- Before a submission leaves the browser, Grovely generates an ephemeral ECDH P-256 key pair and encrypts the message and optional email with AES-GCM. The browser sends only the chosen category and encrypted envelope to the dedicated Feedback Worker. (0.14.2)
- The service does not attach or store household data, account names, license information, installed versions, usage data, logs, device identifiers, or IP addresses. Feedback is not used for advertising, profiling, or product-usage tracking. (0.14.2)
- Dedicated UAT and production Feedback Workers use encrypted-only D1 storage, daily retention cleanup, owner-protected ciphertext export and deletion, and the available Free-plan edge rate limit. Controlled UAT and production checks verified ciphertext-only storage and deletion of the verification row. (0.14.2)
- After a feedback submission is safely stored, the UAT and production Feedback Workers send a best-effort alert to the configured owner address. The alert identifies its environment but contains no feedback content, category, reply email, submission details, household data, or admin data. (#190) (0.14.2)
- Mobile Home keeps feedback reachable in its compact footer, after the brief premium thank-you or license invitation. The unlicensed invitation opens the existing Premium Gate. (0.14.2)
- The manually deployed `try.grovely.org` demo uses the production public feedback configuration and the same explicit encrypted flow, without household or user metadata. Its cache rules exclude static assets so a deploy cannot cache the HTML fallback as JavaScript or CSS. (0.14.2)

## Fixes

- Fixed demo fertile-window predictions missing until a period was edited (#187). (0.14.1-rc.1)
- Fixed UAT updates so Compose reads the same environment file the updater changes. (0.14.1-rc.2)
- Fixed release-candidate version validation and comparison so UAT can offer a newer RC. (0.14.1-rc.2)
- Fixed pre-update snapshot authentication so the private updater token reaches its internal backend route. (0.14.1-rc.3)
- Fixed updater image packaging and UAT Compose port replacement for image-based update testing. (0.14.1-rc.3)
- Kept prerelease images out of the normal `latest` tag. (0.14.1-rc.3)
- Fixed the updater Compose environment so a confirmed update uses the version it writes to the local environment file. (0.14.2)
- Official frontend images, release templates, and guided installers now include the public feedback configuration. (0.14.2)
- Ensured every documented end-user installation path receives public feedback configuration automatically; only direct Vite or custom static frontend builds need explicit `VITE_FEEDBACK_*` values. (#192) (0.14.3)
- Fixed the live demo update status so it remains current when the demo is ahead of the published stable manifest. (#191) (0.14.3)
- Moved official Compose image references to the public `ghcr.io/grovely-org` registry. (#193) (0.14.3)
- Removed the duplicate mobile notification-settings screenshot from the README. (0.14.3)
- Fixed short-cycle prediction review: each unresolved adjacent pair is shown on both periods, either period can exclude or confirm the pair, ignored periods can be restored, and neither warning period renders forecasts. (#194) (0.14.8)
- Fixed Docker rebuilds that could crash with a native Node assertion by pinning the frontend, backend, updater, and CI runtimes to the tested Node release. (#195) (0.14.8)

## Issues created

- #184 (0.14.1-rc.1)
- #185 (0.14.1-rc.1)
- #186 (0.14.1-rc.1)
- #193 (0.14.3)
- #194 (0.14.8)
- #195 (0.14.8)
- #194 (0.14.8)
- #195 (0.14.8)

## Issues closed

- #187 (0.14.1-rc.1)
- #188 (0.14.2)
- #189 (0.14.2)
- #190 (0.14.2)
- #191 (0.14.3)
- #192 (0.14.3)
- #193 (0.14.3)

## Architecture

- Added frontend and backend automated test foundations with coverage reporting. (0.14.1-rc.1)
- Added continuous integration checks for automated tests and the production frontend bundle. (0.14.1-rc.1)
- Resolved the existing frontend TypeScript errors and validated production and demo builds. (0.14.1-rc.1)

## Planned (not in this release)

- Complete the remaining frontend lint cleanup tracked in #185.
- Add Playwright coverage for critical browser workflows when needed, tracked in #186.
- Plan and validate the Nodemailer 9 upgrade with real SMTP testing.

## Docs added

- Added `docs/backend/system-updates.md` with the release-check, snapshot, update, UAT, and troubleshooting design. (0.14.1-rc.1)
- Expanded system-update documentation with acknowledged updates, version-confirmed reloads, published-image UAT testing, and local diagnostic guidance. (0.14.2)
