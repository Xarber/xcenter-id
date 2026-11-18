# Testing X-Center ID

## Source checks

Use Node 24 and install dependencies with `npm ci` in both `services/api` and `apps/dashboard`. Run `npm test` in each package. The API suite uses temporary SQLite stores and loopback services. Run `npm run typecheck` and `npx expo install --check` in the dashboard. Run `python3 scripts/validate-uads.py` from the repo root with the CI-pinned version of `jsonschema`. See `.github/workflows/uads-quality.yml` for the source checks and dependency audits.

## Isolated issuer checks

Use an HTTPS staging origin, a generated staging identity configuration, a separate database directory and a separate mail encryption key. Use `services/api/generate-identity-config.mjs` to create the issuer configuration. Serve the Expo web export through `services/api/account-web.mjs` and terminate TLS for the staging hostname. Scope WebAuthn to the staging origin. Use virtual WebAuthn credentials for browser automation. Keep production keys, passkeys and data out of browser fixtures.

The 17 November continuation used an isolated HTTPS issuer and Chrome at 390 px. The 21 API tests, two dashboard tests, dashboard typecheck and web export passed. The browser checks exercised:

- **Signup and inbox.** Select an available username and create a virtual passkey, complete the profile, deliver synthetic MIME to the isolated store, then load the 101st message, read it, confirm deletion, and reload to verify it is gone.
- **Authorization.** Link a sample client with selected scopes, exchange its authorization code with PKCE, request a new scope, and verify the expanded token. Unlink the client, verify that its existing token is denied and its entry disappears from Permissions, then link it again.
- **Friends.** Create and accept an invitation across two separately authenticated accounts, share a seeded record from a configured publisher, verify it appears for the recipient, then revoke it and verify that it disappears on reload.
- **Files.** Create a nested folder, upload a synthetic file, share it, and check the recipient receives the original bytes. The owner's session cannot use the recipient download URL. Revoking access makes that URL unavailable to the recipient. Confirm file deletion in the original folder.
- **Italian locale and message URL.** Repeat signup and mailbox paging, reading and deletion with the browser locale set to `it-IT`. The birthday label and core mail controls appear in Italian. Open the 101st message, return to the loaded list, then open its URL while signed out. Sign-in and reload both return to the message. Confirm deletion and recheck the inbox.

## Open verification

Run the account, privacy and mail flows separately on installed iOS and Android builds. A virtual WebAuthn credential does not establish physical FIDO2 compatibility. External mail needs an independent sender and inbox and verified public transport. Deployment must retain a checked recovery snapshot. The current production mount is below the backup job's space threshold. Changed-line and changed-branch coverage have yet to be measured.

## 18 November regression batch

The API suite now covers inbound verification with generated DKIM keys and fixture DNS, forged authentication headers, replay, expiry and SMTP delivery. Registry tests cover app restriction, restoration, deletion and ownership. Account tests cover support and replies while locked. The dashboard regression suite exercises missing Intl constructors.

Isolated Chrome at 390 px verified an old administrator session opening the menu with its existing passkey, the default avatar, user detail pages, mailbox warnings, locked-account appeals and reply history, and a descriptive mailto draft. A native-session confirmation rejected another browser account and confirmed only the original native session. Two public client fixtures verified wrong-client code denial and one-time exchange, followed by administrator restriction, restoration and deletion. Native installation and an independent external verification message remain open.


18 November final source batch: 24 API tests and 3 dashboard tests passed; dashboard TypeScript and the 16-declaration UADS structural check passed (using the existing temporary Python environment with jsonschema). Isolated Chrome covered admin renewal, native-bound renewal, account details/default avatar/warnings, app moderation, restricted support-only sign-in/replies, temporary mailto creation and cross-client authorization-code isolation. Actual iOS/Android devices and real external incoming verification remain unverified. The dashboard dependency audit fails on the unpatched picomatch advisory recorded in SECURITY.md; the API audit passes.
