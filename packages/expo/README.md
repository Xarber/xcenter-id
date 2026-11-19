# @authnjs/expo

Shared React Native and Expo Web account entry UI. Install the private package tarball or a local checkout with `npm install /path/to/AuthNJS/packages/expo`. No registry publication has occurred. For Expo SDK 58 native browser sign-in, install `expo-auth-session`, `expo-crypto` and `expo-web-browser` with `npx expo install`.

```tsx
import { AccountEntry } from '@authnjs/expo';

<AccountEntry
  onSignIn={openSystemBrowserSignIn}
  onCreateAccount={openSystemBrowserEnrollment}
  pending={isOpeningBrowser}
  error={userFacingError}
/>
```

Handlers belong to the host application's approved OIDC adapter. Use a system authentication browser with Authorization Code and PKCE. On the web, redirect through the site's backend-for-frontend. Maintain state and nonce, validate the returned identity, and keep backend credentials out of this package and app bundles. The component handles consistent labels, theme, loading, error and press feedback. It does not create or store sessions.

## Native browser authorization

```ts
import { authorizeNative } from '@authnjs/expo/authorize-native';

const transaction = await authorizeNative({ issuer, clientId, redirectUri });
if (transaction) await completeSignInWithYourBackend(transaction);
```

Configure the exact HTTPS app-link callback in the issuer and both native association files. Use a public client reserved for native user sign-in. The helper checks discovery, creates fresh state and nonce, uses PKCE S256, then returns the one-time authorization code and verifier. The app's backend exchanges the code against its configured issuer and validates the ID token issuer, audience, signature, expiry and nonce before issuing its own session. Bind completion to the app's own sign-in transaction. Discard the code, verifier and nonce after use and keep them out of logs. Browser cancellation returns null. Privileged record sharing remains with the approved confidential backend.

## Registered native app sign-in

Import `RegisteredAppSignIn` from `@authnjs/expo/registered-signin` with the activated native client ID, verified HTTPS callback and an `onAuthorized` handler. The reusable UI includes the transparent X-Center ID mark. It opens the system authentication session with PKCE and returns the code, nonce and verifier to the handler. Exchange the code using the registered public client ID and verify the token issuer, audience, nonce and signature through a maintained OIDC adapter. Keep resulting credentials in secure platform storage. Never place a website client's secret in a mobile bundle.

Configure Android App Links or iOS Associated Domains for the callback host and path. The Expo HTTPS authentication callback on iOS requires iOS 17.4 or later. AccountEntry can also display username and email-code inputs when supplied with an authorized adapter. The first-party account manager's email endpoints issue account-management sessions and are for that manager only.

## Persistent sessions and the account overview

Use the secure system sign-in browser with Authorization Code and PKCE. Request `offline_access` for the **Stay signed in** option. Access tokens still last 10 minutes. If the user accepts, exchange and rotate the refresh token using the same registered client, with a 14-day idle expiry. Refresh only when active and close to access-token expiry. Serialize refresh and replace both tokens atomically in protected storage.

```tsx
import { AccountOverview } from '@authnjs/expo/account-overview';

<AccountOverview
  profile={{
    name: user.name,
    username: user.preferred_username,
    photo: authorizedPhoto,
    verified: user.xcenter_verified,
    administrator: user.xcenter_admin,
  }}
  syncOptions={[
    {
      id: 'ride-insights',
      label: 'Ride insights',
      description: 'Sync ride summaries across your devices.',
      enabled: syncInsights,
      onChange: setSyncInsights,
    },
  ]}
  onOpenSettings={openAppSettings}
/>
```

Pass the photo as a React Native image source after obtaining it with the authorized user token. `settings` can render host-owned controls within the details sheet. `onManageAccount` can open a supported native destination with a browser fallback. The default opens the component’s account details sheet. The overview does not own credentials, issuer grants or sync preferences.

Mount `AccountOverview` directly in Settings and pass `profile={null}` while signed out. Supply `signIn` with the registered public app parameters and `onAuthorized` code exchange callback for the system browser, or supply `onSignIn` for the app's existing sign-in implementation. Update the controlled profile after the host validates and stores the session. The component then displays the profile and opens a details sheet from **Manage account & data**. Its **Open dashboard**, **Manage app** and **Sign out** controls are built in. Provide `clientId` for the Manage app destination if it is not already in `signIn`, and `onSignOut` to clear the host session. Pass optional `syncOptions` and `settings` for host-managed data controls.
