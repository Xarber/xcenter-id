# AuthNJS redevelopment plan

16 November 2026 · Planning only · Legacy baseline `e617758`

## What the original project was building

AuthNJS combined a single account, a separate data area for every linked app, and a dashboard where the user controlled which apps could see data from another app. A source app defined named permissions covering file paths. The user could grant those permissions to a destination app, and AuthNJS mediated access. The About page gives examples such as importing posts between social apps or bringing a cloud file into a messaging app. The original system also explored sharing with other accounts and a shared folder accessible to linked apps.

The product worth keeping is **one account, one consistent sign-in experience, and user-controlled data portability between participating apps**. Apps can integrate once with AuthNJS and support any other app using the same data contract. An existing app still needs to adopt the SDK and publish or consume that contract. Arbitrary app databases cannot be shared automatically.

## Legacy repository review

The review covered the first-party server, route/configuration structure, auth and dashboard web surfaces, browser example apps, API notes, ideas and dependency metadata. Vendored Font Awesome and binary media were inventoried. Tracked account material was identified by file type and location without assessing individual records or testing credential validity. Findings are static observations.

| Area | Observed behavior |
| --- | --- |
| Server | `index.js` combines the HTTP server, request routing, template execution, filesystem helpers and encryption. `private/server/rules.json` maps API paths to local handlers. |
| Authentication | `private/server/authentication/` implements signup, password and OTP sign-in, recovery, session handling, refresh and app linking. Redirects and browser storage carry bearer tokens. |
| App integration | `api.txt`, `HTML/devs.html` and the browser test apps show why integration was cumbersome. Calls repeat app metadata and credentials, hand-build forms and redirects, and interpret text responses and special path markers. App registration and settings routes exist, but their handlers are skeletal. |
| Storage and sharing | `private/server/data/` implements file operations, per-app namespaces, shared/public access and cross-account grants. Handlers repeat filesystem and permission logic. `HTML/auth/link.html` and `HTML/auth/share.html` present user-facing link and share flows. |
| Account console | The dashboard covers profile, linked apps, sessions/devices, verification, data and account actions. Backup, export, custom encryption, feedback and support are represented in account handlers. An administrative dashboard handler is empty. |
| Provenance | One reachable commit on `main`. The package declares ISC and the package test script is a placeholder. The repo has no UADS manifest, active queue or GitHub workflow at the reviewed revision. |

### Findings that drive the redesign

- **Credential exposure.** Git tracks account key files, session and password artifacts, logs and an account export. Signup passes passwords to a reversible storage helper, and sign-in decodes them for comparison. Some encode calls omit the encryption flag and the helper supports fallback to unencrypted data. Treat legacy secrets and records as potentially exposed until their provenance and current use are established.
- **Token boundaries.** The sign-in/link flows handle bearer material in redirects, browser storage and form payloads. The linking handler issues a signed app token without an explicit expiration at its signing call. Replace the generic account token with per-client sessions and audience-restricted access.
- **Authorization boundaries.** App metadata and permission claims originate in client inputs. Filesystem paths and operation markers are coupled to several authorization implementations, with shared/public branches. Use registered clients, schema-defined resources and one server-side policy path.
- **Operational risk.** The custom server dynamically evaluates template code, maintains mutable account state across files and contains request-driven key handling. Keep the old server out of any deployment and build the replacement with isolated storage and production configuration.

Before a pilot, establish whether the legacy system is still reachable or any committed material is real or reused. If applicable, contain access, invalidate legacy sessions and rotate affected credentials at their source, then assess affected data and notification obligations. Keep historical records restricted. Any Git history rewrite or destructive remediation is a separate decision.

## Proposed architecture

| Component | Responsibility |
| --- | --- |
| Identity provider | Self-host a maintained OpenID Connect provider on X-Center. Start provider evaluation with Keycloak. Select a pinned version only after proving passwordless enrollment, backup credentials, recovery, hardware-key use, redirect handling, supported customization, license compatibility and restore operations. Evaluate a second maintained provider if those gates fail. |
| Hosted account console | Own the canonical sign-in, account creation, account chooser, consent, recovery, credential management, account export/deletion, connected apps and session management screens. Theme the provider's trusted login surface. Keep the issuer and WebAuthn relying-party domain stable across upgrades. |
| AuthNJS data service | Own the app registry, published data schemas, consent grants, activity history and typed shared records. Use a TypeScript service with PostgreSQL transactions and separate database roles from the identity provider. Keep app-private and local-only data in the owning app. |
| Expo SDK | Ship a typed provider and hooks, standard account entry screens, callback/session management and a versioned data client. Use platform adapters for iOS, Android and web, with one example app and a backend integration guide. |
| Web integration | Offer the same hosted account journeys. A same-origin backend-for-frontend keeps tokens server-side and uses Secure, HttpOnly cookies and CSRF protection. The installable account portal caches public assets only. |

### Sign-up, sign-in and sessions

1. An app registers its identity, trusted display metadata, supported platforms, exact redirect URIs and requested permissions. Native apps are public clients. Production and test environments use distinct clients and issuers.
2. The SDK launches the hosted flow in the system authentication browser via Expo AuthSession. Use OIDC Authorization Code with PKCE S256, state and nonce. Prefer verified Universal Links and Android App Links, with a registered platform-appropriate fallback only where justified. Authenticate solely at the issuer. The app receives an authorization code through the callback and resumes the original screen.
3. Offer platform passkeys and external FIDO2 security keys at enrollment and sign-in. Let users name, use and revoke multiple credentials, enroll a backup and reauthenticate for security-sensitive changes. Where native key support needs it, use the supported system-browser flow. Verify legacy U2F as a second factor wherever exposed. Prefer remaining enrolled credentials for recovery. Any optional verified-channel code must be short-lived, single-use, rate-limited and bound to the account and flow, with a documented recovery policy that preserves credential-management security.
4. Validate token signature, issuer, audience, expiration and nonce where applicable with maintained libraries and keys from issuer discovery. Key app identity on issuer plus stable subject, never on email. Centralize any necessary mapping across per-client subjects. Keep access tokens short-lived and refresh credentials rotated with replay detection and per-device revocation. Use OS-backed secure storage for native refresh credentials and keep access credentials in memory where practical.
5. Treat app logout, account-wide sign-out and disconnecting an app as distinct actions. Disconnect revokes downstream data grants and related sessions. Define and test the propagation window for already-issued access tokens. Handle interruption, canceled browser sessions, account switching and expired credentials with reusable UI states. Existing local app work remains available offline where the app permits it.

Sources: [OAuth Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html), [OAuth for Native Apps](https://www.rfc-editor.org/rfc/rfc8252.html), [W3C WebAuthn](https://www.w3.org/TR/webauthn-3/), [Expo authentication guide](https://docs.expo.dev/guides/authentication/), [Keycloak administration guide](https://www.keycloak.org/docs/latest/server_admin/).

### What Expo app developers integrate

- Configure issuer, client ID, callback association and approved resource types once. Mount an `AuthNProvider` and use `useAuthN()` for session state and account actions.
- Reuse an account entry screen, signed-out state, account summary and connected-apps entry point. Sign-in, signup, recovery and consent open the same centrally hosted screens across apps. Themes may supply approved app branding and locale while the issuer stays recognizable.
- Use the generated data client for explicit operations such as listing available shared datasets, importing records and requesting a grant. Define an OpenAPI contract and structured errors for consent required, disconnected, expired, incompatible version and revision conflict. Keep persistent API credentials and token parsing out of feature code.
- Build the example on iOS, Android and web. Prove callbacks in installed development builds, including cold launch and browser cancellation. Support screen readers, text scaling, keyboard navigation, dark mode and reduced motion. Keep a single compatibility matrix for supported Expo SDKs and operating systems.

### Cross-app data contract

A source app publishes a minimal schema-compatible record in an app-owned collection, with its provenance. A destination app requests read access to that dataset. The hosted consent screen shows the source app, destination app, exact data and permitted operation. After approval, the destination can display or import matching records without a direct integration with the source app.

- Store each grant with owner, source client, destination client, dataset/schema version, permitted operations, duration and revocation state. Resolve the caller from validated credentials, check ownership and live grant state at every request, and deny access whenever the policy cannot be evaluated. A general sign-in scope carries zero app-data access. Default grants to read-only. Writing into another app is a separately approved operation with explicit schema and conflict rules.
- Track opaque resource IDs, schema version, revision, provenance and timestamps. Validate stored and returned fields with explicit allowlists. Use transactional writes, idempotency keys, version preconditions and quotas. Partition by account and app. Add binary attachments only if needed, with a separate validated access path and short-lived download authorization.
- Provide scoped synchronization for explicitly selected account data across devices with incremental revision cursors, tombstones and deterministic conflict handling. Preserve local-first behavior for app-private data. Explain that revocation stops future AuthNJS access and previously imported copies remain subject to the receiving app's deletion policy.
- Keep cross-account sharing, public links, generic file hosting and third-party self-registration as separate product decisions. They expand the consent and abuse model beyond the first-party cross-app flow.

## Threat assessment and acceptance evidence

| Risk | Required control and evidence |
| --- | --- |
| Account takeover or lost device | Exercise passkey and real FIDO2 enrollment, sign-in, recovery with a backup, credential revocation, device logout and recovery throttling. Check the relevant legacy U2F path. |
| App impersonation, token leakage or misuse | Require registered callback associations, PKCE, trusted client metadata, audience validation, redacted logs and scope boundaries. Verify rejected invalid callbacks and credentials with synthetic fixtures. |
| Cross-user or cross-app data exposure | Run a policy matrix across two users, two apps, multiple resources, denied/expired/revoked grants, read versus write and version changes. Verify cached data and in-flight operations follow the documented revocation policy. |
| Central service outage or compromise | Isolate the issuer, app API and database privileges. Back up issuer keys, identity and grant state securely with documented RPO/RTO. Drill restore in isolation and verify stale backups cannot silently reactivate revoked access. |
| Privacy leakage and deletion gaps | Publish data inventory, retention and processing disclosures. Verify export, deletion, backups and the behavior of copies previously imported by an app. Keep real data out of telemetry, tests and screenshots. |

## Delivery order and UADS gates

1. **Containment assessment and design prerequisites.** Confirm legacy footprint, intended stable domain and trusted pilot apps. Retain the existing repo and history. Before new development, set up the scoped UADS manifest, requirement registry, schema, validator, quality workflow and active task ledger. Preserve the legacy license declaration pending a deliberate licensing decision. Plan AGPL-3.0-only for new original work after checking compatibility, including consequences for apps that embed the SDK.
2. **Provider and platform validation.** Use isolated synthetic accounts, a pinned provider and two sample clients. Prove passwordless flows, external keys, safe recovery, browser callbacks and logout on web, iOS and Android. Pin Expo versions when the pilot apps are identified. Retain test evidence by platform.
3. **Reusable SDK and account portal.** Ship account lifecycle, connected apps, the unified UI and installation documentation together. Apply UADS web root landing and PWA behavior, accessible onboarding, isolated sample mode, screenshot rendering, Developer Options and Ideas where applicable to the portal/demo app. Keep auth surfaces and private data out of service-worker caches.
4. **First data contract and pilot.** Implement the app registry, consent, policy enforcement, audit events, typed sync and sharing between two pilot apps. Verify a user can sign in to both, import a record, revoke access and see future access denied. Record tests, coverage and the limits of previously imported data.
5. **Migration and release.** Default to fresh passwordless enrollment. If valuable legacy data exists, design an opt-in offline import with verified ownership, per-record preview, fresh grants, reconciliation and rollback. Exclude old keys, passwords, tokens and permissions. Stage on X-Center with isolated configuration and rollback. Preserve established branches until migration is approved. Apply the UADS promotion, GitHub build and release validation, screenshot and distribution requirements to the authorized channels and applicable shipped artifacts. Package consumers inherit their own mobile app build matrix.

No release or compliance gate has passed. Native browsers, hardware keys, recovery, account migration and X-Center capacity are pending future implementation and verification. The first implementation milestone is a provider and browser-flow validation using synthetic accounts and two clients.
