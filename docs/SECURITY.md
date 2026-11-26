# Security findings and storage design

The static review covered the legacy file save, upload, move, remove, list and download handlers, shared permissions, session lookup and encryption helpers. Historical keys and account records were left in place. No legacy endpoint was exercised.

| Finding | Evidence and impact | Current protection |
| --- | --- | --- |
| Unreliable path confinement | The legacy handlers concatenate request-derived values into filesystem destinations after selective string removal. Move also builds a second destination and upload uses an original name. The code lacks a uniform containment check anchored at the authorized directory. The impact is potential access outside the selected app or account namespace. | The legacy listener was retired. The current service never interprets app-provided record identifiers as filesystem paths. |
| Mixed trust and permissions | Legacy linking accepts app claims from caller inputs and permissions are checked independently inside handlers. Session metadata can be updated before the app credential is checked. | The replacement verifies issuer, token audience and registered client, then scopes prepared statements to the authenticated account and app. |
| Legacy storage may contain plaintext | The legacy helper compresses content when encryption is omitted. Other branches use unauthenticated CBC with externally managed IVs and fallback behavior. The password verifier decodes stored passwords. | The replacement stores only new synthetic or authorized data. It never loads the legacy password or key data. |
| Request-driven key mutation | Legacy handlers write a caller-provided custom key to a live key file and restore it later. Parallel requests or interruption can leave confusing state. | The replacement loads one managed key at startup, outside request control. Each record uses a fresh nonce and authenticated context. |

## Encryption boundaries

Saved-place payloads use a versioned AES-256-GCM envelope with a fresh 96-bit nonce and a 128-bit tag. Authenticated context includes account, source app, dataset, record ID and revision. Moving ciphertext between records or using a different key fails authentication. Schema version, owner and app IDs, grants and revisions remain relational metadata. Restrict filesystem access and encrypt database volumes and backups when that metadata needs confidentiality. This is server-side encryption at rest. The service can read authorized payloads. Key rotation, key version custody, disaster recovery and metadata encryption require completion before production.

The legacy code and pages are retained in Git history. Treat private historical backups as restricted material. Before a live migration, determine whether any historical key, session, account record or archive remains sensitive or in use. The account artifact provenance and exploitability of the original handlers were not established by this review.

## Native and app-link trust boundaries

Browser account cookies and device bearer sessions use separate credential handling. The app receives a browser handoff only after approval on X-Center ID. An intercepted handoff code cannot be exchanged without the app verifier, and the exchange requires the same state. The code expires after one minute. Native sessions retain the original browser session expiration and can be revoked in Devices. The app stores its session in device-only SecureStore. Email codes are generated with system randomness, stored as keyed digests, rate-limited, expire after five minutes and can only be used once in the originating channel. Temporary account sign-in code and native handoff requests never grant a third-party app account-management privileges. Username lookup intentionally reports whether the requested identifier exists.

External samples use distinct OAuth clients and origins. The identity provider permits consent form redirects only to the exact registered app origin. Disconnecting an app revokes its mapped provider grants and denies previously issued grants at account and data access boundaries. Staged checks covered verifier mismatch, replay, owner-scoped file storage, app unlink, relink and isolated sample sharing. Physical device and mail transport verification remain separate.

## Dashboard dependencies

The dashboard uses a scoped npm override to update the Expo fingerprint tooling's `minimatch` dependency to 11.0.1. The 17 November dependency audit identified a moderate denial-of-service advisory in the dependency tree. After updating, a clean install, dashboard audit, typecheck, unit tests, Expo compatibility check and local fingerprint generation passed. The API audit also reported zero known vulnerabilities. Keep the override until the upstream fingerprint package adopts a patched version. [GitHub Security Advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)

## 18 November trust-boundary changes

Administrator read and write routes require a confirmed administrator session. WebAuthn confirmation is scoped to the current session and enrolled account credentials. Native confirmation uses a short-lived, single-use, session-bound request and rejects a different browser account. Locked users receive support-only sessions, with separate authorization for requests and their own support history. App restrictions are checked by the registry, issuer and resource routes. Browser QA exercised wrong-client code exchange, replay and registration restriction.

Inbound address verification requires raw-message DKIM and DMARC checks and the pending code, with atomic final assignment. See the mail runbook for provider assumptions and conservative compatibility limits. Raw Authentication-Results headers are untrusted input. Mailauth is pinned to 8.1.0. The API dependency audit passed after installation.


### 18 November dependency audit limitation

The dashboard npm audit reports high-severity picomatch ReDoS, GHSA-fc5q-39xc-vjpf / CVE-2026-112366 (upstream advisory updated 17 November). Its affected range includes the newest published 4.0.7; no patched release was available at inspection. Expo/Metro and their build-time glob callers propagate the finding. No forced React Native downgrade or audit bypass was applied. The production API dependency audit is clean. This is an unresolved stable-release quality gate, not evidence that arbitrary production requests can execute glob patterns. Recheck upstream remediation before stable publication.


## Hosted data and privilege expansion (18 November)

The new hosted-document interface is restricted to active verified registrations. User access uses provider-validated opaque OAuth tokens with app_data; service keys are separately hashed, app-specific and never become account-manager sessions. SQL statements are parameterized, identifiers are bounded, payloads/ACLs/quotas are enforced, and a low-disk guard protects the host. AES-GCM binds the app, owner, collection, record ID, revision, publication flag and reader ACL. Shared/public IDs use app-bound HMAC identifiers rather than exposing the stable account ID.

Recipient sharing permits reads only. Cross-app access additionally needs publisher collection opt-in and an exact user grant; it excludes another user's records and incoming private messages. Unlink and publisher withdrawal revoke applicable grants. Account/app restriction checks are evaluated server-side, independently of navigation visibility. The threat model includes forged client IDs, stolen user tokens, backend-key leakage, row/ACL tampering, cross-user enumeration, stale writes, malicious JSON and quota exhaustion. Native callback ownership and physical key verification remain separate required evidence.

Public profiles default to private and publish only chosen name/photo fields. Verified email and exact birthday remain excluded. Dynamic administrator delegation requires recent authentication, origin validation, protected-root checks and audit records. A hidden Developer Options gesture is not used as a security boundary.

Mailbox and relay changes made before the explicit email pause are preserved in source, but relay activation and remaining email-specific verification are paused. Sender badges are based on server provenance or independently validated aligned DKIM/DMARC, never From text or supplied Authentication-Results. The receiver update is not considered deployed merely because its source exists.

## Delegated files and read-only app folders

The account file resource accepts only bearer tokens issued for active registered clients. File access intersects the token scope with the current account grant. Dashboard cookies, app storage credentials and linked app badges do not grant file API access. A write grant allows permanent removal of owned files. It cannot update a friend's files or confer file-sharing access. Incoming share reads require both the independent shared scope and a still-active share and friendship. Existing opaque file IDs remain owner-scoped. Uploads still use authenticated storage envelopes, quota checks and bounded parsing. The Files browser's read-only app folders require a first-party account session, publisher ownership for the visibility setting, active verification, and the viewer's own app link. The viewer can export only their own app records. Cross-app data access verifies the publisher link both when saving consent and when serving data.

A visible app container only reveals its name, icon and space charged to the signed-in account. The record route independently checks the developer's identity, ownership of the registration, opt-in, active verification, and the signed-in account's own app link. Admin access to another account's usage does not grant access to its records. Dashboard edits require account mutation intent and an exact revision. New records are private. Existing public and recipient settings are preserved when editing content.

## Transfer and account lifecycle boundaries

Upload reservations and published metadata use the same SQLite database. Chunk authentication binds each encrypted segment to the immutable owner, file identifier, size and offset. Commit verifies the owner, folder and quota again. The API limits each request body to one segment and checks physical disk headroom. Legacy encrypted envelopes remain readable. Account moves change scoped metadata and preserve record access and share identifiers.

The browser account switcher resolves only opaque, current sessions in its Secure, HttpOnly, SameSite cookies. Selection requires the first-party origin and intent header. Native saved sessions are protected by device-only credential storage, and switching unmounts the prior account’s screen state. Deletion requires freshly confirmed identity and the active username. A committed tombstone prevents authentication and public record visibility before retriable cleanup. Protected backups retain their scheduled retention policy. Reserved usernames and mailbox addresses stay reserved to prevent impersonation. The service records already shared with another recipient, such as a delivered email, follow the recipient’s retention policy.

Hosted account selection is scoped to an active issuer interaction and first-party POST. Consent submitted for the previously displayed account is rejected after a switch. The native admin confirmation URL carries a short-lived, single-use request for the app session. Browser cookies do not select which passkey can verify it. A successful WebAuthn assertion must belong to the requesting native account and elevates only that app session.

Manual callback approval requires a recently confirmed administrator and an exact callback list. The administrator verifies ownership out of band. The service does not fetch the supplied URLs. Activation rechecks the current list and approval after provisioning, discards the new client on conflict, and exposes credentials only to the confirmed registration owner. Browser CORS for public resources and delegated file APIs permits cross-origin reads or bearer-token requests as appropriate, with dashboard cookie routes outside that policy.

### Administrative App Permissions

The app trust flag is set by a recently authenticated operator, and requires an active, verified registration with a trusted callback. It makes that app eligible to request optional `account_overview` and `account_manage` grants. Authorization code and device flows reject privileged scope requests from ineligible registrations. The active signed-in account can grant or decline each permission in its own section. Newly enabling account management or file write access requires explicit confirmation, including when re-enabling it in the account dashboard. The issuer uses a nonce-bound script for the confirmation dialog, with an explicit checkbox fallback.

Protected data includes storage totals, public-profile visibility settings, and linked-app permission decisions. Direct requests check the app’s current trust, the account status, issued token scope, and active user grant. The endpoints act on the token’s account. Account management can disable optional grants and replace public visibility settings. Credentials, operator actions, mailbox access, and account deletion use their own existing security boundaries. A stolen token can exercise its scope while valid, so use protected session storage and promptly revoke access on a compromised device. Verify trust denial, refusal without confirmation, grant revocation, and no cross-account access before release.

Peer signaling limits registrations to 2,048 total, 256 per app and eight per account per app. An active peer allows up to 35 operations per ten-second window. The queue holds 24 messages per recipient, with a 16 KiB request limit per signal and a 90-second idle lease. Signaling state is held in memory, so reconnect after an issuer restart. Test any required TURN relay separately under the app's networking configuration.

See [app container file boundaries](APP_CONTAINER_FILES.md#security-and-storage) for scoped binary uploads, dashboard visibility, quota and unlink behavior.

The shared peer service derives its namespace from the authenticated registration for discovery, offers, answers, ICE candidates and hang-ups. The signaling body does not choose a namespace. Each request checks the live app policy and peer ownership. The browser adapter accepts incoming media only after the host app agrees to the invitation. Keep microphone, camera, display and file permissions tied to explicit user actions. Set receiver-side file limits and treat remote metadata and bytes as untrusted.

The PeerJS gateway validates new leases against signed-in app credentials and current app policy. It uses a random lookup key and a separate WebSocket proof. The lookup key and proof are hashed at rest in process memory. Raw access tokens remain in process memory for live authorization and never enter PeerJS URLs. Registration IDs are chosen from the validated token. The relay replaces the sender ID server-side and looks up the destination only in the sender’s registration. TLS, suppressed access logging on signaling URLs, origin binding for browser leases, session deadlines, and bounded payloads, queues and request rates protect the credential and service boundaries.

App file mutations through a dashboard session require authenticated account consent headers, a live app link, and both Browseable and Editable in the authenticated file metadata. Replacements are staged under that same owner and app, bound to the version that was authorized at start, and made visible atomically.
