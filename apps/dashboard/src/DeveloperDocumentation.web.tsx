export default function DeveloperDocumentation(){
 return <main className="xc-main xc-docs" style={{maxWidth:1000}}><a className="xc-brand" href="/">X-Center ID</a><h1>Build with X-Center ID</h1>
 <p>One registered identity integration, reusable sign-in and an optional hosted application database.</p>
 <nav className="xc-actions"><a href="#register">Register an app</a><a href="#manual">Use OpenID Connect</a><a href="#install">Install the Expo SDK</a><a href="#authentication">Secure sign-in</a><a href="#hosted-data">Hosted data</a><a href="/developer">Developer portal</a></nav>
 <section className="xc-card xc-pad xc-stack" id="register"><h2>1. Register and activate</h2><p>Open Apps → Developer portal. Create a distinct registration for each product. Choose Native for a public mobile client or Website for a confidential backend. Enter exact HTTPS callbacks on a domain you control, a name, icon and permission description.</p><p>Publish the DNS TXT challenge supplied by the portal, then verify ownership. Pending, restricted and revoked registrations cannot sign users in. A verification badge is separate from callback activation.</p></section>
 <section className="xc-card xc-pad xc-stack" id="manual"><h2>Connect from any platform</h2>
 <p>Install an OpenID Connect client library for your language, or use the standard HTTPS endpoints. Configure the issuer as <code>https://id.xcenter.it</code>, using the client ID and exact callback from the portal.</p>
 <pre>curl https://id.xcenter.it/.well-known/openid-configuration</pre>
 <ol><li>Generate and store a fresh state, nonce and PKCE verifier for the sign-in attempt. Hash the verifier with SHA-256 and base64url-encode it to get the challenge.</li>
 <li>Open the discovered authorization URL in the system browser with client_id, redirect_uri, response_type=code, scope=openid, state, nonce, code_challenge and code_challenge_method=S256.</li>
 <li>At the callback verify state and handle cancellation. POST the authorization code to the discovered token URL, then verify the ID token using the provider’s JWKS and your original nonce.</li></ol>
 <pre>{`POST <token_endpoint>
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&client_id=CLIENT_ID&code=CODE
&redirect_uri=EXACT_CALLBACK&code_verifier=ORIGINAL_VERIFIER`}</pre>
 <p>URL-encode every value and send the body as one line. Confidential website clients authenticate with HTTP Basic on the backend. Public native clients use their client ID and PKCE. Use a Bearer access token for the discovered UserInfo endpoint or the app data API below.</p>
 <p>Use the operating system’s secure authentication browser on native apps. To keep users signed in, request <code>offline_access</code> with <code>prompt=consent</code>. Refresh shortly before the 10-minute access token expires during active use. Save each new refresh token atomically. Its idle deadline renews for 14 days.</p>
 <p>After sign-in, fetch UserInfo and check that its <code>sub</code> matches the validated ID token. Every linked app receives the standard profile with <code>openid</code>, including the name, username and a <code>picture</code> URL when a photo is set. Fetch the image from the issuer with the same Bearer access token. In a browser, render the response as a blob URL and revoke it on sign-out. Email and age band require separate consent.</p>
 <a href="https://openid.net/specs/openid-connect-core-1_0.html">OpenID Connect specification</a></section>
 <section className="xc-card xc-pad xc-stack" id="device-sign-in"><h2>Sign in on a TV or other input-constrained device</h2>
   <p>Use the secure sign-in browser by default. When that is unavailable or difficult to use, an active confidential registration can start a device sign-in from its backend.</p>
   <p>Request a device code from the discovery endpoint, show the six-character code and the QR link, then poll for approval from your backend. The user confirms on a phone or computer at <a href="/device">id.xcenter.it/device</a>.</p>
   <a href="https://github.com/Xarber/xcenter-id/tree/testing/skills/integrate-xcenter-id#readme">Device integration instructions</a>
 </section>
 <section className="xc-card xc-pad xc-stack" id="install"><h2>2. Install the shared sign-in package</h2><p>The package is currently distributed from the project checkout, not a public npm registry. Repository access is required. From that checkout:</p><pre style={{overflow:'auto'}}>npm pack ./packages/expo</pre><p>Install the resulting archive in your app, together with the peer dependencies supported by its Expo version:</p><pre style={{overflow:'auto'}}>npm install /path/to/authnjs-expo-0.1.0.tgz</pre><p>The current adapter targets Expo SDK 58 and React Native 0.83–0.88. Preserve your app's framework version; use a supported system-browser OAuth library if these peers are incompatible. The package includes AccountEntry, RegisteredAppSignIn and authorizeNative.</p></section>
 <section className="xc-card xc-pad xc-stack" id="authentication"><h2>3. Complete secure authentication</h2><p>Discover the provider at https://id.xcenter.it/.well-known/openid-configuration. Use authorization code with S256 PKCE, random single-use state and nonce, and an exact registered redirect. Native clients need OS-verified HTTPS app links for their own package and signing identity. Custom schemes alone do not establish app ownership.</p><p>Never embed a confidential secret or a database backend key in mobile JavaScript. Validate ID-token signatures, issuer, audience, expiry and the stored nonce. Identify users by issuer and pairwise subject, and bind every callback and code exchange to the transaction created before authorization. Use secure device storage for your own app session. Do not send relying-party tokens to the account-manager APIs.</p><pre style={{overflow:'auto'}}>{`import { authorizeNative } from '@authnjs/expo/authorize-native';

// Your backend stores the nonce and an expiring, single-use transaction first.
const prepared = await yourBackend.beginSignIn();
const authorization = await authorizeNative({
  issuer: 'https://id.xcenter.it',
  clientId: YOUR_REGISTERED_PUBLIC_CLIENT_ID,
  redirectUri: YOUR_VERIFIED_HTTPS_APP_LINK,
  nonce: prepared.nonce,
  scopes: ['openid', 'profile', 'app_data'],
});
if (authorization) {
  // Exchange for the same client; validate the ID token against the stored nonce.
  // Consume prepared.transactionId once, then establish your own app session.
  await yourBackend.finishSignIn(prepared.transactionId, authorization);
}`}</pre><p>For reusable UI import RegisteredAppSignIn from @authnjs/expo/registered-signin. Its clientId, redirectUri, scopes, nonce and onAuthorized props use the same contract. To request additional scopes later, use promptConsent.</p>
<p>Request only supported scopes: openid, profile, email, age_range, app_data, friends and offline_access. Use Developer apps → Permissions to require email or age range and include each required scope in every authorization request. Private app storage is included when app_data is requested. Cross-app permissions and Friends stay optional. With a friends access token, GET /v1/profile/friends lists accepted friends, including their OIDC subject for this registration when they have also linked it. Use prompt=consent when asking for additional access; denied scopes and revoked links must be respected by the app.</p></section>
 <section className="xc-card xc-pad xc-stack" id="hosted-data"><h2>4. Use hosted application data</h2><p>Activate your registration and obtain administrator verification first. Open its Application database page to manage sharing and backend credentials. Every collection is isolated by app and user; an app backend key uses a separate app-owned namespace. The service stores encrypted JSON records, not executable SQL or uploaded database files.</p><pre style={{overflow:'auto'}}>{`PUT /v1/apps/CLIENT_ID/data/posts/post_1
Authorization: Bearer USER_ACCESS_TOKEN
Content-Type: application/json
If-Match: "0"

{"data":{"text":"Hello"},"public":false}`}</pre><p>Use revision 0 for a new record. Read existing records first and send their revision in If-Match for updates and deletion. Each record is limited to 60 KB; quotas apply to the whole app and include a 1 KB metadata allowance plus reader ACL overhead. Capacity is a logical quota, not a reservation of physical disk space. GET lists return at most 100 records with nextCursor.</p><p>Anonymous read-only endpoints use /public/apps/CLIENT_ID/data/COLLECTION. Only records explicitly saved with public:true appear there. Public IDs are opaque and differ from private IDs. To withdraw a public record, save it as private or delete it through the authenticated endpoint.</p><p>For app-to-app access, a publisher enables its shared collections. The requesting app declares source, collection and a human-readable label in database settings. Each user explicitly approves those requests. Such grants permit reads of that user's records only, never writes or access to the app-owned backend namespace.</p><p>Private messaging can use readers:["recipientUsername"] on a record. Every recipient must have linked the same app. Recipients can list and read shared records but cannot modify or delete the sender's record. Updating readers revokes access. A shared record uses an opaque ID for its recipients. Cross-app grants apply only to the user's own authored records, not incoming private messages.</p>
<p>Users can independently publish selected name fields from Profile → Public profile. Nothing is public by default. Birthday and verified email addresses are excluded from public profiles.</p></section>
 <section className="xc-card xc-pad xc-stack"><h2>Before shipping</h2><p>Test wrong client, callback and verifier; replay; cancellation; process restart; pending and revoked apps; cross-user reads; private/public flags; quota failures; and unlinking. Verify real iOS and Android sign-in separately. Keep recovery and account linking explicit.</p><a href="https://github.com/Xarber/xcenter-id">Source and documentation repository</a><p>The repository is currently private. SDK licensing is AGPL-3.0-only; review the applicable obligations for your application.</p></section></main>;
}
