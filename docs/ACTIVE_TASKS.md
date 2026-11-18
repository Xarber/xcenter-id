# Active tasks

Assignment opened 16 November 2026. Legacy source baseline `e617758`.

| Order and ID | Priority and request | State | Dependencies, evidence and next action |
| --- | --- | --- | --- |
| 1 AUTHN-001 | Review the legacy repository and save findings | Verified | Static inventory and source findings in [legacy review](LEGACY_REVIEW.md). Runtime and historical credential validity were outside this verification. |
| 2 AUTHN-002 | Start the overhaul with an Expo account dashboard | Implemented | Source under `apps/dashboard`. Type check, sample test, Expo alignment, web export and Chrome sample flows passed. Native runtime remains pending. Next, establish the installed-device test baseline and keep web/PWA work independent of identity setup. |
| 3 AUTHN-003 | Connect the account manager and reusable Expo SDK to passwordless identity and consent | Implemented | Isolated issuer tests verified the account and browser consent flows. The Expo SDK hands off to the issuer. Native device callback and physical FIDO2 verification remain open. |
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
| 37 AUTHN-037 | Evaluate external SMTP delivery | Verified | Transport evaluation completed. Implementation and external delivery verification continue under AUTHN-039. |

Public web revision bd6b402 is deployed on the account and sample origins. Both iOS artifacts are from the native preview source 72e60f8. The Admin dashboard awaits an authorized production account assignment. External SMTP delivery remains deferred by the user.

### 17 November follow-up

Mail confidentiality and mailbox transport move ahead of the compact navbar fix at the user's request. Independent account and repository work can proceed while public mail routing is blocked.

| Order and ID | Request | State | Evidence, dependencies and next action |
| --- | --- | --- | --- |
| 38 AUTHN-038 | Read and clean up mail in web and native, with attachments and safe formatting | Implemented | Owner-scoped reader, downloads, pagination and confirmed deletion. Compose accepts optional formatting and an attachment. Chrome independently verified the message URL, passkey return, pagination and persistent deletion. Native reader and composer typechecked and still need installed-device testing. |
| 39 AUTHN-039 | External delivery, Hide My Email and mail-client interoperability | In Progress | Reopened AUTHN-037. User-approved Iliadbox TCP 25 rule and Cloudflare subdomain MX are active. STARTTLS and authoritative DNS passed; apex remains iCloud. Source implements Hide My Email management. Next perform independent external delivery, then enable alias issuance. Outbound IPv4/IPv6 SMTP and external verification remain blocked; submission and IMAP are unfinished. |
| 40 AUTHN-040 | Mobile and web parity, device labels, signup/passkey naming, localized dates and Italian plus other main languages | Implemented | Shared overview, friendly native device labels, native localized date picker, and six-language navigation/date labels. Signup options validate the username and use it for passkey creation. Clean dependency install, source checks and signup option regression passed. Full translation and installed-device testing remain open. |
| 41 AUTHN-041 | Permission toggles, incremental authorization and full unlink revocation | Implemented | Chrome on an isolated issuer verified selected token scopes, incremental authorization, revoked token denial, absence of the published app from Permissions after unlink, and relink. Production deployment and native verification remain open. |
| 42 AUTHN-042 | Friends, share files and app data, and polish web and native file browsers | Implemented | At 390 px, an isolated issuer with two accounts verified invitations, saved-place sharing and revocation, nested folder creation, file upload, scoped download, file grant revocation, and deletion. Native device and production publisher verification remain open. See [Friends](FRIENDS.md). |
| 43 AUTHN-043 | Preserve horizontal scroll in the compact account navbar | Queued | User ordered after email. Tab anchors in Expo Web currently cause document navigation. |
| 44 AUTHN-044 | Grant the production account xarberyt admin and rename it to xarber | Implemented | Targeted production rollout assigned xarber and the Admin allowlist to the existing stable account. Verified isolated re-encryption and rollback, live deployment, database assignment and anonymous denial. Authenticated Admin tab remains to verify. |
| 45 AUTHN-045 | Rename and brand the GitHub repository | Verified | GitHub confirmed Xarber/xcenter-id remains private. Updated topics, description, homepage, origin, README and banner. |
| 46 AUTHN-046 | Fix Android signing and prepare AltSource and distribution | In Progress | No matching release identity or prior signed distribution found. User authorized a new key; local identity verified and four GitHub secrets configured. AltSource generator passed fixture checks. Build start gate remains pending independent work, then verify APK/AAB and device artifacts and generate metadata from release receipts. |

### 17 November usage checkpoint

The five-hour window reached 9% remaining and resets at 17:28:55 CET on 17 November. The weekly window had 43% remaining and resets at 11:05:56 CET on 23 November. UADS §0 pauses new work.

- Mail ingress is live. The updated SMTP receiver from `94ccae4` accepted an isolated fixture over TLS and persisted the message. The production public hostname then accepted the local mailbox recipient and refused external relay. The earlier container is stopped and retained for targeted rollback. Inbound delivery from a truly independent external mailbox still needs a test. The direct outbound path times out to Gmail and iCloud from the appliance on both address families. Next establish an outbound route before configuring verification codes, public SMTP submission or mail-client access. Router internet settings exposed no SMTP egress control.
- The dashboard changes are on `testing`. API suite passed 20 tests, dashboard suite passed 2, TypeScript and Expo dependency checks passed. When work resumes, finish publisher-approved friend app-data sharing and the remaining localization, then stage the smallest necessary web export and exercise mail, signup, consent, unlink and sharing on isolated accounts. The compact navbar fix remains ordered after email.
- A dedicated Android signing identity and four GitHub secrets are ready. No app build started during this assignment. Apply §8 after remaining independent work. Then verify installed native behavior and generate the AltSource from a validated release artifact.

### 17 November resumption

Usage permit confirmed. Added publisher-approved friend sharing for saved places and the associated API isolation test. Production web still reported bd6b402, and DNS and signing configuration were present. Browser staging and native artifacts remain pending.

Friend app-data sharing landed on `testing` at `be44dc9`. Chrome at 390 px passed mock-API sharing and revocation. A separate Chrome run against an isolated HTTPS issuer passed username-first signup with a virtual passkey, paging to the 101st stored email, opening it, deleting it, and confirming the deletion after reload. Both clients now expose older email. API suite passed 21 tests, dashboard suite passed 2, and dashboard typecheck and web export passed. External transport, a real publisher UI run, native verification and production deployment remain open.

The subsequent isolated issuer run verified persisted friend sharing and revocation with two separate Chrome accounts. Core mailbox controls and birthday labels now use the shared six-language catalog. Direct outbound TCP 25 also timed out from the Mac, while inspection found accepting IPv4 and IPv6 OUTPUT chains on the appliance. The location of the outbound failure remains unconfirmed. Public web cutover needs a verified recovery snapshot under UADS §24. The production storage mount currently has about 1.5 GiB free, below the existing backup job's 2 GiB guard. Inspect disposable app-specific caches and recheck snapshot readiness before cutover.

Italian Chrome passed the isolated birthday and mailbox flow. Added a dedicated native composer with isolated status, draft retention and keyboard-aware layout. Android workflow now rejects APKs and AABs signed by a different certificate. Verified workflow syntax and comparable signatures with a synthetic signed JAR. No Android or iOS device was available for the new UI, and no native build was dispatched.

Dedicated mailbox readers now use individual web URLs and native modal screens. Isolated Chrome verified passkey return, direct reload, return to a paged inbox and persistent deletion. File sharing and recipient-only downloads also passed in isolated Chrome. The dashboard dependency audit identified a moderate transitive advisory in Expo fingerprint tooling. A scoped override resolved it and the clean-install audit passed.

### 17 November weekly usage checkpoint

The weekly window reached 34% remaining with no reset credits and a reset scheduled for 23 November at 11:05:56 CET. UADS §0 applies a 35% minimum with five to six days until reset. The five-hour window had 49% remaining and resets 17 November at 22:45:39 CET. Implementation and verification commits through `7821843` were confirmed on `origin/testing`. No native release workflow was dispatched.

When usage permits, resume AUTHN-039 first. Verify public delivery with an independent sender, confirm outbound TCP 25 availability with the line provider, and validate outbound delivery before enabling verification mail. Recheck production snapshot readiness on the low-space mount before staging a cutover. Continue independent localization and native release preparation, then apply the UADS §8 build gate and verify the Android certificate and both iOS artifact formats. AUTHN-043 remains ordered after email. Generate distribution metadata from validated release receipts.

### Admin and support continuation

The user waived the weekly pause for this assignment and requested the native preview build after changes. The five-hour checkpoint still applies.

| Order and ID | Request | State | Dependencies and next action |
| --- | --- | --- | --- |
| 47 AUTHN-047 | Admin photos, account locks and deletion | Implemented | API and isolated 390 px Chrome verified admin JPEG access, lock, session loss, unlock and confirmed deletion. Identity information is removed and separate encrypted data remains subject to retention. Installed native and production verification remain open. |
| 48 AUTHN-048 | Member feedback, shared admin support inbox and mailbox replies | Implemented | Two admins could open the same request on an isolated issuer. Chrome and API checks confirmed one reply reaches the requester's Mail and role checks reject unauthorized readers. Native runtime and production remain open. |
| 49 AUTHN-049 | Accept support email at the requested domains | Implemented | Isolated SMTP accepted both exact opt-in addresses and denied other recipients on their domains. Public `id.xcenter.it` is a CNAME. Apex MX remains iCloud. Public delivery and external replies depend on inbound routing and an authorized outbound sender. |
| 50 AUTHN-050 | Start the native build after implementation | Verified | [Run 44138528022](https://github.com/Xarber/xcenter-id/actions/runs/44138528022) was dispatched for `207627d`. Both Android jobs started while both iOS jobs were queued. Artifact validation and release remain under AUTHN-046. |

Build gate reconciliation. Admin and in-app support implementation and source preparation are complete. The isolated browser and SMTP checks passed. Public routing, external mail, production backup headroom and installed-device checks depend on services or artifacts outside this source change. This user explicitly requested a native preview after changes. Dispatch it on the tested development revision without release publication.

### Remaining queue continuation

AUTHN-038 gained confirmed bulk mail cleanup on web and native. API tests passed for ownership, cross-origin denial, malformed input, request bounds and retry safety. Isolated Chrome at 390 px verified cancel and persistent selected-only deletion. Native runtime remains open. The latest native run targets an earlier commit and remains separate from this batch. Public web still reports `bd6b402`, and the production storage mount still has 1.4 GiB free.

| Order and ID | Request | State | Evidence and next action |
| --- | --- | --- | --- |
| 51 AUTHN-051 | Preserve sessions under account lock and add separate sign-out-all | Implemented | API tests and isolated Chrome verified the locked state, unlock restoring the same session, and separate revocation. Device and production checks pending. |
| 52 AUTHN-052 | Account-holder-confirmed username request with admin approval | Implemented | API and Chrome verified request, dashboard confirmation, restricted admin approval and changed mailbox username. Email OTP is transport-dependent. |

The user reaffirmed priority for external internet mail, followed by authenticated mail client access. Outbound TCP 25 from X-Center still timed out to Gmail and iCloud. Public support routing remains pending. The Italian shared overview, pluralized status, and revised admin controls passed 390 px isolated Chrome. The 22 API tests and dashboard typecheck passed. The prior native run built the AAB and both iOS variants. The universal APK job failed and is being diagnosed.

AUTHN-046 build diagnosis. Run 44138528022 completed three artifact jobs. Gradle assembled the APK, then its final certificate assertion failed. The workflow now explicitly signs the final APK and retains its independent fingerprint and architecture checks. Next validate a fresh run on the new source revision. The previous artifacts omit the bulk-inbox, lock and username changes.

### Five-hour checkpoint

The five-hour window reached 8% remaining and resets on 17 November at 22:45:39 CET. UADS §0 pauses new work. The user's weekly override remains in effect. [Native retry 44145142129](https://github.com/Xarber/xcenter-id/actions/runs/44145142129) was confirmed queued for `31891c3`. The earlier AAB and both iOS artifacts passed their SHA-256 checks and the AAB signer matched the expected Android certificate. Physical devices, release publication and AltSource remain unverified.

Resume the user's priority order with AUTHN-039. Establish and verify an external inbound delivery path and a usable outbound route, then finish authenticated SMTP submission and mailbox access for external clients. Continue support address routing with the existing iCloud apex route preserved. Recheck the production snapshot guard and verify the retry's Android APK, AAB and iOS artifacts before any release. AUTHN-043 remains sequenced after mail.

### 18 November follow-up

Production revision 861128c is now live at id.xcenter.it and both sample hosts. A checked six-database rollback snapshot is at the protected host path recorded in the operations runbook. New priority is the reusable integration skill, then native crash, authenticated admin access and account detail moderation, locked account support, and inbound email verification while external sending remains unavailable.

| ID | Request | State | Next action |
| --- | --- | --- | --- |
| AUTHN-053 | Integrate X-Center ID skill | Verified | Installed and source-controlled skill validated with Skill Creator. Independent review completed and clarified native versus confidential backend registration. |
| AUTHN-054 | Native accountStatus crash | Implemented | Unsupported Intl constructor dependency removed; missing-constructor regression passed. Native run 44245479618 is building; installed-device verification remains open. |
| AUTHN-055 | Admin authentication, icons, avatar fallback and user detail controls | Implemented | Isolated Chrome and API checks passed. Deployed d4de743; authenticated production and native-device checks remain open. |
| AUTHN-056 | Support access while account locked | Implemented | Browser/API verified preserved and fresh passkey support-only sessions with reply history. Deployed d4de743; native device remains unverified. |
| AUTHN-057 | Temporary verification using mailto and authenticated inbound mail | Implemented | Signed SMTP regression and descriptive browser draft passed. Live service accepts verify@mail.xcenter.it over TLS and rejects relay; first real independently sent message remains unverified. |


18 November batch checkpoint: AUTHN-054–057 are implemented. API tests passed 24/24, dashboard tests 3/3, TypeScript and the UADS structural validator passed. Isolated Chrome passed in-session browser/native confirmation, cross-account denial, default avatars, account detail moderation, warnings, locked passkey support-only access and replies, descriptive mailto, and cross-client PKCE redemption/replay denial. The signed loopback SMTP regression verifies the matching sender and code, rejecting forged headers, changed content and replay. Native runtime and the first independently sent external verification message remain unverified.

Build gate: independent implementation and preparation for this batch are done. Production export and the requested four-job native preview are the next verification steps. No stable release or public artifact publication is planned. APK certificate verification remains to validate on the new run. External outbound transport, submission/IMAP, complete localization, physical devices and distribution publication remain outstanding; the compact navbar item remains ordered after mail by the user.

Dependency gate: the dashboard audit reports the high picomatch advisory GHSA-fc5q-39xc-vjpf (CVE-2026-112366), including transitive Expo/Metro build tooling. The affected upstream releases extend through 4.0.7 and no patched npm release is currently available. Do not force a framework downgrade or disable the audit. API audit reports zero vulnerabilities. Stable publication remains gated on resolution or an authorized, justified exception. The diagnostic native preview and targeted runtime deployment remain distinct from stable release publication.


Production receipt: API/Web d4de743 is live with old versions retained and six checked recovery snapshots. Native preview [44245479618](https://github.com/Xarber/xcenter-id/actions/runs/44245479618) targets the same source and has all four jobs running. It has not been reported as built or released. Commits dd78ce5 and d4de743 were pushed to testing. Hardware-backed signing was attempted and failed with device-not-found; unsigned commits were used under UADS §36. No main/beta promotion or new distribution publication occurred.

Final 18 November checkpoint: API/Web d4de743 and SMTP diagnostics 8bd6b7c are deployed. Public Chrome signed-out routing passed without JS exceptions; SMTP STARTTLS/verification recipient/relay denial passed; all live databases passed quick_check. The receiver has zero restarts. Both fresh Gmail and iCloud TCP25 probes timed out. First real incoming verification, external sending, mail-client submission/IMAP, complete translation and installed-native verification remain outstanding. No background monitoring is promised; the actual four-job GitHub build is running. Deployment and recovery details are in operations/XCENTER_ID_PRODUCTION.md.


### 18 November administration, app backend and navigation expansion

New requests are ordered below; external direct mail investigation (AUTHN-039) has explicit priority and runs first. The user prefers fully local mail and asks for actionable network remediation rather than automatically introducing a relay. No relay account creation or external provider is authorized by this preference.

| ID | Request | State | Acceptance and next action |
| --- | --- | --- | --- |
| AUTHN-058 | Explain admin controls; verify any user/app; delegate admin; capacity units | Implemented | Labeled accessible controls, server-enforced roles and audit trail, root-admin protection, verification controls independent of developer review requests, KB through TB quotas and formatting. |
| AUTHN-059 | Verified app hosted private database and public data | Implemented | Encrypted app-isolated collections, bounded authenticated writes, revoked app denial, explicit per-record and profile-field publication, anonymous public reads, quotas and management. No arbitrary SQL or automatic publication of existing records. |
| AUTHN-060 | Sidebar plus Account/Apps/Settings/Admin navigation, preferences, icons, progressive editing | Implemented | Shared navigation model; native and responsive web sidebar, main bottom tabs; persistent language/theme, support under Settings, app-icon fallback, samples only under temporary Developer Options; edit buttons or dedicated grouped forms. |
| AUTHN-061 | Developer documentation website | Implemented | Public documentation route for installation, registration and secure integration, hosted-data API and credential boundaries; working links and accurate examples. |
| AUTHN-062 | Verified/admin sender badges in mailbox | Queued | Separate badges only from independently authenticated server provenance; never infer trust solely from From text or copied headers. |

Inspection clarified the third control on the protected administrator's own profile is premium-alias entitlement, while regular-account controls begin with lock, sign-out-all, deletion. Existing icon title attributes are insufficient for touch discoverability.

| AUTHN-063 | Show current Hide My Email state | Queued | Explicit On/Off status for each alias on web/native and clear delivery consequences; make current selected sharing state visible at consent. |
| AUTHN-064 | App-to-app permission toggles during linking and incremental authorization | Implemented | Developer-declared source collection requests, publisher opt-in, exact user consent, live grant checks and unlink/restriction revocation. No decorative toggles. |

Mail network findings: A matches measured outbound IPv4; IPv4 has no PTR. Both local IPv4/IPv6 OUTPUT chains accept traffic. Appliance-interface capture observed 8 outbound SMTP SYN packets and no SYN-ACK; IPv4/IPv6 attempts timed out. Iliadbox Internet and IPv6 configuration were inspected while signed in; no SMTP unblock setting exists in those screens, IPv6 inbound firewall is already disabled. No network/firewall/mail settings changed. The full incoming port allocation and static IP do not establish permission for outbound SMTP. Exact drop location remains unconfirmed. Iliad may need to enable outgoing TCP25 and delegate/configure PTR; this cannot be configured in ordinary forward DNS.

| AUTHN-065 | Per-user external email limits, administrator override/removal | In Progress | Persist UTC day/month counters; external recipients only, default 10/day and 100/month; separate global free-plan ceiling; admin-editable limits and visible usage. Reserve before delivery and retain ambiguous/failed attempt reservations to prevent retry overrun. |

User selected further self-hosting investigation followed by SMTP2GO fallback, then created and signed into the free relay account. Domain verification and protected credential setup are the next mail actions. Receiving and the iCloud apex route stay local/existing.


### Email pause and non-email completion batch

The user explicitly paused email work at 2% reported weekly usage and asked to finish the other items. This pause applies to email implementation, relay setup and email runtime verification, not the whole assignment. The prior request not to stop solely for session usage remains applicable to the remaining authorized batch. Email changes already made are preserved for review; do not activate the external relay while paused.

Relay state: mail.xcenter.it and id.xcenter.it are verified in the signed-in SMTP2GO account; their approved CNAME records were published without changing apex/iCloud MX. hme.xcenter.it was submitted in the browser but its DNS details and verification remain unfinished. No SMTP/API sending credential was created or copied, no relay was enabled, and no external test message was sent. Resume from the Safari verified-sender page.

| AUTHN-066 | Premium Hide My Email address format and dashboard creation | Queued | User clarified that premium aliases must look identical to regular addresses and be creatable at any time from the dashboard. Do not call this implemented: current generated given.surname.random addresses and app-link-only creation do not satisfy it. Reserve the same local-part namespace safely across signup, renaming and alias creation; resume with email work. |

Non-email implementation: dynamic administrator roles and user verification, pending/active app verification independent of DNS activation, KB–TB quotas, encrypted app-owned/user-owned collections with explicit public flags and recipient ACLs, publisher-enabled cross-app collection grants, public profile name flags, mobile sidebar and bottom screens, language/theme preferences, progressive profile editing, private developer sample entry, and developer documentation are being finalized. Source and browser verification and push are the next actions. Native runtime evidence remains outstanding.

APK diagnosis: run 44245479618 built both iOS variants and the Android AAB. The APK was assembled and signed with the expected certificate; the verification parser missed the actual `V3.0 Signer: certificate SHA-256 digest:` prefix and produced an empty observed hash. The parser now accepts the certificate-digest line independently of that prefix, retaining fingerprint comparison. A new native run remains subject to the build start gate.


Non-email verification checkpoint: 28 API tests passed, 4 dashboard regressions passed, dashboard TypeScript and Expo Web export passed, and both workflow YAML files parsed. Isolated 390px Chrome passed persisted Italian/dark preferences, Account/Apps/Settings tabs and admin-only fourth tab, drawer navigation, read-only profile/Edit/Cancel, user verification, 2 GB quota and live role changes, hidden sample entries, and public developer docs. Real registered public clients obtained app_data access tokens; declared source-collection consent granted the intended cross-app read. Wrong-client redemption, replay and app restrict/restore/delete checks passed. Screenshots were visually inspected.

Hosted API tests additionally verify private recipient messaging and withdrawal, no recipient writes/deletes, ciphertext at rest, failed publication-flag tampering, service-key namespace isolation, source-grant revocation and restriction. Physical iOS/Android runtime, physical FIDO2, full accessibility review and changed-code coverage percentages remain unverified. Dashboard audit still fails on the unpatched build-tool picomatch advisory; API audit is clean. No stable publication is permitted by these checks.

Build gate reconciliation: non-email implementation/preparation is complete. Email setup and premium-alias changes are explicitly paused by the user. New native preview is now the next applicable build verification; it will remain a private preview from testing. Production deployment is intentionally deferred because the current source also preserves email behavior changes from before the pause; deploying this combined revision would activate paused email work. Prior production remains d4de743 API/Web and 8bd6b7c SMTP. The next safe rollout must explicitly reconcile the paused email configuration and database migrations, take seven checked database snapshots (including app-data.sqlite after its creation), and retain prior versions.

Final source receipt: feature batch `b6b4f84`, APK parser `65031be` and sparse-checkout fix `2a92156` are pushed to `origin/testing`. Confirmed remote preview [44325257679](https://github.com/Xarber/xcenter-id/actions/runs/44325257679) uses exact source `2a92156e0d3fd4a676c02af112f68720b4e931c9`; Android APK/AAB jobs have started and both iOS variants are queued. Do not infer build completion. Final web export passed. No new production deployment, stable release or distribution metadata publication occurred. All remaining email work stays explicitly paused; native runtime and remote artifact results remain dependent verification.


### Email resumption

The user explicitly resumed all email work. Resume AUTHN-039 and AUTHN-062/063/065/066: finish approved sender-domain verification and protected relay credentials; test external delivery; implement dashboard-created regular-format premium aliases with shared username reservation; finish the unverified-address transfer workflow and sender trust badges; then authenticated external mail-client submission and mailbox access. Production rollout and a fresh native preview follow independent implementation and verification. Preserve the prior email-pause history.


### Resumed mail implementation checkpoint

AUTHN-039/062/063/065/066 are implemented in source with runtime verification outstanding. Thirty API regressions passed, including actual loopback SMTP authentication/sender isolation and TLS IMAP fetch/folder/flag/append/revocation, signed versus forged-header sender badges, competing inbound verification and premium namespace collision/reservation. Dashboard typecheck passed. The user confirmed the external relay test arrived. Mail client public ports and dedicated id.xcenter.it DNS were explicitly approved; DNS is published and router rules await verified saving after a control timeout. SMTP2GO tracking is Off. Existing production source remains d4de743 API/Web and 8bd6b7c ingress until staged rollout passes.

Preview 44325257679: simulator succeeded; iOS device canceled (cause unestablished), APK failed because the script path was relative to android/, AAB still running at inspection. The script now uses GITHUB_WORKSPACE. Reapply the build start gate after current mail preparation, then launch a fresh private preview. No stable release or distribution claim.

Storage inspection: SharedData has about 870 MB free; root about 2.08 GB. No disposable X-Center ID cache large enough to resolve this was found. Another project's temporary build storage is large but has not been altered. Preserve all retained release dependencies and existing backup guard. Targeted checked snapshots can use root; the nightly shared-volume backup guard remains blocked by space. Record rollout-specific recovery evidence before cutover.


Both approved router rules are now saved and visibly Active: TCP465→192.168.1.30:465 and TCP993→192.168.1.30:993, all source addresses. No DMZ or unrelated rule changed. Source checks and preparation for the current batch are complete; the smallest web export is now required for real browser verification and staging. Private native preview follows this integration. Pending hardware/real-mail-client tests and provider/inbound round-trip evidence are recorded dependencies. Existing backup limitation remains explicit.
