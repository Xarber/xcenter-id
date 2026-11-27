# X-Center ID integration

Use OpenID Connect Authorization Code with PKCE S256. Register an HTTPS callback in the developer portal, then add the requested public TXT record for that host. Activation returns a unique client ID and one-time client secret. Store the secret on the application's backend. Perform code exchange server-to-server and validate the issuer, state, nonce, audience and signatures using a maintained OIDC client. Never ship confidential credentials in JavaScript, iOS or Android app bundles.

Request `openid` for a stable app-specific subject and standard profile. The `profile` scope remains supported for compatibility. Request `age_range` for the self-declared child, teen or adult band, and `email` to prompt the user to choose a verified address or an available Hide My Email alias. Identity is available through the UserInfo endpoint returned by discovery. Email and age range are optional unless the app owner marks them required under Developer apps → Permissions. Use the validated issuer and subject to associate an app account. Never treat the age band as proof of age.

A developer registration describes the app and verifies control of its callback domain. It does not grant its backend access to another app. Request `app_data` for data operations and use the supported records API. The account owner controls read grants in X-Center ID. Revoking a developer app disables client lookup and subsequent data access. Revoking a user grant blocks subsequent cross-app reads. A recipient may retain copies already imported.

The two sample sites use independent confidential clients and separate datasets. They demonstrate actual OIDC signin, pairwise subjects, app-local notes, owner-controlled read grants, and a shared folder scoped to the user's sample data. Use fictional values in both apps.

The account manager supports timed data access and access until explicitly revoked. This applies to data-sharing permissions. OIDC tokens retain their short expiration. The sample clients can sign out independently of X-Center ID and save notes with a title, text, date and tags. They can delete their own records and their own new shared notes. Notes received from the other app are read-only.

## Linking and developer branding

The developer dashboard manages registration branding and revocation. App icons are uploaded as PNG or JPEG and re-encoded by X-Center ID. The link screen displays the originating account, the registered callback hostname, app icon, developer name and requested permissions. SSO can reuse a linked app grant while an X-Center ID session is active. Unlinking removes app sharing grants and disallows tokens from previous links. Data previously retained by the relying party remains governed by that app's retention policy.

Native registrations accept verified HTTPS App Links or Universal Links. These are public clients using PKCE. Confidential website clients still receive backend-only credentials. The Expo component can render username and email-code inputs for an authorized adapter, or use the system authentication browser. Native relying-party email sign-in needs its own client-bound authorization exchange before it can use email directly.

Optional scopes are individually selectable on the link screen. A linked app requesting new scopes uses **Authorize permissions**, while previously granted scopes remain available. Unlinking removes the app from the account's Permissions directory until the user links it again. An isolated HTTPS browser run verified token scopes, incremental approval, rejection of a previously issued token after unlink, and the directory entry returning after a fresh link.

Registration and app editing accept up to eight exact HTTPS callback paths on one verified origin. Changing an active app's verified origin requires a new registration. The developer name is managed centrally under Profile. An active app with a public GitHub repository is eligible for a developer verification request; administrators review the repository and ownership separately. App verification is an independent administrator action. Editing a verified app profile returns it to unverified status. Administrator storage limits range from 1 MB to 1 GB, gate new uploads, and preserve existing files when lowered.

Unlinking invalidates the stored authorization grants and removes data-sharing grant entries involving the app. Both the sample and registered-app permission APIs hide entries involving a disconnected app and reject new grants for it until the user links it again. Initial sample grants retain their existing first-use behavior.

New signup checks a chosen username before creating WebAuthn registration options and uses it as the credential's user name and display name. Successful enrollment temporarily reserves the username to the account for 24 hours, and profile completion fixes that username to the account. Existing password-manager entries remain under the platform's control. The app can change its own passkey labels.

Hosted consent grants requested private app storage automatically. Cross-app collection access and accepted friends are separate opt-ins. Email remains a verified-address or alias choice. Changing the verified developer name removes the developer badge until re-review and leaves the app and personal verification statuses independent. The app-specific identifier is required for OpenID Connect. When an already linked app requests a new scope, the same flow uses an Authorize permissions heading and shows the additional access. Previously declined scopes stay declined until a new link. Verify the browser flow against an isolated issuer before deploying.

Every linked app gets the standard profile from OIDC UserInfo with an `openid` access token. This includes the display name, given name, family name, preferred username, and a picture URL when a photo exists. The picture URL requires the same Bearer access token. Fetch the image bytes with authorization, then display them through the app. The endpoint does not publish a user's photo to anonymous visitors. Email, self-declared age band, and app records retain their separate permission controls. The standard profile does not expose exact birthday. Applications should read UserInfo after sign-in rather than assuming the ID token contains all profile claims.

App branding comes from the active registration whenever the dashboard loads or refocuses Permissions. Linked apps use the current name, icon, description, and verification status, without relinking. Editing a verified registration still returns it to review. The account dashboard, friend profiles, and admin account views display verification and administrator roles separately. Public profile responses include the positive `verified` and `admin` flags only when a public profile already exists. Linked clients can render the positive `xcenter_verified` and `xcenter_admin` UserInfo claims. These display fields do not grant administrative access.


## App permissions and friend import

An app owner can mark `email` or `age_range` required in its Permissions settings. Include each configured scope in authorization requests. The issuer rejects a request that omits a required scope. The user can cancel sign-in or choose a verified address. Personal verification, app verification and developer verification are separate.

Request `friends` and accept the optional consent control for `GET /v1/profile/friends`. It accepts an access token for the linked registration and returns `{"friends":[{"username":"example","sub":"pairwise-subject"}]}`. Only accepted, available friends are listed. A friend who has not linked the same registration has no `sub` field. A returned subject equals that friend's OIDC subject for this client ID. Use issuer and subject for matching. Unlinking or declining this permission during renewed consent ends access. The app can use `prompt=consent` to renew or remove its friend-list grant.

## Persistent linked-app sessions

Registered relying parties can request `offline_access` with `prompt=consent` in the secure system sign-in browser. **Stay signed in** authorizes a refresh token with a rolling 14-day idle lifetime. Access tokens remain valid for 10 minutes. Refresh uses the original client, current account and current grant. On success it consumes the prior refresh token and renews both the refresh token and consent deadline. Reuse of a consumed token revokes the grant. Unlinking ends refresh and data access. Adjusting required claims may require a new consent flow. Dashboard sign-in remains a separate 12-hour session.

Use an authenticated backend for confidential clients and OS-backed storage for public native clients. Refresh on foreground or protected activity when close to access expiry. Serialize refresh and replace credentials atomically. Keep a separate product session and stop refreshing while the user is idle. Sensitive token traffic stays inside discovery-approved endpoints.

## Returning apps and device sign-in

Interactive browser authorization asks users to confirm access for previously linked apps and shows the current grant. Refresh-token exchange remains noninteractive. On the account manager's per-app Permissions page, optional sign-in grants can be changed independently of cross-app collection access. Required profile, app storage and developer-required claims stay visible. An email address can be restored only while the previously selected address is still available. Users can choose a different address during consent.

Hosted authorization uses the active X-Center ID website session and opens directly to consent. The account row shows the avatar, display name and username. It opens a dedicated chooser on demand, including when a private app denies access to the active account. The chooser can select another saved browser session or add an account if fewer than three are saved. Switching returns to the same app authorization and recalculates permissions for the selected account. Explicit OAuth reauthentication requirements still apply.

Device approval is a fallback for input-constrained devices, typically TVs. Active confidential registrations start a five-minute [OAuth device authorization](https://www.rfc-editor.org/rfc/rfc8628.html) request. The confirming device opens `/device?code=XXXXXX` or enters the same code at `/device`, matches the displayed app and code, and approves linking or sign-in on the issuer. The native account manager's Devices page scans and validates issuer QR links before opening the confirmation in the system browser. The browser can reuse its signed-in X-Center ID session. If necessary it asks the user to sign in first.

The device user code is independent of the secret device code returned to the authenticated backend. Verification submissions are throttled. Token polling requires the same registered backend credentials, and a device code can be redeemed only once. The backend validates the ID token with its saved transaction nonce. App-specific pseudonyms stay stable across browser and device routes. Confidential clients receive a directly computed app-bound subject from the account claims because the provider's built-in pairwise Device Grant metadata requires different client-authentication methods. Public native clients continue to use verified HTTPS callbacks with the secure sign-in browser.

### Private apps and client secrets

The developer portal's app management page can restrict sign-in to an allowlist. The owner always has access. Developers grant access by X-Center ID username or choose a friend. If requests are enabled, an authenticated user can request access from the denial page. Denial and membership removal apply to new and existing app authorization. Approving access allows the user's next sign-in and does not grant their data automatically.

Confidential app owners can rotate or revoke the OAuth client secret after confirming identity. Rotation immediately replaces the sole active secret. Revocation stops confidential client authentication and regeneration retains the existing client ID. Copy a new secret when it is shown and update the app backend. This credential is separate from database keys. Existing account sessions and access-token expiry are separate from client authentication.

A linked app's email address is read-only at sign-in. The issuer shows the previously selected address while it is available. To choose a different address, first unlink the app, which deletes the user data it saved in X-Center ID, then link it again.


### DNS-free registrations

Developer Apps can activate a confidential backend without public DNS. Use an exact HTTP loopback callback on `127.0.0.1` or `[::1]` with an explicit port for local browser use. A remote self-hosted installation without DNS can use the device authorization flow with the same backend credential. Store the secret only on the backend. The issuer labels this registration **Unsecure app**, defaults it to private, and keeps its identity separate from DNS-verified apps. It cannot receive a verified app badge or provision its own service database.

The source publisher controls who can read its shared collections. **Secure apps** is the default and requires DNS activation. **Verified apps only** additionally requires administrator verification. **All apps** lets local or custom-hosted apps request hosted collection access after showing an explicit warning. Each grant still requires the owner’s approval. The current trust setting, registration status and grants are checked on reads. The older saved-place cross-app endpoint accepts DNS-verified registrations.

App linking displays **App developer** and **Signing in as** as separate sections and keeps each badge in its own section. Administrators can verify a registered developer directly, including from the account detail page, without waiting for a self-service review request. Developer app access settings show friends, approved users and pending requests as rows. Searching an exact username can add another account without listing unrelated users publicly.

Account handles use 3–24 lowercase letters, digits, underscores, dashes and interior dots. Leading, trailing and consecutive dots are rejected to keep each handle routable as a mailbox address. Existing reserved names and private mail aliases remain protected. Third-party apps should store the issuer and subject as the stable identity.

### Administrator callback approval

In Administration → Registered apps, select **Approve callback URLs** after independently verifying that the developer controls every listed HTTPS callback. This approval is tied to the exact pending registration and callback list. A callback change removes the approval. The developer sees an approval notice and can activate the registration and claim credentials after confirming their identity. Confidential clients receive their client secret once. Public native clients receive the client ID for PKCE and still need OS-level link association. Administrators do not see the credentials. Callback approval is independent of the app verification badge and service database eligibility.

## Approve app authorization from another device

When an unsigned-in browser starts a registered app's interactive authorization-code flow, the issuer can display a QR code and six-digit confirmation code. Scan the code using a browser on another device, sign in there if needed, enter the code shown on the first browser, and approve the usual application permissions. The approval page shows the app and account. It stays at X-Center ID; only the original browser continues to the already registered callback, using the original state and PKCE challenge. The SDK's authorization-code exchange stays the same.

The QR ticket expires after three minutes or with the issuer interaction, whichever comes first. The original browser's issuer interaction cookie is needed to pick up approval. The ticket is single-use, the confirmation code is attempt-limited, and a form rendered for a different account session is rejected. There is no new dashboard login on the original device. The OAuth device code flow remains the separate flow for TVs and other input-limited clients. The operating system camera can open the app approval URL.

## Account activity

Open **Sign-in & security** and select **View activity**. Recent account events include dashboard sign-in, app linking and unlinking, and permission changes made through the issuer. Events show the app or device label, timestamp, and scopes added or removed where available. Account owners see up to 100 events from the previous 90 days. Older events are evicted on new activity, and account deletion removes its activity. The log never includes tokens, addresses selected during consent, request payloads or stored records. Activity starts with this version.

## Sign out of connected apps

From **Apps**, request **Sign out of connected apps** and confirm with a passkey when needed. X-Center ID revokes outstanding access tokens, refresh tokens and authorization codes for the current account's connected apps. The action preserves the app links, stored data and current permission choices. The next sign-in uses the same registered callback. An app that maintains its own independent session or offline cache can stay visually signed in until it checks X-Center ID or expires its own session.

### Choose where to sign in

Signed-out app authorization offers **Add an account on this device** and **Sign in on another device**. The QR appears after choosing the second option. It authorizes the requesting app and returns the original callback without creating a dashboard account session on the requesting device. On the main X-Center ID sign-in screen, the same explicit QR action adds an account to the requesting dashboard after approval. The native dashboard uses its existing state-bound session exchange for the return.

The approval scanner accepts both first-party account and app authorization links. For manual entry use the six digits displayed on the requesting device. Legacy TV and console device codes continue through their existing flow. Native approval links use a short-lived, single-use browser handoff bound to the exact approval URL.
