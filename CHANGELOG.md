# X-Center ID changelog

This archive covers the original AuthNJS source and the X-Center ID rewrite. Earlier entries reconstruct source milestones. Development entries identify unreleased work. There are no published GitHub releases in this history.
Deployment and native build evidence are recorded in [release documentation](docs/RELEASES.md).

## 0.15.0 · 2026-11-24

Development

### File transfers and account switching

- **Files upload in parallel**. Upload as much as your account can hold. Track and cancel individual transfers, or move existing files between folders.
- **Switch between accounts**. Keep up to three signed-in accounts in the website or app. Delete your own account from Settings.
- **See requested app access**. Review cross-app requests with the app name and icon. The Permissions directory lists your linked apps.
- **Start with sign-in**. The night background now appears on the main website. Native sign-in uses a continuous sky with subtle motion.
- **Browse full version notes**. Use Back from changelog pages and turn on Developer Mode to read commit notes inside a version.

### Fixes & Improvements

- Device sign-in uses six separate code inputs. Administration shows current app artwork. The first tour follows sign-in.

## 0.14.0 · 2026-11-23

Development

### Device sign-in, Files and release history

- **Sign in on another device**. Scan a device QR code or enter its six-character code, then review the sign-in before approving.
- **A better Files browser**. Upload several files at once, rename files and folders, and see the storage used by app containers.
- **Onboarding and release history**. Take a tour without an account and open full notes for individual versions.
- **Clearer app permissions**. Review permissions by linked source app. Apps can request access to owned files or read shared files.

### Fixes & Improvements

- The native sign-in screen includes a subtle night backdrop that respects Reduce Motion.
- Registered apps can store private user records without verification. Dedicated service storage remains available to verified apps.

## 0.13.0 · 2026-11-20

Reconstructed source history

### Native dashboard and administration

- **Account administration**. Review accounts, developers and registered apps in separate Administration cards.
- **Storage controls**. Check server storage and open verified-app storage from the native app.

### Fixes & Improvements

- The account overview brings back the colored profile card, shortcut tiles and section dividers from the mobile website.

## 0.12.0 · 2026-11-19

Reconstructed source history

### Mail setup and app approvals

- **Mail client setup**. Copy generated mail passwords and find mail-client setup in the inbox.
- **Private app access**. Manage private-app access from a searchable list. Administrators can verify developers directly.
- **Version history**. Browse version history from Settings.

### Fixes & Improvements

- Sign-in separates the developer from the account you’re using, suggests email code AutoFill where supported, and shows progress on the action you started.
- Mail clients gain additional reconnect authentication support.

## 0.11.0 · 2026-11-19

Reconstructed source history

### Private and self-hosted apps

- **Private apps and trust**. Private apps support approved users and access requests. Local apps can register without DNS, with reader trust controls for shared data.
- **Client secret rotation**. Rotate or revoke client secrets.
- **Account overview**. Use the Expo account overview for sign-in, profile, sync settings, and account management.

### Fixes & Improvements

- Fixed browser consent and stacked sidebar navigation, made linked emails read-only, and removed user-owned data on unlink.
- Improved mail connection setup and reconnect limits.

## 0.10.0 · 2026-11-19

Reconstructed source history

### Device sign-in and linked permissions

- **Device sign-in**. Sign in on another device with a QR code or short code.
- **Linked permissions**. Review and adjust app sign-in grants and confirm returning sign-ins.
- **Storage ownership**. User-owned records count toward account storage. Service databases have independent quotas.
- **Account emails and GitHub**. Account activity emails use an HTML template. Developer profiles can link to GitHub.

### Fixes & Improvements

- Storage navigation returns to the appropriate developer or administrator page.

## 0.9.0 · 2026-11-19

Reconstructed source history

### App trust and longer sign-ins

- **Trust badges**. See verified and administrator badges across account and app views.
- **Friend import and required claims**. Apps can import accepted friends with app-specific identifiers and require optional claims during setup.
- **Renewable app sessions**. App sessions can renew for another 14 days during use.

### Fixes & Improvements

- App branding refreshes on the permissions page, verification actions appear only as needed, and offline dashboard navigation works.

## 0.8.0 · 2026-11-18

Reconstructed source history

### App management and dashboard polish

- **Storage and app management**. Administrators can inspect volume health and app quotas. App owners and administrators can delete registrations.
- **Profile and integration**. Linked apps can retrieve the authorized profile and photo. The integration skill explains public, private, shared, and unsigned-client integration.

### Fixes & Improvements

- Improved small-screen layout, mail composer motion, controls, app links, and verification delivery.

## 0.7.0 · 2026-11-18

Reconstructed source history

### Mail clients and private addresses

- **Mail clients and private addresses**. Connect mail apps over authenticated IMAP and SMTP. Create premium mailbox aliases and check the state of private addresses.

### Fixes & Improvements

- Validated the production email relay and improved address state feedback.

## 0.6.0 · 2026-11-18

Reconstructed source history

### Hosted data and client integrations

- **Hosted app data**. Verified apps can manage encrypted hosted data, published data and user-approved cross-app sharing.
- **Integrations and email verification**. Published X-Center ID integration skill guidance and added authenticated inbound email verification.
- **Administrator workspace**. Reorganized account management with an administrator workspace.

### Fixes & Improvements

- Improved admin access renewal, mail receiver error reporting and native build validation.

## 0.5.0 · 2026-11-17

Reconstructed source history

### Account moderation and support

- **Account moderation**. Administrators can lock accounts separately from signing out devices and approve username changes.
- **Support and mailbox cleanup**. Send support requests and replies through the mailbox or delete selected messages together.

### Fixes & Improvements

- Updated native signing and verification workflow checks.

## 0.4.0 · 2026-11-17

Reconstructed source history

### Friends and mail sharing

- **Friend sharing**. Share selected files and publisher-approved saved places with friends.
- **Mailbox and languages**. Manage private addresses, browse older messages, and read or compose mail on dedicated screens. Core mailbox actions support multiple languages.

### Fixes & Improvements

- Removed unlinked apps from the permission directory and improved Android package verification.

## 0.3.0 · 2026-11-17

Reconstructed source history

### Native account management

- **Native account management**. Manage accounts in Expo and use a reusable registered sign-in entry.
- **App linking**. Manage app linking and consent in the dashboard.
- **Mailbox cleanup**. Read and clean up private mailbox messages.

### Fixes & Improvements

- Revoked unlinked grants, supported encrypted account renames, and improved signup, developer profiles and navigation.

## 0.2.0 · 2026-11-16

Reconstructed source history

### X-Center ID sign-in and mail

- **Registered app sign-in**. OpenID Connect for registered apps, plus sample integrations.
- **Mail identities**. Reserved mail identities and added authenticated mailbox submission.
- **Responsive dashboard**. Introduced a redesigned responsive account and sign-in experience.

### Fixes & Improvements

- Recorded web deployments and prepared parallel native previews.

## 0.1.0 · 2026-11-16

Reconstructed source history

### Passwordless dashboard foundation

- **Passkey accounts**. Added passkey accounts, registered confidential clients, a developer portal and a reusable native authorization helper.
- **Encrypted storage**. Introduced encrypted account-scoped records and permission grants.
- **Account dashboard**. Built an Expo dashboard, native account tabs and offline web shell.

### Fixes & Improvements

- Disabled the legacy server by default and fixed exported font delivery.

## AuthNJS 1.0.0 · 2025-04-19

Reconstructed source history

### Original AuthNJS

- **Authentication and app management**. Original Node.js authentication API, account and app management, and administrative and developer pages.
