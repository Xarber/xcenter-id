# Secure browser, sessions and account overview

## Open the secure sign-in browser

On signed iOS and Android apps, prefer the platform’s authentication browser. With Expo, use `RegisteredAppSignIn` or `authorizeNative` to open the system authentication session and use the exact registered HTTPS app return. On platforms that display “App wants to use id.xcenter.it to sign in,” keep that system prompt. Complete the handshake with Authorization Code and S256 PKCE after the browser returns. For products that cannot claim an app URL, use the [backend browser handoff](integration.md#unsigned-apps-and-clients-without-an-app-callback). Use a top-level authorization redirect for web. Keep passkeys, passwords, and verification codes on the issuer’s own pages. [OAuth for native apps](https://www.rfc-editor.org/rfc/rfc8252.html)

## Keep the user signed in

1. Discover `refresh_token` in `grant_types_supported` and `offline_access` in `scopes_supported`. Request `offline_access` with `prompt=consent` when starting or recovering a persistent session. The user can turn off **Stay signed in**. A successful callback without a refresh token is a valid short session.
2. Store the issuer’s refresh token and access token on the confidential backend. For public native clients that own their exchange, use OS-backed secure storage. Scope credentials by issuer, exact client and signed-in account. A web browser should get only a separate, secure HTTP-only product session cookie.
3. Issue a separate product session with a matching 14-day idle deadline. A valid issuer access token lasts 10 minutes. Refresh on foreground or before authenticated work when less than 60 seconds remain. Use one in-flight refresh per session. For a replicated backend, serialize by session in shared storage. Avoid timers that refresh while the product is idle.
4. POST `grant_type=refresh_token` and `refresh_token` to the discovered token endpoint. Use the same registered client authentication as the code exchange. Atomically replace the consumed refresh token and its access token, and advance the product idle deadline by 14 days. Guard against a completed response writing over a newer account or a signed-out session. A setup that shares issuer credentials across multiple browser tabs must coordinate the request through the backend.
5. Handle `invalid_grant` by clearing the provider credentials and offering the secure browser again. Never automatically retry the same refresh token after an uncertain response. A reused consumed token can revoke the whole issuer grant. Stop refreshing when the user signs out or unlinks. Keep the product's local data accessible where supported while offline. [OAuth refresh token protection](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14)

## Build the account screen

Use `AccountOverview` from `@authnjs/expo/account-overview` for a single-page React Native account view. It is available in this repository’s [Expo package](https://github.com/Xarber/xcenter-id/tree/testing/packages/expo). Each app supplies validated profile data and controls that make sense for that product.

- Lead with one rounded, softly tinted account card. Use the X-Center ID mark, circular profile photo, name and username with a strong size hierarchy. Place personal verification and administrator badges in a distinct line. Render compact icons with accessible names wherever only an inline indicator fits.
- Group app-owned controls away from the identity card. Use labeled switches with a short description only when it helps the user decide. Show sync, sharing and permissions for the actual features the app supports. Save the controls per account and enforce them in the app’s sync worker or backend. The optional slots accept either embedded settings or an action to open the host app’s settings page.
- Keep a clear **Manage X-Center ID** action. The component opens the account website by default. Supply a custom action if verified native links and a web fallback are available. Recover from missing photos with the component’s fallback. Fetch photos with the app’s bearer authorization and pass a trusted image source.
- Match X-Center ID’s light and dark appearance, rounded surfaces, blue accents, restrained typography, accessible labels and quiet press feedback. Use the same hierarchy on other stacks. Keep narrative explanations for screens where a decision needs them.

## Expo component specifications

Use the current [Expo package](https://github.com/Xarber/xcenter-id/tree/testing/packages/expo) and check its peer dependencies against the target app.

### RegisteredAppSignIn

Import from `@authnjs/expo/registered-signin`. Pass the activated native registration’s `clientId`, its exact verified HTTPS `redirectUri`, and `onAuthorized`. The handler receives `code`, `verifier`, `nonce`, and `redirectUri` after the secure system browser returns. Bind exchange to the original sign-in attempt and validate the ID token before saving a product session. The component handles loading, cancellation and sign-in errors.

Optional `scopes` request the app’s capabilities, `nonce` supplies a pre-created transaction nonce, and `promptConsent` reopens consent. The helper automatically requests consent when `offline_access` is present.

```tsx
<RegisteredAppSignIn
  clientId={registration.clientId}
  redirectUri={registration.redirectUri}
  nonce={signInAttempt.nonce}
  scopes={['openid', 'offline_access']}
  onAuthorized={finishVerifiedSignIn}
/>
```

### AccountOverview

Import from `@authnjs/expo/account-overview`. Pass `profile` with `name` and `username`. Optional fields are `email`, `photo` as a React Native image source, `verified`, and `administrator`.

Pass `syncOptions` for controlled switches. Each item has `id`, `label`, `enabled`, and `onChange(enabled)`, with optional `description` and `disabled`. Use `settings` for additional inline React content or `onOpenSettings` for a separate app settings screen. The default **Manage X-Center ID** action opens the website profile. Override it with `onManageAccount` to open a supported native route.

```tsx
<AccountOverview
  profile={{ name: profile.name, username: profile.preferred_username, photo }}
  syncOptions={[
    { id: 'preferences', label: 'Sync preferences', enabled: syncEnabled, onChange: saveSyncPreference },
  ]}
  onOpenSettings={openAppSettings}
/>
```
