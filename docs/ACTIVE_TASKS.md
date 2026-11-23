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
| 43 AUTHN-043 | Preserve horizontal scroll in the compact account navbar | Verified | Replaced by fixed main tabs and a vertical sidebar. Phone-width Chrome verified all four admin tabs fit without horizontal scrolling and the selection updates after navigation. |
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


Mail source 5c3187f is pushed to testing. Both public mail-port rules are saved. Six pre-migration databases plus the new seventh app-data database passed online snapshot quick_check at `/var/lib/xcenter-id-rollbacks/pre-mail-5c3187f.nxq70s3m`. Staged API/OIDC, incoming STARTTLS/support acceptance/relay denial and IMAP/submission TLS passed. Browser alias and mail-client credential flows passed. Thirty API tests passed in the actual Linux image after correcting test-environment prerequisites. Final visual polish wraps long addresses and clears stale reactivation feedback. Old preview is finished: simulator/AAB succeeded, APK failed script location, device canceled; replacement preview follows final preparation.


Production email milestone: API/SMTP/client listeners5c3187f and Webc27d386 are live. Public TLS465/993, exact revision/issuer, anonymous admin/mail denial and external relay→publicMX→support-inbox receipt passed. The user independently confirmed iCloud delivery. First rollout auto-restored prior services because a stale check expected public samples200; corrected hidden-sample404 check passed on retry. Prior containers/proxies and seven checked snapshots retained. Detailed receipt: operations/XCENTER_ID_PRODUCTION.md. Nightly backup remains space-blocked; actual third-party mail client login, external owner verification proof, physical FIDO2/native runtime and full localization remain unverified.

Current implementation and preparation are complete for this mail batch. The next required native verification is a private four-format preview from testing; no stable release/public source publication is authorized by this batch. Physical/runtime checks depend on artifacts/devices, and external mailbox ownership proof requires the mailbox owner. The unpatched dashboard build-tool picomatch advisory continues to fail the stable release gate; the API runtime dependency audit is clean. New build requested explicitly by the user and allowed as a private diagnostic preview.


New private native preview [44335880160](https://github.com/Xarber/xcenter-id/actions/runs/44335880160) is confirmed queued for exact9aa4ee94031b36b575ddc14256682016cb87c999. Four-format results remain pending. [Mail verification report](reports/MAIL_ROLLOUT_2026-11-18.md) records checks and missing evidence. Commits5c3187f/c27d386/9aa4ee9 are confirmed onorigin/testing and unsigned because the configured hardware signing identity was unavailable. No temporary branch/worktree created; unrelated Finder metadata remains untracked.

### Dashboard polish and publication review

| ID | Request | State | Evidence and next action |
| --- | --- | --- | --- |
| AUTHN-067 | Fix app linking, authorizations and developer documentation | Implemented | Isolated Chrome exercised a registered client, code exchange, and visibility in Apps and Permissions. Linked sample apps are visible to their owner, while the public sample directory stays hidden. Apps links to the platform-neutral OIDC and HTTPS API guide. |
| AUTHN-068 | Polish onboarding, profile, controls and identity prompts | Implemented | Four shared introduction steps, row-sized selection controls, profile avatar and age group, and automatic confirmation for mail-client actions and confirmation of a pending username change. Submitting a username change request requires the signed-in session. Broader review of remaining legacy controls and admin prompt flows is open. |
| AUTHN-069 | Improve friends and sharing | Implemented | Ten-character single-use invites, fragment-based links, web/native invitation dialogs and username requests. Existing 32-character invites remain accepted. Profile photos respect public profile settings. Separate file share groups. Verify installed-device sharing and profile-photo rendering. |
| AUTHN-070 | Improve mailbox and private email choices | Implemented | Mail index includes bounded subject, sender and text preview, with a default web sender icon. Composer adds formatting and attachment controls. Consent offers the primary address, verified emails and one Hide My Email choice. Generated aliases are available without premium, custom names are limited to eligible admins, and disabled aliases can be permanently deleted on web. Verify current mail UI and consent choices in production before marking verified. |
| AUTHN-071 | Scrub sensitive history and publish if safe | Blocked | All five remote branch histories were rewritten and verified. Reviewed 18 artifact archives and logs for 10 runs. An authenticated request still retrieved an excluded historical file by its old commit ID after the rewrite. Keep the repo private while GitHub purges retained history. See the [publication review](reports/REPOSITORY_PUBLICATION_2026-11-19.md). |

The earlier native build stopped before runner allocation because GitHub rejected the account's billing setup. No replacement native build was submitted for this batch.

Dashboard follow-up: AUTHN-067–070 source is deployed as 310186a. Isolated Chrome exercised registered-client authorization, linked apps and permissions, onboarding, friend invitation, profile navigation and inline checkbox layout. Thirty-one API tests, four dashboard tests, typecheck and Expo Web export passed. Live discovery, revision and the rendered manual guide passed. A development integration can now be attempted. A real app's callback ownership, token exchange and unlink behavior must still be tested for that app. Native release builds and publication review remain pending.

- App registration management follow-up: developer deletion for pending and active registrations; separate account and global admin inventories; database icon action for eligible apps. Record rollout and browser evidence after verification.
- The installed integration skill and tracked copy cover framework-neutral OIDC and link to the manual developer guide, alongside the optional Expo adapter.

- App management source `8f1fca2` pushed to testing. Isolated phone-width Chrome passed a single scoped admin inventory, database navigation, administrator deletion, and owner deletion of a pending registration. The skill passed its validator and the installed copy matches the tracked version. Production rollout at 18806 stopped during unpack with ENOSPC. The live shared data volume had zero free file entries despite reporting hundreds of MB free. Public revision 310186a and discovery remained available. Next retry staging after file entry headroom is restored.
- External storage extension: add XHDD alongside primary, retain identities and durable routing indexes on primary, report unavailable storage as 503. The admin volume health inventory is implemented as a prerequisite. Remaining placement and volume setup are tracked in [additional volumes](operations/STORAGE_VOLUMES.md). Confirmed 4 TB XHDD hardware exists on the host, but the VM cannot see it and the documented APFS mounts are read-only. Writable presentation and indexed placement are required before allocations are enabled.

- App management and storage health deployed at d595995 after file entry recovery. See [rollout and rollback](operations/XCENTER_ID_PRODUCTION.md). 33 API tests, 4 dashboard tests, typecheck and web export passed. XHDD attachment and indexed placement remain open.
- The installed skill now covers dedicated app storage, per-user records, same-app recipient grants, cross-app consent, public interfaces, and the unsigned-app browser handoff. An isolated Chrome run completed confidential OIDC through a browser-only HTTPS callback, verified issuer/audience/nonce/signature, and tested the fixture product session pickup before completion, with an incorrect verifier, on first use, and on replay. Each integrating backend must implement its own expiring atomic pickup.

### App profile and email verification

| ID | Request | State | Evidence and next action |
| --- | --- | --- | --- |
| AUTHN-072 | Share the standard profile and photo with all signed-in apps | Verified | Chrome completed a registered app sign-in using only `openid`, checked UserInfo and the protected JPEG, and confirmed that anonymous and unlinked access were denied. Email and age stay separately consented. Developer docs and integration skill updated. Production 3faa812 returned 401 to signed-out avatar requests and rendered the updated public guide. |
| AUTHN-073 | Restore email verification and give Check delivery feedback | Implemented | Chrome added an unverified address, submitted a link through an isolated authenticated SMTP fixture, confirmed it in a second tab and saw Verified in the original tab. API tests covered wrong-account confirmation, replay and rejected SMTP submission. Production relay authenticated over TLS. The original mailbox attempt and installed native UI are unverified. |

The web export is deployed. See the [production receipt](operations/XCENTER_ID_PRODUCTION.md). Physical native UI verification depends on an updated installation. Work usage percentages were unavailable.

| ID | Request | State | Evidence |
| --- | --- | --- | --- |
| AUTHN-074 | Make the integration skill perform registration preparation, DNS activation and target-app sync work | Verified | Installed and tracked copies match and pass skill validation. Checked the portal action labels against the dashboard source and the storage and permission instructions against the API contract. The unnamed target app was not changed. |

Usage checkpoint under UADS §0. The five-hour window has 4% remaining and resets on 2026-11-19 at 01:26 CET. The weekly window has 70% remaining and resets on 2026-11-25 at 15:25 CET. The verified local skill update is published to testing as d72aa7c. Next runnable checks after the short-window reset require the target app repository for its integration, the mailbox owner's real verification attempt for production inbox confirmation, or an updated installed native build for native UI validation.

### App and profile badges, permissions refresh and mail controls

| ID | Request | State | Evidence and next action |
| --- | --- | --- | --- |
| AUTHN-075 | Show verified-app, verified-profile and administrator badges and refresh linked-app branding in Permissions | Implemented | One current registry snapshot supplies both linked-app views. Account badges use server state in the dashboard, friend profiles, consent and UserInfo. Phone-width Chrome verified name/icon/description refresh on focus, app and profile badges, and the OIDC role claims. Live discovery exposes the claims. Installed native verification is pending. |
| AUTHN-076 | Hide Check delivery when no verification is pending | Implemented | Shared web/native predicate covers idle, superseded, expired and active requests. Native alias deletion is available after disabling. Isolated Chrome and SMTP fixture verified hidden before request, visible while pending, and hidden immediately after confirmation. Native alias deletion and badge rendering await an installed build. |

Queue reconciliation before the web build under UADS §8. Compact horizontal tab navigation was superseded by four fixed main tabs and a vertical sidebar. Browser verification is next. The XHDD still does not appear as a writable guest disk, so production placement cannot be enabled. Public repository work still depends on historical secret and artifact remediation. Native build verification previously failed at runner allocation. Independent badge and email implementation is ready for an isolated browser run using the web export.

AUTHN-004 follow-up. Added a public offline fallback for non-root dashboard navigation while keeping private API and identity traffic outside the service worker cache. The smallest required build is the web export for a browser disconnect/reconnect check. Native preview [44462753022](https://github.com/Xarber/xcenter-id/actions/runs/44462753022) for dbb1d6c finished with all four jobs failing before allocation. GitHub reported failed payments or a spending-limit problem. The nightly snapshot job resumed successfully on 19 November at 04:22 CET. All seven produced databases passed read-only quick_check.

Latest reconciliation. Production d430aad includes AUTHN-075/076 and the PWA fallback. API tests (33), dashboard tests (6), typecheck, UADS validation, web export, and authenticated fixture browser flows for branding and verification passed. Public revision, offline fallback HTML, service worker, discovery and signed-out restrictions passed. Chromium failed to launch for the final offline disconnect test because the Mac ran out of writable space. The startup and recovery checks for the new worker on a real browser remain open.

Remaining queue dependencies: the XHDD is absent from the guest block-device list, so indexed placement remains unimplemented and unavailable. The next storage action is writable disk presentation followed by indexed placement and disconnect/reconnect tests. Public visibility remains blocked on historical secrets and retained artifact review; GitHub still reports this repository as private. Native preview allocation requires fixing GitHub Actions billing, then rerunning the four jobs and verifying installed devices. PWA update prompts, full installed-device coverage, and broader UADS rollout remain open.

The repository publication assignment is blocked on GitHub server-side cleanup. The four-job native workflow is enabled and ready to dispatch on the sanitized testing branch once public visibility can be enabled safely. The last private run failed at runner allocation due to the account billing or spending-limit check.

GitHub Support displayed a successful submission confirmation for the historical-data purge request. The ticket list had not shown a ticket number at verification. Publication and the native build depend on GitHub completing the purge and a fresh check of the old file URLs.

### Consent requirements and friend import

| ID | Request | State | Evidence and next action |
| --- | --- | --- | --- |
| AUTHN-077 | Show app and developer badges separately, use the developer profile name, and make email and age requirements editable | Implemented | Required claims are enforced by the issuer and managed by the registration owner. Verified developer name edits require review. Phone-width Chrome verified editable requirements, blocked missing scopes and email approval without a selected address, a locked age switch, developer name and separate app badge, and the dashboard button row. |
| AUTHN-078 | Support optional friend sharing and describe the full integration surface | Implemented | Linked app bearer tokens can read accepted friends after independent consent. Same-registration friends can be matched using their pairwise subjects. Chrome verified pairwise subject matching, omission for an unlinked friend, scope denial and revocation. The installed skill was refreshed and validated. |

Build gate. The implementation and fixture preparation for the current consent and Friends batch are ready. A web export is the next prerequisite for browser and deployment checks. The private repository publication and native preview remain pending GitHub support cleanup.


UADS §0 checkpoint on 19 November. The weekly window has 54% remaining and resets on 25 November at 15:25 CET, six days and about three hours away. Its applicable minimum is 55%, with no weekly reset available. The five-hour window has 97% remaining and resets today at 17:23 CET. API tests (34), dashboard tests (6), TypeScript, UADS validation, web export and isolated browser end-to-end checks passed. An earlier hosted-data test returned 503 while the local disk was nearly full and passed on rerun. Next, stage this tested export and API on 18811, take and verify the seven production snapshots, test discovery and anonymous Friends denial, then cut over from d430aad with rollback retained. Production remains on d430aad. Installed native behavior remains unverified.

### Persistent app sessions and Expo account overview

| ID | Request | State | Next action |
| --- | --- | --- | --- |
| AUTHN-079 | Keep linked app sessions active and renew on activity | Queued | Implement short-lived access tokens plus client-bound rotating refresh tokens with a rolling 14-day idle expiry. Cover single-flight refresh, replay, revocation and relinking. Preserve independent first-party dashboard sessions. |
| AUTHN-080 | Add a configurable Expo account overview and update the integration skill | Queued | Reuse the account design and secure system-browser sign-in. Show the photo, identity and badges, allow host-owned sync and settings sections, and link to full account management. Document secure browser sign-in, code exchange and refresh in the repository and installed skill. |
| AUTHN-081 | Deploy the consent and Friends release together with the session update | Queued | The user ordered deployment after the session work. Verify the whole batch with an isolated issuer and browser, then stage the deployment with rollback and production checks. |

19 November usage checkpoint. The five-hour window has 94% remaining and resets at 17:23 CET. The weekly window has 53% remaining and resets 25 November at 15:25 CET, just over six days away. The applicable minimum is 55%, with no weekly reset available. Source inspection confirmed a ten-minute relying-party OIDC access token, no registered refresh grant, and a separate twelve-hour first-party account session. New implementation and deployment are paused. Resume with AUTHN-079 when usage permits or the user explicitly overrides the checkpoint.

The user explicitly overrode the weekly checkpoint for AUTHN-079 through AUTHN-081. The five-hour checkpoint still applies. The issuer supports opt-in 14-day rolling refresh, with 10-minute access tokens, client binding, encrypted renewal and reuse revocation. The Expo package includes a host-configurable account overview and the tracked skill covers the preferred secure browser and session handling. The isolated refresh flow passed. The next build is the web export for final combined regressions and deployment. The native preview still awaits the separate repository publication dependency.

AUTHN-077 through AUTHN-081 are deployed as 5ddcb7a. Isolated consent, Friends and rolling-session flows passed, and production discovery and anonymous restrictions were verified. The tracked and installed integration skill both document the complete flow. The Expo overview passed package typecheck and React Native Web rendering. Physical native UI and the existing publication/build dependency remain open. The one-batch weekly checkpoint override ends here. See the [deployment receipt](operations/XCENTER_ID_PRODUCTION.md).

### Storage navigation, developer identity links and consent management

| ID | Request | State | Next action |
| --- | --- | --- | --- |
| AUTHN-082 | Align action groups and keep app storage navigation in its originating section | Implemented | Consolidated actions at the row end and kept storage return origin separate from admin role. Pending browser verification of both entry paths. |
| AUTHN-083 | Show a GitHub profile link for developers | Implemented | Stored an optional validated GitHub profile URL, with verified status reset when identity changes. Added portal display and admin review link. Pending browser verification. |
| AUTHN-084 | Manage app consent and confirm returning sign-ins | Implemented | Added first-party linked permission controls and explicit repeat consent. Isolated API tests passed owner, required permission and optional scope cases. Pending full browser and installed native checks. |
| AUTHN-085 | QR and short-code approval for input-constrained devices | Implemented | Added OAuth device authorization for confidential registered apps, manual and QR entry, native scanner, and integration skill instructions. Isolated tests passed token binding, repeat consent, cancellation, code replay, and scanner URL validation. Pending real browser and native camera checks. |
| AUTHN-086 | Separate user app data from service storage | Implemented | User-owned records now count toward the account quota and list under account app containers. Service DB quota counts service-owned records. Isolated tests passed quota and owner separation. Pending live storage page check. |
| AUTHN-087 | Styled account mail and app security notices | Implemented | Added multipart HTML templates and security notices for linked, changed, and unlinked apps. MIME, escaping and support regressions passed. Pending rendered mailbox and real delivery verification. |

19 November usage checkpoint. The weekly window has 47% remaining and resets on 25 November at 15:25 CET. Between now and 19 November at 15:25 CET, the 55% minimum applies and no reset is available. The five-hour window has 52% remaining and resets at 17:23 CET. The previous override applied to the completed session and overview batch only. Investigation confirmed the storage return link uses the user's administrator role to choose its destination. The next implementation is to separate route origin from that role and cover both storage entry points before moving on to developer identity and consent.

Batch source validation passed 38 API tests, seven dashboard tests, dashboard TypeScript, UADS manifest validation and skill validation. Production and native builds remain pending. Next, export the eligible web candidate and run the isolated browser flows for storage navigation, GitHub profile, browser and device sign-in, and mailbox notices before staging production with rollback.

19 November UADS §0 checkpoint. The five-hour window has 9% remaining and resets at 17:23 CET on 19 November. The weekly window has 40% remaining and resets at 15:25 CET on 25 November. The batch-only override cannot override the five-hour pause. Implementation and source evidence are pushed at `632861f` on `origin/testing`. Resume by checking both windows, exporting the dashboard, exercising QR and manual authorization against the actual isolated browser route, and validating activity messages and both storage back links before a staged production cutover. The production website and native distribution remain pending.

The user requested immediate production deployment and took over feature testing. AUTHN-082 through AUTHN-087 are live in web/API revision `b4ca80c49ccd6a4b2c6c70d13b1fce58668b1067`. Production checks covered verified backups, deployment revision, service startup and public issuer routes. Feature acceptance and installed native verification remain open. See the [production receipt](operations/XCENTER_ID_PRODUCTION.md#account-storage-and-device-sign-in).

### Device navigation, app access, mail clients and account SDK

| ID | Request | Status | Next action |
| --- | --- | --- | --- |
| AUTHN-088 | Repair device back navigation, sidebar, returning OIDC form and read-only linked email | Implemented | Verify actual browser POST origin and signed-out device links. |
| AUTHN-089 | Remove user-owned app data on unlink, remove misleading file-browser link and show capacity editing only from administration | Implemented | Verify owner/app separation, including service-owned records and unrelated user records. |
| AUTHN-090 | Developer-managed OAuth client credentials | Implemented | Add recent-authenticated renewal and revocation. Keep app registration and subject IDs stable. |
| AUTHN-091 | Shared mail-client settings UI and Spark reconnect investigation | Implemented | Verify production TLS and service status, then review credential lifetime and rate limiting. |
| AUTHN-092 | Private apps, approved membership and access requests | Implemented | Enforce membership across authorization, token exchange and existing app access before exposing owner controls. |
| AUTHN-093 | Self-contained account overview and host customization | Implemented | Add SDK sign-in states and secure browser integration hook, followed by account and app links and sign-out. |
| AUTHN-094 | Unverified local/custom installations and cross-data trust settings | Implemented | Design restricted app identity independent of DNS proof, explicit warnings, and source-owner trust policy enforced on reads. |

AUTHN-088 through AUTHN-093 source implementation checkpoint. The live IMAP and SMTP ports answered with a valid TLS certificate, and the mail-client container reported zero restarts. Source and tests identified a reconnect rate-limit issue and no password expiration. Local TypeScript and all 38 API tests passed. Native developer management links to the authenticated web portal. Full browser/device verification, Spark compatibility and production rollout remain open.

AUTHN-094 implementation note. A DNS-free registration must be a separately identified registration with an exact loopback callback and PKCE or a confidential backend using device authorization. The issuer must label it before consent and keep its credentials and subjects separate from verified registrations. Keep default publisher policy secure registrations, allow a stricter verified-only policy, and require explicit publisher opt-in and consent warnings before permitting a DNS-free registration to read cross-app records. Apply that policy to both permission mutation and every subsequent authorized read. The registry, developer portal, consent warning and hosted-data policy are implemented. API tests verify secure-by-default, the publisher opt-in and verified-only exclusion. Real browser and native verification remain pending.

Follow-up deployment receipt for AUTHN-088 through AUTHN-094. Production web, API and TLS mail-client service use `f465477`. Expo web export, Chrome mobile device-page return and sidebar layout, actual browser issuer form consent, returning email picker absence, the refresh lifecycle, 38 API tests, seven dashboard tests, TypeScript, UADS declarations and integration skill conformance passed. Local registration and trust settings have API coverage. Actual Spark setup, Velunivo production login with a user account, and the installed native/SDK screens remain pending user acceptance.

### Mail credential notice, sign-in polish and release history

| ID | Request | Status | Next action |
| --- | --- | --- | --- |
| AUTHN-095 | Restore the generated mail password to its notice and add icon-only copy controls | Queued | Keep the password out of the connection table. Inventory visible codes and credentials, then reuse accessible clipboard controls on web and native. |
| AUTHN-096 | Email OTP autofill and independent sign-in loading states | Queued | Trace browser, Expo and SDK sign-in forms. Verify phone autofill hints and that OTP, username and passkey buttons reflect only their own pending actions. |
| AUTHN-097 | Put Mail clients beside Create private email address and fix mailbox spacing | Queued | Update both mail views and verify the toolbar at phone widths and when the alias form opens. |
| AUTHN-098 | Remove the top divider on the first mail-access settings row | Queued | Locate the divider selector and remove the leading border without affecting separators between later settings. |
| AUTHN-099 | Write a changelog and assign UADS versions across project history | Queued | Reconcile the complete Git log with deployment receipts and any GitHub releases. Distinguish historical version assignments from releases that were actually published. |
| AUTHN-100 | Investigate Spark's failed second sign-in and server-supplied name and avatar | Queued | Compare reconnect authentication and protocol behavior with an isolated mail credential. Check what user identity and avatar metadata Spark can consume before exposing any profile information. |

UADS §0 checkpoint at 18:24 CET on 19 November 2026. Weekly usage remaining is 33%, below the 35% minimum for the 25 November 15:25 CET reset, with no reset credit available. The five-hour window has 65% remaining. The prior rollout override ended with that rollout. The new requests are recorded above and implementation resumes at AUTHN-095 when the usage gate permits. Production remains on `f465477`.

| ID | Request | Status | Next action |
| --- | --- | --- | --- |
| AUTHN-101 | Show signed-in user and app developer in separate consent sections | Implemented | Isolated issuer check verifies distinct sections. |
| AUTHN-102 | Add direct administrator verification for developers | Implemented | Test verifies registered developers are listed and can be verified before requesting review. Developer and user badges remain independent. |
| AUTHN-103 | Replace the private-app friend picker with a searchable list and switches | Implemented | Verify on a mobile-width account page with accepted friends and exact username search. |

Batch override authorized on 19 November. AUTHN-095 through AUTHN-100 source work and 0.12.0 history implemented. Isolated TLS IMAP test reconnects with the same credential and reads the same mailbox using another authentication mechanism. Spark acceptance and installed native OTP AutoFill remain to verify.

AUTHN-095 through AUTHN-103 web/API and mail-client changes are live in 0.12.0 revision `418f89c`. Chrome at phone width verified icon-only copying from the one-time password notice, independent username progress, OTP field and numeric paste, the mailbox link and settings divider, private-app friend and username switching, separate consent sections and version history including one-time update highlights. API and dashboard suites passed 39 and seven tests. UADS manifest and TypeScript passed. The changelog appendix covers every source commit through the implementation revision. Isolated TLS IMAP verified reconnect and continued mailbox access with the same password. Native installed UI, OS-supplied email OTP suggestions and Spark's actual reconnect remain unverified. See [production receipt](operations/XCENTER_ID_PRODUCTION.md#dashboard-0120-and-mail-reconnect-compatibility).

### AUTHN-104 · Preferred account overview and secure sign-in completion

Implemented under the user's final one-batch usage override. The integration skill recommends one AccountOverview in Settings, mandates ASWebAuthenticationSession on iOS, and documents verified callback and backend pickup completion. Expo SDK 0.3.0 adds managed iOS backend pickup with automatic sheet dismissal and a managed same-origin HTTPS website redirect. Eleven dashboard tests, the freshly packed SDK typecheck and skill validation passed. Installed iOS and Android behavior and an actual relying-party browser redirect remain unverified.

### Native dashboard parity and standalone public SDK

| ID | Request | State | Next action and verification |
| --- | --- | --- | --- |
| AUTHN-105 | Match the mobile web dashboard on native, especially Administration, and preserve native features | Implemented | Native Overview and Administration source in `48d0420`. Added bordered groups, row dividers, restored status colors and the profile hero, and included web Administration inventory controls. Dashboard TypeScript and eleven tests passed. Native preview and installed iOS/Android checks remain. |
| AUTHN-106 | Publish reusable X-Center ID modules in a separate public GitHub repository and update the integration skill | Implemented | [Public SDK](https://github.com/Xarber/xcenter-id-sdk) tested source `816b0f3` covers Expo, SwiftUI, Compose, Flutter, HTML and Next.js/Vercel. Browser, Node, Swift macOS and iOS Simulator compilation, Android library compilation, Flutter analysis and widget tests passed. Real registered-device sign-in remains to verify. |

20 November checkpoint under UADS §0. Weekly usage had 21% remaining, with no reset credit and a 35% minimum until the reset moves to under five days away. The weekly reset is 25 November at 15:25 CET. The five-hour window had 84% remaining, with a reset at 15:15 CET on 20 November. The prior one-batch override has expired. Resume by rechecking both limits, then compare mobile web and native Administration for AUTHN-105. No implementation, build, or SDK publication began in this checkpoint.

The user overrode the usage gate for this assignment on 20 November. The standalone SDK was created from a fresh Git history with reviewed source, branding and synthetic tests. Its integration skill is also installed locally and maintained in both repositories.

Verification links for AUTHN-105 and AUTHN-106 are in the [native dashboard and SDK report](reports/NATIVE_DASHBOARD_SDK_2026-11-20.md). The dashboard's first run was rejected before setup. After anonymous verification showed the repository was public, a second preview was dispatched from `fdde5ca`. A native install is still required to verify presentation and real account actions.

### Consent presentation and app file access

| ID | Request | State | Evidence and next action |
| --- | --- | --- | --- |
| AUTHN-107 | Add a still night background and group cross-app permissions by linked source | Implemented | Static consent art and source-linked consent and resource checks. Isolated issuer tests cover linked and unlinked source states. Rendered phone scrolling remains to verify. |
| AUTHN-108 | Register and test an actual app requesting two Velunivo exports | Blocked | Private pending **Velunivo Consent Test** registration created under the signed-in developer account. Host its HTTPS callback and publish the portal DNS challenge, activate it, configure both requests, and separately approve access for the live test. Isolated issuer verified `recent-neighborhoods` and `ride-insights`. |
| AUTHN-109 | Add delegated owned-files read, owned-files read/write, and shared-files read | Implemented | Scoped resource and consent tests cover isolation and revocation. Authenticated native and web host flows remain to verify. |
| AUTHN-110 | Show read-only app data folders in Files when the verified developer opts in | Implemented | Storage tests cover owner-only browsing, download, mutation denial and opt-out. Installed dashboard testing remains. |
| AUTHN-111 | Remove legacy AuthNJS from the current source | Verified | `16512dd` removes tracked retired files. Its parent retains the original tree. See [verification report](reports/CONSENT_AND_RETIRED_TREE_2026-11-23.md). |

23 November checkpoint at the user's direction. Five-hour usage was 4% remaining, with reset at 16:09 CET on 23 November. Weekly usage was 85% remaining, with reset on 30 November at 11:09 CET. The legacy cleanup is on the default branch as `8df94c4`, with history preserved.

AUTHN-112 · **Implemented.** Active registered apps can use private user-owned records with a linked user grant and `app_data` before app verification. Service database keys, public publication and cross-app publishing still require verification. Focused hosted storage and issuer tests passed after this correction. Next action is to run full checks for the correction, sync the standalone SDK documentation and scope allowlist, and resume the pending production test app's DNS and callback setup when access is available. No feature deployment or new native build was started.

### Devices, Files and integration icon guidance

| ID | Request | State | Evidence and next action |
| --- | --- | --- | --- |
| AUTHN-113 | Dedicated native device sign-in with opt-in QR scanning and six web/native code slots | Implemented | Local issuer confirms one code input and six visual slots. Native requires a review action and the issuer still requires approval. Installed-device camera and layout verification remain. |
| AUTHN-114 | Show app container icons and usage and limit content editing to the developer's own account | Implemented | Files, Data usage and admin show icon and usage. First-party routes enforce verified publisher ownership, opt-in and user link. See hosted storage tests. |
| AUTHN-115 | Finder-style Files with upload icon, multiple uploads and inline create/rename | Implemented | Native and web changes, with owner and content-preservation API tests. Verify chooser, keyboard, layout and accessibility on installed devices and browser. |
| AUTHN-116 | Make the real app icon a high-priority recommendation in the integration skill | Implemented | Registration guidance prioritizes the product's real icon and leaves it optional. Local and repository skill copies updated. |

Follow-up for AUTHN-108 and AUTHN-113–116. The live test registration is already active and verified, and the public issuer accepts its authorization start. Confirm the developer passkey to save the two requests, then verify the saved state before attempting live consent. The registered HTTPS callback still returns 404. Local 390-pixel browser checks passed for the Files workflow and the issuer's code form. iOS and Android bundles exported successfully. Installed-device verification remains open. See [verification report](reports/DEVICE_FILES_2026-11-23.md).

### Reopen consent settings, refresh native sign-in and release

| ID | Request | State | Evidence and next action |
| --- | --- | --- | --- |
| AUTHN-117 | Reopen and redo the live Velunivo Consent Test settings | Blocked | Both requested collections were entered and Save was submitted in the live portal. The browser is awaiting the developer passkey. Verify persistence after confirmation. The registration is active and verified. The callback previously returned 404. |
| AUTHN-118 | Refresh the native sign-in screen with a subtle, slowly animated night background | Implemented | Native sign-in preserves the existing form, adds a fixed background and pauses its subtle opacity animation when inactive or Reduce Motion is enabled. Source checks pass. Verify layout and input behavior on an installed build. |
| AUTHN-119 | Deploy the updated app and start the native build | Verified | Web/API revision `fcea370` is live and passed the staged and public checks. [Native preview 45264711602](https://github.com/Xarber/xcenter-id/actions/runs/45264711602) is running all four jobs from the same commit. Check artifacts and native runtime after completion. |

23 November usage checkpoint under UADS §0. The five-hour window has 7% remaining and resets at 21:45 CET on 23 November. The weekly window has 70% remaining and resets at 11:09 CET on 30 November. No portal mutation, new implementation, production deployment or build started for this follow-up. Resume with AUTHN-117 and AUTHN-118 before the release gate.

### Onboarding and release history

| ID | Request | State | Evidence and next action |
| --- | --- | --- | --- |
| AUTHN-120 | Apply updated UADS §§16, 37, 40 and 44 to onboarding and past changelogs | Implemented | Added full-screen replayable tours, concise archive cards, per-version links and Developer Mode Git notes. Chromium exercised desktop and mobile with a synthetic account. Native capture, runtime checks and stable release evidence remain pending. |

[Verification report](reports/ONBOARDING_RELEASE_HISTORY_2026-11-23.md) records production, preview and screenshot evidence.
