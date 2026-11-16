# X-Center ID dashboard

The Expo app in `apps/dashboard` supports iOS, Android and web. The web account manager is the authoritative interface for sign-in, account changes and permission decisions. Native tabs open the corresponding canonical `https://id.xcenter.it` pages in the system browser. Those pages use the browser's account session and WebAuthn support.

## Account navigation

The web sidebar and native navigation include account status, profile, devices, sign-in and security, connected apps, permissions, data usage, files, mail and settings. Web accounts show Administration when the API confirms the account is in the deployment's admin allowlist. Settings can replay the introduction. Three taps on the version unlock Developer Options, including the isolated sample dashboard. The first automatic introduction is recorded in local browser storage and survives reloads.

Signup registers a passkey before asking for a username and profile. Sign-in can start with a username or go directly to the passkey chooser. The birthday determines the age range, and OAuth clients receive the range only when the corresponding profile access is granted. Profile photos are private to the signed-in account. Additional email addresses require verification.

The sign-in illustration uses six Lucide icons for Mail, Files, Saved Places, Apps, Devices and Security around the X-Center ID mark. CSS animates their initial appearance and leaves them static under Reduced Motion. The illustration is decorative and hidden from assistive technology.

## Storage, mail and permissions

The file browser uploads and downloads account-owned files. It supports up to 2 MiB per file and 10 MiB or 100 files per account. Names are display metadata. Downloads are served as attachments. Account permissions are managed on the identity origin and account cookies are distinct from OAuth API access tokens.

A username reserves the corresponding address at `mail.xcenter.it`. Standard Hide My Email addresses use random UUIDs at `hme.xcenter.it`. An admin may enable eligibility for human-looking aliases at `mail.xcenter.it` for a specific account. Eligibility alone does not enable mail delivery. The protected `admin@management.xcenter.it` address is reserved. The dashboard does not use mailbox ownership to grant administrative privileges. See [mail operations](MAIL.md).

## Develop and verify

From `apps/dashboard`, run `npm ci`, `npm run typecheck`, `npm test` and `npx expo install --check`. Use the configured web export to serve the account UI and static PWA assets alongside `services/api/account-web.mjs`. The original site remains in `HTML/`. Production and platform-specific evidence is tracked in [the queue](ACTIVE_TASKS.md).

## Passkeys and folders

After passkey enrollment, Security opens a name editor with the suggested provider name. The server uses the AAGUID from the verified registration result and caches the community authenticator catalog. Catalog entries are display hints. Anonymous or unknown authenticators receive a generic name. A user can rename or remove a passkey after recent authentication. The last credential remains protected.

The file browser supports nested folders, breadcrumb navigation and uploads into the open folder. It supports eight levels and 100 folders per account. Empty folders can be removed. Existing files remain accessible at the root, and files and folder names are encrypted.
