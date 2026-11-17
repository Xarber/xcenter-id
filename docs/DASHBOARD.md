# X-Center ID dashboard

The Expo app in `apps/dashboard` supports iOS, Android and web. Both the web and native dashboards use the X-Center ID account service for account changes and permission decisions. Native tabs contain in-app controls. The system authentication browser handles WebAuthn.

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

## Native account manager

The mobile app keeps its session in Expo SecureStore. Account controls call the account APIs from the native app. Passkey authentication opens the system authentication browser and returns a one-time code bound to the app's verifier and state. Account management credentials never appear in the return URL. Passkey enrollment uses the secure browser. Username sign-in checks the account and offers an email code when a verified address and configured mail transport are available. The app itself accepts the code. Sign-in without email uses a passkey.

Data Usage separates files, account information, security metadata, app data, and mail. It counts account-owned logical bytes and excludes shared SQLite page overhead. The reported storage limit gates file uploads. Mail retains its separate mailbox quota.

The native account dashboard refreshes account data when it comes back to the foreground, including after passkey enrollment.

### Website permissions and profile feedback

Permissions opens a directory of registered, linked and test apps. A URL under `/permissions/<client>` shows the app's incoming and outgoing grants. Access is still changed by the same account-scoped APIs. Connected app entries link directly to the corresponding page.

Profile save feedback reads Saving while a write is pending and Saved after the service accepts the write. Editing a field or changing the photo restores the Save changes action. The confirmation check animates briefly and stays still with Reduced Motion.

The web design review covered app navigation, grant disclosures, form state, touch and keyboard targets, and animation costs. Permission rows wrap at narrow widths. Hover feedback applies to fine pointers. Text inputs stay at least 16 px at phone widths to avoid browser zoom on focus. Physical mobile browser review remains pending.

## 17 November parity and localization

The overview used separate web and native shortcut lists. Both now use the shared `account-overview.ts` model and display the same shortcuts and account status with their platform layout. Newly exchanged native sessions identify iOS or Android in device lists. Existing session labels remain readable. Native profile editing uses the system date picker, formats the date with the device locale and sends a calendar date without UTC conversion. The locale catalog translates account navigation, birthday labels and core Mail actions in English, Italian, Spanish, French, German and Portuguese. Full screen copy and server responses remain to be localized.

The private file list has labeled download and trash actions on both platforms. Sharing with other accounts still needs explicit invitations and resource-level grants. The native picker and UI require installed-device verification. Clean package installation, Expo dependency alignment, the dashboard test suite and type checking passed.
