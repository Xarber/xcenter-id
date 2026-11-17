# X-Center ID integration

Use OpenID Connect Authorization Code with PKCE S256. Register an HTTPS callback in the developer portal, then add the requested public TXT record for that host. Activation returns a unique client ID and one-time client secret. Store the secret on the application's backend. Perform code exchange server-to-server and validate the issuer, state, nonce, audience and signatures using a maintained OIDC client. Never ship confidential credentials in JavaScript, iOS or Android app bundles.

Request `openid` for a stable app-specific subject. Request `profile` for display name, given name and surname. Request `age_range` for the self-declared child, teen or adult band, and `email` to prompt the user to choose a verified address or an available Hide My Email alias. Identity is available through the UserInfo endpoint returned by discovery. An email is optional. Use the validated issuer and subject to associate an app account. Never treat the age band as proof of age.

A developer registration describes the app and verifies control of its callback domain. It does not grant its backend access to another app. Request `app_data` for data operations and use the supported records API. The account owner controls read grants in X-Center ID. Revoking a developer app disables client lookup and subsequent data access. Revoking a user grant blocks subsequent cross-app reads. A recipient may retain copies already imported.

The two sample sites use independent confidential clients and separate datasets. They demonstrate actual OIDC signin, pairwise subjects, app-local notes, owner-controlled read grants, and a shared folder scoped to the user's sample data. Use fictional values in both apps.

The account manager supports timed data access and access until explicitly revoked. This applies to data-sharing permissions. OIDC tokens retain their short expiration. The sample clients can sign out independently of X-Center ID and save notes with a title, text, date and tags. They can delete their own records and their own new shared notes. Notes received from the other app are read-only.

## Linking and developer branding

The developer dashboard manages registration branding and revocation. App icons are uploaded as PNG or JPEG and re-encoded by X-Center ID. The link screen displays the originating account, the registered callback hostname, app icon, developer name and requested permissions. SSO can reuse a linked app grant while an X-Center ID session is active. Unlinking removes app sharing grants and disallows tokens from previous links. Data previously retained by the relying party remains governed by that app's retention policy.

Native registrations accept verified HTTPS App Links or Universal Links. These are public clients using PKCE. Confidential website clients still receive backend-only credentials. The Expo component can render username and email-code inputs for an authorized adapter, or use the system authentication browser. Native relying-party email sign-in needs its own client-bound authorization exchange before it can use email directly.

Registration and app editing accept up to eight exact HTTPS callback paths on one verified origin. Changing an active app's verified origin requires a new registration. The developer name is managed centrally under Profile. An active app with a public GitHub repository is eligible for a developer verification request; administrators review the repository and ownership separately. App verification is an independent administrator action. Editing a verified app profile returns it to unverified status. Administrator storage limits range from 1 MB to 1 GB, gate new uploads, and preserve existing files when lowered.

Unlinking invalidates the stored authorization grants and removes data-sharing grant entries involving the app. Both the sample and registered-app permission APIs hide entries involving a disconnected app and reject new grants for it until the user links it again. Initial sample grants retain their existing first-use behavior.

New signup checks a chosen username before creating WebAuthn registration options and uses it as the credential's user name and display name. Successful enrollment temporarily reserves the username to the account for 24 hours, and profile completion fixes that username to the account. Existing password-manager entries remain under the platform's control. The app can change its own passkey labels.

Hosted consent presents optional profile, age range and app-data scopes as switches. Email remains a separate verified-address or alias choice. The app-specific identifier is required for OpenID Connect. When an already linked app requests a new scope, the same flow uses an Authorize permissions heading and shows the additional access. Previously declined scopes stay declined until a new link. Verify the browser flow against an isolated issuer before deploying.
