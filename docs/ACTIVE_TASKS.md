# Active tasks

Assignment opened 16 November 2026. Legacy source baseline `e617758`.

| Order and ID | Priority and request | State | Dependencies, evidence and next action |
| --- | --- | --- | --- |
| 1 AUTHN-001 | Review the legacy repository and save findings | Verified | Static inventory and source findings in [legacy review](LEGACY_REVIEW.md). Runtime and historical credential validity were outside this verification. |
| 2 AUTHN-002 | Start the overhaul with an Expo account dashboard | Implemented | Source under `apps/dashboard`. Type check, sample test, Expo alignment, web export and Chrome sample flows passed. Native runtime remains pending. Next, establish the installed-device test baseline and keep web/PWA work independent of identity setup. |
| 3 AUTHN-003 | Connect the account manager and reusable Expo SDK to passwordless identity and consent | Queued | Determine the issuer and validate the provider with synthetic accounts and external keys. Implement the hosted journeys and typed grant API before wiring live actions. |
| 4 AUTHN-004 | Complete applicable UADS portal, SDK and operational requirements | Queued | Requires the identity/data services and release scope. Track PWA, onboarding screenshots, developer tools, updates, production configuration, accessibility and operations. |
| 5 AUTHN-005 | Validate and release supported artifacts when authorized | Queued | Requires prior implementation and preparation. Apply UADS §8 before starting builds or triggering CI through a push. |
| 6 AUTHN-006 | Critical priority, review file saving and account encryption | Verified | [Security findings](SECURITY.md). Static review established unsafe path construction and unauthenticated or optional encryption. Legacy runtime disabled by default. |
| 7 AUTHN-007 | Finish the secure replacement API | Implemented | Typed records, optimistic revisions, quota, pagination and read-only grants implemented. Synthetic isolation, encryption and signed-token tests passed. Account lifecycle, quota, sync, rotation and operational gates remain pending. Depends on AUTHN-003 for end-to-end identity verification. |
| 8 AUTHN-008 | Redesign the web page with Expo and preserve the old site | Implemented | New Expo root landing and PWA export. Legacy pages preserved in place. Chrome verified first entry, return, manifest and offline reload. Actual PWA installation, update UI and distribution remain pending. |

| 9 AUTHN-009 | Stage AuthNJS on X-Center for testing | Implemented | Private web preview served over HTTPS at 6882dae. Browser verified developer navigation and account entry. Live API and account preview need a validated issuer and gateway. See [preview runbook](XCENTER_PREVIEW.md). |
| 10 AUTHN-010 | Developer registration and app identity enforcement | Implemented | Pending registry, operator approval and API checks pass synthetic tests. Expo page requires authenticated gateway, trusted issuance policy and live verification. |
| 11 AUTHN-011 | Reusable React Native package and integration documentation | Implemented | Dashboard consumes the package. Native browser PKCE helper passes SDK 58 type checking. Live callback, backend token exchange, session storage and physical-device verification remain open. See [integration guide](INTEGRATION.md). |
| 12 AUTHN-012 | Build native artifacts under §8 and §9 | Queued | [Run 43853292379](https://github.com/Xarber/xcenter-id/actions/runs/43853292379) submitted for 0762414. iOS jobs started. Both Android jobs stopped at signing validation before compiling. A subsequent SDK change needs its own verification when ready. Live identity remains an independent external dependency. |

AUTHN-006 and the storage portion of AUTHN-007 moved ahead of live identity integration to address the requested security and data-integrity priority.

The Expo web export was the smallest build needed to verify the redesigned public shell and offline behavior under §8. Live issuer verification and native/release builds remain open. The next action is to configure and test an isolated passwordless issuer with two registered clients and a distinct account console client. No Docker executable is available on this host.

| 13 AUTHN-013 | Deploy a real passkey-first identity service and account settings | In Progress | Same-origin account backend and Expo Web passkey settings implemented. Verify enrollment and sign-in with a synthetic account in isolated storage before cutover. Email enrollment is unavailable until an ownership-verification transport is configured. |
| 14 AUTHN-014 | Brand X-Center ID and add native tabs | Implemented | Editable icon, native tab bar and shared branding added. Run web and source checks, then validate native artifacts and device behavior. |

AUTHN-013 deployed at b528298; browser tests passed against isolated X-Center storage. AUTHN-014 branding and tab code passed TypeScript. Pending work includes email verification delivery, OAuth and shared-data integration, account-backup validation, and native artifacts/device checks. Next action: configure and verify email ownership delivery, then connect OIDC and consent to the passkey session. See [live deployment](XCENTER_ID.md).

### Usage checkpoint

Five-hour window reached 9% remaining and resets 16 November at 16:05:56 CET. Weekly window had 86% remaining and resets 23 November at 11:05:56 CET. Section 0 pauses new work. After usage permits, implement and test email ownership verification with a configured delivery provider, then connect OAuth issuance and consent to the passkey session and verify the latest native artifacts. The native build matrix is still pending for the branded code.

### 16 November production expansion

| Order and ID | Priority and request | State | Dependencies and next action |
| --- | --- | --- | --- |
| 15 AUTHN-015 | Replace shield branding with an original icon | Implemented | Layered identity-card SVG and raster exports deployed and fetched from public HTTPS. Native runtime remains pending. |
| 16 AUTHN-016 | Expand identity profiles and OIDC consent | In Progress | Profile and OIDC exchange passed two-client virtual-authenticator tests. Mail-backed choices and physical security keys still need live verification. |
| 17 AUTHN-017 | Ship actual sample apps, permissions, shared storage and developer onboarding | In Progress | Two sample apps passed stage OAuth, writes, grant/revoke, and shared-folder tests. Portal submission passed; public DNS-proof activation and developer revocation remain to be exercised end to end. |
| 18 AUTHN-018 | Provide inbound SMTP, outbound delivery, verified email and Hide My Email | In Progress | Local SMTP and STARTTLS verified. Public port 25 is refused and the root MX remains iCloud. Configure routing and authenticate an SMTP submission provider before enabling public receive, verification and outbound. |
| 19 AUTHN-019 | Publish the production account platform at id.xcenter.it | Implemented | Live web/OIDC revision 1e940dd verified. Daily SQLite snapshots active. Public mail, off-device restore and native artifacts remain open. |

The previous public identity deployment served revision 1e940dd. The latest source at daca54d adds the guarded mailbox-composition adapter. No SMTP submission provider has been configured. The [native artifact run](https://github.com/Xarber/xcenter-id/actions/runs/43899352702) was submitted for daca54d. Android signing secrets remain unavailable. Keep the older private account database and host available for its existing passkeys.

Next external prerequisite for mail is verified ingress for port 25 to the appliance or a dedicated inbound provider. Use mail.xcenter.it and hme.xcenter.it first. Inventory managed iCloud addresses and approve an apex coexistence plan before changing xcenter.it MX. Send only after configuring an authorized SMTP submission sender and verifying delivery, SPF, DKIM and DMARC.

### Account manager redesign

| Order and ID | Request | State | Dependencies and evidence |
| --- | --- | --- | --- |
| 20 AUTHN-020 | Replace the web layout, fix onboarding and split passkey signup from profile setup | Implemented | Staged Chrome verified passkey signup before profile, avatar upload, introduction persistence and Settings replay. Public source is revision 9aa9969. Physical passkeys and assistive technology testing remain open. |
| 21 AUTHN-021 | Centralize all permissions in X-Center ID | Implemented | Sample mutations moved into the account-authenticated permissions API. Staged Chrome verified the old URL redirects. Recheck the complete sample grant and revoke flow. Third-party activation rejects issuer-host callbacks. |
| 22 AUTHN-022 | Add web and native account sections, private file browser and admin-controlled alias eligibility | Implemented | Native tabs open the canonical pages in the system browser. File isolation covered by API tests and staged Chrome verified upload and removal. Native device runtime remains pending. Admin role is a deployment allowlist of stable account IDs. Live mail routing is still blocked. |
| 23 AUTHN-023 | Animate service icons on sign-in | Verified | Six icons rendered in Chrome at 1366×900 and 390×844. The public sign-in is served from revision 9aa9969. |

| Order and ID | Request | State | Dependencies and next action |
| --- | --- | --- | --- |
| 24 AUTHN-024 | Fix web scrolling, fullscreen and mobile navigation, and orbit service icons | Verified | Staged Chrome verified compact scrolling, sticky header, orbit pause and Reduced Motion. Physical mobile browsers and standalone fullscreen remain unverified. |
| 25 AUTHN-025 | Suggest authenticator-based passkey names and allow rename/removal | Implemented | Staged Chrome verified rename, default suggestion on second enrollment, name override and removal. Provider resolution and fallbacks covered by automated test. Real hardware verification remains open. |
| 26 AUTHN-026 | Add private file folders | Verified | Staged Chrome verified folder creation and upload. API tests covered nesting, account isolation, root listing and denying non-empty removal. |
| 27 AUTHN-027 | Improve third-party sign-in, consent, permissions and sample apps | Implemented | Staged Chrome verified delegated signup and consent, durable app data access, structured notes, own record deletion and sample sign-out. Native library rendering remains unverified. |

Native preview for deployed revision 9745b7f was queued in [run 43934382712](https://github.com/Xarber/xcenter-id/actions/runs/43934382712). Verify each artifact and exercise the installed app after the run. The previous run produced an iOS Simulator artifact, canceled its device job, and failed both Android variants because release signing was missing.

### Native account controls and registered app linking

| Order and ID | Request | State | Dependencies and next action |
| --- | --- | --- | --- |
| 28 AUTHN-028 | Replace browser links with native account controls and secure sign-in | Implemented | Native account controls use a device-confined session. Isolated Chrome and API QA verified fixed return, code exchange, profile, sessions, folders and logout. Device installation and actual app interactions remain pending. |
| 29 AUTHN-029 | Show registered app and developer metadata at consent, auto-login linked apps, allow unlinking | Implemented | Isolated cross-site QA verified branding registration, linked-app SSO, sharing, unlink and consent on relink. Native client callback and relying-party in-app email sign-in remain pending. |
| 30 AUTHN-030 | Route username sign-in to verified-email code or passkey | Implemented | Username lookup, fallback and code lifecycle tested. External code delivery still requires working SMTP submission. |
| 31 AUTHN-031 | Enable mailbox receiving and sending, show account storage categories | In Progress | Storage categories verified. Local SMTP certificate and isolated on-appliance submission, receipt and inbox retrieval verified. Public TCP 25 timed out, as did outbound direct connections to Gmail and iCloud. Public MX ingress and upstream submission remain blocked. |
| 32 AUTHN-032 | Publish two external test apps with distinct hostnames | Implemented | Distinct origins, callback URLs, access grants and unlinking verified using isolated accounts. Public revision 4637889 passed HTTPS and exact OAuth callback initiation checks on both dedicated hostnames. |

The earlier revision 9745b7f produced both iOS artifacts in run 43934382712. The Android jobs failed at the release signing configuration step. This is historical build evidence only.

Native account controls and the registered sign-in component were submitted in [run 44055741615](https://github.com/Xarber/xcenter-id/actions/runs/44055741615) from 72e60f8. Both Android jobs failed at the release signing gate. The iOS device and simulator jobs succeeded and both artifacts are present. Installed-device checks remain pending because no usable simulator runtime or physical test device was available.

| Order and ID | Request | State | Dependencies and next action |
| --- | --- | --- | --- |
| 33 AUTHN-033 | Dedicated app permission pages and profile save feedback | Verified | Isolated Chrome verified app URLs and grants, profile save and rejected writes, 320 px dark layout, and Reduced Motion. |
| 34 AUTHN-034 | Revise developer app profiles and add admin review, verification and storage controls | Implemented | Browser tests covered app editing, callbacks, global developer profile, review eligibility and admin access denial. API tests covered role and recency checks, app/developer verification and changing account quotas. Production admin access awaits a configured account. |
| 35 AUTHN-035 | Create the Implement X-Center ID skill | Verified | Skill Creator validation passed after installing PyYAML in a temporary environment. |
| 36 AUTHN-036 | Give mail composition a separate window and keep New email reachable | Verified | Isolated Chrome with an inbox fixture verified fixed launcher, separate dialog, Escape and draft retention. Local STARTTLS delivery was separately verified on X-Center. |
| 37 AUTHN-037 | Evaluate external SMTP delivery | Queued | Deferred by user. Research completed. Retain the local SMTP path while external delivery is deferred. Activate only after a future request and verified network or relay prerequisites. |

Public web revision bd6b402 is deployed on the account and sample origins. Both iOS artifacts are from the native preview source 72e60f8. The Admin dashboard awaits an authorized production account assignment. External SMTP delivery remains deferred by the user.

### 17 November follow-up

Mail confidentiality and mailbox transport move ahead of the compact navbar fix at the user's request. Independent account and repository work can proceed while public mail routing is blocked.

| Order and ID | Request | State | Evidence, dependencies and next action |
| --- | --- | --- | --- |
| 38 AUTHN-038 | Read and clean up mail in web and native, with attachments and safe formatting | Implemented | Owner-scoped plaintext reader, downloads and confirmed permanent deletion. Compose accepts optional formatting and an attachment. API regression tests and Expo typecheck passed. Next stage browser and native verification. |
| 39 AUTHN-039 | External delivery, Hide My Email and mail-client interoperability | In Progress | Reopened AUTHN-037. User-approved Iliadbox TCP 25 rule and Cloudflare subdomain MX are active. STARTTLS and authoritative DNS passed; apex remains iCloud. Source implements Hide My Email management. Next perform independent external delivery, then enable alias issuance. Outbound IPv4/IPv6 SMTP and external verification remain blocked; submission and IMAP are unfinished. |
| 40 AUTHN-040 | Mobile and web parity, device labels, signup/passkey naming, localized dates and Italian plus other main languages | Implemented | Shared overview, friendly native device labels, native localized date picker, and six-language navigation/date labels. Signup options validate the username and use it for passkey creation. Clean dependency install, source checks and signup option regression passed. Full translation and installed-device testing remain open. |
| 41 AUTHN-041 | Permission toggles, incremental authorization and full unlink revocation | In Progress | Implemented unlink cleanup, permission filtering, selected consent scopes and incremental authorization screen. Sample regression passed. Verify broker flow, scope choices and relink on staging. |
| 42 AUTHN-042 | Friends, share files and app data, and polish web and native file browsers | In Progress | Web and native invitation, friend removal and recipient-bound file sharing implemented. Cross-account grant tests passed. Next verify UI and implement publisher-approved app-data sharing. See [Friends](FRIENDS.md). |
| 43 AUTHN-043 | Preserve horizontal scroll in the compact account navbar | Queued | User ordered after email. Tab anchors in Expo Web currently cause document navigation. |
| 44 AUTHN-044 | Grant the production account xarberyt admin and rename it to xarber | Implemented | Targeted production rollout assigned xarber and the Admin allowlist to the existing stable account. Verified isolated re-encryption and rollback, live deployment, database assignment and anonymous denial. Authenticated Admin tab remains to verify. |
| 45 AUTHN-045 | Rename and brand the GitHub repository | Verified | GitHub confirmed Xarber/xcenter-id remains private. Updated topics, description, homepage, origin, README and banner. |
| 46 AUTHN-046 | Fix Android signing and prepare AltSource and distribution | In Progress | No matching release identity or prior signed distribution found. User authorized a new key; local identity verified and four GitHub secrets configured. AltSource generator passed fixture checks. Build start gate remains pending independent work, then verify APK/AAB and device artifacts and generate metadata from release receipts. |

### 17 November usage checkpoint

The five-hour window reached 9% remaining and resets at 17:28:55 CET on 17 November. The weekly window had 43% remaining and resets at 11:05:56 CET on 23 November. UADS §0 pauses new work.

- Mail ingress is live. The updated SMTP receiver from `94ccae4` accepted an isolated fixture over TLS and persisted the message. The production public hostname then accepted the local mailbox recipient and refused external relay. The earlier container is stopped and retained for targeted rollback. Inbound delivery from a truly independent external mailbox still needs a test. The direct outbound path times out to Gmail and iCloud from the appliance on both address families. Next establish an outbound route before configuring verification codes, public SMTP submission or mail-client access. Router internet settings exposed no SMTP egress control.
- The dashboard changes are on `testing`. API suite passed 20 tests, dashboard suite passed 2, TypeScript and Expo dependency checks passed. When work resumes, finish publisher-approved friend app-data sharing and the remaining localization, then stage the smallest necessary web export and exercise mail, signup, consent, unlink and sharing on isolated accounts. The compact navbar fix remains ordered after email.
- A dedicated Android signing identity and four GitHub secrets are ready. No app build started during this assignment. Apply §8 after remaining independent work. Then verify installed native behavior and generate the AltSource from a validated release artifact.
