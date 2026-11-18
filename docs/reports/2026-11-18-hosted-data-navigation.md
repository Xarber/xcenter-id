# Administration, navigation and hosted data

## Scope

This batch adds visible names and explanations to admin icon actions; live administrator delegation and user verification; pending/active app verification independent of callback activation; account and app quotas with B–TB display; encrypted app/user JSON collections, public records and recipient sharing; publisher-defined app-to-app data requests and consent; opt-in public profile fields/photo; web/native grouped navigation and settings; progressive profile/app editing; app-icon fallbacks; hidden sample entry; and a public developer integration guide. It extends the native authorization adapter with supported scopes, a pre-created transaction nonce and explicit incremental consent.

The current SDK is distributed as a package archive from an authorized checkout, not a public npm release. The hosted database does not offer arbitrary SQL, executable backend functions, indexed search or push notifications. Private messaging can use recipient ACLs and authorized polling.

## Verification performed

- 28 API tests passed on Node24/macOS. New tests exercise roles, operator-root protection, user verification, 2 TB logical account quota, profile privacy, app/user/service-key isolation, stale writes, private/public records, recipient sharing/withdrawal, grant revocation, restriction, ciphertext and publication-flag tampering.
- Four dashboard tests passed, including B/KB/MB/GB/TB formatting and missing Intl constructors.
- Dashboard TypeScript passed, including native sources and shared SDK changes.
- Expo Web export passed.
- UADS structural validation passed for 16 existing declarations and references. This is not full compliance.
- Both workflow YAML files parsed in the existing temporary Python environment.
- Actual failed-run APK output was parsed with the corrected maintained awk script. It produced the exact expected SHA-256 certificate fingerprint. A new native build must validate its own artifacts.
- Isolated HTTPS issuer, Chrome virtual passkeys and 390px viewport: in-session browser/native confirmation; cross-account denial; visible admin controls and fallback avatar; grouped profile Edit/Cancel; persisted Italian and dark preferences; sidebar and main tabs; live administrator grant/removal without logout; user verification; 2 GB quota; hidden sample listings; public developer documentation.
- Two registered public clients used actual OAuth authorization and access tokens. The destination consent page displayed the source collection request; selecting it authorized the intended app-to-app read. Wrong-client code redemption, replay, and registration restriction/restoration/deletion remained protected.
- Compact dark profile screenshot was visually inspected. Desktop authenticated behavior uses the same web components but lacks a new separate wide-viewport screenshot in this batch.

## Known limits and paused work

No installed native execution, physical FIDO2 key, complete screen-reader/dynamic-text audit, measured performance benchmark or changed-code coverage percentage is claimed. The dashboard dependency audit remains failed on the unpatched picomatch build-tool advisory; API dependency audit reports zero vulnerabilities. Stable publication remains gated.

The user explicitly paused email work. Existing mail changes made before the pause are preserved in source: unverified-address storage and account-bound inbound transfer proof, conservative persistent external limits, and authenticated sender badges. Their remaining integration/production verification, SMTP2GO credential setup/activation, outbound test delivery, SMTP client submission/IMAP and premium alias creation remain pending. The service receiver is already event-driven; it does not require a new mailbox polling job.

SMTP2GO verification completed for mail.xcenter.it and id.xcenter.it, with approved records. hme.xcenter.it registration was submitted but its DNS/verification remains unfinished. No relay credential was created or copied and no outgoing test was sent. The apex iCloud MX remains unchanged. Premium aliases still need the newly requested regular-address format and dashboard creation workflow.

Source work is integrated on testing. No main/beta promotion or public release is part of this batch. Production remains API/Web d4de743 and SMTP 8bd6b7c; this combined source is not deployed because it includes paused email behavior changes. The next rollout must reconcile that pause, stage safely, verify online recovery snapshots and include the new app-data.sqlite database in backup/restore.

## Documentation and traceability

HOSTED_DATA.md describes the data model, interfaces, encryption, ACLs, quotas and residual risks. NAVIGATION.md describes native/web behavior and preferences. INTEGRATION.md, API.md, SUPPORT.md, SECURITY.md, TESTING.md and ACTIVE_TASKS.md are updated. Machine-readable performance targets and private release metadata were added without inventing measured results. Relevant UADS subjects are SEC-001/002, PLAT-001, UI-001/002/003, QA-001, DOC-001, REL-001 and OPS-001; manifest-wide states remain pending.

No temporary Git branch/worktree was created. Existing untracked .DS_Store files were preserved and excluded. Commits are unsigned because the hardware signing key was unavailable; no shared history was rewritten.

## Git and preview receipt

Feature commit b6b4f84 and CI fixes 65031be/2a92156 are pushed to testing. Native preview [44325257679](https://github.com/Xarber/xcenter-id/actions/runs/44325257679) was submitted and verified against full source 2a92156e0d3fd4a676c02af112f68720b4e931c9. Both Android jobs started; both iOS jobs were queued at the receipt. This is a running private preview, not successful build or release evidence. The earlier run's successful artifacts remain preserved. Production and email remain unchanged by this checkpoint.
