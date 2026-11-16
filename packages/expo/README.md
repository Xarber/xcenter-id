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
