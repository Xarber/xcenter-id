# Admin, support and incoming verification batch

Source: d4de743 API/Web; 8bd6b7c SMTP diagnostic follow-up. Profile: web/native account manager and backend identity service.

Implemented and deployed: in-session passkey confirmation with bounded admin authorization; icon actions and avatar fallback; per-user details, registered-app restriction/deletion and mailbox warnings; restricted support-only sign-in and replies; temporary mailto verification at verify@mail.xcenter.it; account count formatting without unsupported Intl.PluralRules. The Integrate X-Center ID skill was installed and its canonical source committed.

## Evidence

- API: 24/24 Node tests, including signed SMTP proof, ownership and moderation, passed on macOS and the production Linux image. The logging follow-up passed the same 24 tests locally.
- Dashboard: 3/3 tests, TypeScript and Expo Web export passed.
- UADS structural validation: 16 declarations and references passed using the existing jsonschema Python environment. This is not full compliance.
- Skill Creator validator passed. Independent skill review clarified native versus confidential backend registration and app isolation.
- Isolated 390px Chrome: in-session browser/native identity confirmation, cross-account denial, fallback avatar, user details and warning, locked support-only passkey login, reply history, descriptive mail draft, code redemption isolation/replay, app restrict/restore/delete passed.
- Actual public Chrome: signed-out landing and guarded reauthentication route passed without JavaScript exceptions. Authenticated production flows were not exercised with synthetic accounts.
- Live exact revision, discovery, anonymous Admin denial, both sample roots and protected verification routes passed. SMTP public STARTTLS, service recipient and relay denial passed without sending production mail. Six SQLite snapshots and six live database quick_check results passed.
- API dependency audit: zero vulnerabilities. Dashboard audit fails on unpatched picomatch GHSA-fc5q-39xc-vjpf; stable-release gate unresolved.

## Platform and release limits

Native preview 44245479618 targets d4de743 with unsigned iOS device, iOS Simulator, universal Android APK and Android AAB jobs running. No new build success, physical-device use, release publication or distribution-source update is claimed. Physical FIDO2 verification is outstanding. The Hermes fix has source regression coverage but awaits a new installed native binary.

External outgoing TCP25 to both Gmail and iCloud timed out. First real external incoming verification remains untested. Authenticated SMTP submission and IMAP are unfinished. No full localization, full accessibility audit, performance budget evidence or complete UADS compliance is claimed.

## Relevant requirements

UADS-SEC-001/002: targeted authentication, authorization and mail trust-boundary tests passed; full security verification pending. UADS-QA-001: focused source checks passed, dashboard dependency gate failed. UADS-PLAT-001: web exercised, native runtime pending. UADS-OPS-001: staged rollback and actual production probes passed; continuous monitoring and off-device recovery remain incomplete. UADS-DOC-001: project context, queue and operational evidence updated. Manifest-wide states remain pending rather than inferring compliance from this batch.

Git: skill dd78ce5 and feature d4de743 pushed to testing; diagnostic/receipt 8bd6b7c pushed. Hardware-backed commit signing failed with device-not-found; unsigned commits used under UADS §36. No history rewrite, promotion or public publication. Unrelated local .DS_Store files preserved and excluded.
