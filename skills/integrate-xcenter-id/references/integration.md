# Current integration contract

## Portal

Open https://id.xcenter.it/developer while signed in. Register the app's real name, developer profile, optional icon and an exact HTTPS callback path on a domain the product controls. Select Native app for a public native client that owns the HTTPS app return. A native app using its backend-owned confidential authorization flow registers that backend callback as a web client, with credentials held only by the backend. The current API accepts up to eight HTTPS callback paths on one origin, without queries, fragments, wildcard paths or embedded credentials.

Registration starts pending. Publish TXT at _xcenter-id.<callback-host> with the value xcenter-id=<registration UUID>, then activate the registration from the portal. The issuer resolves that record before allocating a distinct client ID. A confidential web registration also returns a one-time secret. Native registration has token endpoint authentication method none and never receives a confidential secret. A pending, restricted, revoked or unknown registration cannot authorize login. Sample clients in protected operator configuration are operational exceptions, not IDs to reuse.

A DNS challenge proves control of the callback domain. It does not establish which installed mobile app receives the callback. Configure Apple Associated Domains and the apple-app-site-association file with the app's team ID and bundle ID, and Android intent filters and assetlinks.json with its package name and release certificate digest. Verify association on an installed development or release build. Sharing a callback with another product defeats product isolation.

## Shared package

The package under packages/expo is @authnjs/expo. It currently targets React 19, React Native >=0.83 <0.89 and Expo 58 authentication modules. Read its package.json and installed target versions. Install from a local checkout or an authorized privately packed artifact. Do not embed a private repository access token into the target app or a package URL.

AccountEntry from @authnjs/expo renders the reusable account entry UI. RegisteredAppSignIn from @authnjs/expo/registered-signin starts the native flow. authorizeNative from @authnjs/expo/authorize-native uses Expo AuthSession with S256, a cryptographically generated nonce and an HTTPS native return. It requests openid and returns code, verifier, nonce and redirectUri. Cancellation returns null. It does not establish the product session.

For a product backend, prefer letting that backend create and retain the one-time authorization transaction, open its authorization start in the system browser, validate the exact callback, and redeem the code with its own verifier and credentials. Use a one-time return bound to the app's initial verifier to deliver the product session to the native app. An app-supplied expected nonce at completion is not a replacement for a backend-retained pre-authorization nonce.

For a registered public native client, send client_id, code, code_verifier, exact redirect_uri and grant_type=authorization_code to the issuer token endpoint discovered from its exact issuer URL. An established OIDC library must validate the ID token with the nonce created before this flow. If a product backend accepts that result, bind it to its own prior transaction and expected audience, or let the backend own authorization. Never accept an arbitrary user-supplied subject or decode an ID token without validating it. Store product sessions with SecureStore or equivalent OS-backed storage.

## API and identity boundaries

Use the issuer's .well-known/openid-configuration. Pin the issuer and validate endpoint origins. Exact registered redirect paths, S256 verifier checks and state verification are mandatory. Every ID token is bound to its client audience. The issuer uses pairwise subjects, so product A and product B receive different subjects for the same person.

The identity provider uses opaque access tokens. Third-party native clients cannot use the account manager's /account/native/exchange or /account/login/code to obtain privileged account-manager sessions. The registered API accepts confidential active app tokens with app_data scope for that app's records. Cross-app reads additionally require an owner-approved, unexpired grant. Giving product B the same display name, username or client ID as product A does not create product A credentials or its callback ownership.

## Host app checks

Trace normal login, deep-link return and app-session restore. Preserve user data when switching login providers. Verify against isolated identities before public deployment. Include negative checks showing that app B cannot redeem app A's code, that a different callback or verifier fails, and that an unregistered/revoked client fails. For public clients, verify the OS sends the claimed HTTPS callback only to the intended app. Backend identity, user consent and OS callback ownership are distinct checks.

Inspect docs/IDENTITY.md, services/api/oidc.mjs, services/api/registry.mjs and packages/expo in the current identity repo if behavior differs. Apply a discovered security fix at its relevant boundary before reporting integration complete.
