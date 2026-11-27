import type { Reference } from './sdk-reference';

export const languages = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  swift: 'Swift',
  kotlin: 'Kotlin',
  dart: 'Dart',
} as const;
export type Language = keyof typeof languages;
type Native = 'swift' | 'kotlin' | 'dart';
type Args = Reference['args'];
export type LanguageExample = Pick<Reference, 'signature' | 'args' | 'example'> & {
  output?: string; note?: string;
};
type NativeSet = Partial<Record<Native, LanguageExample>>;

const argument = (name:string,type:string,explanation:string) => [name,type,explanation] as const;
const snippet = (signature:string,args:Args,example:string,output?:string,note?:string):LanguageExample =>
  ({signature,args,example,output,note});
const native: Partial<Record<string,NativeSet>> = {};

const callbackInfo = 'Exact registered callback. Native apps require an OS-verified HTTPS app link.';
const optionalScopes = 'Requested scopes. An empty list still requests openid. Other claims depend on consent.';
const nativeBytes = {
  swift: 'The call returns Foundation Data. Decode JSON into an app type with JSONDecoder, or pass image and file data to the relevant native API.',
  kotlin: 'The call returns ByteArray. Decode JSON with JSONObject(bytes.toString(Charsets.UTF_8)). Run blocking calls on an IO dispatcher.',
  dart: 'The call returns Uint8List. Use jsonDecode(utf8.decode(bytes)) for JSON. Close the adapter when its HTTP client is no longer needed.',
};
const safePublic = 'Explicit values take precedence over environment values and JSON. Public configuration carries no client secret or database key.';
const serverEnv = 'Environment map, defaulting to the process environment.';
const privateFile = 'Private xid.json path. A missing implicit file is allowed. An explicitly named file must exist.';
const configProperties = 'The configuration holds clientId, clientSecret, redirectUri, databaseKey, scopes and allowLoopback. Keep secrets in the private server process.';
const publicConfigArgs = {
  swift: [
    argument('json or file','Data? or URL','Raw JSON data or a file URL passed to the matching load overload.'),
    argument('environment','[String: String]','Public build values including XCENTER_CLIENT_ID and XCENTER_REDIRECT_URI. Defaults to [:].'),
    argument('clientId','String?','Explicit registered client ID.'),
    argument('redirectUri','URL?','Explicit exact registered callback.'),
    argument('scopes','[String]?','Explicit scopes. If omitted, uses the JSON scopes or [].'),
  ],
  kotlin: [
    argument('json','String?','Optional raw JSON string.'),
    argument('environment','Map<String, String>','Public build values including XCENTER_CLIENT_ID and XCENTER_REDIRECT_URI. Defaults to an empty map.'),
    argument('clientId','String?','Explicit public client ID.'),
    argument('redirectUri','URI?','Explicit exact registered callback.'),
    argument('scopes','List<String>?','Explicit scopes. If omitted, uses the JSON scopes or an empty list.'),
  ],
  dart: [
    argument('config','Map<String, Object?>','Public JSON object. Defaults to an empty map.'),
    argument('environment','Map<String, String>','Public build values including XCENTER_CLIENT_ID and XCENTER_REDIRECT_URI. Defaults to an empty map.'),
    argument('clientId','String?','Explicit public client ID.'),
    argument('redirectUri','Uri?','Explicit exact registered callback.'),
    argument('scopes','List<String>?','Explicit scopes. If omitted, uses the JSON scopes or an empty list.'),
  ],
};
native.install = {
  swift: snippet('SwiftPM · XCenterID / XCenterIDServer',[
    argument('XCenterID','SwiftPM product','Use the UI, public OAuth and delegated data APIs.'),
    argument('XCenterIDServer','SwiftPM product','Use on macOS for confidential OAuth and app storage.'),
  ],'// Add the package dependency at the SDK revision linked below.\n// In the app’s target, add the XCenterID product.\nimport XCenterID\n\nlet publicAPI = XCenterDataClient()', 'XCenterDataClient available to the target.'),
  kotlin: snippet('Gradle · Android library / JVM library',[
    argument('packages/android','Android library','Import BrowserSignIn, AccountOverview and the shared SDK API.'),
    argument('packages/kotlin-server','JVM module','Build on JDK 17 or higher for confidential OAuth and app storage.'),
  ],'// Add the Android or JVM library to your Gradle build.\nimport it.xcenter.id.XCenterDataClient\n\nval publicApi = XCenterDataClient()', 'XCenterDataClient available to the module.'),
  dart: snippet('pubspec.yaml · xcenter_id / xcenter_id_server',[
    argument('packages/flutter','Flutter package','Use xcenter_id for native UI, system browser sign-in and delegated data.'),
    argument('packages/dart-server','Standalone Dart package','Use xcenter_id_server for backend identity and service storage.'),
  ],"// Add the matching package as a path dependency in pubspec.yaml.\nimport 'package:xcenter_id/xcenter_id.dart';\n\nfinal publicApi = XCenterDataClient();",'XCenterDataClient available to the application.'),
};
native['public-config'] = {
  swift:snippet('XCenterPublicConfig.load(json:environment:clientId:redirectUri:scopes:)',publicConfigArgs.swift,
    'let config = try XCenterPublicConfig.load(\n    clientId: clientID, redirectUri: callback, scopes: ["app_data"]\n)',undefined,safePublic),
  kotlin:snippet('XCenterPublicConfig.load(json, environment, clientId, redirectUri, scopes)',publicConfigArgs.kotlin,
    'val config = XCenterPublicConfig.load(\n    clientId = clientId, redirectUri = callback, scopes = listOf("app_data")\n)',undefined,safePublic),
  dart:snippet('XCenterPublicConfig.load(config:, environment:, clientId:, redirectUri:, scopes:)',publicConfigArgs.dart,
    "final config = XCenterPublicConfig.load(\n  clientId: clientId, redirectUri: callback, scopes: ['app_data'],\n);",undefined,safePublic),
};
native['load-public-config'] = {
  swift:snippet('XCenterPublicConfig.load(file:environment:clientId:redirectUri:scopes:)',publicConfigArgs.swift,
    'guard let file = Bundle.main.url(forResource: "xid", withExtension: "json") else {\n    throw CocoaError(.fileNoSuchFile)\n}\nlet config = try XCenterPublicConfig.load(file: file)',undefined,safePublic),
  kotlin:snippet('loadXCenterAsset(assets, name = "xid.json")',[
    argument('assets','AssetManager','The host Android activity’s assets.'),
    argument('name','String','Asset path relative to src/main/assets. Defaults to xid.json.'),
  ],'val config = loadXCenterAsset(assets, name = "xid.json")',undefined,safePublic),
  dart:snippet('XCenterPublicConfig.loadAsset(asset:, environment:, clientId:, redirectUri:, scopes:)',[
    argument('asset','String','Path declared in pubspec.yaml. Defaults to xid.json.'),...publicConfigArgs.dart.slice(1),
  ],"final config = await XCenterPublicConfig.loadAsset(asset: 'xid.json');",undefined,safePublic),
};
native['server-config'] = {
  swift:snippet('XCenterServerConfig.load(file:environment:explicit:)',[
    argument('file','URL?',privateFile),argument('environment','[String: String]',serverEnv),argument('explicit','XCenterServerConfig',configProperties),
  ],'import XCenterIDServer\n\nlet config = try XCenterServerConfig.load()\nlet auth = try config.identity()', 'Private configuration loaded in the macOS backend.'),
  kotlin:snippet('XCenterConfig.load(explicit, environment, file)',[
    argument('explicit','XCenterConfig',configProperties),argument('environment','Map<String, String>',serverEnv),argument('file','Path?',privateFile),
  ],'import it.xcenter.id.server.XCenterConfig\n\nval config = XCenterConfig.load()\nval auth = config.identity()', 'Private configuration loaded in the JVM backend.'),
  dart:snippet('XCenterConfig.load(path:, environment:, explicit:)',[
    argument('path','String?',privateFile),argument('environment','Map<String, String>?',serverEnv),argument('explicit','XCenterConfig?',configProperties),
  ],"import 'package:xcenter_id_server/config.dart';\n\nfinal config = XCenterConfig.load();\nfinal auth = config.oauth();",'Private configuration loaded in the Dart backend.'),
};
native['create-public-oauth'] = {
  swift:snippet('XCenterOAuth(clientID:redirectURI:session:)',[
    argument('clientID','String','Registered public OAuth client ID.'),argument('redirectURI','URL',callbackInfo),argument('session','URLSession?','Optional test transport. The default ephemeral session rejects redirects.'),
  ],'let oauth = try XCenterOAuth(clientID: clientID, redirectURI: callback)', 'Public OAuth adapter with begin, complete and refresh.'),
  kotlin:snippet('XCenterOAuth(clientId, callback)',[
    argument('clientId','String','Registered public OAuth client ID.'),argument('callback','URI',callbackInfo),
  ],'val oauth = XCenterOAuth(clientId, callback)', 'Public OAuth adapter with begin, complete and refresh.'),
  dart:snippet('XCenterOAuth.publicClient(clientId, callback, {transport})',[
    argument('clientId','String','Registered public OAuth client ID.'),argument('callback','Uri',callbackInfo),argument('transport','http.Client?','Optional HTTP client. close() closes the adapter’s transport.'),
  ],"import 'package:xcenter_id_server/xcenter_id_server.dart';\n\nfinal oauth = XCenterOAuth.publicClient(clientId, callback);",'Public OAuth adapter with begin, complete and refresh.'),
};
native['create-server-oauth'] = {
  swift:snippet('XCenterServerConfig.identity() throws → XCenterServerOAuth',[],
    'import XCenterIDServer\n\nlet auth = try XCenterServerConfig.load().identity()', 'Confidential OAuth adapter with browser and device flows.', 'On macOS. The direct initializer also accepts clientId, secret, redirect, scopes and allowLoopback.'),
  kotlin:snippet('XCenterConfig.identity() → XCenterServerOAuth',[],
    'val auth = XCenterConfig.load().identity()', 'Confidential OAuth adapter with browser and device flows.', 'The JVM adapter reads credentials from XCenterConfig. Call its blocking endpoints on a worker thread.'),
  dart:snippet('XCenterConfig.oauth() → XCenterOAuth',[],
    'final auth = XCenterConfig.load().oauth();', 'Confidential OAuth adapter with browser and device flows.', 'The direct XCenterOAuth.server constructor also accepts clientId, callback, clientSecret, allowLoopback, transport and defaultScopes.'),
};
const transaction = 'Single-use value from begin. Save it before opening the browser and consume it atomically on callback.';
const promptConsent = (type:string) => argument('promptConsent',type,'Defaults to false. Requests a new consent screen. offline_access also asks for consent in the applicable flow.');
native['begin-sign-in'] = {
  swift:snippet('oauth.begin(scopes: [String] = [], promptConsent: Bool = false) throws',[
    argument('scopes','[String]',optionalScopes),promptConsent('Bool'),
  ],'let attempt = try oauth.begin(scopes: ["app_data", "offline_access"])\ntry await saveLoginAttempt(attempt.transaction)\n// Open attempt.url in the system authentication browser.',undefined,'XCenterServerOAuth.begin() uses scopes from its configuration and takes no arguments.'),
  kotlin:snippet('oauth.begin(scopes: Collection<String> = emptyList(), promptConsent: Boolean = false): Login',[
    argument('scopes','Collection<String>',optionalScopes),promptConsent('Boolean'),
  ],'val attempt = oauth.begin(scopes = listOf("app_data", "offline_access"))\nsaveLoginAttempt(attempt.transaction)\n// Open attempt.url in the system authentication browser.',undefined,'XCenterServerOAuth.begin() takes no arguments and uses configured scopes.'),
  dart:snippet('oauth.begin({List<String> scopes = const [], bool promptConsent = false})',[
    argument('scopes','List<String>',optionalScopes),promptConsent('bool'),
  ],"final attempt = oauth.begin(scopes: ['app_data', 'offline_access']);\nawait saveLoginAttempt(attempt.transaction);\n// Send the browser to attempt.url.",undefined,'Flutter XCenterNativeOAuth.begin exposes scopes only. The shared XCenterOAuth type exposes promptConsent as shown.'),
};
native['complete-sign-in'] = {
  swift:snippet('oauth.complete(_ returned: URL, transaction: XCenterOAuthTransaction) async throws',[
    argument('returned','URL','Full registered callback including code and state.'),argument('transaction','XCenterOAuthTransaction',transaction),
  ],'let attempt = try await takeLoginAttempt()\nlet session = try await oauth.complete(returnedURL, transaction: attempt)\ntry await saveProductSession(session)'),
  kotlin:snippet('oauth.complete(returned: URI, transaction: Transaction): Identity',[
    argument('returned','URI','Full registered callback including code and state.'),argument('transaction','XCenterOAuth.Transaction',transaction),
  ],'val attempt = takeLoginAttempt()\nval session = withContext(Dispatchers.IO) { oauth.complete(returnedUri, attempt) }\nsaveProductSession(session)'),
  dart:snippet('oauth.complete(Uri returned, Map<String, Object?> transaction)',[
    argument('returned','Uri','Full registered callback including code and state.'),argument('transaction','Map<String, Object?>',transaction),
  ],'final attempt = await takeLoginAttempt();\nfinal session = await oauth.complete(returnedUri, attempt);\nawait saveProductSession(session);'),
};
const refreshArgs = (type:string):Args => [
  argument('refreshToken',type,'Refresh token from the previously verified product session.'),
  argument('subject',type,'Pinned issuer subject. The renewed profile must match.'),
];
native.refresh = {
  swift:snippet('oauth.refresh(_ refreshToken: String, subject: String) async throws',refreshArgs('String'),
    'let replacement = try await oauth.refresh(savedToken, subject: subject)\ntry await saveProductSession(replacement)'),
  kotlin:snippet('oauth.refresh(refreshToken: String, subject: String): Identity',refreshArgs('String'),
    'val replacement = withContext(Dispatchers.IO) { oauth.refresh(savedToken, subject) }\nsaveProductSession(replacement)'),
  dart:snippet('oauth.refresh(String refreshToken, String subject)',refreshArgs('String'),
    'final replacement = await oauth.refresh(savedToken, subject);\nawait saveProductSession(replacement);'),
};
const storageCallbacks = (nativeLanguage:Native):Args => [
  argument('load',nativeLanguage==='swift'?'@Sendable () async throws → XCenterSessionTokens?':nativeLanguage==='kotlin'?'() -> XCenterSessionTokens?':'Future<XCenterSessionTokens?> Function()','Loads the most recent access token, optional refresh token, and absolute expiry.'),
  argument('save',nativeLanguage==='swift'?'@Sendable (XCenterSessionTokens) async throws → Void':nativeLanguage==='kotlin'?'(XCenterSessionTokens) -> Unit':'Future<void> Function(XCenterSessionTokens)','Persists the replacement atomically.'),
  argument('refresh',nativeLanguage==='swift'?'@Sendable (String) async throws → XCenterSessionTokens':nativeLanguage==='kotlin'?'(String) -> XCenterSessionTokens':'Future<XCenterSessionTokens> Function(String)','Rotates the token and maps the verified response into XCenterSessionTokens.'),
];
const storageNote='Use one token source per persisted account session. The native helpers use a 30-second refresh window and deduplicate within the instance. Use a shared lock across multiple processes.';
native['session-token-source'] = {
  swift:snippet('XCenterSessionTokenSource(load:save:refresh:).accessToken() async throws',storageCallbacks('swift'),
    'let source = XCenterSessionTokenSource(\n    load: loadTokens, save: saveTokens, refresh: rotateTokens\n)\nlet token = try await source.accessToken()',undefined,storageNote),
  kotlin:snippet('XCenterSessionTokenSource(load, save, refresh).accessToken(): String',storageCallbacks('kotlin'),
    'val source = XCenterSessionTokenSource(::loadTokens, ::saveTokens, ::rotateTokens)\nval token = withContext(Dispatchers.IO) { source.accessToken() }',undefined,storageNote),
  dart:snippet('XCenterSessionTokenSource({load, save, refresh}).accessToken() → Future<String>',storageCallbacks('dart'),
    'final source = XCenterSessionTokenSource(\n  load: loadTokens, save: saveTokens, refresh: rotateTokens,\n);\nfinal token = await source.accessToken();',undefined,storageNote),
};
const deviceNote='Expose only the display code and verification URL to the input-constrained device. Persist the transaction privately.';
native['begin-device'] = {
  swift:snippet('auth.beginDevice() async throws → (userCode, verificationURL, transaction)',[],
    'let attempt = try await auth.beginDevice()\ntry await saveDeviceAttempt(attempt.transaction)\nshowCode(attempt.userCode, url: attempt.verificationURL)',undefined,deviceNote),
  kotlin:snippet('auth.beginDevice(): XCenterOAuth.Device',[],
    'val attempt = withContext(Dispatchers.IO) { auth.beginDevice() }\nsaveDeviceAttempt(attempt.transaction)\nshowCode(attempt.userCode, attempt.verificationUrl)',undefined,deviceNote),
  dart:snippet('auth.beginDevice({List<String> scopes = const []})',[
    argument('scopes','List<String>','Additional requested scopes beyond the configured defaults.'),
  ],'final attempt = await auth.beginDevice();\nawait saveDeviceAttempt(attempt.transaction);\nshowCode(attempt.code, attempt.verificationUrl);',
  '{"code":"X7K2PQ","verificationUrl":"https://id.xcenter.it/device?code=X7K2PQ"}',deviceNote),
};
native['complete-device'] = {
  swift:snippet('auth.completeDevice(_ transaction: DeviceTransaction) async throws',[
    argument('transaction','XCenterServerOAuth.DeviceTransaction','Private value returned by beginDevice. Cancel the waiting task if the requesting device leaves.'),
  ],'let session = try await auth.completeDevice(attempt)\ntry await saveProductSession(session)'),
  kotlin:snippet('auth.completeDevice(transaction, cancelled = { false }): Identity',[
    argument('transaction','XCenterOAuth.DeviceTransaction','Private value returned by beginDevice.'),
    argument('cancelled','() -> Boolean','Returns true when polling should stop. Checked before network attempts.'),
  ],'val session = withContext(Dispatchers.IO) {\n    auth.completeDevice(attempt, cancelled = { !isActive })\n}\nsaveProductSession(session)'),
  dart:snippet('auth.completeDevice(Map<String, Object?> transaction, {bool Function()? cancelled})',[
    argument('transaction','Map<String, Object?>','Private value returned by beginDevice.'),
    argument('cancelled','bool Function()?','Returns true to stop waiting.'),
  ],'final session = await auth.completeDevice(attempt, cancelled: isCancelled);\nawait saveProductSession(session);'),
};
native['issuer-sign-out'] = {
  swift:snippet('oauth.issuerSignOutURL: URL',[], 'try await clearProductSession()\nopenURL(oauth.issuerSignOutURL)'),
  kotlin:snippet('oauth.issuerSignOutUrl: URI',[], 'clearProductSession()\nopenExternalBrowser(oauth.issuerSignOutUrl)'),
  dart:snippet('oauth.issuerSignOutUrl → Uri',[], 'await clearProductSession();\nawait launchUrl(oauth.issuerSignOutUrl);'),
};

const jsOnlyNote='This helper is specific to the JavaScript SDK. The corresponding options or validation are shown in the related platform guide.';

const idArg = argument('id','String','File, folder or record ID from the corresponding list or create result.');
const collectionArg=argument('collection','String','Collection inside the selected app namespace.');
const appIDArg = argument('clientId','String','Client ID from the app’s active registration.');
const userToken = argument('accessToken','Token callback','Returns the active delegated bearer token. Use the session token source for renewal.');
native['create-public-client'] = {
  swift:snippet('XCenterDataClient(session: URLSession? = nil)',[
    argument('session','URLSession?','Optional transport for an isolated test or configured runtime.'),
  ],'import XCenterID\n\nlet publicAPI = XCenterDataClient()', 'Anonymous client ready for public calls.'),
  kotlin:snippet('XCenterDataClient(clientId: String? = null, accessToken: (() -> String)? = null)',[
    appIDArg,userToken,
  ],'import it.xcenter.id.XCenterDataClient\n\nval publicApi = XCenterDataClient()', 'Anonymous client ready for public calls.', 'Omit both arguments for public access.'),
  dart:snippet('XCenterDataClient({clientId, accessToken, http.Client? client})',[
    appIDArg,userToken,argument('client','http.Client?','Optional transport.'),
  ],"import 'package:xcenter_id/xcenter_id.dart';\n\nfinal publicApi = XCenterDataClient();",'Anonymous client ready for public calls.', 'Omit clientId and accessToken for anonymous access. Call close() when finished.'),
};
native['create-user-client'] = {
  swift:snippet('XCenterDataClient(clientID:session:accessToken:)',[
    appIDArg,argument('session','URLSession?','Optional transport. Defaults to an ephemeral session.'),userToken,
  ],'let user = XCenterDataClient(clientID: clientID) {\n    try await tokenSource.accessToken()\n}', 'Delegated data adapter for the active session.'),
  kotlin:snippet('XCenterDataClient(clientId: String? = null, accessToken: (() -> String)? = null)',[
    appIDArg,userToken,
  ],'val user = XCenterDataClient(clientId) { tokenSource.accessToken() }', 'Delegated data adapter for the active session.'),
  dart:snippet('XCenterDataClient({clientId, accessToken, http.Client? client})',[
    appIDArg,userToken,argument('client','http.Client?','Optional HTTP transport.'),
  ],'final user = XCenterDataClient(\n  clientId: clientId, accessToken: tokenSource.accessToken,\n);','Delegated data adapter for the active session.'),
};

function dataExamples(
  id:string, receiver:'user'|'publicApi', methods:readonly [string,string,string],
  args:Args|Record<Native,Args>, call:readonly [string,string,string], note?:string,
) {
  const [swift,kotlin,dart]=methods;
  const binary=['public-avatar','user-avatar','app-icon','download-file','download-shared-file','download-app-file'].includes(id);
  const isPublic=receiver==='publicApi';
  const argumentsFor=(language:Native)=>'swift' in args?args[language]:args;
  native[id] = {
    swift:snippet(swift+' async throws → Data',argumentsFor('swift'),
      'let bytes = try await '+(isPublic?'publicAPI':receiver)+'.'+call[0]+(binary?'':'\nlet result = try JSONSerialization.jsonObject(with: bytes)'),undefined,note??nativeBytes.swift),
    kotlin:snippet(kotlin+': ByteArray',argumentsFor('kotlin'),
      'val bytes = withContext(Dispatchers.IO) { '+receiver+'.'+call[1]+' }'+(binary?'':'\nval result = JSONObject(bytes.toString(Charsets.UTF_8))'),undefined,note??nativeBytes.kotlin),
    dart:snippet(dart+' → Future<Uint8List>',argumentsFor('dart'),
      'final bytes = await '+receiver+'.'+call[2]+';'+(binary?'':'\nfinal result = jsonDecode(utf8.decode(bytes));'),undefined,note??nativeBytes.dart),
  };
}
for(const [id,receiver,method] of [
  ['discover','publicApi','discover'],['user-info','user','userInfo'],
  ['user-avatar','user','avatar'],['friends','user','friends'],
] as const) {
  const call=method+'()';
  dataExamples(id,receiver,[call,call,call],[],[call,call,call]);
}
for(const [id,swift,kotlin,dart,param,value] of [
  ['public-profile','publicProfile','publicProfile','publicProfile','username','jamie'],
  ['public-avatar','publicAvatar','publicAvatar','publicAvatar','username','jamie'],
  ['app-icon','appIcon','appIcon','appIcon','registrationId','9dbbdc61-08a6-4c49-9df8-51cf596871cd'],
] as const){
  const arg=argument(param,'String',param==='username'?'Public account handle without @.':'App registration UUID, distinct from the OAuth client ID.');
  dataExamples(id,'publicApi',[
    swift+'(_ '+param+': String)',kotlin+'('+param+': String)',dart+'(String '+(param==='registrationId'?'id':param)+')',
  ],[arg],[swift+'("'+value+'")',kotlin+'("'+value+'")',dart+"('"+value+"')"]);
}

const serviceNote='Create and store the service key in the backend. This credential accesses the verified app’s own storage.';
native['create-service-client'] = {
  swift:snippet('XCenterServerConfig.records() throws → XCenterServiceRecords',[
    argument('clientId','String','Registration ID. Pass in XCenterServerConfig or the direct record client initializer.'),
    argument('key','String','Verified app database bearer key. XCenterServerConfig calls the field databaseKey.'),
  ],'import XCenterIDServer\n\nlet records = try XCenterServerConfig.load().records()', 'Verified app service records adapter.',serviceNote),
  kotlin:snippet('XCenterConfig.records() → XCenterServiceRecords',[
    appIDArg,argument('databaseKey','String','Verified app database bearer key.'),
  ],'val records = XCenterConfig.load().records()', 'Verified app service records adapter.',serviceNote),
  dart:snippet('XCenterConfig.records() → XCenterServiceRecords',[
    appIDArg,argument('key','String','Verified app database bearer key. XCenterConfig calls the field databaseKey.'),
    argument('transport','http.Client?','Optional HTTP client on the direct XCenterServiceRecords constructor.'),
  ],'final records = XCenterConfig.load().records();','Verified app service records adapter.',serviceNote),
};

const readActions = ['list','get'] as const;
for(const space of ['user','shared','public'] as const){
  for(const action of readActions){
    const list=action==='list';
    const name=list?'listRecords':'getRecord';
    const swiftScope={user:'.own',shared:'.shared(sourceClientID)',public:'.publiclyVisible(sourceClientID)'}[space];
    const kotlinScope={user:'XCenterDataClient.RecordSpace.Own',shared:'XCenterDataClient.RecordSpace.Shared(sourceClientId)',public:'XCenterDataClient.RecordSpace.Public(sourceClientId)'}[space];
    const dartName=space==='public'?(list?'listPublicRecords':'getPublicRecord'):name;
    const dartPositional=(space==='public'?"sourceClientId, ":'')+"'notes'"+(list?'':space==='public'?', publicRecordId':", 'first_note'");
    const pos=(list?'':space==='public'?', publicRecordID':', "first_note"');
    const kotlinPos=(list?'':space==='public'?', publicRecordId':', "first_note"');
    const nativeId = space+'-records-'+action;
    const receiver=space==='public'?'publicApi':'user';
    const basic=[collectionArg,...(!list?[idArg]:[]),...(list?[argument('cursor','String?','Previous page cursor. Omit for the first page.')]:[])];
    const recordSpaces='Select the caller’s own namespace, a consented source app, or a publicly visible collection. Defaults to the caller’s own records.';
    dataExamples(nativeId,receiver,[
      name+'(_ collection: String'+(list?'':', id: String')+', space: RecordSpace = .own'+(list?', cursor: String? = nil':'')+')',
      name+'(collection: String'+(list?'':', id: String')+', space: RecordSpace = Own'+(list?', cursor: String? = null':'')+')',
      dartName+'('+(space==='public'?'String client, ':'')+'String collection'+(list?'':', String id')+
        (space==='public'?(list?', {String? cursor}':''):list?', {String? cursor, String? sharedFrom}':', {String? sharedFrom}')+')',
    ],{
      swift:[...basic,argument('space','XCenterDataClient.RecordSpace',recordSpaces)],
      kotlin:[...basic,argument('space','XCenterDataClient.RecordSpace',recordSpaces)],
      dart:space==='public'?[argument('client','String','Source registration’s OAuth client ID.'),...basic]
        :[...basic,argument('sharedFrom','String?','Consented source app client ID. Omitting it reads the caller’s own namespace.')],
    },
      [name+'("notes"'+pos+(space==='user'?'':', space: '+swiftScope)+')',
       name+'("notes"'+kotlinPos+(space==='user'?'':', space = '+kotlinScope)+')',
       dartName+'('+dartPositional+(space==='shared'?', sharedFrom: sourceClientId':'')+')']);
  }
}
const rev = (type:string) => argument('revision',type,'Use 0 to create. For edits and deletion, use the latest revision.');
const dataWrite=argument('data','JSON value','Replacement JSON record contents. The encoded payload may be at most 60,000 bytes.');
const visibility=argument('isPublic','Boolean','Required visibility. A verified app can publish a record.');
const readers=argument('readers','Optional list of strings','Handles of up to 50 recipients who linked the app. Omit or pass an empty list to clear existing recipient grants.');
const recordWrite = (withReaders:boolean) => {
  const swiftReaders=withReaders?', readers: ["morgan"]':'';
  const kotlinReaders=withReaders?', readers = listOf("morgan")':'';
  const dartReaders=withReaders?", readers: ['morgan']":'';
  const fn='putRecord';
  const args=[collectionArg,idArg];
  return {
    swift:snippet(fn+'(_ collection: String, id: String, revision: Int, value: Write<Value>) async throws → Data',
      [...args,rev('Int'),argument('value','Write<Value: Encodable>','Contains data, required isPublic and optional readers.'),dataWrite,visibility,readers],
      'let value = XCenterDataClient.Write(data: ["title": "First note"], isPublic: false'+swiftReaders+')\nlet bytes = try await user.putRecord("notes", id: "first_note", revision: 0, value: value)',undefined,nativeBytes.swift),
    kotlin:snippet(fn+'(collection: String, id: String, revision: Long, data: Any?, isPublic: Boolean, readers: List<String>? = null): ByteArray',
      [...args,rev('Long'),dataWrite,visibility,readers],
      'val bytes = withContext(Dispatchers.IO) {\n    val data = JSONObject().put("title", "First note")\n    user.putRecord("notes", "first_note", 0, data, isPublic = false'+kotlinReaders+')\n}',undefined,nativeBytes.kotlin),
    dart:snippet(fn+'(String collection, String id, {required int revision, required Object? data, required bool isPublic, List<String>? readers})',
      [...args,rev('int'),dataWrite,visibility,readers],
      "final bytes = await user.putRecord(\n  'notes', 'first_note', revision: 0, data: {'title': 'First note'},\n  isPublic: false"+dartReaders+",\n);",undefined,nativeBytes.dart),
  };
};
native['user-records-put']=recordWrite(false);
native['recipient-sharing']=recordWrite(true);
native['user-records-delete']={
  swift:snippet('deleteRecord(_ collection: String, id: String, revision: Int) async throws → Data',
    [collectionArg,idArg,rev('Int')],'let bytes = try await user.deleteRecord("notes", id: id, revision: revision)',undefined,nativeBytes.swift),
  kotlin:snippet('deleteRecord(collection: String, id: String, revision: Long): ByteArray',
    [collectionArg,idArg,rev('Long')],'val bytes = withContext(Dispatchers.IO) { user.deleteRecord("notes", id, revision) }',undefined,nativeBytes.kotlin),
  dart:snippet('deleteRecord(String collection, String id, {required int revision}) → Future<Uint8List>',
    [collectionArg,idArg,rev('int')],"final bytes = await user.deleteRecord('notes', id, revision: revision);",undefined,nativeBytes.dart),
};
for(const action of ['list','get','put','delete'] as const){
  const list=action==='list', put=action==='put', remove=action==='delete';
  const argNames=[collectionArg,...(list?[argument('cursor','String?','Previous page cursor. Omit for the first page.')]:[idArg])];
  const swiftArgs=[...argNames,...(put||remove?[rev('Int')]:[]),...(put?[dataWrite,visibility]:[])];
  const kotlinArgs=[...argNames,...(put||remove?[rev('Long')]:[]),...(put?[dataWrite,visibility]:[])];
  const dartArgs=[...argNames,...(put||remove?[rev('int')]:[]),...(put?[dataWrite,visibility]:[])];
  const swiftSig=action+'(_ collection: String'+(list?', cursor: String? = nil':', id: String'+(put||remove?', revision: Int':'')+(put?', data: Value, isPublic: Bool':''))+') async throws → Data';
  const kotlinSig=action+'(collection: String'+(list?', cursor: String? = null':', id: String'+(put||remove?', revision: Long':'')+(put?', data: Any?, isPublic: Boolean':''))+'): JSONObject';
  const dartSig=action+'(String collection'+(list?', {String? cursor}':', String id'+(put||remove?', {required int revision'+(put?', required Object? data, required bool isPublic':'')+'}':''))+') → Future<Uint8List>';
  const swiftInput=list?'"notes"':'"notes", id: "first_note"'+(put?', revision: 0, data: ["title": "First note"], isPublic: false':remove?', revision: revision':'');
  const kotlinInput=list?'"notes"':'"notes", "first_note"'+(put?', 0, JSONObject().put("title", "First note"), false':remove?', revision':'');
  const dartInput=list?"'notes'":"'notes', 'first_note'"+(put?", revision: 0, data: {'title': 'First note'}, isPublic: false":remove?', revision: revision':'');
  native['service-records-'+action]={
    swift:snippet(swiftSig,swiftArgs,'let bytes = try await records.'+action+'('+swiftInput+')',undefined,nativeBytes.swift),
    kotlin:snippet(kotlinSig,kotlinArgs,'val result = withContext(Dispatchers.IO) {\n    records.'+action+'('+kotlinInput+')\n}',undefined,'The JVM server module returns a JSONObject. Run the blocking call on an IO dispatcher.'),
    dart:snippet(dartSig,dartArgs,'final bytes = await records.'+action+'('+dartInput+');',undefined,nativeBytes.dart),
  };
}

const parent=argument('folder','String?','Optional parent folder ID. Use nil or null for the root where the method supports it.');
const folderName=argument('name','String','Display name for the new folder or file.');
const folderPatch=argument('change','ItemChange / JSON object / map','Set a new name, a destination, or both. Omit a property to keep it. An explicit null folder moves to the root.');
const fileRows = [
  ['list-files','listFiles','folder: String? = nil','folder: String? = null','{String? folder}',[parent],'folder: folderID','folder = folderId','folder: folderId'],
  ['get-file','getFile','_ id: String','id: String','String id',[idArg],'fileID','fileId','fileId'],
  ['download-file','downloadFile','_ id: String','id: String','String id',[idArg],'fileID','fileId','fileId'],
  ['delete-file','deleteFile','_ id: String','id: String','String id',[idArg],'fileID','fileId','fileId'],
  ['create-folder','createFolder','name: String, parent: String? = nil','name: String, parent: String? = null','String name, {String? parent}',[folderName,argument('parent','String?',parent[2])],'name: "Notes"','"Notes"',"'Notes'"],
  ['delete-folder','deleteFolder','_ id: String','id: String','String id',[idArg],'folderID','folderId','folderId'],
  ['list-shared-files','listSharedFiles','','','',[],'','',''],
  ['get-shared-file','getSharedFile','_ id: String','id: String','String id',[argument('id','String','Incoming share identifier returned by the shared file list.')],'shareID','shareId','shareId'],
  ['download-shared-file','downloadSharedFile','_ id: String','id: String','String id',[argument('id','String','Incoming share identifier returned by the shared file list.')],'shareID','shareId','shareId'],
] as const;
for(const [id,method,swiftSig,kotlinSig,dartSig,args,swift,kotlin,dart] of fileRows){
  dataExamples(id,'user',[method+'('+swiftSig+')',method+'('+kotlinSig+')',method+'('+dartSig+')'],args,
    [method+'('+swift+')',method+'('+kotlin+')',method+'('+dart+')']);
}
for(const [id,method] of [['update-file','updateFile'],['update-folder','updateFolder']] as const){
  dataExamples(id,'user',[method+'(_ id: String, change: ItemChange)',method+'(id: String, change: JSONObject)',method+'(String id, Map<String, Object?> change)'],
    {
      swift:[idArg,argument('change','XCenterDataClient.ItemChange','Optional name and destination. Choose .unchanged, .root, or .folder(id).')],
      kotlin:[idArg,argument('change','JSONObject',folderPatch[2])],
      dart:[idArg,argument('change','Map<String, Object?>',folderPatch[2])],
    },
    [method+'(id, change: .init(name: "Renamed", destination: .root))',
     method+'(id, JSONObject().put("name", "Renamed").put("folder", JSONObject.NULL))',
     method+"(id, {'name': 'Renamed', 'folder': null})"]);
}
dataExamples('upload-file','user',[
  'uploadFile(name: String, content: Data, folder: String? = nil)',
  'uploadFile(name: String, content: ByteArray, folder: String? = null)',
  'uploadFile(String name, Uint8List content, {String? folder})',
], {
  swift:[folderName,argument('content','Data','Raw bytes of a nonempty file, up to 2 MiB.'),parent],
  kotlin:[folderName,argument('content','ByteArray','Raw bytes of a nonempty file, up to 2 MiB.'),parent],
  dart:[folderName,argument('content','Uint8List','Raw bytes of a nonempty file, up to 2 MiB.'),parent],
},
  ['uploadFile(name: "hello.txt", content: Data("Hello".utf8))',
   'uploadFile("hello.txt", "Hello".encodeToByteArray())',
   "uploadFile('hello.txt', Uint8List.fromList(utf8.encode('Hello')))"]);

const nativeProfileArgs: Args = [
  argument('profile','OverviewProfile?','Null while signed out. A signed-in profile requires name and username, with optional picture, email and badge fields.'),
  argument('clientId','String','Registration ID used by Manage app.'),
  argument('signIn','Async closure','Starts the chosen system browser or product authentication adapter.'),
  argument('signOut','Async closure','Clears product credentials and updates the controlled profile.'),
  argument('settings','Optional view','App-owned controls displayed in account details.'),
];
const accountCard: NativeSet = {
  swift:snippet('AccountOverview(profile:clientID:signIn:signOut:settings:)',nativeProfileArgs,
    'import XCenterID\n\nAccountOverview(\n    profile: profile, clientID: clientID,\n    signIn: signIn, signOut: signOut\n) {\n    SyncSettings()\n}',undefined,'Provide a SwiftUI view builder for settings. The signIn and signOut closures are @MainActor, async and throwing.'),
  kotlin:snippet('AccountOverview(profile, clientId, signIn, signOut, modifier, settings)',[
    ...nativeProfileArgs,argument('modifier','Modifier','Optional Compose layout modifier. Defaults to Modifier.'),
  ],'import it.xcenter.id.AccountOverview\n\nAccountOverview(profile, clientId, ::signIn, ::signOut) {\n    SyncSettings()\n}',undefined,'The sign-in and sign-out callbacks are suspend functions. Settings is an optional Compose ColumnScope content block.'),
  dart:snippet('AccountOverview({key, required profile, required clientId, required signIn, required signOut, settings})',[
    argument('key','Key?','Optional Flutter widget identity.'),...nativeProfileArgs,
  ],"import 'package:xcenter_id/xcenter_id.dart';\n\nAccountOverview(\n  profile: profile, clientId: clientId,\n  signIn: signIn, signOut: signOut,\n  settings: const SyncSettings(),\n)",undefined,'signIn and signOut return Future<void>. Settings is a Widget. The profile accepts either a picture Uri or an ImageProvider avatar.'),
};
native['account-overview']=accountCard;
native['native-overview']=accountCard;

native['swift-browser-sign-in'] = {
  swift:snippet('BrowserSignIn(anchor:).signIn(config:) async throws',[
    argument('anchor','ASPresentationAnchor','Window presenting the authentication session.'),
    argument('config','XCenterPublicConfig','Public registration ID, verified HTTPS callback and scopes.'),
    argument('using, scopes','XCenterOAuth, [String]','Alternate overloads take a preconfigured OAuth client and optional scopes. Defaults to [].'),
  ],'import XCenterID\n\nlet config = try XCenterPublicConfig.load(file: configURL)\nlet browser = BrowserSignIn(anchor: window)\nif let session = try await browser.signIn(config: config) {\n    try await saveProductSession(session)\n}',undefined,'Cancellation returns nil. The managed overload validates the returned identity.'),
};
native['android-browser-sign-in'] = {
  kotlin:snippet('BrowserSignIn(activity).signIn(config): XCenterOAuth.Identity?',[
    argument('activity','ComponentActivity','Create BrowserSignIn before the activity starts.'),
    argument('config','XCenterPublicConfig','Public registration ID, verified HTTPS callback and scopes.'),
    argument('client, scopes','XCenterOAuth, Collection<String>','Alternate overload takes the configured OAuth client and optional scopes.'),
  ],'private val xcenterBrowser = BrowserSignIn(this)\n\n// From an activity coroutine after startup:\nval config = loadXCenterAsset(assets)\nval session = xcenterBrowser.signIn(config)\nif (session != null) saveProductSession(session)',undefined,'The wrapper runs the exchange on an IO dispatcher and returns null on cancellation.'),
};
native['flutter-browser-sign-in'] = {
  dart:snippet('XCenterPublicConfig.loadAsset().identity().signIn({List<String> scopes = const []})',[
    argument('asset','String','Root bundle path. Defaults to xid.json.'),
    ...publicConfigArgs.dart.slice(1),argument('signIn.scopes','List<String>','Additional scopes for this sign-in attempt.'),
  ],"final config = await XCenterPublicConfig.loadAsset();\nfinal oauth = config.identity();\ntry {\n  final session = await oauth.signIn(scopes: ['offline_access']);\n  await saveProductSession(session);\n} finally {\n  oauth.close();\n}",undefined,'On Flutter web use begin and complete across the redirect, or use a confidential backend.'),
};
native['expo-oauth'] = {
  swift:native['swift-browser-sign-in'].swift,
  kotlin:native['android-browser-sign-in'].kotlin,
  dart:native['flutter-browser-sign-in'].dart,
};
const browserProof='Build the request from an active SDK or backend login attempt. Validate the returned callback with the same single-use transaction before saving a session.';
native['authorize-native'] = {
  swift:snippet('BrowserSignIn.authorize(_ request: RegisteredBrowserRequest) async throws → URL?',[
    argument('authorizationURL','URL','Authorization URL returned by begin.'),argument('callbackURL','URL','Exact verified HTTPS callback.'),
  ],'let request = try RegisteredBrowserRequest(\n    authorizationURL: attempt.url, callbackURL: callback\n)\nlet returned = try await browser.authorize(request)', 'https://app.example.com/callback?code=<redacted>&state=<redacted>',browserProof),
  kotlin:snippet('BrowserSignIn.authorize(request: BrowserRequest): Uri?',[
    argument('authorization','android.net.Uri','Authorization URL returned by begin.'),argument('callback','android.net.Uri','Exact verified HTTPS callback.'),
  ],'val request = BrowserRequest(Uri.parse(attempt.url.toString()), Uri.parse(callback.toString()))\nval returned = browser.authorize(request)', 'https://app.example.com/callback?code=<redacted>&state=<redacted>',browserProof),
  dart:snippet('authorizeBrowser(BrowserRequest request) → Future<Uri>',[
    argument('authorization','Uri','Authorization URL returned by begin.'),argument('callback','Uri','Exact verified HTTPS callback.'),
  ],'final request = BrowserRequest(authorization: attempt.url, callback: callback);\nfinal returned = await authorizeBrowser(request);','https://app.example.com/callback?code=<redacted>&state=<redacted>',browserProof),
};
native['native-backend-handoff'] = {
  swift:snippet('BrowserSignIn.authorizeWithPickup(browserURL:backendOrigin:complete:) async throws',[
    argument('browserURL','URL','HTTPS authorization start URL hosted by your product backend.'),
    argument('backendOrigin','URL','Trusted deployment origin. Scheme, host and port must match.'),
    argument('complete','@MainActor () async throws → Void','Waits for the requesting app’s proof-bound pickup, validates it and persists the product session.'),
  ],'try await browser.authorizeWithPickup(\n    browserURL: attempt.url, backendOrigin: backendOrigin\n) {\n    try await redeemAndSaveProductSession(attempt)\n}',undefined,'The authentication sheet closes after the callback closure succeeds. Handle cancellation in the pickup flow.'),
};

native['saved-places-client'] = {
  swift:snippet('XCenterSavedPlaces(clientId:accessToken:)',[appIDArg,userToken],
    'import XCenterIDServer\n\nlet places = XCenterSavedPlaces(clientId: clientID) {\n    try await tokenSource.accessToken()\n}', 'Legacy saved-places adapter ready.'),
  kotlin:snippet('XCenterSavedPlaces(accessToken: () -> String)',[userToken],
    'import it.xcenter.id.server.XCenterSavedPlaces\n\nval places = XCenterSavedPlaces { tokenSource.accessToken() }','Legacy saved-places adapter ready.'),
  dart:snippet('XCenterSavedPlaces(accessToken, {http.Client? transport})',[
    userToken,argument('transport','http.Client?','Optional HTTP client. close() releases the transport.'),
  ],'final places = XCenterSavedPlaces(tokenSource.accessToken);','Legacy saved-places adapter ready.'),
};
for(const method of ['list','create','update','delete'] as const){
  const list=method==='list', update=method==='update', write=update||method==='create';
  const base=list?[argument('source','String?','Optional delegated source registration.'),argument('after','String?','Continue with the previous page’s nextCursor.')]:method==='create'?[]:[idArg];
  const swiftArgs:Args=[...base,...(update?[rev('Int')]:[]),...(write?[argument('place','XCenterSavedPlaces.Place','Contains label, latitude and longitude in decimal degrees.')]:[])];
  const kotlinArgs:Args=[...base,...(update?[rev('Long')]:[]),...(write?[argument('place','JSONObject','Contains label, latitude and longitude in decimal degrees.')]:[])];
  const dartArgs:Args=[...base,...(update?[rev('int')]:[]),...(write?[argument('place','Map<String, Object?>','Contains label, latitude and longitude in decimal degrees.')]:[])];
  const inputsSwift=list?'after: cursor':write?(update?'id, revision: revision, place: ':'')+'.init(label: "Central station", latitude: 45.48, longitude: 9.20)':'id';
  const inputsKotlin=list?'after = cursor':write?(update?'id, revision, ':'')+'JSONObject().put("label", "Central station").put("latitude", 45.48).put("longitude", 9.20)':'id';
  const inputsDart=list?'after: cursor':write?(update?'id, revision, ':'')+"{'label': 'Central station', 'latitude': 45.48, 'longitude': 9.20}":'id';
  const swiftSignature=list?'list(source: String? = nil, after: String? = nil)':update?'update(_ id: String, revision: Int, place: Place)':write?'create(_ place: Place)':'delete(_ id: String)';
  const kotlinSignature=list?'list(source: String? = null, after: String? = null)':update?'update(id: String, revision: Long, place: JSONObject)':write?'create(place: JSONObject)':'delete(id: String)';
  const dartSignature=list?'list({String? source, String? after})':update?'update(String id, int revision, Map<String, Object?> place)':write?'create(Map<String, Object?> place)':'delete(String id)';
  native['saved-places-'+method]={
    swift:snippet(swiftSignature+' async throws → Data',swiftArgs,'let bytes = try await places.'+method+'('+inputsSwift+')',undefined,nativeBytes.swift),
    kotlin:snippet(kotlinSignature+': JSONObject',kotlinArgs,'val result = withContext(Dispatchers.IO) {\n    places.'+method+'('+inputsKotlin+')\n}',undefined,'Use the JVM server module and run requests on an IO dispatcher.'),
    dart:snippet(dartSignature+' → Future<Uint8List>',dartArgs,'final bytes = await places.'+method+'('+inputsDart+');',undefined,nativeBytes.dart),
  };
}
native['issuer-scopes']={
  swift:snippet('XCenterOAuth.supportedScopes: Set<String>',[],
    'let requested = ["openid", "files_read"].filter(XCenterOAuth.supportedScopes.contains)', '{"requested":["openid","files_read"]}'),
  kotlin:snippet('XCenterOAuth.scopes: Set<String>',[],
    'val requested = listOf("openid", "files_read").filter(XCenterOAuth.scopes::contains)', '{"requested":["openid","files_read"]}'),
  dart:snippet('supportedScopes: Set<String>',[],
    "final requested = ['openid', 'files_read'].where(supportedScopes.contains).toList();", '{"requested":["openid","files_read"]}'),
};
const statusArg=argument('status','Int / int','HTTP status from the issuer.');
const retryArg=argument('retryAfter','String?','Retry-After header when present.');
native['swift-config-data']={swift:snippet(
  'XCenterPublicConfig.data(accessToken:) → XCenterDataClient',
  [argument('accessToken','() async throws → String','Returns the current delegated access token.')],
  'let data = config.data { try await source.accessToken() }',
)};
native['jvm-data-client']={kotlin:snippet(
  'createDataClient(clientId: String? = null, accessToken: (() -> String)? = null): XCenterDataClient',
  [appIDArg,userToken],
  'import it.xcenter.id.server.createDataClient\n\nval user = createDataClient(clientId) { source.accessToken() }',undefined,
  'The JVM module uses Java HttpClient. Use it for delegated operations, including PATCH. Omit both arguments for anonymous calls.',
)};
native['close-dart-clients']={dart:snippet(
  'close() → void',[],
  'final user = XCenterDataClient(clientId: clientId, accessToken: source.accessToken);\ntry {\n  final bytes = await user.listFiles();\n  consumeFileList(bytes);\n} finally {\n  user.close();\n}',
  'The underlying HTTP client is closed.',
  'XCenterDataClient, XCenterOAuth, XCenterNativeOAuth, XCenterServiceRecords and XCenterSavedPlaces each expose close(). This also closes a client passed into the constructor.',
)};
native['oauth-errors']={
  swift:snippet('XCenterOAuthFailure / SignInFailure',[
    argument('XCenterOAuthFailure','Error','invalidConfiguration, invalidCallback, invalidToken, expired, unsupported, or http(status, code).'),
    argument('SignInFailure','Error','invalidURL, unsupportedCallback, browserUnavailable, invalidCallback, or alreadyRunning.'),
  ],'do {\n    _ = try await oauth.complete(returnedURL, transaction: attempt)\n} catch XCenterOAuthFailure.expired {\n    showExpiredSignIn()\n}', 'Expired sign-in attempts return the user to the sign-in action.'),
  kotlin:snippet('XCenterOAuthException(status: Int, code: String?)',[
    argument('status','Int','HTTP response status.'),argument('code','String?','Issuer OAuth error code when present.'),
  ],'try {\n    withContext(Dispatchers.IO) { oauth.complete(callback, attempt) }\n} catch (error: XCenterOAuthException) {\n    showOAuthFailure(error.status, error.code)\n}', 'The HTTP status and issuer error code are available.'),
  dart:snippet('XCenterOAuthError(int httpStatus, String? code)',[
    argument('httpStatus','int','HTTP response status.'),argument('code','String?','Issuer OAuth error code when present.'),
  ],'try {\n  await oauth.complete(callback, attempt);\n} on XCenterOAuthError catch (error) {\n  showOAuthFailure(error.httpStatus, error.code);\n}', 'The HTTP status and issuer error code are available.'),
};
native['session-tokens']={
  swift:snippet('XCenterSessionTokens(accessToken:refreshToken:expiresAt:)',[
    argument('accessToken','String','Current access bearer.'),argument('refreshToken','String?','Rotated credential, if granted.'),
    argument('expiresAt','Date','Absolute access-token expiry.'),
  ],'let saved = XCenterSessionTokens(\n    accessToken: access, refreshToken: refresh,\n    expiresAt: Date().addingTimeInterval(TimeInterval(expiresIn))\n)'),
  kotlin:snippet('XCenterSessionTokens(accessToken: String, refreshToken: String?, expiresAt: Long)',[
    argument('accessToken','String','Current access bearer.'),argument('refreshToken','String?','Rotated credential, if granted.'),
    argument('expiresAt','Long','Absolute access-token expiry in epoch milliseconds.'),
  ],'val saved = XCenterSessionTokens(access, refresh, System.currentTimeMillis() + expiresIn * 1000L)'),
  dart:snippet('XCenterSessionTokens(String accessToken, String? refreshToken, DateTime expiresAt)',[
    argument('accessToken','String','Current access bearer.'),argument('refreshToken','String?','Rotated credential, if granted.'),
    argument('expiresAt','DateTime','Absolute access-token expiry.'),
  ],'final saved = XCenterSessionTokens(\n  access, refresh, DateTime.now().add(Duration(seconds: expiresIn)),\n);'),
};
native['xcenter-error']={
  swift:snippet('XCenterHTTPError: Error',[
    argument('status','Int',statusArg[2]),argument('body','Data','Raw response body.'),retryArg,
  ],'do {\n    _ = try await user.listFiles()\n} catch let error as XCenterHTTPError where error.status == 401 {\n    try await reopenSignIn()\n}', '{"status":401,"retryAfter":null}'),
  kotlin:snippet('XCenterHTTPException : IOException',[
    argument('status','Int',statusArg[2]),argument('responseBody','ByteArray','Raw response body.'),retryArg,
  ],'try {\n    withContext(Dispatchers.IO) { user.listFiles() }\n} catch (error: XCenterHTTPException) {\n    if (error.status != 401) throw error\n    reopenSignIn()\n}', '{"status":401,"retryAfter":null}'),
  dart:snippet('XCenterHttpException implements Exception',[
    argument('status','int',statusArg[2]),argument('body','Uint8List','Raw response body.'),retryArg,
  ],'try {\n  await user.listFiles();\n} on XCenterHttpException catch (error) {\n  if (error.status != 401) rethrow;\n  await reopenSignIn();\n}', '{"status":401,"retryAfter":null}'),
};

const platformOnly: Partial<Record<string,Language>> = {
  'expo-oauth':'typescript','authorize-native':'typescript','account-entry':'typescript','registered-app-sign-in':'typescript',
  'swift-browser-sign-in':'swift','android-browser-sign-in':'kotlin','flutter-browser-sign-in':'dart','close-dart-clients':'dart','jvm-data-client':'kotlin','swift-config-data':'swift',
};
const unavailable: Record<string,string> = {
  'stock-peerjs':'The stock PeerJS client is JavaScript or TypeScript. A compatible client can also request leases through POST, PUT and DELETE at /v1/peers/peerjs/session.',
  'browser-peer-connections':'The WebRTC browser adapter is available in JavaScript and TypeScript. Use the Peer signaling pages with your platform’s WebRTC and media APIs.',
  revoke:'The issuer currently supports revocation through Linked apps. There is no native revoke operation.',
  'server-user-info':'The separate subject-binding method belongs to the Node adapter. Native adapters validate the returned subject during code exchange and refresh.',
  'public-avatar-url':'The native SDK exposes publicAvatar to fetch image bytes. This URL-only helper is available in JavaScript and TypeScript.',
  'app-icon-url':'The native SDK exposes appIcon to fetch image bytes. This URL-only helper is available in JavaScript and TypeScript.',
  'web-account-overview':'Use the native account card. The custom element belongs to the web package.',
  'nextjs-routes':'The route adapter is an example for a Node.js backend. Use the platform’s server OAuth client with your own router.',
  'create-transport':jsOnlyNote,
  'create-records':jsOnlyNote,
  'redirect-url':jsOnlyNote,
  'validate-callback':jsOnlyNote,
  'web-sign-in-url':'This same-origin route helper belongs to the Web Component package.',
  'manage-app-url':'Use the built-in Manage app action in the native account overview.',
  'safe-photo-url':'This browser URL helper belongs to the Web Component package.',
  'native-overview':'The native guide covers SwiftUI, Compose and Flutter. Use Account Overview for Expo or the Web Component for browser code.',
  'native-backend-handoff':'The automatic pickup adapter is available for Swift and Expo on iOS. Use the supported browser flow or a backend-owned device approval flow on other platforms.',
  'oauth-errors':'The JavaScript SDK propagates runtime verification and issuer errors. Check the Error instance without logging credentials.',
  'account-overview':'For JavaScript in the browser, use the account overview Web Component.',
  'register-app':'Registration is a Developer Apps portal workflow shared by every language.',
};

const typescript: Partial<Record<string,LanguageExample>> = {
  install:snippet('npm · TypeScript / Expo',[
    argument('@xcenter-id/client','Package','Shared typed HTTP and OAuth APIs for JavaScript and TypeScript.'),
    argument('@authnjs/expo','Package','Expo system-browser OAuth and React Native account components.'),
    argument('@xcenter-id/server','Package','Node-only API with type declarations. Keep its secrets on the backend.'),
  ],'npm pack ./packages/client ./packages/expo\n# In the Expo application, install both tarballs from the SDK checkout.\nnpm install /path/to/xcenter-id-client-0.7.0.tgz /path/to/authnjs-expo-0.9.0.tgz\nnpx expo install expo-auth-session expo-crypto expo-web-browser',
  'import {createUserClient} from "@authnjs/expo/client";'),
  'create-user-client':snippet('createUserClient(options: { clientId: string; getAccessToken: () => string | Promise<string>; fetch?: typeof fetch }): UserClient',[
    argument('clientId','string','Client ID assigned in Developer Apps.'),
    argument('getAccessToken','() => string | Promise<string>','Returns the current delegated access token.'),
    argument('fetch','typeof fetch | undefined','Optional transport. Defaults to the platform fetch.'),
  ],'import {createUserClient, type UserClient} from "@authnjs/expo/client";\n\nconst user: UserClient = createUserClient({clientId, getAccessToken});'),
  'user-records-put':snippet('user.records.put<T extends Json>(collection, id, body: RecordWrite<T>, options: RevisionOptions)',[
    argument('collection','string','Registration-scoped collection name.'),
    argument('id','string','Record ID.'),
    argument('body','RecordWrite<T>','Provide data, explicit public visibility, and optionally readers. Omission clears reader grants.'),
    argument('options.revision','number','Integer 0 for creation, latest revision for an edit.'),
    argument('options.signal','AbortSignal | undefined','Optional request cancellation.'),
  ],'import type {RecordWrite} from "@xcenter-id/client";\n\ntype Note = {title: string};\nconst body: RecordWrite<Note> = {data: {title: "First note"}, public: false};\nconst saved = await user.records.put<Note>("notes", "first_note", body, {revision: 0});'),
};

dataExamples('account-overview-api','user',
  ['accountOverview()','accountOverview()','accountOverview()'],[],
  ['accountOverview()','accountOverview()','accountOverview()']);
dataExamples('administrative-app-permissions','user',
  ['updateProfileVisibility(_ fields: [String])','updateProfileVisibility(fields: List<String>)','updateProfileVisibility(List<String> fields)'],
  [argument('fields','List of field names','Replace the entire selection with names from username, givenName, surname and picture.')],
  ['updateProfileVisibility(["username", "picture"])','updateProfileVisibility(listOf("username", "picture"))',"updateProfileVisibility(['username', 'picture'])"]);
dataExamples('resumable-uploads','user',
  ['startUpload(name: String, size: Int64, folder: String? = nil)','startUpload(name: String, size: Long, folder: String? = null)','startUpload(String name, int size, {String? folder})'],
  [argument('name','String','The uploaded file’s display name.'),argument('size','64-bit integer','Size of the input in bytes.'),argument('folder','Optional String','Account folder ID. Omit to use the root.')],
  ['startUpload(name: "video.mp4", size: 4000000)','startUpload("video.mp4", 4000000L)','startUpload("video.mp4", 4000000)'],
  'The start request returns id and chunkSize. Call uploadStatus(id) to resume, appendUpload with the next byte offset and chunk bytes, completeUpload to commit, or cancelUpload to discard the transfer.');
native['resumable-uploads']!.swift!.output='{"id":"3aa33912-a1b8-4c39-ab4a-ac63d15adf71","chunkSize":524288}';
native['resumable-uploads']!.kotlin!.output=native['resumable-uploads']!.swift!.output;
native['resumable-uploads']!.dart!.output=native['resumable-uploads']!.swift!.output;
dataExamples('peer-signaling','user',
  ['openPeer(discoverable: Bool = false)','openPeer(discoverable: Boolean = false)','openPeer({bool discoverable = false})'],
  [argument('discoverable','Boolean','Defaults to false. App-wide discovery must also be enabled.')],
  ['openPeer(discoverable: false)','openPeer(discoverable = false)','openPeer(discoverable: false)']);

dataExamples("account-profile-visibility",'user',
  ["profileVisibility()","profileVisibility()","profileVisibility()"],
  [],
  ["profileVisibility()","profileVisibility()","profileVisibility()"]);

dataExamples("account-connected-apps",'user',
  ["connectedApps()","connectedApps()","connectedApps()"],
  [],
  ["connectedApps()","connectedApps()","connectedApps()"]);

dataExamples("account-connected-permissions",'user',
  ["connectedPermissions(_ client: String)","connectedPermissions(client: String)","connectedPermissions(String client)"],
  [["client","string","Registered OAuth client ID from the linked app list."]],
  ["connectedPermissions(clientId)","connectedPermissions(clientId)","connectedPermissions(clientId)"]);

dataExamples("account-disable-permission",'user',
  ["disableConnectedPermission(_ client: String, scope: String)","disableConnectedPermission(client: String, scope: String)","disableConnectedPermission(String client, String scope)"],
  [["client","string","Registered OAuth client ID from the linked app list."],["scope","string","Optional permission identifier from the linked app permissions response."]],
  ["disableConnectedPermission(clientId, scope: \"friends\")","disableConnectedPermission(clientId, \"friends\")","disableConnectedPermission(clientId, \"friends\")"]);

dataExamples("start-upload",'user',
  ["startUpload(name: String, size: Int64, folder: String? = nil)","startUpload(name: String, size: Long, folder: String? = null)","startUpload(String name, int size, {String? folder})"],
  [["name","String","File display name."],["size","64-bit integer","Exact file size in bytes."],["folder","Optional String","Account folder identifier. Omit for the root."]],
  ["startUpload(name: \"video.mp4\", size: 4000000)","startUpload(\"video.mp4\", 4000000L)","startUpload(\"video.mp4\", 4000000)"]);

dataExamples("upload-status",'user',
  ["uploadStatus(_ id: String)","uploadStatus(id: String)","uploadStatus(String id)"],
  [["id","string","Transfer ID from the start response. Preserve it across interruptions."]],
  ["uploadStatus(transferId)","uploadStatus(transferId)","uploadStatus(transferId)"]);

dataExamples("append-upload",'user',
  ["appendUpload(_ id: String, position: Int64, content: Data)","appendUpload(id: String, position: Long, content: ByteArray)","appendUpload(String id, int position, Uint8List content)"],
  [["id","string","Transfer ID from the start response. Preserve it across interruptions."],["position","64-bit integer","Next byte offset."],["content","Raw bytes","Pass this chunk as native bytes. The SDK applies base64."]],
  ["appendUpload(transferId, position: 0, content: firstChunk)","appendUpload(transferId, 0L, firstChunk)","appendUpload(transferId, 0, firstChunk)"]);

dataExamples("complete-upload",'user',
  ["completeUpload(_ id: String)","completeUpload(id: String)","completeUpload(String id)"],
  [["id","string","Transfer ID from the start response. Preserve it across interruptions."]],
  ["completeUpload(transferId)","completeUpload(transferId)","completeUpload(transferId)"]);

dataExamples("cancel-upload",'user',
  ["cancelUpload(_ id: String)","cancelUpload(id: String)","cancelUpload(String id)"],
  [["id","string","Transfer ID from the start response. Preserve it across interruptions."]],
  ["cancelUpload(transferId)","cancelUpload(transferId)","cancelUpload(transferId)"]);

dataExamples("list-peers",'user',
  ["listPeers(_ id: String, proof: String)","listPeers(id: String, proof: String)","listPeers(String id, String proof)"],
  [["id","String","Your current opaque peer ID returned by openPeer."],["proof","String","Private proof returned by openPeer. Never send it to another peer."]],
  ["listPeers(peerId, proof: peerProof)","listPeers(peerId, peerProof)","listPeers(peerId, peerProof)"]);

dataExamples("receive-peer-messages",'user',
  ["receivePeerMessages(_ id: String, proof: String)","receivePeerMessages(id: String, proof: String)","receivePeerMessages(String id, String proof)"],
  [["id","String","Your current opaque peer ID returned by openPeer."],["proof","String","Private proof returned by openPeer. Never send it to another peer."]],
  ["receivePeerMessages(peerId, proof: peerProof)","receivePeerMessages(peerId, peerProof)","receivePeerMessages(peerId, peerProof)"]);

dataExamples("send-peer-message",'user',
  ["sendPeerMessage<Value: Encodable>(_ id: String, proof: String, to: String, type: String, data: Value)","sendPeerMessage(id: String, proof: String, to: String, type: String, data: JSONObject)","sendPeerMessage(String id, String proof, {required String to, required String type, required Map<String, Object?> data})"],
  [["id","String","Your current opaque peer ID returned by openPeer."],["proof","String","Private proof returned by openPeer. Never send it to another peer."],["to","String","Destination peer ID in the same registration."],["type","String","offer, answer or candidate."],["data","JSON object","Signaling payload from WebRTC."]],
  ["sendPeerMessage(peerId, proof: peerProof, to: remotePeerId, type: \"offer\", data: [\"type\": \"offer\", \"sdp\": offerSDP])","sendPeerMessage(peerId, peerProof, remotePeerId, \"offer\", JSONObject().put(\"type\", \"offer\").put(\"sdp\", offerSdp))","sendPeerMessage(peerId, peerProof, to: remotePeerId, type: \"offer\", data: {\"type\": \"offer\", \"sdp\": offerSdp})"]);

dataExamples("close-peer",'user',
  ["closePeer(_ id: String, proof: String)","closePeer(id: String, proof: String)","closePeer(String id, String proof)"],
  [["id","String","Your current opaque peer ID returned by openPeer."],["proof","String","Private proof returned by openPeer. Never send it to another peer."]],
  ["closePeer(peerId, proof: peerProof)","closePeer(peerId, peerProof)","closePeer(peerId, peerProof)"]);

dataExamples("app-container-files",'user',
  ["startAppUpload(name: String, size: Int64, browseable: Bool = false, editable: Bool = false)","startAppUpload(name: String, size: Long, browseable: Boolean = false, editable: Boolean = false)","startAppUpload(String name, int size, {bool browseable = false, bool editable = false})"],
  [["name","String","Display name."],["size","64-bit integer","Exact size in bytes."],["browseable","boolean","True exposes this user file in the account dashboard. Defaults to false. Omit for service uploads."],["editable","boolean","Defaults to false. Set true with browseable to allow dashboard writes and deletion."]],
  ["startAppUpload(name: \"Beat Saber.zip\", size: 600000, browseable: true, editable: true)","startAppUpload(\"Beat Saber.zip\", 600000L, browseable = true, editable = true)","startAppUpload(\"Beat Saber.zip\", 600000, browseable: true, editable: true)"]);

dataExamples("start-app-upload",'user',
  ["startAppUpload(name: String, size: Int64, browseable: Bool = false, editable: Bool = false)","startAppUpload(name: String, size: Long, browseable: Boolean = false, editable: Boolean = false)","startAppUpload(String name, int size, {bool browseable = false, bool editable = false})"],
  [["name","String","Display name."],["size","64-bit integer","Exact size in bytes."],["browseable","boolean","True exposes this user file in the account dashboard. Defaults to false. Omit for service uploads."],["editable","boolean","Defaults to false. Set true with browseable to allow dashboard writes and deletion."]],
  ["startAppUpload(name: \"backup.zip\", size: 600000)","startAppUpload(\"backup.zip\", 600000L)","startAppUpload(\"backup.zip\", 600000)"]);

dataExamples("app-upload-status",'user',
  ["appUploadStatus(_ id: String)","appUploadStatus(id: String)","appUploadStatus(String id)"],
  [["id","string","Transfer ID returned by the start operation. Store it to resume the same file."]],
  ["appUploadStatus(id)","appUploadStatus(id)","appUploadStatus(id)"]);

dataExamples("append-app-upload",'user',
  ["appendAppUpload(_ id: String, position: Int64, content: Data)","appendAppUpload(id: String, position: Long, content: ByteArray)","appendAppUpload(String id, int position, Uint8List content)"],
  [["id","string","Transfer ID returned by the start operation. Store it to resume the same file."],["position","64-bit integer","Next byte offset."],["content","Native byte buffer","Bytes of a single chunk."]],
  ["appendAppUpload(id, position: 0, content: bytes)","appendAppUpload(id, 0L, bytes)","appendAppUpload(id, 0, bytes)"]);

dataExamples("complete-app-upload",'user',
  ["completeAppUpload(_ id: String)","completeAppUpload(id: String)","completeAppUpload(String id)"],
  [["id","string","Transfer ID returned by the start operation. Store it to resume the same file."]],
  ["completeAppUpload(id)","completeAppUpload(id)","completeAppUpload(id)"]);

dataExamples("cancel-app-upload",'user',
  ["cancelAppUpload(_ id: String)","cancelAppUpload(id: String)","cancelAppUpload(String id)"],
  [["id","string","Transfer ID returned by the start operation. Store it to resume the same file."]],
  ["cancelAppUpload(id)","cancelAppUpload(id)","cancelAppUpload(id)"]);

dataExamples("list-app-files",'user',
  ["listAppFiles(cursor: String? = nil)","listAppFiles(cursor: String? = null)","listAppFiles({String? cursor})"],
  [["cursor","Optional String","Cursor returned by the preceding page. Omit for the first page."]],
  ["listAppFiles()","listAppFiles()","listAppFiles()"]);

dataExamples("get-app-file",'user',
  ["getAppFile(_ id: String)","getAppFile(id: String)","getAppFile(String id)"],
  [idArg],["getAppFile(id)","getAppFile(id)","getAppFile(id)"]);

dataExamples("download-app-file",'user',
  ["downloadAppFile(_ id: String)","downloadAppFile(id: String)","downloadAppFile(String id)"],
  [["id","string","Committed file ID returned by complete or list."]],
  ["downloadAppFile(id)","downloadAppFile(id)","downloadAppFile(id)"]);

dataExamples("set-app-file-browseable",'user',
  ["setAppFileVisibility(_ id: String, browseable: Bool, editable: Bool? = nil)","setAppFileVisibility(id: String, browseable: Boolean, editable: Boolean? = null)","setAppFileVisibility(String id, {required bool browseable, bool? editable})"],
  [["id","String","Committed file ID."],["browseable","Boolean","Allows dashboard reads."],["editable","Optional Boolean","Allows writes and deletion only if Browseable is also true."]],
  ["setAppFileVisibility(id, browseable: true, editable: true)","setAppFileVisibility(id, browseable = true, editable = true)","setAppFileVisibility(id, browseable: true, editable: true)"]);

dataExamples("delete-app-file",'user',
  ["deleteAppFile(_ id: String)","deleteAppFile(id: String)","deleteAppFile(String id)"],
  [["id","string","Committed file ID returned by complete or list."]],
  ["deleteAppFile(id)","deleteAppFile(id)","deleteAppFile(id)"]);
for (const language of ['swift','kotlin','dart'] as const) {
  const guide=native['app-container-files']?.[language];
  if(guide)guide.output='{"id":"3aa33912-a1b8-4c39-ab4a-ac63d15adf71","chunkSize":524288}';
}

export function parseLanguage(value:unknown):Language|undefined{
  return typeof value==='string'&&Object.hasOwn(languages,value)?value as Language:undefined;
}

export function exampleFor(entry:Reference, language:Language):LanguageExample | {unavailable:string} {
  const nativeExample=language==='javascript'||language==='typescript'?undefined:native[entry.id]?.[language];
  if(nativeExample)return nativeExample;
  const only=platformOnly[entry.id];
  if(entry.id==='register-app')return {signature:entry.signature,args:entry.args,example:entry.example,output:entry.output,note:unavailable[entry.id]};
  if(only&&only!==language)return {unavailable:'This guide has a '+languages[only]+' implementation. Use that language to view the exact API.'};
  const typedExample=language==='typescript'?typescript[entry.id]:undefined;
  if(typedExample)return typedExample;
  if((language==='javascript'||language==='typescript')&&entry.id!=='oauth-errors'&&entry.id!=='native-overview'&&
      (language==='typescript'||(entry.group!=='components'||entry.id==='web-account-overview'))){
    return {signature:entry.signature,args:entry.args,example:entry.example,output:entry.output};
  }
  return {unavailable:unavailable[entry.id]??'This platform uses a different account component or sign-in adapter. See the setup and identity guides for the selected language.'};
}

for(const [id,method,withId] of [
  ['list-app-backups','listAppBackups',false],
  ['create-app-backup','createAppBackup',false],
  ['delete-app-backup','deleteAppBackup',true],
  ['request-app-backup-restore','requestAppBackupRestore',true],
] as const){
  dataExamples(id,'user',[
    method+(withId?'(_ id: String)':'()'),
    method+(withId?'(id: String)':'()'),
    method+(withId?'(String id)':'()'),
  ],withId?[idArg]:[],[method+(withId?'(id)':'()'),method+(withId?'(id)':'()'),method+(withId?'(id)':'()')]);
}
