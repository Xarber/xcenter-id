export const sdkSource = 'https://github.com/Xarber/xcenter-id-sdk/tree/ed0d3f55fa1dbba44ac245ebdc1a58b1ad66e9f0';

export const groups = {
  setup: 'Setup & configuration',
  identity: 'Sign-in & sessions',
  profile: 'Profiles & friends',
  data: 'Records & storage',
  files: 'Files & folders',
  components: 'Account components',
  migration: 'Saved places migration',
  advanced: 'Transport & errors',
} as const;

type Group = keyof typeof groups;
type Argument = readonly [name: string, type: string, description: string];
type Flow = readonly [input: string, action: string, result: string];
export type Reference = {
  group: Group; id: string; title: string; signature: string; description: string;
  flow: Flow; args: readonly Argument[]; example: string; output: string;
  access?: string; related?: string; variants?: string;
};
const signal = ['options.signal?', 'AbortSignal', 'Cancels the request. Omit to use the normal request lifecycle.'] as const;
const cursor = ['options.cursor?', 'string', 'Pass the previous page’s nextCursor unchanged. Omit to start at the first page.'] as const;
const revision = ['options.revision', 'integer', 'Use 0 to create. For updates or deletes, supply the revision returned by the last read.'] as const;
const collection = ['collection', 'string', 'Collection identifier in the registered app’s namespace, such as notes.'] as const;
const recordId = ['id', 'string', 'Record identifier returned by the relevant list, or your chosen private ID for a new record.'] as const;
const clientId = ['clientId', 'string', 'Client ID assigned in Developer Apps.'] as const;
const issuer = 'https://id.xcenter.it';
const callback = ['redirectUri', 'string | URL', 'Exact registered callback. Native clients use a verified HTTPS app link.'] as const;
const fetchOption = ['fetch?', 'typeof fetch', 'Transport override for testing or supported hosts. Defaults to the runtime fetch.'] as const;
const scopes = ['scopes?', 'string[]', 'Request offline_access by default for normal sign-in. Use the hosted Stay signed in toggle as the only prompt. If no refresh token is issued, use a short session. Add only other needed scopes. openid is added automatically.'] as const;
const oldRefresh = ['refreshToken', 'string', 'Current refresh token from this app’s protected session. Replace it after a successful refresh.'] as const;
const subject = ['subject', 'string', 'Previously verified issuer subject for this app and account.'] as const;
const configFields = [
  ['clientId?', 'string', 'Explicit public registration ID. Otherwise read XCENTER_CLIENT_ID or the JSON clientId.'],
  ['redirectUri?', 'string', 'Exact callback. Otherwise read XCENTER_REDIRECT_URI or the JSON redirectUri.'],
  scopes,
  ['config?', 'object', 'Public JSON containing clientId, redirectUri and optional scopes.'],
  ['env?', 'object', 'Build-provided map with XCENTER_CLIENT_ID and XCENTER_REDIRECT_URI.'],
] as const;
const serverFields = [
  ['clientId?', 'string', 'Registration ID or XCENTER_CLIENT_ID. Required if absent from the other sources.'],
  ['clientSecret?', 'string', 'Confidential OAuth secret or XCENTER_CLIENT_SECRET. Keep in the backend.'],
  ['redirectUri?', 'string', 'Exact registered callback or XCENTER_REDIRECT_URI. Needed for browser OAuth.'],
  ['databaseKey?', 'string', 'Separate verified-app database key or XCENTER_DATABASE_KEY. Use for service storage.'],
  ['file?', 'string | URL | false', 'Private file path, default ./xid.json. Use false in Node to disable file loading.'],
  ['env?', 'record', 'Environment override. Defaults to the server process environment.'],
  scopes,
  ['promptConsent?', 'boolean', 'Requests the consent screen again in Node. Defaults to false.'],
  ['allowLoopback?', 'boolean', 'Enables an explicitly registered local loopback callback on supported server SDKs. Defaults to false.'],
] as const;
const tokens = '{\n  "tokens": {"access_token":"<redacted>","token_type":"Bearer","expires_in":600},\n  "identity": {"sub":"pairwise-subject","name":"Jamie Chen","preferred_username":"jamie"}\n}';
const configOutput = '{"clientId":"your-client-id","redirectUri":"https://app.example.com/callback","scopes":["openid","app_data"]}';
const configCode = 'import {publicConfig} from "@xcenter-id/client";\n\nconst config = publicConfig({\n  clientId: "your-client-id",\n  redirectUri: "https://app.example.com/callback",\n  scopes: ["openid", "app_data"],\n});';
const record = '{"id":"first_note","revision":1,"public":false,"data":{"title":"First note"}}';
const publicRecord = '{"id":"opaque-public-id","revision":1,"public":true,"data":{"title":"Published note"}}';
const page = (item: string) => '{"records":[' + item + '],"nextCursor":null}';
const ok = '{"ok":true}';
const mockId = '9dbbdc61-08a6-4c49-9df8-51cf596871cd';
const digest = '185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969';
const fileSample = {id:mockId,name:'hello.txt',created:1795600000000,size:5,sha256:digest};
const sharedSample = {...fileSample,from:'morgan'};
const appFileSample = {...fileSample,browseable:true,editable:false};
const digestBehavior = 'The sha256 field is a 64-character lowercase hexadecimal digest of the file bytes. It survives renames and moves. Use the file ID and digest together in your own index. Identical bytes can have multiple file IDs.';
const fileId = ['id', 'string', 'File or folder ID from an earlier list or create response.'] as const;
const folder = ['folder?', 'string | null', 'Parent folder ID. Omit or use null for the account root.'] as const;
const change = [
  ['change.name?', 'string', 'New display name. Omit to keep the current name.'],
  ['change.folder?', 'string | null', 'Destination folder ID. Use null for the root. Omit to keep the current folder.'],
] as const;
const write = [
  ['body.data', 'JSON', 'Value to store. Use JSON-compatible values. Serialized data is capped at 60,000 bytes.'],
  ['body.public', 'boolean', 'Required visibility choice. Public publishing requires a verified app.'],
] as const;
const platformData = 'Swift returns Data, Kotlin returns ByteArray, and Dart returns Uint8List. Decode JSON for structured responses and use image or file bytes directly for binary responses. Kotlin’s calls are blocking and belong on an IO dispatcher.';

const setup: Reference[] = [
  {group:'setup',id:'register-app',title:'Register an app',signature:'Developer Apps → Register app',description:'Create one registration per product. Choose a public native registration for a verified app link, or a confidential website registration for a backend. Add the actual product icon so users can identify it in consent. Activate the callback via the portal’s DNS challenge or exact-URL approval from an administrator.',
    flow:['Product identity','Verify callback ownership','Active registration'],args:[['Name and icon','text, image','Product name and recognizable app icon.'],['Registration type','Native app | Website','Native uses a public client ID. A confidential backend also receives a one-time client secret.'],['Callback URLs','HTTPS URLs','Exact authorized destinations. Native callback also needs platform app-link associations.'],['Permissions','scope and export settings','Configure required profile fields and any shared collections or app-to-app requests.']],
    example:'Callback: https://app.example.com/callback\nDNS TXT: _xcenter-id.app.example.com\nValue: use the challenge displayed by the portal',output:'{"status":"active","clientId":"your-client-id"}',related:'install'},
  {group:'setup',id:'install',title:'Install the SDK',signature:'Node.js · browser · Expo · Swift · Kotlin · Flutter',description:'Use the public SDK checkout. Node.js 22 or later can install source tarballs. Swift uses SwiftPM products XCenterID or XCenterIDServer on macOS. Kotlin includes the Android library or the standalone JVM module. Flutter and standalone Dart use the corresponding package paths.',
    flow:['Select your runtime','Add the SDK package','Import its entry point'],args:[['Browser','JavaScript modules','Keep index.js, config.js, oauth.js and session.js together. Install @xcenter-id/web for the account card.'],['Expo','packages/expo','Pack alongside packages/client. Use the installed Expo SDK’s auth-session, crypto and web-browser dependencies.'],['JVM / Dart backend','packages/kotlin-server or packages/dart-server','Use a server-only target with confidential configuration.']],
    example:'git clone https://github.com/Xarber/xcenter-id-sdk.git\ncd xcenter-id-sdk\nnpm pack ./packages/client ./packages/server\n\n# From your Node app, install both tarballs from that checkout.\nnpm install /path/to/xcenter-id-sdk/xcenter-id-client-0.7.0.tgz /path/to/xcenter-id-sdk/xcenter-id-server-0.3.0.tgz',output:'import {createPublicClient} from "@xcenter-id/client";\nimport {createXCenterOIDC} from "@xcenter-id/server";',related:'public-config'},
  {group:'setup',id:'public-config',title:'Parse public configuration',signature:'publicConfig(options?) → PublicConfig',description:'Resolves explicit settings first, then the build-provided environment map, then the public JSON object. Validation rejects confidential credential fields in the public JSON and explicit settings.',
    flow:['Explicit · environment · JSON','Resolve public settings','Client ID, callback and scopes'],args:configFields,example:configCode,output:configOutput,
    variants:'Swift uses XCenterPublicConfig.load(file:environment:clientId:redirectUri:scopes:). Android has XCenterPublicConfig.load and loadXCenterAsset(assets). Flutter uses XCenterPublicConfig.load or loadAsset. Expo accepts a JSON import as config.',related:'load-public-config'},
  {group:'setup',id:'load-public-config',title:'Read browser xid.json',signature:'loadPublicConfig(options?) → Promise<PublicConfig>',description:'Fetches a public JSON file on the page’s own origin without cookies. The same parser resolves constructor overrides and environment values.',
    flow:['Public /xid.json','Same-origin fetch','Validated public configuration'],args:[...configFields.filter(([name])=>name!=='config?'),['file?','string','Same-origin path. Defaults to /xid.json.'],fetchOption],
    example:'import {loadPublicConfig} from "@xcenter-id/client";\n\nconst config = await loadPublicConfig({file: "/xid.json"});',output:configOutput,related:'server-config'},
  {group:'setup',id:'server-config',title:'Read private server configuration',signature:'loadXCenterConfig(options?) → ServerConfig',description:'Resolves explicit options, environment variables, then a private xid.json. Missing implicit files are allowed. A missing explicitly selected file fails. Keep production files out of the public web root and version control.',
    flow:['Explicit · process environment · JSON','Resolve backend credentials','Ready for OAuth or service storage'],args:serverFields,
    example:'import {loadXCenterConfig} from "@xcenter-id/server";\n\nconst config = loadXCenterConfig({file: "/etc/my-app/xid.json"});',output:'{"clientId":"your-client-id","clientSecret":"<redacted>","redirectUri":"https://app.example.com/callback","scopes":[]}',
    variants:'Swift XCenterServerConfig.load(file:environment:explicit:) → identity() / records(). Kotlin XCenterConfig.load → identity() / records(). Dart XCenterConfig.load(path:, environment:, explicit:) → oauth() / records(). Each accepts its own typed constructor options.',related:'create-server-oauth'},
];

const signInArgs = [
  ['callback','string | URL','The full returned URL, including the code and state.'],
  ['transaction','OAuthTransaction','Single-use transaction created by begin and saved before redirect. Includes state, nonce, verifier and expiresAt.'],
] as const;
const beginOutput = '{"url":"https://id.xcenter.it/auth?…","transaction":{"state":"<random>","nonce":"<random>","verifier":"<private>","expiresAt":1795623000000}}';
const identity: Reference[] = [
  {group:'identity',id:'create-public-oauth',title:'Create a public OAuth client',signature:'createPublicOAuthClient(options) → PublicOAuthClient',description:'Creates the public-client sign-in, exchange and refresh adapter. It validates issuer discovery and uses PKCE S256 and RS256 token verification.',
    flow:['Public app configuration','Construct OAuth adapter','Begin, complete and refresh'],args:[...configFields,fetchOption,['crypto?','Crypto','Secure random and Web Crypto implementation. Defaults to globalThis.crypto.'],['verifyRS256?','(jwt, key) => boolean | Promise<boolean>','Runtime-specific verifier when Web Crypto is unavailable. Must validate against the supplied issuer JWK.'],['now?','() => number','Clock in milliseconds. Defaults to Date.now.']],
    example:'import {createPublicOAuthClient, loadPublicConfig} from "@xcenter-id/client";\n\nconst oauth = createPublicOAuthClient(await loadPublicConfig());',output:'{begin, complete, refresh, issuerSignOutURL}',related:'begin-sign-in'},
  {group:'identity',id:'create-server-oauth',title:'Create a backend OAuth client',signature:'createXCenterOIDC(options?) → Promise<ServerOAuthClient>',description:'Creates a server adapter using live discovery. Configure a confidential secret on the backend. Node also supports a registered public client when initialized without a secret.',
    flow:['Protected registration settings','Discover and pin issuer endpoints','Backend OAuth adapter'],args:serverFields,
    example:'import {createXCenterOIDC} from "@xcenter-id/server";\n\nconst auth = await createXCenterOIDC();',output:'{begin, complete, beginDevice, completeDevice, userInfo, refresh, issuerSignOutURL, revoke}',
    variants:'Swift uses XCenterServerConfig.identity(), Kotlin uses XCenterConfig.identity(), and standalone Dart uses XCenterConfig.oauth().',related:'begin-sign-in'},
  {group:'identity',id:'begin-sign-in',title:'Start browser sign-in',signature:'oauth.begin(options?) → {url, transaction}',description:'Generates an authorization URL and short-lived proofs. Save the transaction bound to the current app session before opening the browser. On native, prefer the supported system authentication browser.',
    flow:['Your app starts sign-in','Save PKCE transaction','User approves in browser'],args:[scopes,['promptConsent?','boolean','Request a fresh consent screen. offline_access also triggers consent. Defaults to false.']],example:'const {url, transaction} = await oauth.begin({\n  scopes: ["app_data", "offline_access"],\n});\nawait saveLoginAttempt(transaction);\nwindow.location.assign(url.href);',output:beginOutput,
    variants:'Node configures scopes and consent when calling createXCenterOIDC. Its begin() takes no arguments. Native Swift, Kotlin and Dart offer their own transaction types or system-browser helper.',related:'complete-sign-in'},
  {group:'identity',id:'complete-sign-in',title:'Exchange and validate a callback',signature:'oauth.complete(callback, transaction, options?) → {tokens, identity}',description:'Consumes the authorization code with its original PKCE verifier. Validates the returned ID token and checks the UserInfo subject. Remove the saved transaction when taking it for use. Use a host-provided secure session store for the result.',
    flow:['Browser returns code and state','Validate proofs and signed token','Verified account and tokens'],args:[...signInArgs,signal],
    example:'const attempt = await takeLoginAttempt();\nconst session = await oauth.complete(window.location.href, attempt);\nawait saveProductSession(session);',output:tokens,variants:'On Node pass the backend-observed callback and saved transaction. The Node method takes two arguments. Apple, Kotlin and Dart use their platform-specific transaction types.',related:'refresh'},
  {group:'identity',id:'refresh',title:'Rotate an existing session',signature:'oauth.refresh(refreshToken, subject, options?) → {tokens, identity}',description:'Renews the access token when the user granted offline_access. The provider rotates refresh credentials and extends the 14-day idle window upon successful renewal. Serialize requests and save rotated tokens together.',
    flow:['Stored refresh credential','Rotate at the token endpoint','Persist replacement tokens'],args:[oldRefresh,subject,signal],example:'const replacement = await oauth.refresh(saved.refreshToken, saved.subject);\nawait saveProductSession(replacement);',output:tokens.replace('"expires_in":600','"expires_in":600,"refresh_token":"<rotated>"'),
    variants:'Expo sign-in exposes refresh(token, subject). Node’s refresh(refreshToken) returns the token set. Use Node userInfo(accessToken, subject) to bind the renewed profile to the saved account.',related:'session-token-source'},
  {group:'identity',id:'session-token-source',title:'Refresh on demand',signature:'createSessionTokenSource(options) → () => Promise<string>',description:'Reuses the access token until it is close to expiry. Reloads the persisted session inside the lock so concurrent callers can reuse the new token. Keep one token source per product session.',
    flow:['API asks for an access token','Load or rotate under a lock','API uses the current token'],args:[
      ['withLock','(work) => Promise','Serializes refresh for this credential across any participating workers or windows.'],
      ['load','() => Promise<SessionTokens | null>','Reads accessToken, optional refreshToken and expiresAt in milliseconds.'],
      ['save','(tokens) => Promise<void>','Persists the replacement tokens atomically.'],
      ['refresh','(token) => Promise<TokenResponse>','Returns access_token, optional refresh_token and expires_in in seconds.'],
      ['now?','() => number','Clock in milliseconds. Defaults to Date.now.'],
      ['refreshWindowMs?','number','Refresh threshold in milliseconds. Defaults to 30,000 ms.'],
    ],example:'const getAccessToken = createSessionTokenSource({\n  withLock, load: loadSession, save: saveSession,\n  refresh: async token => (await oauth.refresh(token, subject)).tokens,\n});\nconst user = createUserClient({clientId, getAccessToken});',output:'"<current access token>"',
    variants:'Swift, Kotlin and Dart provide XCenterSessionTokenSource with native token types and a platform-specific storage adapter.',related:'create-user-client'},
  {group:'identity',id:'begin-device',title:'Begin device sign-in',signature:'auth.beginDevice() → {userCode, verificationUrl, transaction}',description:'Use for TVs or other devices where the system browser is unavailable or inconvenient. The product backend starts the request. Show the user code and QR using the verification URL. Keep the device transaction on the backend.',
    flow:['TV requests sign-in','Backend starts device approval','TV shows code and QR'],access:'Confidential backend registration',args:[],
    example:'const {userCode, verificationUrl, transaction} = await auth.beginDevice();\nawait saveDeviceAttempt(transaction);\nreturn {userCode, verificationUrl};',output:'{"userCode":"X7K2PQ","verificationUrl":"https://id.xcenter.it/device?code=X7K2PQ"}',
    variants:'Swift returns verificationURL. Kotlin returns userCode and verificationUrl. Dart returns code and verificationUrl. Keep the raw device transaction private on all backends.',related:'complete-device'},
  {group:'identity',id:'complete-device',title:'Wait for device confirmation',signature:'auth.completeDevice(transaction, options?) → {tokens, identity}',description:'Waits until the user confirms the request on an already signed-in device or the request expires. The SDK handles polling intervals and slow-down responses. Bind approval to the initiating product session.',
    flow:['User confirms on phone','Backend polls with device proof','TV session becomes available'],access:'Confidential backend registration',
    args:[['transaction','DeviceTransaction','Kept server-side from beginDevice.'],signal],example:'const session = await auth.completeDevice(attempt, {signal});\nawait saveProductSession(session);',output:tokens,
    variants:'Kotlin uses a cancellation callback. Swift and Dart expose completion through their server SDKs.',related:'issuer-sign-out'},
  {group:'identity',id:'issuer-sign-out',title:'Open issuer sign-out',signature:'oauth.issuerSignOutURL() → URL',description:'Clear the product’s local session and credentials. Use this URL when the user also wants to end their X-Center ID browser session. Existing app grants are managed through Linked apps.',
    flow:['Clear product session','Open issuer sign-out','Issuer browser session ends'],args:[],example:'await clearProductSession();\nwindow.location.assign(oauth.issuerSignOutURL().href);',output:'https://id.xcenter.it/session/end',
    variants:'Swift exposes issuerSignOutURL as a property. Kotlin and Dart use issuerSignOutUrl.',related:'revoke'},
  {group:'identity',id:'revoke',title:'Check OAuth revocation support',signature:'auth.revoke(token, tokenTypeHint?) → Promise<void>',description:'The Node adapter supports issuers advertising a revocation endpoint. X-Center ID currently has no such endpoint. Send users to Linked apps to unlink a grant and discard their product tokens when appropriate.',
    flow:['App requests grant removal','User unlinks in the dashboard','Previously granted access is revoked'],args:[['token','string','Access or refresh token if the issuer advertises token revocation.'],['tokenTypeHint?','access_token | refresh_token','Optional indication of the supplied token’s type.']],
    example:'// For X-Center ID, offer a link to Linked apps.\nconst linkedApps = "https://id.xcenter.it/apps";',output:'Unsupported through auth.revoke on the current issuer. Linked apps provides unlinking.'},
  {group:'identity',id:'expo-oauth',title:'Sign in with Expo’s system browser',signature:'createExpoOAuth(options) → {signIn, refresh, issuerSignOutURL}',description:'Opens ASWebAuthenticationSession on iOS and the supported system browser on Android. Matches the exact HTTPS callback, exchanges the code and validates the account. The browser closes on return. Cancellation resolves to null.',
    flow:['Tap the sign-in action','System browser returns a verified link','Validated identity or cancellation'],args:[...configFields,fetchOption,['signIn({scopes?, promptConsent?})','object','Override requested scopes or ask for new consent for a single attempt.']],
    example:'import {createExpoOAuth} from "@authnjs/expo/oauth";\nimport config from "./xid.json";\n\nconst auth = createExpoOAuth({config});\nconst session = await auth.signIn();\nif (session) await saveProductSession(session);',output:tokens,
    variants:'iOS HTTPS callbacks need iOS 17.4 or newer. Use the secure backend handoff when an app cannot register a callback.',related:'authorize-native'},
  {group:'identity',id:'authorize-native',title:'Get a native authorization code',signature:'authorizeNative(options) → Promise<NativeAuthorizationResult | null>',description:'Returns a short-lived code for a product using its own exchange flow. Bind it to a product transaction created before authorization. The backend verifies the original nonce and independently validates the issuer and client.',
    flow:['Backend prepares transaction','OS secure authentication browser','Code and PKCE verifier return'],
    args:[['issuer','string','Use https://id.xcenter.it.'],clientId,callback,scopes,['nonce?','string','Fresh transaction nonce from your backend when using backend exchange.'],['promptConsent?','boolean','Prompt again for updated permissions. Defaults to false.']],
    example:'const prepared = await beginProductAttempt();\nconst result = await authorizeNative({issuer: "https://id.xcenter.it", clientId, redirectUri, nonce: prepared.nonce});\nif (result) await finishProductAttempt(prepared.id, result);',output:'{"code":"<single-use>","verifier":"<private>","nonce":"<random>","state":"<random>","redirectUri":"https://app.example.com/callback","callbackUrl":"https://app.example.com/callback?…","expiresAt":1795623000000}',related:'complete-sign-in'},
];

const userName = ['username','string','Public X-Center ID handle, without @.'] as const;
const registration = ['registrationId','string','App registration UUID from Developer Apps. This is separate from the OAuth client ID.'] as const;
const sourceClient = ['client','string','OAuth client ID of the registration that owns the collection.'] as const;
const binaryImage = 'HTTP 200 · Content-Type: image/png\n<binary image bytes>';
const bytes = 'HTTP 200 · Content-Type: application/octet-stream\n<file bytes>';
const userInfo = '{"sub":"pairwise-subject","name":"Jamie Chen","preferred_username":"jamie","email":"jamie@example.com","email_verified":true}';
const profile: Reference[] = [
  {group:'profile',id:'create-public-client',title:'Create an anonymous client',signature:'createPublicClient(options?) → PublicClient',description:'Use for public profile, icon, record and discovery requests. Requests omit authorization credentials and cookies.',
    flow:['Anonymous viewer','Create public client','Read deliberately published resources'],args:[fetchOption],example:'import {createPublicClient} from "@xcenter-id/client";\n\nconst publicApi = createPublicClient();',output:'{discover, profile, avatarUrl, avatar, appIconUrl, appIcon, listRecords, getRecord}',variants:'Use a credential-free XCenterDataClient initializer in Swift, Kotlin or Dart.',related:'discover'},
  {group:'profile',id:'create-user-client',title:'Create a user-authorized client',signature:'createUserClient({clientId, getAccessToken, fetch?}) → UserClient',description:'Uses the token from the signed-in product session on each operation. Use the active registration, and pass a token callback so refreshed credentials are picked up.',
    flow:['Signed-in product account','Supply current access token','Read or write granted data'],args:[clientId,['getAccessToken','() => string | Promise<string>','Returns a current user access token. A service database key is rejected.'],fetchOption],
    example:'import {createUserClient} from "@xcenter-id/client";\n\nconst user = createUserClient({clientId, getAccessToken});',output:'{userInfo, avatar, friends, records, sharedRecords, files}',
    variants:'Swift uses XCenterDataClient(clientID:session:accessToken:). Kotlin uses XCenterDataClient(clientId, accessToken). Dart uses XCenterDataClient(clientId:, accessToken:, client:). Refer to platform source for transport types.',related:'user-info'},
  {group:'profile',id:'discover',title:'Read issuer discovery',signature:'publicApi.discover(options?) → Promise<object>',description:'Reads the issuer’s OpenID configuration and advertised capabilities. Use the registered issuer URL as the trust anchor.',
    flow:['Public client','Fetch issuer metadata','Authorization and token endpoints'],args:[signal],example:'const metadata = await publicApi.discover({signal});\nconsole.log(metadata.issuer);',
    output:'{"issuer":"https://id.xcenter.it","authorization_endpoint":"https://id.xcenter.it/auth","token_endpoint":"https://id.xcenter.it/token","jwks_uri":"https://id.xcenter.it/jwks"}',variants:platformData,related:'create-public-oauth'},
  {group:'profile',id:'public-profile',title:'Read a public profile',signature:'publicApi.profile(username, options?) → Promise<Profile>',description:'Returns fields the account opted to publish. Missing or private profiles can return 404. Private email, age range and birthday are excluded.',
    access:'Anonymous',flow:['Public username','Apply profile visibility settings','Published fields only'],args:[userName,signal],example:'const profile = await publicApi.profile("jamie");',output:'{"username":"jamie","givenName":"Jamie","avatar":null,"verified":true}',variants:'Native name: publicProfile. '+platformData,related:'public-avatar'},
  {group:'profile',id:'user-info',title:'Read the signed-in user',signature:'user.userInfo(options?) → Promise<UserInfo>',description:'Returns the signed-in profile and the app-specific subject. Use issuer and sub to identify the local account. Email and age_range appear only with the applicable scopes and consent.',
    access:'openid · email and age_range when granted',flow:['User access token','Resolve consented profile claims','App-specific subject and profile'],args:[signal],
    example:'const identity = await user.userInfo({signal});\nconsole.log(identity.preferred_username);',output:userInfo,variants:platformData,related:'user-avatar'},
  {group:'profile',id:'server-user-info',title:'Bind UserInfo to a subject',signature:'auth.userInfo(accessToken, subject) → Promise<UserInfo>',description:'Fetches UserInfo and checks that its subject matches the previously authenticated subject. Use after a Node token refresh if you need updated claims.',
    access:'User access token',flow:['Access token and known subject','Fetch and bind UserInfo','Profile for the expected account'],args:[['accessToken','string','Access token from the active product session.'],subject],
    example:'const identity = await auth.userInfo(tokens.access_token, saved.subject);',output:userInfo,related:'refresh'},
  {group:'profile',id:'friends',title:'List consented friends',signature:'user.friends(options?) → Promise<{friends}>',description:'Reads accepted friends. The friend’s app-specific sub is returned only when the friend also linked this registration. Store only the identifiers needed by your integration.',
    access:'friends',flow:['User grants Friends','Look up accepted friends','Handles and linked-app subjects'],args:[signal],
    example:'const {friends} = await user.friends();\nconst linkedFriends = friends.filter(friend => friend.sub);',output:'{"friends":[{"username":"morgan","sub":"friend-pairwise-subject"},{"username":"riley"}]}',variants:platformData,related:'user-info'},
];

const images = [
  ['public-avatar-url','Build a public avatar URL','publicApi.avatarUrl(username) → string','username',userName,'publicApi.avatarUrl("jamie")','https://id.xcenter.it/public/profiles/jamie/avatar','Builds the public avatar URL without a request. The actual image follows profile visibility.','public-avatar'],
  ['public-avatar','Download a public avatar','publicApi.avatar(username, options?) → Promise<Response>','username',userName,'await publicApi.avatar("jamie")',binaryImage,'Fetch a publicly shared avatar. Handle a missing or private avatar with your default icon.','public-avatar-url'],
  ['user-avatar','Download the signed-in avatar','user.avatar(options?) → Promise<Response>','token',null,'await user.avatar()',binaryImage,'Uses the consented user token to fetch an authenticated avatar. In browser code, convert the response to a blob URL and revoke it when no longer used.','user-info'],
  ['app-icon-url','Build a public app icon URL','publicApi.appIconUrl(registrationId) → string','registration ID',registration,'publicApi.appIconUrl("'+mockId+'")','https://id.xcenter.it/public/app-icons/'+mockId,'Builds a stable public icon URL for the registration. Display a default if it has no uploaded icon.','app-icon'],
  ['app-icon','Download an app icon','publicApi.appIcon(registrationId, options?) → Promise<Response>','registration ID',registration,'await publicApi.appIcon("'+mockId+'")',binaryImage,'Reads the app’s current icon. The icon can change without relinking or reauthorizing the app.','app-icon-url'],
] as const;
for(const [id,title,signature,input,arg,expression,output,description,related] of images){
  const isUrl=id.endsWith('-url');
  profile.push({group:'profile',id,title,signature,description,flow:[input,isUrl?'Build issuer URL':'Fetch allowed image',isUrl?'Public image URL':'Image response'],
    access:id==='user-avatar'?'openid and a user access token':'Anonymous',args:[...(arg?[arg]:[]),...(isUrl?[]:[signal])],
    example:'const '+(isUrl?'url':'response')+' = '+expression+';',output,related,variants:isUrl?undefined:platformData});
}

const data: Reference[] = [
  {group:'data',id:'create-service-client',title:'Connect to verified app storage',signature:'createServiceClient(options?) → {records}',description:'Uses the app’s service database namespace, separate from private user containers. Create a database key in a verified app’s storage settings and keep it on the backend.',
    access:'Verified app service database key',flow:['Verified registration and database key','Create backend service client','App-owned records'],args:[...serverFields,fetchOption],
    example:'import {createServiceClient} from "@xcenter-id/server/data";\n\nconst service = createServiceClient();\nconst health = await service.records.get("status", "installation");',
    output:'{records: {list, get, put, delete}}',variants:'Swift XCenterServerConfig.records(), Kotlin XCenterConfig.records(), or Dart XCenterConfig.records(). Their put APIs accept data and visibility directly. Service records have no per-user reader ACL.',related:'service-records-put'},
];
const recordActions = ['list','get','put','delete'] as const;
for(const namespace of ['user','service','shared','public'] as const){
  const isPublic=namespace==='public';
  const isShared=namespace==='shared';
  const isService=namespace==='service';
  const isUser=namespace==='user';
  const access=isPublic?'Anonymous':isShared?'app_data · both apps linked · live collection grant':isService?'Verified app database key':'app_data';
  const label={user:'account',service:'service',shared:'cross-app',public:'public'}[namespace];
  for(const action of recordActions){
    if((isPublic||isShared)&&(action==='put'||action==='delete'))continue;
    const list=action==='list';
    const put=action==='put';
    const remove=action==='delete';
    const method=isPublic?(list?'publicApi.listRecords':'publicApi.getRecord'):isShared?'user.sharedRecords.'+action:namespace+'.records.'+action;
    const args: Argument[]=[...(isPublic||isShared?[sourceClient]:[]),collection,...(!list?[recordId]:[]),...(list?[cursor]:[])];
    if(put)args.push(...write);
    if(put&&isUser)args.push(['body.readers?','string[]','Handles of recipients who also linked the app. Replace this list to change access. Omission clears existing reader grants. Repeat the desired usernames when updating.']);
    if(put||remove)args.push(revision);
    args.push(signal);
    const signature=method+'('+(isPublic||isShared?'client, ':'')+'collection'+(list?'':', id')+(put?', body':'')+(put||remove?', options':', options?')+')';
    const input=(isPublic||isShared?'"source-client-id", ':'')+'"notes"'+(list?'':isPublic?', "opaque-public-id"':isShared?', "first_note"':', "first_note"');
    const example=put?'const result = await '+method+'('+input+', {\n  data: {title: "First note"}, public: false,\n}, {revision: 0});'
      : 'const result = await '+method+'('+input+(remove?', {revision: current.revision}':'')+');';
    const readOutput=isPublic?publicRecord:record;
    const output=list?page(readOutput):put?'{"id":"first_note","revision":1,"public":false}':remove?ok:readOutput;
    const actionText={
      list:'Read up to 100 records. Continue by passing nextCursor, then stop when it is null.',
      get:'Read one record with its data, visibility and revision. An unavailable record can return 404.',
      put:'Set data and explicit visibility. Create with revision 0. For an existing record, read its revision before updating. Resolve conflicts before retrying.',
      delete:'Permanently removes the record after checking its revision. Read the current revision before deleting.',
    }[action];
    const boundary={
      user:'The records live in the signed-in account’s app container. Active apps can use private user storage without verification.',
      service:'The records live in the verified app’s database, independently of a signed-in user.',
      shared:'The publisher exports the collection and the user approves access. The request reads that user’s authored records in the source app. Service records and incoming recipient shares stay outside this grant.',
      public:'The registration must be verified and the record must explicitly be public. Use the public ID from the list for public lookups.',
    }[namespace];
    const variants=isPublic||isShared?'Swift and Kotlin use listRecords or getRecord with RecordSpace. Dart uses sharedFrom for cross-app and listPublicRecords or getPublicRecord for public data. '+platformData
      :isService?'The Swift, Kotlin and Dart service clients expose list, get, put and delete. Their mutating calls take the revision directly. '+platformData
      :'Swift, Kotlin and Dart name these listRecords, getRecord, putRecord and deleteRecord. Their write APIs use a typed value or explicit data and visibility. '+platformData;
    data.push({group:'data',id:namespace+'-records-'+action,title:(put?'Write':action[0].toUpperCase()+action.slice(1))+' '+label+' '+(list?'records':'record'),signature,
      description:actionText+' '+boundary,access,flow:[isPublic?'Public reader':isShared?'Granted source collection':isService?'Backend database key':'Signed-in app session',
        {list:'Read collection page',get:'Resolve record ID',put:'Validate revision and write',delete:'Validate revision and delete'}[action],
        {list:'Records and next cursor',get:'Data with revision',put:'New record revision',delete:'Deletion acknowledgment'}[action]],
      args,example,output,variants,related:namespace+'-records-'+(list?'get':'list')});
  }
}
data.push({group:'data',id:'recipient-sharing',title:'Share a record with recipients',signature:'user.records.put(collection, id, {data, public, readers}, options)',description:'Share a private record with named recipients who already linked the same app. Readers receive an opaque ID and may read the record without editing it. Set readers to [] on the next edit to remove recipient access.',
  access:'app_data · same app linked by every recipient',flow:['Author lists recipients','Save private record with reader grant','Recipients see read-only record'],
  args:[collection,recordId,...write,['body.readers','string[]','Recipient usernames. Use an empty list to revoke recipient shares.'],revision,signal],
  example:'await user.records.put("messages", "first_message", {\n  data: {text: "Hello Morgan"}, public: false, readers: ["morgan"],\n}, {revision: 0});',output:'{"id":"first_message","revision":1,"public":false}',related:'user-records-list'});

const files: Reference[] = [];
type FileDoc = [id:string,title:string,method:string,signature:string,description:string,access:string,action:string,result:string,args:readonly Argument[],code:string,output:string,native:string];
const fileDocs: FileDoc[] = [
  ['list-files','List files in a folder','list','options?','List direct children and the breadcrumb trail. Each folder row includes a recursive size in bytes. Pass a folder ID from a preceding result to open a nested folder. '+digestBehavior,'files_read or files_write','Enumerate selected folder','Files, folders and breadcrumbs',[folder],'const listing = await user.files.list();',JSON.stringify({files:[fileSample],folders:[],breadcrumbs:[]}),'listFiles(folder)'],
  ['get-file','Get file metadata','get','id, options?','Return a file descriptor without downloading the file. '+digestBehavior,'files_read or files_write','Read file metadata','File descriptor',[fileId],'const {sha256} = await user.files.get(id);',JSON.stringify(fileSample),'getFile(id)'],
  ['download-file','Download a file','download','id, options?','Read a file as a binary response. In JavaScript use arrayBuffer() or blob() and offer a safe save destination.','files_read or files_write','Fetch owned file','File response',[fileId],'const response = await user.files.download("'+mockId+'");\nconst content = await response.arrayBuffer();',bytes,'downloadFile(id)'],
  ['upload-file','Upload a file','upload','file, options?','The delegated upload accepts a nonempty file up to 2 MiB and counts against the user’s quota. For larger files, use the resumable transfer API.','files_write','Decode and save file','New file ID',[['file.name','string','Display name, including the extension if applicable.'],['file.content','base64 string','Raw base64-encoded bytes. Omit data URL prefixes.'],['file.folder?','string | null',folder[2]]],'const created = await user.files.upload({name:"hello.txt", content:"SGVsbG8="});','{"id":"'+mockId+'"}','uploadFile(name, contentBytes, folder)'],
  ['update-file','Rename or move a file','update','id, change, options?','Supply a new name, a destination folder, or both. A move uses the existing file ID.','files_write','Apply rename or move','Change acknowledgment',[fileId,...change],'await user.files.update("'+mockId+'", {name:"welcome.txt", folder:null});',ok,'updateFile(id, change)'],
  ['delete-file','Delete a file','delete','id, options?','Removes an account-owned file. Ask the user to confirm consequential deletions in your product.','files_write','Remove owned file','Deletion acknowledgment',[fileId],'await user.files.delete("'+mockId+'");',ok,'deleteFile(id)'],
  ['create-folder','Create a folder','createFolder','folder, options?','Creates a named folder inside an existing folder or at the account root. Keep the returned ID for navigation and future uploads.','files_write','Create empty directory','New folder ID',[['folder.name','string','Name to display in the file browser.'],['folder.folder?','string | null',folder[2]]],'const folder = await user.files.createFolder({name:"Notes"});','{"id":"'+mockId+'"}','createFolder(name, parent)'],
  ['update-folder','Rename or move a folder','updateFolder','id, change, options?','Change the folder name or parent. A folder cannot be moved into itself or any of its descendants.','files_write','Validate destination and move','Change acknowledgment',[fileId,...change],'await user.files.updateFolder("'+mockId+'", {name:"Meeting notes", folder:null});',ok,'updateFolder(id, change)'],
  ['delete-folder','Delete an empty folder','deleteFolder','id, options?','The delegated method accepts empty folders only. Use the account dashboard for recursive deletion.','files_write','Check that the folder is empty','Deletion acknowledgment',[fileId],'await user.files.deleteFolder("'+mockId+'");',ok,'deleteFolder(id)'],
  ['list-shared-files','List incoming file shares','listShared','options?','Returns files shared with the signed-in user and the sender’s handle. IDs identify the shares. Use them with getShared or downloadShared. Each entry includes sha256.','shared_files_read','Look up incoming grants','Read-only shared files',[],'const {incoming} = await user.files.listShared();',JSON.stringify({incoming:[sharedSample]}),'listSharedFiles()'],
  ['get-shared-file','Get shared file metadata','getShared','id, options?','Return the sender and file descriptor while the share remains active. '+digestBehavior,'shared_files_read','Verify the live share','Shared file descriptor',[['id','string','Incoming share ID returned by listShared.']],'const {sha256} = await user.files.getShared(shareId);',JSON.stringify(sharedSample),'getSharedFile(id)'],
  ['download-shared-file','Download an incoming file share','downloadShared','id, options?','Uses a share ID from listShared. Downloads work only while the original user’s file and the live share are available.','shared_files_read','Check live share and fetch','Shared file bytes',[['id','string','Incoming share ID returned by listShared.']],'const response = await user.files.downloadShared("'+mockId+'");\nconst content = await response.arrayBuffer();',bytes,'downloadSharedFile(id)'],
];
for(const [id,title,method,signature,description,access,action,result,args,example,output,native] of fileDocs){
  files.push({group:'files',id,title,signature:'user.files.'+method+'('+signature+')',description,access,
    flow:['Delegated file permission',action,result],args:[...args,signal],example,output,
    variants:'Native method: '+native+'. '+platformData,related:id.includes('shared')?(id==='list-shared-files'?'download-shared-file':'list-shared-files'):(id==='list-files'?'upload-file':'list-files')});
}

const components: Reference[] = [
  {group:'components',id:'account-overview',title:'Show Account Overview in Settings',signature:'<AccountOverview profile={...} />',description:'Put one overview at the top of Settings. It shows the sign-in banner or the current profile, and opens account details with Open dashboard, Manage app and Sign out. Let the host update the controlled profile after login and cleanup.',
    flow:['Signed-out banner','System sign-in & saved product session','Profile and account controls'],args:[
      ['profile','OverviewProfile | null','Null when signed out. Profile takes name and username, optional email, photo, verified and administrator. Expo photo is ImageSourcePropType.'],
      ['clientId?','string','Needed for Manage app when not part of the signIn settings.'],
      ['signIn?','RegisteredAppSignInProps','Built-in Expo PKCE flow returning the code to onAuthorized.'],
      ['onSignIn?','() => void | Promise<void>','Custom adapter. Takes precedence. Suitable for createExpoOAuth.'],
      ['onSignOut?','() => void | Promise<void>','Clear the product session and update the controlled profile.'],
      ['iosBackendSignIn?','{begin(signal)}','For iOS apps with no supported callback. The result provides url and complete(signal).'],
      ['webSignIn?','{startPath:string}','Same-origin HTTPS backend start route.'],
      ['syncOptions?','readonly OverviewSyncOption[]','Optional controls with id, label, enabled and onChange. Each may have description and disabled. Defaults to [].'],
      ['settings?','ReactNode','App-owned controls inside the account details.'],
      ['onOpenSettings?','() => void','Open app-owned settings.'],
      ['onManageAccount?','() => void | Promise<void>','Override the default details navigation.'],
    ],example:'import {AccountOverview} from "@authnjs/expo/account-overview";\n\n<AccountOverview\n  profile={profile}\n  clientId={clientId}\n  onSignIn={openManagedSignIn}\n  onSignOut={clearProductSession}\n  settings={<SyncSettings />}\n/>',output:'Signed out: Continue with X-Center ID\nSigned in: Jamie Chen · @jamie\nDetails: Open dashboard · Manage app · Sign out',
    variants:'SwiftUI, Compose and Flutter expose their own AccountOverview components. The browser uses the custom element below. Full platform constructors and examples are linked from SDK source.',related:'expo-oauth'},
  {group:'components',id:'web-account-overview',title:'Embed the browser account component',signature:'<xcenter-account-overview client-id="…">',description:'Use the Web Component from plain HTML or your framework. Set its properties on the element. Place app settings in its settings slot. A backend sign-in adapter can start at a same-origin endpoint.',
    flow:['Embed the account element','Set profile and session handlers','Render account and sync controls'],args:[
      ['client-id','attribute','Registered client ID for the Manage app link.'],
      ['start-path, style-nonce','optional attributes','Same-origin secure sign-in route and a CSP nonce for the component’s style.'],
      ['profile','OverviewProfile | null','name, username, optional picture URL, email, verified and administrator.'],
      ['syncOptions','array','label, enabled and onChange, plus optional description and disabled.'],
      ['signIn?, signOut?','() => void | Promise<void>','Product session handlers.'],
      ['settings','slot','App-managed content shown in account details.'],
    ],example:'import "@xcenter-id/web";\n\nconst card = document.querySelector("xcenter-account-overview");\ncard.signIn = () => location.assign("/sign-in/xcenter");\ncard.signOut = clearProductSession;\ncard.profile = {name:"Jamie Chen", username:"jamie"};',output:'An account card showing Jamie Chen and a Manage account & data action.',related:'account-overview'},
  {group:'components',id:'registered-app-sign-in',title:'Use the registered sign-in button',signature:'<RegisteredAppSignIn {...options} />',description:'An Expo standalone native sign-in action. Its browser flow returns the native authorization proof to the host exchange handler. For host-managed account settings use AccountOverview.',
    flow:['User taps branded button','System browser runs PKCE','Host handles authorized code'],
    args:[clientId,callback,scopes,['nonce?','string','Backend-generated nonce for a prepared transaction.'],['promptConsent?','boolean','Ask for consent again when scopes change.'],['onAuthorized','(NativeAuthorizationCode) => Promise<void>','Validate and exchange the returned code with your product adapter.']],
    example:'import {RegisteredAppSignIn} from "@authnjs/expo/registered-signin";\n\n<RegisteredAppSignIn clientId={clientId} redirectUri={redirectUri}\n  nonce={attempt.nonce} onAuthorized={finishPreparedAttempt} />',output:'Branded sign-in button, followed by native browser or a user-facing error.',related:'authorize-native'},
  {group:'components',id:'account-entry',title:'Render a custom entry screen',signature:'<AccountEntry {...options} />',description:'An Expo entry component for teams providing their own session adapter. Product integrations normally open the X-Center ID system browser for sign-in and registration. The username and code hooks require an authorized adapter for those flows.',
    flow:['Entry screen action','Call host authentication handler','Update the UI from host state'],
    args:[['onSignIn?, onCreateAccount?','() => void','Open the host’s sign-in or enrollment path.'],
      ['onUsernameSubmit?','(username) => Promise<method | undefined>','Returns {method:"email",ticket} or {method:"passkey"} for an authorized adapter.'],
      ['onCodeSubmit?','(ticket, code) => Promise<void>','Handles a pending code challenge from the adapter.'],
      ['pending?, pendingAction?','boolean, passkey | signup','Busy state and selected action. pending defaults to false.'],
      ['transparent?','boolean','Uses a transparent component surface. Defaults to true.'],
      ['error?, children?','string, ReactNode','Visible error and custom application content.']],
    example:'import {AccountEntry} from "@authnjs/expo";\n\n<AccountEntry onSignIn={openSecureBrowser}\n  onCreateAccount={openEnrollment} pending={busy} error={error} />',output:'Sign-in and registration actions with product-provided loading and errors.',related:'account-overview'},
  {group:'components',id:'native-backend-handoff',title:'Sign in without a native callback',signature:'AccountOverview.iosBackendSignIn = {begin(signal)}',description:'Use when the product cannot own a supported OS callback. The product backend owns its registered callback and binds a short-lived pickup to the initiating app session. The approved system browser closes after the app verifies and saves the product session.',
    flow:['Native app starts protected pickup','Backend finishes browser OAuth','App collects verified product session'],
    args:[['begin','(signal) => Promise<{url, complete}>','Prepares product-backend browser sign-in and returns an HTTPS URL.'],
      ['complete','(signal) => Promise<void>','Poll a proof-bound pickup, then verify and save the returned product session. Honor cancellation.']],
    example:'<AccountOverview profile={profile} clientId={clientId}\n  iosBackendSignIn={{begin: prepareProofBoundSignIn}}\n  onSignOut={clearProductSession} />',output:'After approval the sign-in sheet closes and Settings shows the signed-in profile.',related:'create-server-oauth'},
];

const migration: Reference[] = [{
  group:'migration',id:'saved-places-client',title:'Connect to historical saved places',signature:'createSavedPlacesClient(options) → {list, create, update, delete}',
  description:'Compatibility client for a legacy dataset used by existing integrations. Use app-owned record collections for new product data. The migration surface uses an authorized user token.',
  access:'Confidential registration · delegated app_data',flow:['Existing migration integration','Use delegated user credential','Read or migrate saved places'],
  args:[['getAccessToken','() => string | Promise<string>','Returns the current authorized user token.'],fetchOption],
  example:'import {createSavedPlacesClient} from "@xcenter-id/server";\n\nconst places = createSavedPlacesClient({getAccessToken});',output:'{list, create, update, delete}',
  variants:'Use XCenterSavedPlaces from the Swift, Kotlin, or Dart server module.',related:'saved-places-list',
}];
const placeWrite = [
  ['body.label','string','Human-readable place name.'],
  ['body.latitude','number','Latitude in decimal degrees, from -90 through 90.'],
  ['body.longitude','number','Longitude in decimal degrees, from -180 through 180.'],
] as const;
const place = '{"id":"'+mockId+'","label":"Central station","latitude":45.48,"longitude":9.20,"revision":1}';
for(const action of recordActions){
  const legacyAction=action==='get'?'create':action==='put'?'update':action;
  const list=legacyAction==='list';
  const create=legacyAction==='create';
  const update=legacyAction==='update';
  const title=legacyAction[0].toUpperCase()+legacyAction.slice(1);
  migration.push({group:'migration',id:'saved-places-'+legacyAction,title:title+(list?' saved places':' a saved place'),
    signature:'places.'+legacyAction+'('+(list?'options?':create?'body, options?':update?'id, body, options':'id, options?')+')',
    description:list?'Read the migration dataset page. Pass the returned nextCursor as after to resume.':create?'Insert one saved place into the legacy dataset.':update?'Replace label and coordinates after reading the current revision.':'Delete a legacy saved place by ID.',
    access:'Confidential registration · delegated app_data',
    flow:['Historical saved-place dataset',title+' through migration API',list?'Place list and cursor':legacyAction==='delete'?'Deletion confirmation':'Stored place and revision'],
    args:[...(list?[['options.source?','string','Optional exported source client for a consented read.'] as const,['options.after?','string','Previous page’s nextCursor.'] as const]:create?[]:[recordId]),
      ...(create||update?placeWrite:[]),...(update?[revision]:[]),signal],
    example:'const result = await places.'+legacyAction+'('+(list?'':create?'{label:"Central station", latitude:45.48, longitude:9.20}':update?'current.id, {label:"Central station", latitude:45.48, longitude:9.20}, {revision:current.revision}':'current.id')+');',
    output:list?page(place):legacyAction==='delete'?'{"deleted":true}':update?place.replace('"revision":1','"revision":2'):place,
    variants:'Swift uses typed XCenterSavedPlaces.Place for mutation. Kotlin/JVM and Dart take their platform JSON object or map. '+platformData,related:'saved-places-client'});
}

const advanced: Reference[] = [
  {group:'advanced',id:'create-transport',title:'Construct a low-level transport',signature:'createTransport(options?) → request(path, options?)',description:'Builds an issuer-pinned request adapter. The named SDK methods provide the usual route and permission handling. Use this helper only for an explicitly documented issuer API.',
    flow:['Issuer-relative route','Send JSON or binary request','Decode response or throw XCenterError'],
    args:[fetchOption,['getAccessToken?','() => string | Promise<string>','Bearer provider. Omit for requests without credentials.'],
      ['path','string','Issuer-relative route such as /me.'],['options.method?','string','HTTP method. Default GET.'],
      ['options.body?','JSON','Request body encoded as JSON.'],['options.revision?','integer','Adds If-Match for optimistic concurrency.'],
      ['options.binary?','boolean','True returns the raw Response. Defaults to false.'],signal],
    example:'const request = createTransport({getAccessToken});\nconst account = await request("/me", {signal});',output:userInfo,related:'xcenter-error'},
  {group:'advanced',id:'create-records',title:'Build record methods from a transport',signature:'createRecords(request, clientId) → Records',description:'Creates the standard list, get, put and delete methods bound to one registration. Normal user and service SDK constructors create these methods with the right credential boundary.',
    flow:['Issuer transport and client ID','Bind record routes','Collection methods'],args:[['request','ReturnType<typeof createTransport>','Request adapter with the correct credentials.'],clientId],
    example:'const records = createRecords(request, clientId);\nconst page = await records.list("notes");',output:page(record),related:'user-records-list'},
  {group:'advanced',id:'xcenter-error',title:'Handle an SDK response error',signature:'XCenterError extends Error',description:'The JavaScript data transport exposes HTTP status, parsed error body and Retry-After. Handle revoked authorization, quota failures and revision conflicts separately. Retry a stale write only after refreshing and reconciling the record.',
    flow:['API refuses a request','Read status and retry metadata','Recover or explain the error'],args:[
      ['error.status','number','HTTP status, such as 401, 404, 409 or 429.'],
      ['error.body','unknown','Server-provided error JSON or text.'],
      ['error.retryAfter','string | null','Retry-After header when present.']],
    example:'try {\n  await user.records.put("notes", "first_note", change, {revision});\n} catch (error) {\n  if (error instanceof XCenterError && error.status === 409) {\n    await reloadAndResolveConflict();\n  } else throw error;\n}',output:'{"status":409,"body":{"error":"Record changed. Read its revision before writing."},"retryAfter":null}',related:'user-records-put'},
  {group:'advanced',id:'redirect-url',title:'Validate a configured HTTPS redirect',signature:'redirectURL(value) → URL',description:'Validates a plain HTTPS URL. User credentials, query strings and fragments are disallowed in the configured value.',
    flow:['Configured HTTPS callback','Validate URL shape','URL for exact matching'],args:[['value','string | URL','Expected registered callback.']],
    example:'const registered = redirectURL("https://app.example.com/callback");',output:'URL {href: "https://app.example.com/callback"}',related:'validate-callback'},
  {group:'advanced',id:'validate-callback',title:'Match a returned callback URL',signature:'validateCallback(value, redirect) → URL',description:'Validates origin and pathname against the configured redirect while preserving the returned query. Code exchange separately verifies state, PKCE and the signed token.',
    flow:['Returned URL with authorization query','Match the registered origin and path','Callback ready for exchange'],args:[['value','string | URL','Callback observed by the product.'],['redirect','URL','Trusted URL from the product configuration.']],
    example:'const received = validateCallback(fullCallbackUrl, registered);',output:'URL {href: "https://app.example.com/callback?code=…&state=…"}',related:'complete-sign-in'},
  {group:'advanced',id:'issuer-scopes',title:'Choose supported scopes',signature:'issuer, scopes',description:'The SDK’s issuer constant identifies X-Center ID. The scopes constant lists the available permission names. Ask for the minimum required by the product and handle optional consent declines.',
    flow:['Product capability','Select compatible scope','User approves or declines'],args:[
      ['openid, profile','scope','Account identity and core profile. openid is added to sign-in requests.'],
      ['email, age_range','scope','Consented email choice and age band. Required fields can be configured in Developer Apps.'],
      ['app_data, friends','scope','Private records and consented shared collections, or accepted friends.'],
      ['offline_access','scope','Refresh tokens when the user agrees to stay signed in.'],
      ['files_read, files_write, shared_files_read','scope','Read own files, edit own files, or read incoming file shares.']],
    example:'import {issuer, scopes} from "@xcenter-id/client";\nconst requested = scopes.filter(scope => ["openid", "files_read"].includes(scope));',output:'{"issuer":"'+issuer+'","requested":["openid","files_read"]}',related:'begin-sign-in'},
];


identity.push(
  {group:'identity',id:'swift-browser-sign-in',title:'Sign in from Swift',signature:'BrowserSignIn(anchor:).signIn(config:) → (tokens, identity)?',description:'The SwiftUI integration opens ASWebAuthenticationSession and dismisses it after the registered HTTPS callback. The managed overload exchanges the code and validates the returned subject. Cancellation returns nil.',
    flow:['Public Swift configuration','Apple system authentication','Verified identity returned to app'],args:[
      ['anchor','ASPresentationAnchor','Presenting application window.'],['config','XCenterPublicConfig','Public ID, exact verified callback and requested scopes.'],
      ['using: client, scopes:','alternate overload','Supply a configured XCenterOAuth and optional scopes. Defaults to [].'],
      ['authorize(request:)','lower-level alternative','RegisteredBrowserRequest(authorizationURL:callbackURL:) returns the callback URL for a host exchange.'],
    ],example:'import XCenterID\n\nlet config = try XCenterPublicConfig.load(file: configURL)\nlet browser = BrowserSignIn(anchor: window)\nif let session = try await browser.signIn(config: config) {\n    try await saveProductSession(session)\n}',output:tokens,related:'public-config'},
  {group:'identity',id:'android-browser-sign-in',title:'Sign in from Android',signature:'BrowserSignIn(activity).signIn(config) → Identity?',description:'Create the sign-in launcher before the activity starts. The Android implementation opens an Auth Tab and exchanges the callback on an IO dispatcher. Handle a null return when the user cancels.',
    flow:['Register activity result launcher','Approve in Android Auth Tab','Validate HTTPS callback and identity'],args:[
      ['activity','ComponentActivity','Create BrowserSignIn as part of activity registration.'],
      ['config','XCenterPublicConfig','Public registration ID, verified HTTPS link and requested scopes.'],
      ['client, scopes','alternate overload','Supply XCenterOAuth and an optional scope collection.'],
      ['authorize(request)','lower-level alternative','BrowserRequest(authorization, callback) authenticates in the tab and returns the callback URI.'],
    ],example:'private val xcenterBrowser = BrowserSignIn(this)\n\n// In a coroutine after the activity starts:\nval config = loadXCenterAsset(assets)\nval session = xcenterBrowser.signIn(config)\nif (session != null) saveProductSession(session)',output:tokens,related:'public-config'},
  {group:'identity',id:'flutter-browser-sign-in',title:'Sign in from Flutter',signature:'XCenterPublicConfig.loadAsset().identity().signIn(scopes:)',description:'Load a public asset declared in pubspec.yaml and create XCenterNativeOAuth. On iOS, Android and macOS the wrapper opens the supported browser and exchanges the callback. On web use begin and complete across a browser redirect or use a confidential backend.',
    flow:['Load Flutter public asset','Open registered browser flow','Save verified product session'],args:[
      ['asset','String','Root bundle path. Defaults to xid.json.'],
      ['environment, clientId, redirectUri, scopes','optional overrides','Environment map and explicit public values passed to XCenterPublicConfig.load.'],
      ['signIn(scopes:)','List<String>','Additional scopes for this attempt. Defaults to [].'],
      ['authorizeBrowser(request)','lower-level alternative','BrowserRequest takes authorization and callback URIs and returns the callback.'],
      ['close()','void','Closes the underlying HTTP client when the OAuth adapter is no longer needed.'],
    ],example:'final config = await XCenterPublicConfig.loadAsset();\nfinal oauth = config.identity();\ntry {\n  final session = await oauth.signIn(scopes: ["offline_access"]);\n  await saveProductSession(session);\n} finally {\n  oauth.close();\n}',output:tokens,related:'begin-sign-in'},
);
components.push(
  {group:'components',id:'native-overview',title:'Show the native account card',signature:'AccountOverview(profile, clientId, signIn, signOut, settings)',description:'In SwiftUI, Compose and Flutter, provide the current profile and the host’s authentication actions. The card uses those callbacks and renders the current product session. The built-in details provide account and app management.',
    flow:['Host builds settings screen','Pass controlled profile and actions','Native account card and management details'],args:[
      ['profile','OverviewProfile?','Use nil/null while signed out. Name and username are required when signed in.'],
      ['clientID / clientId','String','Active registration ID for the Manage app link.'],
      ['signIn, signOut','async closures','Call the platform browser adapter or clear the session.'],
      ['settings','view builder / composable / Widget','Product settings within the details view.'],
      ['modifier','Compose Modifier','Optional host layout modifier on Android.'],
    ],example:'// SwiftUI\nAccountOverview(profile: profile, clientID: clientID,\n                signIn: signIn, signOut: signOut) { SyncSettings() }\n\n// Compose\nAccountOverview(profile, clientId, ::signIn, ::signOut) { SyncSettings() }\n\n// Flutter\nAccountOverview(profile: profile, clientId: clientId,\n  signIn: signIn, signOut: signOut, settings: const SyncSettings())',
    output:'Signed-in product profile, account links and settings controls.',related:'account-overview'},
);
advanced.push(
  {group:'advanced',id:'web-sign-in-url',title:'Validate a web sign-in start path',signature:'signInURL(path, origin) → string',description:'Validates a local, same-origin HTTPS route before assigning it as a Web Component sign-in destination.',flow:['Product path and origin','Enforce same-origin HTTPS','Safe start URL'],
    args:[['path','string','Absolute path relative to this website, such as /sign-in/xcenter.'],['origin','string','The product origin, such as location.origin.']],
    example:'import {signInURL} from "@xcenter-id/web/urls";\nconst url = signInURL("/sign-in/xcenter", "https://app.example.com");',output:'https://app.example.com/sign-in/xcenter',related:'web-account-overview'},
  {group:'advanced',id:'manage-app-url',title:'Link to a connected app’s settings',signature:'manageAppURL(clientId) → string',description:'Builds the X-Center ID permission management link for a registered app. The dashboard checks the active account and linked app.',flow:['Registration ID','Encode app identifier','Dashboard app settings URL'],
    args:[clientId],example:'import {manageAppURL} from "@xcenter-id/web/urls";\nconst url = manageAppURL("your-client-id");',output:'https://id.xcenter.it/permissions/your-client-id',related:'web-account-overview'},
  {group:'advanced',id:'safe-photo-url',title:'Filter an account photo URL',signature:'safePhotoURL(value, origin) → string | undefined',description:'Returns an HTTPS image address or a same-origin blob URL. Use the default profile icon for an absent or rejected value.',flow:['Image candidate','Check scheme and credentials','Validated URL or fallback'],
    args:[['value','string | undefined','Potential image address. Relative values resolve against origin.'],['origin','string','Product origin used to resolve relative and blob URLs.']],
    example:'import {safePhotoURL} from "@xcenter-id/web/urls";\nconst photo = safePhotoURL("https://cdn.example.com/avatar.png", location.origin);',output:'https://cdn.example.com/avatar.png',related:'web-account-overview'},
);

identity.push({
  group:'identity',id:'nextjs-routes',title:'Connect Next.js or Vercel route handlers',signature:'xCenterRoutes({origin, clientId, clientSecret, store, session, scopes?})',
  description:'The SDK includes a Next.js example adapter. It places an opaque transaction ID in a short-lived secure cookie and stores the OAuth proofs on the backend. Bind its start and callback functions to Node.js route handlers.',
  flow:['Settings starts backend route','Store proof-bound authorization attempt','Return to Settings with product session'],
  args:[['origin','string','Canonical HTTPS product origin. Register origin + /api/xcenter/callback.'],clientId,
    ['clientSecret','string','Confidential secret from protected server configuration.'],
    ['store','{put(id, transaction, ttlSeconds), take(id)}','Shared expiring transaction storage. take must consume the transaction atomically.'],
    ['session','{create(result)}','Maps validated issuer identity to your product user and returns the product session cookie header value.'],scopes],
  example:'const routes = xCenterRoutes({origin, clientId, clientSecret, store, session});\n\n// In the start route\nexport const GET = routes.start;\n\n// In the callback route instead\n// export const GET = routes.callback;',
  output:'HTTP 303 → https://app.example.com/settings\nSet-Cookie: <product session cookie>',
  variants:'The route adapter is an example in the SDK repository. Plain Node.js can build the same flow using createXCenterOIDC.',
  related:'create-server-oauth',
});

advanced.push(
  {group:'advanced',id:'swift-config-data',title:'Create a Swift data client from configuration',signature:'config.data(accessToken:)',description:'Uses the client ID already held in public configuration to create a delegated Swift data client.',
    flow:['Public Swift configuration','Supply a token callback','Delegated Swift data client'],args:[['accessToken','async closure','Returns the current end-user token.']],
    example:'let data = config.data { try await source.accessToken() }',output:'An XCenterDataClient bound to the configured registration.',related:'create-user-client'},
  {group:'advanced',id:'jvm-data-client',title:'Create the JVM data adapter',signature:'createDataClient(clientId, accessToken)',description:'Uses the JVM networking transport for a standalone Kotlin process. It supports both anonymous and delegated calls.',
    flow:['Kotlin/JVM worker','Construct the JDK HTTP adapter','Call the X-Center data API'],args:[clientId,['accessToken','callback','Returns the current delegated bearer token.']],
    example:'val user = createDataClient(clientId) { source.accessToken() }',output:'XCenterDataClient over the JVM transport.',related:'create-user-client'},
  {group:'advanced',id:'close-dart-clients',title:'Close a Dart HTTP client',signature:'client.close()',description:'Release the transport when an adapter is no longer needed. Give the adapter a dedicated HTTP client if other code needs its transport to remain open.',
    flow:['Finished with adapter','Close its HTTP transport','Resources released'],args:[],
    example:'user.close();',output:'The adapter releases its HTTP client.',related:'create-user-client'},
  {group:'advanced',id:'oauth-errors',title:'Handle native OAuth failures',signature:'OAuth error types by platform',description:'Handle cancellation, expiry, unsupported callbacks, and HTTP failures through the SDK and the host’s session flow. Never include authorization codes or token values in logs.',
    flow:['Sign-in attempt fails','Inspect platform error','Show a useful next step'],args:[],
    example:'Use the native language guide for the exact error.',output:'The host displays a recovery action based on the error.',related:'complete-sign-in'},
  {group:'identity',id:'session-tokens',title:'Store a session token set',signature:'SessionTokens {accessToken, refreshToken?, expiresAt}',description:'Store tokens with absolute access expiry. Convert expires_in seconds from the token endpoint to a platform timestamp. Keep the pair in one protected record and replace it atomically.',
    flow:['Verified token response','Convert expiry and persist','Session source reads current tokens'],
    args:[['accessToken','string','Current access bearer.'],['refreshToken?','string','Current refresh credential if granted.'],['expiresAt','number','Absolute epoch milliseconds.']],
    example:'if (typeof tokens.expires_in !== "number") throw new Error("Missing access expiry");\nconst saved = {accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires_in * 1000};',
    output:'{"accessToken":"<redacted>","refreshToken":"<redacted>","expiresAt":1795623000000}',related:'session-token-source'},
);

const accountAndTransport: Reference[] = [
  {group:"profile",id:"account-profile-visibility",title:"Read public profile settings",signature:"user.account.visibility(options?)",
    description:"Read the current public fields before rendering an editor. The settings apply to the signed-in account.",
    access:"account_manage",flow:["Signed-in user","Read visibility settings","Public field names"],args:[signal],
    example:"const result = await user.account.visibility();",output:"{\"fields\":[\"username\",\"picture\"]}",related:"administrative-app-permissions"},
  {group:"profile",id:"account-connected-apps",title:"List connected apps for the signed-in account",signature:"user.account.apps(options?)",
    description:"List the signed-in account’s active connections and their current app names and badges.",
    access:"account_manage",flow:["Signed-in user","Load active connections","Linked app list"],args:[signal],
    example:"const result = await user.account.apps();",output:"{\"apps\":[{\"client\":\"xid-example\",\"label\":\"Example App\",\"verified\":true}]}",related:"administrative-app-permissions"},
  {group:"profile",id:"account-connected-permissions",title:"Read a connected app’s permissions",signature:"user.account.permissions(client, options?)",
    description:"Read existing decisions for an app connected to this user. A missing or unlinked app returns HTTP 404.",
    access:"account_manage",flow:["Linked app ID","Read its user grant","Permission decisions"],args:[["client","string","Registered OAuth client ID from the linked app list."],signal],
    example:"const result = await user.account.permissions(clientId);",output:"{\"permissions\":[{\"scope\":\"friends\",\"enabled\":false,\"required\":false,\"canEnable\":true}]}",related:"account-connected-apps"},
  {group:"profile",id:"account-disable-permission",title:"Turn off a connected app’s optional permission",signature:"user.account.disablePermission(client, scope, options?)",
    description:"Disable an existing optional permission. Required or unknown scopes return HTTP 422. Ask the account holder before applying a change on their behalf.",
    access:"account_manage",flow:["Linked app and scope","Revoke optional access","Updated permissions"],args:[["client","string","Registered OAuth client ID from the linked app list."],["scope","string","Optional permission identifier from the linked app permissions response."],signal],
    example:"const result = await user.account.disablePermission(clientId, \"friends\");",output:"{\"permissions\":[{\"scope\":\"friends\",\"enabled\":false,\"required\":false,\"canEnable\":true}]}",related:"account-connected-permissions"},
  {group:"files",id:"start-upload",title:"Start a resumable transfer",signature:"user.files.transfers.start(file, options?)",
    description:"Reserve quota and obtain the server’s chunk size before reading bytes. Use a folder from the user’s account or omit it for the root.",
    access:"files_write",flow:["Name, size and folder","Reserve account storage","Transfer ID and chunk size"],args:[["file","{name, size, folder?}","The display name, exact byte count and optional folder identifier."],signal],
    example:"const result = await user.files.transfers.start({name: \"video.mp4\", size: 4000000});",output:"{\"id\":\"3aa33912-a1b8-4c39-ab4a-ac63d15adf71\",\"chunkSize\":524288}",related:"resumable-uploads"},
  {group:"files",id:"upload-status",title:"Read transfer status",signature:"user.files.transfers.status(id, options?)",
    description:"Resume using received as the next file offset. A committed transfer already has a file and needs no more data.",
    access:"files_write",flow:["Saved transfer ID","Check reserved transfer","Byte offset and commit status"],args:[["id","string","Transfer ID from the start response. Preserve it across interruptions."],signal],
    example:"const result = await user.files.transfers.status(transferId);",output:"{\"id\":\"3aa33912-a1b8-4c39-ab4a-ac63d15adf71\",\"chunkSize\":524288,\"size\":4000000,\"received\":524288,\"committed\":false}",related:"append-upload"},
  {group:"files",id:"append-upload",title:"Append a file chunk",signature:"user.files.transfers.append(id, chunk, options?)",
    description:"Send the next chunk at the confirmed offset. Use the server chunk size except for the final chunk. Retry the same bytes and offset if a response is lost.",
    access:"files_write",flow:["Offset and bytes","Store encrypted chunk","Next byte offset"],args:[["id","string","Transfer ID from the start response. Preserve it across interruptions."],["chunk","{position, content}","Position is a byte offset. Content is the raw base64 of this chunk."],signal],
    example:"const result = await user.files.transfers.append(transferId, {position: 0, content: firstChunkBase64});",output:"{\"received\":524288}",related:"complete-upload"},
  {group:"files",id:"complete-upload",title:"Complete a file transfer",signature:"user.files.transfers.complete(id, options?)",
    description:"Commit after all bytes have arrived. Repeat this request after a lost response to recover the file identifier.",
    access:"files_write",flow:["Fully transferred file","Commit into the account folder","File ID"],args:[["id","string","Transfer ID from the start response. Preserve it across interruptions."],signal],
    example:"const result = await user.files.transfers.complete(transferId);",output:"{\"id\":\"3aa33912-a1b8-4c39-ab4a-ac63d15adf71\"}",related:"upload-status"},
  {group:"files",id:"cancel-upload",title:"Cancel a file transfer",signature:"user.files.transfers.cancel(id, options?)",
    description:"Discard an unfinished upload and release its reserved quota. This operation leaves completed files intact.",
    access:"files_write",flow:["Unfinished transfer ID","Release reservation","Cancellation confirmed"],args:[["id","string","Transfer ID from the start response. Preserve it across interruptions."],signal],
    example:"const result = await user.files.transfers.cancel(transferId);",output:"{\"ok\":true}",related:"upload-status"},
  {group:"advanced",id:"list-peers",title:"List discoverable peers",signature:"user.peers.list(peer, options?)",
    description:"Enable peer signaling and discovery in Developer Apps, then open a peer with discoverable: true to appear in the list. This method returns only other opted-in peers using the same registration. It works for callers who opt out of being listed. Other apps use their own isolated directories.",
    access:"Verified registration, enabled peer connections and a user access token",flow:["Active peer session","Query the app directory","Discoverable peer IDs"],args:[["peer","PeerSession","Your own session from peers.open. Keep the proof private."],signal],
    example:"const result = await user.peers.list(peer);",output:"{\"peers\":[\"dHGGbnxVRIkI4K-I7Fo_tr0o\"]}",related:"peer-signaling"},
  {group:"advanced",id:"receive-peer-messages",title:"Receive peer messages",signature:"user.peers.receive(peer, options?)",
    description:"Drain the pending queue. Poll at a bounded rate while signaling. Keep the channel’s offer, answer and ICE candidate handling in your WebRTC implementation.",
    access:"Verified registration, enabled peer connections and a user access token",flow:["Active peer session","Drain pending signals","Messages with sender IDs"],args:[["peer","PeerSession","Your own session from peers.open. Keep the proof private."],signal],
    example:"const result = await user.peers.receive(peer);",output:"{\"messages\":[{\"from\":\"dHGGbnxVRIkI4K-I7Fo_tr0o\",\"type\":\"candidate\",\"data\":{\"candidate\":\"candidate:…\",\"sdpMid\":\"0\",\"sdpMLineIndex\":0}}]}",related:"send-peer-message"},
  {group:"advanced",id:"send-peer-message",title:"Send a peer message",signature:"user.peers.send(peer, message, options?)",
    description:"Send signaling within the same app namespace. HTTP 202 confirms queueing. A live peer must poll to retrieve the message. Each request is limited to 16 KiB.",
    access:"Verified registration, enabled peer connections and a user access token",flow:["Active peer and signal","Queue for destination","Signal accepted"],args:[["peer","PeerSession","Your own session from peers.open. Keep the proof private."],["message","{to, type, data}","Destination ID, offer/answer/candidate/hangup message type and JSON object payload."],signal],
    example:"const result = await user.peers.send(peer, {to: remotePeerId, type: \"offer\", data: {type: offer.type, sdp: offer.sdp}});",output:"{\"accepted\":true}",related:"receive-peer-messages"},
  {group:"advanced",id:"close-peer",title:"Close a peer registration",signature:"user.peers.close(peer, options?)",
    description:"Remove the signaling registration and its queued messages. Close the local WebRTC connection separately.",
    access:"Verified registration, enabled peer connections and a user access token",flow:["Active peer session","Release signaling state","Peer closed"],args:[["peer","PeerSession","Your own session from peers.open. Keep the proof private."],signal],
    example:"const result = await user.peers.close(peer);",output:"{\"ok\":true}",related:"peer-signaling"},
  {group:'profile',id:'account-overview-api',title:'Read the account overview',signature:'user.accountOverview(options?)',
    description:'Show the active account’s storage usage, capacity and connected app count inside your app. An administrator must designate the registration as trusted, then the user must enable this scope under Administrative App Permissions.',
    access:'account_overview',flow:['User grants overview','Check live app trust and grant','Return account totals'],
    args:[signal],example:'const summary = await user.accountOverview();',output:'{"storage":{"used":1048576,"capacity":1073741824},"connectedApps":3}',related:'administrative-app-permissions'},
  {group:'profile',id:'administrative-app-permissions',title:'Manage settings for a signed-in account',signature:'user.account.updateVisibility(fields, options?)',
    description:'Use account_manage for public-profile visibility and existing linked-app permissions. Only selected trusted apps may request it. The user turns it on separately and confirms what the app can change. Access stays with this account and expires or ends when revoked. Read current fields with account.visibility(), show linked apps with account.apps(), read a linked app’s access with account.permissions(client), and turn off optional access with account.disablePermission(client, scope). Turning on new access requires the account holder’s consent.',
    access:'account_manage',flow:['User confirms account settings access','Apply selected public fields','Return the visible field names'],
    args:[['fields','PublicProfileField[]','Complete list of public fields. Choose username, givenName, surname or picture. An empty list disables public fields.'],signal],
    example:'const result = await user.account.updateVisibility(["username", "picture"]);',output:'{"fields":["username","picture"]}',related:'account-overview-api'},
  {group:'files',id:'resumable-uploads',title:'Upload a file in chunks',signature:'user.files.uploadChunks(file, readChunk, options?)',
    description:'Reserve space against the user’s available storage. Read and encode one chunk at a time. Store the transfer ID so an interrupted upload can resume with the same file. To use individual operations, call files.transfers.start, status, append, complete or cancel.',
    access:'files_write',flow:['File and byte size','Reserve space and append chunks','Commit the new file'],
    args:[['file','{name, size, folder?}','Name, byte size and optional account folder ID.'],['readChunk','(offset, length) → base64 string or Promise','Read exactly those bytes from the source.'],['options.id?','string','Existing transfer ID to resume.'],['options.onProgress?','(progress) → void','Receives id, received and total.'],signal],
    example:'const saved = await user.files.uploadChunks({name, size}, readBase64Chunk, {id: existingTransferId, onProgress: showProgress});',
    output:'{"id":"3aa33912-a1b8-4c39-ab4a-ac63d15adf71"}',related:'upload-file'},
  {group:'advanced',id:'stock-peerjs',title:'Connect with stock PeerJS',signature:'user.peers.openPeerJS({discoverable, id?}, options?)',
    description:'Use the standard PeerJS client on the shared X-Center service. The authenticated registration determines the namespace. Stock PeerJS peers can discover only opted-in PeerJS peers in that registration. Use renewPeerJS(lease) with a current access token before expiration and closePeerJS(lease) when you leave.',
    flow:['Verified app user session','Issue a scoped PeerJS lease','Open standard PeerJS signaling'],
    args:[['discoverable','boolean','List this peer if app discovery is enabled.'],['id?','string','Optional PeerJS identifier, up to 80 characters, unique in this registration.'],signal],
    example:'import {Peer} from "peerjs";\nconst lease = await user.peers.openPeerJS({discoverable: true});\nconst peer = new Peer(lease.id, {host: "id.xcenter.it", port: 443, secure: true, path: lease.path, key: lease.key, token: lease.token});',
    output:'{"id":"<peer-id>","key":"<private-key>","token":"<private-socket-proof>","path":"/peerjs/","connectWithin":60}',related:'list-peers'},
  {group:'advanced',id:'browser-peer-connections',title:'Connect browser peers for media and data',signature:'openPeerConnections(user, options?)',
    description:'Open a browser WebRTC host in the signed-in app’s own peer namespace. The host handles offers, answers and hang-ups for independent connections. The application handles user invitations, permissions, and local media tracks. Use an approved microphone, camera or display stream for calls, or use a reliable data channel to exchange files.',
    flow:['Active verified app session','Accept an invitation and negotiate WebRTC','Exchange audio, video or data'],
    args:[['user','UserClient','Signed-in SDK client for the verified registration.'],['options.discoverable?','boolean','Whether this peer should appear in the registration’s directory. Defaults to false.'],
      ['options.configuration?','RTCConfiguration','WebRTC settings such as STUN and TURN servers.'],['options.onInvite?','callback','Return false to decline or return an optional MediaStream and connection callback to accept.'],
      ['options.onError?','callback','Display signaling and connection errors.']],
    example:'import {openPeerConnections} from "@xcenter-id/web/peers";\nconst host = await openPeerConnections(user, {onInvite: approveInvitation});\nconst peers = await host.listDiscoverablePeers();\nconst call = await host.connect(peers[0], {stream: approvedMedia});',
    output:'An active peer host and a negotiated WebRTC connection. Close the host on sign-out and stop tracks you opened.',
    related:'list-peers'},
  {group:'advanced',id:'peer-signaling',title:'Open a WebRTC peer',signature:'user.peers.open({discoverable}, options?)',
    description:'Enable Peer connections in Developer Apps for your verified registration. The server scopes opaque peer IDs to the registration. Keep the proof private. Use peers.send for offer, answer, candidate and hangup messages, peers.receive to poll, and peers.close when finished. The optional peers.list directory only shows peers that opt in when app discovery is enabled. Media and data travel through your own WebRTC connection. A TURN server may be needed on restrictive networks.',
    access:'Verified registration, enabled peer connections and a user access token',flow:['Open app-scoped peer','Exchange signaling messages','Connect through WebRTC'],
    args:[['discoverable','boolean','Set true to appear in the app directory if the developer enabled discovery.'],signal],
    example:'const peer = await user.peers.open({discoverable: false});',output:'{"id":"<opaque-peer-id>","proof":"<keep-private>","expiresIn":90}'},
];

const containerFiles: Reference[] = [
  {group:"files",id:"app-container-files",title:"Upload to an app container",signature:"user.appFiles.uploadChunks(file, readChunk, options?)",
    description:"Use a user token with app_data for a backup that belongs to a linked account. The backup is charged to that account. Enable Browseable to let the account holder download it from the branded folder in Files. Also enable Editable to let them rename, replace or delete the file. Editable requires Browseable. For verified service files, call the same method on service.files using the backend database key and omit Browseable. The app data grant is sufficient for a user container upload.",
    access:"app_data for user files · verified app database key for service files",flow:["Choose an account or service file","Stream quota-limited chunks","Save inside the app container"],args:[["file","{name, size, browseable?, editable?}","Display name, exact byte count and optional account visibility."],["readChunk","(offset, length) → base64 string or Promise","Read exactly this part of the same file."],["options.id?","string","Transfer ID when resuming."],["options.onProgress?","(progress) → void","Receives id, received and total."],["options.signal?","AbortSignal","Cancels the request. The transfer can be resumed."]],
    example:"const result = await user.appFiles.uploadChunks({name: \"Beat Saber.zip\", size: backupSize, browseable: true, editable: true}, readBase64Chunk);",output:"{\"id\":\"3aa33912-a1b8-4c39-ab4a-ac63d15adf71\"}",related:"start-app-upload"},
  {group:"files",id:"start-app-upload",title:"Reserve an app file transfer",signature:"user.appFiles.transfers.start(file, options?)",
    description:"Reserve storage and obtain an ID and byte limit per chunk. The server checks quota against completed files, pending transfers and other stored data in that namespace.",
    access:"app_data for user files · verified app database key for service files",flow:["File name and size","Reserve quota","Transfer ID and chunk size"],args:[["file","{name, size, browseable?, editable?}","Name and exact byte count. Set browseable for a user file only."],["options.signal?","AbortSignal","Optional cancellation."]],
    example:"const result = await user.appFiles.transfers.start({name: \"backup.zip\", size: 600000});",output:"{\"id\":\"3aa33912-a1b8-4c39-ab4a-ac63d15adf71\",\"chunkSize\":524288}",related:"app-container-files"},
  {group:"files",id:"app-upload-status",title:"Check an app file transfer",signature:"user.appFiles.transfers.status(id, options?)",
    description:"Read the next byte offset for resumption. If committed is true, use the ID as the saved file ID. Unfinished transfers expire after one hour of inactivity.",
    access:"app_data for user files · verified app database key for service files",flow:["Saved transfer ID","Inspect the scoped reservation","Offset and commit status"],args:[["id","string","Transfer ID returned by the start operation. Store it to resume the same file."],signal],
    example:"const result = await user.appFiles.transfers.status(id);",output:"{\"id\":\"3aa33912-a1b8-4c39-ab4a-ac63d15adf71\",\"size\":600000,\"received\":524288,\"chunkSize\":524288,\"committed\":false}",related:"append-app-upload"},
  {group:"files",id:"append-app-upload",title:"Append an app file chunk",signature:"user.appFiles.transfers.append(id, chunk, options?)",
    description:"Send the next chunk. It must match chunkSize except for the final chunk. Retry the same byte position and content after a lost response.",
    access:"app_data for user files · verified app database key for service files",flow:["Transfer and next bytes","Store an encrypted chunk","New byte offset"],args:[["id","string","Transfer ID returned by the start operation. Store it to resume the same file."],["chunk","{position, content}","Byte position and the chunk’s standard base64 string."],signal],
    example:"const result = await user.appFiles.transfers.append(id, {position: 0, content: chunkBase64});",output:"{\"received\":524288}",related:"complete-app-upload"},
  {group:"files",id:"complete-app-upload",title:"Complete an app file transfer",signature:"user.appFiles.transfers.complete(id, options?)",
    description:"Commit once all bytes are present. The transfer ID becomes the committed file ID. Repeating completion after a lost response is safe.",
    access:"app_data for user files · verified app database key for service files",flow:["Complete chunk stream","Make file available","Saved file ID"],args:[["id","string","Transfer ID returned by the start operation. Store it to resume the same file."],signal],
    example:"const result = await user.appFiles.transfers.complete(id);",output:"{\"id\":\"3aa33912-a1b8-4c39-ab4a-ac63d15adf71\"}",related:"list-app-files"},
  {group:"files",id:"cancel-app-upload",title:"Cancel an app file transfer",signature:"user.appFiles.transfers.cancel(id, options?)",
    description:"Cancel an unfinished transfer and release reserved space. If the file has already been committed, cancel leaves the file in place.",
    access:"app_data for user files · verified app database key for service files",flow:["Pending transfer ID","Discard staged chunks","Cancellation acknowledged"],args:[["id","string","Transfer ID returned by the start operation. Store it to resume the same file."],signal],
    example:"const result = await user.appFiles.transfers.cancel(id);",output:"{\"ok\":true}",related:"app-upload-status"},
  {group:"files",id:"list-app-files",title:"List files in the app container",signature:"user.appFiles.list(options?)",
    description:"Return one page of the app’s committed files. An authenticated app can see its own private and Browseable files. Account dashboard access separately enforces Browseable visibility. "+digestBehavior,
    access:"app_data for user files · verified app database key for service files",flow:["Account or service credential","List files within its namespace","Entries and next cursor"],args:[["options.cursor?","string","Pass the previous page’s nextCursor unchanged."],signal],
    example:"const result = await user.appFiles.list();",output:JSON.stringify({files:[appFileSample],nextCursor:null}),related:"download-app-file"},
  {group:"files",id:"get-app-file",title:"Get app file metadata",signature:"user.appFiles.get(id, options?) / service.files.get(id, options?)",
    description:"Read a committed file descriptor without downloading the bytes. Replacing bytes updates sha256 even if the file ID remains the same. "+digestBehavior,
    access:"app_data for user files · verified app database key for service files",flow:["File ID","Check app and account scope","Descriptor with SHA-256"],args:[["id","string","Committed file ID returned by complete or list."],signal],
    example:"const {sha256} = await user.appFiles.get(id);",output:JSON.stringify(appFileSample),related:"list-app-files"},
  {group:"files",id:"download-app-file",title:"Download a file from the app container",signature:"user.appFiles.download(id, options?)",
    description:"Get the committed file as a binary attachment. Stream large files to a supported safe destination instead of holding the full response in memory.",
    access:"app_data for user files · verified app database key for service files",flow:["File ID","Check app and account scope","Binary data"],args:[["id","string","Committed file ID returned by complete or list."],signal],
    example:"const response = await user.appFiles.download(id);\nconst stream = response.body;",output:"Binary attachment response",related:"list-app-files"},
  {group:"files",id:"set-app-file-browseable",title:"Change app file visibility in Files",signature:"user.appFiles.setVisibility(id, {browseable, editable?}, options?)",
    description:"Set Browseable and Editable on a committed user file. Both must be true to permit renaming, replacing, or deleting it in the dashboard. Turning Browseable off clears Editable. Service files do not support this operation.",
    access:"app_data (user only)",flow:["User container file ID","Update dashboard visibility","New policy applies to list and download"],args:[["id","string","Committed file ID returned by complete or list."],["visibility","{browseable, editable?}","Browseable grants downloads. Editable additionally grants rename, replace and delete."],signal],
    example:"const result = await user.appFiles.setVisibility(id, {browseable: true, editable: true});",output:"{\"ok\":true}",related:"list-app-files"},
  {group:"files",id:"delete-app-file",title:"Delete an app file",signature:"user.appFiles.delete(id, options?)",
    description:"Remove a committed file and release its quota. The ID must belong to the requesting app and namespace.",
    access:"app_data for user files · verified app database key for service files",flow:["Committed file ID","Remove file and chunks","Deletion acknowledged"],args:[["id","string","Committed file ID returned by complete or list."],signal],
    example:"const result = await user.appFiles.delete(id);",output:"{\"ok\":true}",related:"list-app-files"},
];

export const reference: readonly Reference[] = [...setup,...identity,...profile,...data,...files,...components,...migration,...advanced,...accountAndTransport,...containerFiles];
