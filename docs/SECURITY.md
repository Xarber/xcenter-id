# Security findings and storage design

The static review covered the legacy file save, upload, move, remove, list and download handlers, shared permissions, session lookup and encryption helpers. Historical keys and account records were left in place. No legacy endpoint was exercised.

| Finding | Evidence and impact | Current protection |
| --- | --- | --- |
| Unreliable path confinement | The legacy handlers concatenate request-derived values into filesystem destinations after selective string removal. Move also builds a second destination and upload uses an original name. The code lacks a uniform containment check anchored at the authorized directory. The impact is potential access outside the selected app or account namespace. | The legacy listener is disabled by default; the replacement never interprets data supplied by applications as filesystem paths. |
| Mixed trust and permissions | Legacy linking accepts app claims from caller inputs and permissions are checked independently inside handlers. Session metadata can be updated before the app credential is checked. | The replacement verifies issuer, token audience and registered client, then scopes prepared statements to the authenticated account and app. |
| Legacy storage may contain plaintext | The legacy helper compresses content when encryption is omitted. Other branches use unauthenticated CBC with externally managed IVs and fallback behavior. The password verifier decodes stored passwords. | The replacement stores only new synthetic or authorized data. It never loads the legacy password or key data. |
| Request-driven key mutation | Legacy handlers write a caller-provided custom key to a live key file and restore it later. Parallel requests or interruption can leave confusing state. | The replacement loads one managed key at startup, outside request control. Each record uses a fresh nonce and authenticated context. |

## Encryption boundaries

Saved-place payloads use a versioned AES-256-GCM envelope with a fresh 96-bit nonce and a 128-bit tag. Authenticated context includes account, source app, dataset, record ID and revision. Moving ciphertext between records or using a different key fails authentication. Schema version, owner and app IDs, grants and revisions remain relational metadata. Restrict filesystem access and encrypt database volumes and backups when that metadata needs confidentiality. This is server-side encryption at rest. The service can read authorized payloads. Key rotation, key version custody, disaster recovery and metadata encryption require completion before production.

The legacy code and pages remain in `index.js` and `HTML/`. Treat them as restricted archive material. Before a live migration, determine whether any historical key, session, account record or archive remains sensitive or in use. The account artifact provenance and exploitability of the original handlers were not established by this review.

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
