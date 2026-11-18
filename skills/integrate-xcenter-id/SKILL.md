---
name: integrate-xcenter-id
description: Integrate X-Center ID sign-in into web, backend, desktop, and mobile apps using OpenID Connect or the optional Expo SDK. Use for developer portal registration, callback ownership, code exchange, account mapping, and sign-in troubleshooting.
---

# Integrate X-Center ID

Preserve the target app's data, navigation and account recovery. Inspect its current authentication, backend, and platform before choosing an integration. Read [the integration contract](references/integration.md) for portal activation, native callbacks and verification. The issuer is https://id.xcenter.it. The maintained implementation currently lives in /Users/xarber/Productivity/apps/AuthNJS and its private Xarber/xcenter-id repository. Verify relevant contract details against current source when accessible, especially before enabling a new integration.

Start with the [platform-neutral developer guide](https://id.xcenter.it/docs#manual). For web apps or products with a backend, use the target stack's OpenID Connect library with a confidential website registration. For standalone native clients with callback ownership, use a public registration and the system browser with a verified HTTPS callback. For unsigned apps or clients that cannot receive callbacks, use the [backend browser handoff](references/integration.md#unsigned-apps-and-clients-without-an-app-callback). Use the Expo SDK only when it fits the existing framework. The protocol and hosted API do not require any JavaScript or React Native dependency.

Use the shared AccountEntry or RegisteredAppSignIn component where its installed framework versions are compatible. A reusable sign-in view only supplies the entry point. Finish the host app's code exchange, validated account session, logout, secure persistence and error handling. For native apps without Expo modules, adapt the system browser and PKCE flow through a supported installed library. Do not upgrade an app's framework just to import this package.

The user's registration must be active before sign-in works. Each product needs its own registration, exact callback and application identity. Client IDs and icons are public metadata. A copied client ID cannot establish ownership. Keep confidential client credentials on the product's backend and use PKCE, state, nonce and validated issuer metadata. Public native clients depend on OS-verified HTTPS app links owned by that product. Declare Apple association records and Android asset links for the exact bundle/package and signing identity. If that ownership cannot be established, prepare the integration and report the missing callback requirement without enabling a substitute custom-scheme path.

Bind code exchange and login completion to a single-use transaction created before browser authorization. Validate the ID token's signature, issuer, audience, expiry and stored nonce. Identify users by issuer and subject. Existing accounts need explicit authenticated linking or a proven migration. Keep the provider's opaque access token separate from the product's own session and obtain live UserInfo or another supported validation before trusting it.

Verify cancellation, callback failure, process restart, wrong client, wrong callback, wrong PKCE verifier, replay, pending/revoked registration and unauthorized data access. Only report installation or device sign-in when actually executed. Document the installed files, portal identity, tested platforms and remaining activation steps in the target project. Registering a relying-party app does not authorize publishing it or changing another app.

If the target app uses more than sign-in, read [capabilities and API examples](references/capabilities.md). Choose between the dedicated backend namespace, per-user app records, recipient sharing, and cross-app consent. Account-manager files, mail and administration remain dashboard features.
