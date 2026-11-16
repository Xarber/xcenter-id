# @authnjs/expo

Shared React Native and Expo Web account entry UI. Install the private package tarball or a local checkout with `npm install /path/to/AuthNJS/packages/expo`. No registry publication has occurred.

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
