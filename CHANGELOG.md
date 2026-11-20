# X-Center ID changelog

This history covers the original AuthNJS source and the X-Center ID rewrite. X-Center ID uses its own 0.x series.
Versions were assigned retrospectively to source milestones. Deployment and native publication are tracked separately.
Each entry below includes the actual commits in its range. The current version includes the work under this release entry.

## 0.13.0 · 2026-11-20

- Native Overview uses the mobile website's profile card, shortcut tiles and account-status layout.
- Native Administration has separate Accounts, Username requests, Support inbox, Server storage, Developer verification and Registered apps cards. Account and app-storage details open in their own views.
- The standalone public SDK provides Expo, SwiftUI, Compose, Flutter and web account components, plus a Next.js example and the integration skill.

<details>
<summary>Source changes</summary>

- `48d0420` fix(dashboard): match mobile web account and administration surfaces
- [Standalone SDK source](https://github.com/Xarber/xcenter-id-sdk/commit/eab0298)

</details>

## 0.12.0 · 2026-11-19

### Mail setup and app approvals

- Copy generated mail passwords and find mail-client setup in the inbox.
- Manage private-app access from a searchable list. Administrators can verify developers directly.
- Browse version history from Settings.

### Fixes & improvements

- Sign-in separates the developer from the account you’re using, suggests email code AutoFill where supported, and shows progress on the action you started.
- Mail clients gain additional reconnect authentication support.

<details>
<summary>Source changes</summary>

- `1c3d28e` feat(dashboard): improve mail setup and add version history

</details>

## 0.11.0 · 2026-11-19

### Private and self-hosted apps

- Private apps support approved users and access requests. Local apps can register without DNS, with reader trust controls for shared data.
- Rotate or revoke client secrets.
- Use the Expo account overview for sign-in, profile, sync settings, and account management.

### Fixes & improvements

- Fixed browser consent and stacked sidebar navigation, made linked emails read-only, and removed user-owned data on unlink.
- Improved mail connection setup and reconnect limits.

<details>
<summary>Source changes</summary>

- `5f4892f` fix(identity): restore browser consent and improve app management
- `f465477` feat(developer): add DNS-free registration and data trust controls
- `3c1735e` docs(deploy): record consent and mail production rollout
- `8db8fa0` docs(queue): record mail polish and release history tasks

</details>

## 0.10.0 · 2026-11-19

### Device sign-in and linked permissions

- Sign in on another device with a QR code or short code.
- Review and adjust app sign-in grants and confirm returning sign-ins.
- User-owned records count toward account storage. Service databases have independent quotas.
- Account activity emails use an HTML template. Developer profiles can link to GitHub.

### Fixes & improvements

- Storage navigation returns to the appropriate developer or administrator page.

<details>
<summary>Source changes</summary>

- `727cabc` docs(queue): record storage navigation and consent requests
- `632861f` feat(identity): confirm app and device sign-ins
- `b4ca80c` docs(queue): record identity validation checkpoint
- `fe1f11f` docs(deploy): record production identity rollout

</details>

## 0.9.0 · 2026-11-19

### App trust and longer sign-ins

- See verified and administrator badges across account and app views.
- Apps can import accepted friends with app-specific identifiers and require optional claims during setup.
- App sessions can renew for another 14 days during use.

### Fixes & improvements

- App branding refreshes on the permissions page, verification actions appear only as needed, and offline dashboard navigation works.

<details>
<summary>Source changes</summary>

- `b6e24ea` fix(dashboard): refresh app branding and show trust badges
- `b8fadf9` fix(mail): hide delivery checks on confirmation
- `5c34bad` fix(pwa): restore offline dashboard navigation
- `73f1b34` docs(ops): record dashboard and offline rollout
- `492b5e1` docs(security): record repository publication audit
- `9d9e734` docs(security): verify retained private data after rewrite
- `f44cda7` docs(security): record GitHub purge request submission
- `3f8b33b` feat(identity): add required claims and friend import
- `8416eb8` docs(queue): record persistent app sessions and Expo account overview
- `5ddcb7a` feat(identity): rotate app sessions and add Expo account overview
- `23b8e1d` docs(ops): record consent and rolling session deployment
- `0e8a29b` docs(skill): remove machine paths and specify Expo components

</details>

## 0.8.0 · 2026-11-18

### App management and dashboard polish

- Administrators can inspect volume health and app quotas. App owners and administrators can delete registrations.
- Linked apps can retrieve the authorized profile and photo. The integration skill explains public, private, shared, and unsigned-client integration.

### Fixes & improvements

- Improved small-screen layout, mail composer motion, controls, app links, and verification delivery.

<details>
<summary>Source changes</summary>

- `e89b990` fix(dashboard): restore app links and polish account flows
- `c1f02bc` fix(dashboard): apply mobile polish and composer motion
- `aa93619` fix(dashboard): keep selection controls inline in stacked forms
- `0c1567e` docs(ops): record dashboard deployment and integration checks
- `0763f72` fix(apps): expose deletion and simplify admin inventory
- `a728db8` feat(admin): report storage volume capacity and mount health
- `f24ec71` docs(skill): explain hosted data and consent workflows
- `6570cef` docs(ops): record storage recovery and unsigned app flow
- `87d3771` fix(identity): share linked profiles and restore email verification
- `d33e885` docs(ops): record profile and verification rollout
- `85a8420` fix(skill): require actionable identity setup and sync integration
- `abafcd5` docs(queue): checkpoint integration and verification work

</details>

## 0.7.0 · 2026-11-18

### Mail clients and private addresses

- Connect mail apps over authenticated IMAP and SMTP. Create premium mailbox aliases and check the state of private addresses.

### Fixes & improvements

- Validated the production email relay and improved address state feedback.

<details>
<summary>Source changes</summary>

- `1aeefb5` feat(mail): add protected client access and dashboard aliases
- `f21afc2` fix(mail): polish address states and portable TLS tests
- `2ce79c5` docs(mail): record verified production relay rollout
- `a28fd8c` docs(qa): record mail checks and native preview submission

</details>

## 0.6.0 · 2026-11-18

### Hosted data and client integrations

- Verified apps can manage encrypted hosted data, published data and user-approved cross-app sharing.
- Published X-Center ID integration skill guidance and added authenticated inbound email verification.
- Reorganized account management with an administrator workspace.

### Fixes & improvements

- Improved admin access renewal, mail receiver error reporting and native build validation.

<details>
<summary>Source changes</summary>

- `d0927a0` feat(skill): add secure X-Center ID integration guidance
- `9e05846` feat(accounts): renew admin access and verify email through signed inbound mail
- `c0bd5c3` fix(mail): distinguish receiver connection errors and record rollout
- `d8bf0e5` docs(operations): record verified rollout and remaining mail gates
- `04f071a` fix(ci): parse certificate fingerprints across apksigner versions
- `0095197` feat(platform): add hosted app data and reorganize account management
- `9d1df9b` fix(ci): include certificate parser directory in sparse checkout
- `7bf1f0f` docs(verification): record private native preview and email pause

</details>

## 0.5.0 · 2026-11-17

### Account moderation and support

- Administrators can lock accounts separately from signing out devices and approve username changes.
- Send support requests and replies through the mailbox or delete selected messages together.

### Fixes & improvements

- Updated native signing and verification workflow checks.

<details>
<summary>Source changes</summary>

- `546e633` feat(account): add admin moderation and mailbox support
- `ae3de18` docs(queue): record native preview build receipt
- `3c41496` feat(mail): delete selected inbox messages together
- `d5a4551` feat(account): separate locking and approve username changes
- `ec9c8ac` fix(ci): explicitly sign the final Android APK
- `c63f267` docs(queue): record build retry and five-hour checkpoint

</details>

## 0.4.0 · 2026-11-17

### Friends and mail sharing

- Share selected files and publisher-approved saved places with friends.
- Manage private addresses, browse older messages, and read or compose mail on dedicated screens. Core mailbox actions support multiple languages.

### Fixes & improvements

- Removed unlinked apps from the permission directory and improved Android package verification.

<details>
<summary>Source changes</summary>

- `ff24785` feat(sharing): add friend file grants and private address controls
- `4100f29` docs(operations): checkpoint SMTP rollout and pending verification
- `fbb5611` feat(sharing): let friends share publisher-approved saved places
- `b2331e4` fix(mail): make older inbox messages accessible
- `b76b48a` fix(permissions): hide unlinked apps from the directory
- `6fd0a22` feat(i18n): localize core mailbox actions across clients
- `6ccca0e` feat(mail): open a dedicated native composer
- `a2b5fc7` fix(ci): verify Android release signing identity
- `8777042` docs(qa): record isolated account verification
- `f2d3796` feat(mail): give messages dedicated readers
- `7116d65` fix(ci): require strict Android bundle signature verification
- `28b4b2c` fix(deps): patch Expo fingerprint glob matching
- `1f10dc8` docs(queue): checkpoint at the weekly usage threshold

</details>

## 0.3.0 · 2026-11-17

### Native account management

- Manage accounts in Expo and use a reusable registered sign-in entry.
- Manage app linking and consent in the dashboard.
- Read and clean up private mailbox messages.

### Fixes & improvements

- Revoked unlinked grants, supported encrypted account renames, and improved signup, developer profiles and navigation.

<details>
<summary>Source changes</summary>

- `703c968` feat(identity): add native account management and app linking
- `7c195fe` feat(expo): add registered sign-in entry and refresh account on return
- `e087385` feat(web): refine permissions, developer profiles and mail
- `4abe542` docs(release): record web rollout and native artifacts
- `9916ac6` feat(mail): add private message reading and cleanup
- `9ec3b40` fix(identity): revoke unlinked grants and support encrypted account renames
- `be3ae5e` docs(repo): brand the renamed X-Center ID repository
- `62b523a` feat(account): improve signup, consent, mailbox and native dashboard

</details>

## 0.2.0 · 2026-11-16

### X-Center ID sign-in and mail

- OpenID Connect for registered apps, plus sample integrations.
- Reserved mail identities and added authenticated mailbox submission.
- Introduced a redesigned responsive account and sign-in experience.

### Fixes & improvements

- Recorded web deployments and prepared parallel native previews.

<details>
<summary>Source changes</summary>

- `ba3e258` feat(identity): add OIDC clients, sample apps and X-Center mail foundations
- `cab67aa` chore(identity): reserve infrastructure names and retain backups
- `bf7071d` feat(mail): add authenticated mailbox submission and document production checks
- `1cf8273` docs(release): record public identity and native build receipt
- `b22eac8` feat(identity): redesign the account manager and sign-in
- `4889606` docs(identity): record dashboard verification and rollback
- `9d37dc3` feat(identity): improve web layout and account management
- `125906b` docs(identity): record responsive dashboard deployment
- `5eb0d8f` docs(release): record native preview submission

</details>

## 0.1.0 · 2026-11-16

### Passwordless dashboard foundation

- Added passkey accounts, registered confidential clients, a developer portal and a reusable native authorization helper.
- Introduced encrypted account-scoped records and permission grants.
- Built an Expo dashboard, native account tabs and offline web shell.

### Fixes & improvements

- Disabled the legacy server by default and fixed exported font delivery.

<details>
<summary>Source changes</summary>

- `0a5c489` feat(dashboard): start Expo account manager and document legacy system
- `dbd7e05` fix(legacy): disable archived server by default
- `009c7e0` feat(api): add encrypted account-scoped records and app grants
- `8dd46ce` feat(web): redesign Expo landing page and add offline shell
- `09731ea` feat(api): require approved confidential app registrations
- `39e1047` feat(dashboard): add developer portal and shared account entry package
- `a7ca739` ci(preview): add parallel native artifact jobs
- `aada8a6` feat(expo): add native browser authorization helper
- `b59ee41` feat(account): add X-Center ID passkeys and native tabs
- `a545d8f` fix(web): serve scoped Expo font assets
- `b18a707` docs(account): record live X-Center ID deployment
- `a8ea58f` docs(account): checkpoint live verification and pending integration

</details>

## AuthNJS 1.0.0 · 2025-04-19

### Original AuthNJS

- Original Node.js authentication API, account and app management, and administrative and developer pages.

<details>
<summary>Source changes</summary>

- `6ef1066` AuthNJS First Commit

</details>
