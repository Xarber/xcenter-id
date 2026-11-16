# Integrate AuthNJS

## Register an application

1. Use **Developer apps** from the account manager. Sign in with an authorized developer account when the developer session service is available.
2. Submit your application's display name and one exact HTTPS backend callback. The submission appears as pending and grants no access.
3. An operator verifies control of the callback origin and that the developer is authorized to act for the app. Use an independent channel or a deployment-controlled domain challenge. The operator creates a new, distinct confidential issuer client, restricts it to the exact callback, and binds its issuer-issued client ID to the pending registration. A registration cannot claim an existing bound client ID.
4. For activation, run `node manage-client.mjs approve <registration UUID> <issuer client ID>` on the API host with its configured data directory. For revocation use `node manage-client.mjs revoke <registration UUID>` and disable the client at the issuer. The API rejects future requests from that client as soon as the registration is revoked. The issuer must also terminate the underlying sessions and refresh authorization.

Successful registration proves the identity of a provisioned confidential backend, whose credential stays in server-side secret storage. A display name, icon, redirect address or copied client ID proves nothing. Configure the issuer to emit the boolean `authnjs_confidential` only for user access tokens obtained by the specifically provisioned confidential backend and require strong client authentication during code exchange. Prefer issuer-supported asymmetric client authentication. Disable public flows, untrusted token exchange, direct password grants and service accounts for these clients. Never allow applications to set this claim through profile data. Use a dedicated developer portal client with a boolean `authnjs_developer` claim restricted to approved developer accounts. Ordinary users receive no developer claim. Keep the account consent console client separate from both.

The API also validates issuer, subject, signature, audience, expiration, token age and a dedicated end-user scope. Every cross-app read requires a separate live user grant. Bearer tokens remain bearer credentials. Future work includes sender-constraining them at the resource server and remote verification of the issuer policy. A compromised legitimate backend can access its own authorized data until its registration or grant is revoked.

## Existing website

- Have the website backend initiate an OIDC Authorization Code with PKCE browser redirect. Use exact registered callbacks, a server-held verifier, state and nonce, and the issuer's trusted signing keys. Validate the ID token before creating an app session. Store the provider tokens server-side and give the browser a secure, HttpOnly session cookie.
- Apply CSRF protection to writes. Keep the application's identity provider credentials, access tokens and refresh tokens out of browser storage and client JavaScript.
- Use server-side bearer requests to the [data API](API.md). A data access token must target the AuthNJS API, and a read with `source` must name an active originating client. Present the user's consent through the account console. A client registration by itself never authorizes another user's data.

## Existing Expo or React Native application

- Install the shared [React Native package](../packages/expo/README.md) from a local checkout or a privately shared pack artifact. The AuthNJS dashboard uses the same component. The package exposes themed sign-in and account-creation entry points with loading and error states.
- Use your approved host adapter to open the system authentication browser. Use an Expo development build to verify your app's verified Universal Link or Android App Link callback. Store host session credentials in OS-backed secure storage. The mobile app calls its own backend, which performs privileged data access. Never embed a confidential client credential in a mobile bundle.
- The package currently supplies the shared screen and callback contract. A reusable hosted OIDC session adapter, account recovery screens and production consent wiring are pending. Use the [Expo AuthSession guide](https://docs.expo.dev/versions/v58.0.0/sdk/auth-session/) and [OAuth Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html).

## Developer portal gateway contract

The web form expects a same-origin BFF at `/account/developer/apps`. The BFF must authenticate the developer via a secure server-managed session, enforce same-origin and CSRF protection for writes, and forward `GET` and `POST` to `/v1/developer/apps` using the developer user's access token. It must return the upstream JSON shape without caching. Enable the form with `EXPO_PUBLIC_AUTHNJS_DEVELOPER_PORTAL=enabled` only after the gateway exists. The X-Center static preview shows the page and its unavailable state because no provider or BFF has been connected.
