import {appConfiguration} from './application-configuration.mjs';
import {isUsername} from './identity-profile.mjs';
import {createConsentTest} from './velunivo-consent-preview.mjs';
import {localAccountMessage} from './account-mail.mjs';
import {parseStorageVolumes,storageVolumeStatus} from './storage-volumes.mjs';
import {createSupportMailer} from './service-mail.mjs';
import {openMailLimits} from './mail-limits.mjs';
import {openApplicationData} from './application-data.mjs';
import { createAdminUsers } from './admin-users.mjs';
import { createSupportRoutes } from './support-routes.mjs';
import { createFriendRecordRoutes, openFriendRecords } from './friend-records.mjs';
import { createAppFriendRoutes, createFriendRoutes, openFriends } from './account-friends.mjs';
import { handleInbox, handleMailAliases } from './mail-routes.mjs';
import { createAdminAppRoutes } from './admin-apps.mjs';
import { hkdfSync } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { createServer } from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createAccountFiles } from './account-files.mjs';
import { createOutboundMail } from './outbound-mail.mjs';
import { createVerificationMailer } from './email-verification.mjs';
import { createAccounts } from './accounts.mjs';
import { openMailStore } from './mail-store.mjs';
import { createSamplePermissions } from './sample-permissions.mjs';
import { createSamples } from './samples.mjs';
import { createApiHandler, readJson } from './server.mjs';
import { openRegistry } from './registry.mjs';
import { openStore } from './store.mjs';
import { createIdentityProvider } from './oidc.mjs';

const root = resolve(process.env.AUTHNJS_WEB_ROOT ?? '/web');
const mailConfig = process.env.AUTHNJS_MAIL_CONFIG
  ? JSON.parse(readFileSync(process.env.AUTHNJS_MAIL_CONFIG,'utf8')) : null;
if(mailConfig&&process.env.AUTHNJS_LOCAL_SMTP_HOST){
  mailConfig.localDelivery={host:process.env.AUTHNJS_LOCAL_SMTP_HOST};
}
const configuration = process.env.AUTHNJS_OIDC_CONFIG ? JSON.parse(readFileSync(process.env.AUTHNJS_OIDC_CONFIG, 'utf8')) : null;
const mailLimits=openMailLimits(join(process.env.AUTHNJS_DATA_DIR,'accounts.sqlite'),mailConfig?.externalLimits);
const accounts = createAccounts({
  outboundMail:createOutboundMail(mailConfig,{limits:mailLimits,
    senderName:owner=>{const person=accounts.identity(owner);return person&&[person.givenName,person.surname].join(' ');},
    allowSender:(owner,from)=>accounts.mailboxSender(owner,from),
    deliverLocal:(recipient,raw,from)=>mail?.receive([recipient],raw,accounts.badgeForAddress(from)),
  }),
  appBrand:client=>registry.brand(client),
  extraStorage:owner=>(accountFiles?.fileBytes(owner)??0)+(applicationData?.accountUsage(owner)??0)+(store?.usage(owner)??0)+(mail?.usage(owner)??0),
  mailboxNameTaken:name=>mail?.hasLegacyPremiumName(name)??false,
  purgeAccount:owner=>{
    accountFiles?.removeAccount(owner);
    applicationData?.removeAccount(owner);
    friends?.removeAccount(owner);
    mail?.removeAccount(owner);
    store?.removeAccount(owner);
    registry.removeAccount(owner);
  },
  canReceiveMail:!!mailConfig?.inboundDomains?.length,
  externalMail:!!mailConfig?.publicDelivery,
  inboundVerification:!!mailConfig?.inboundVerification,
  profileKey: configuration ? Buffer.from(configuration.profileKey,'hex') : null,
  sendVerification: createVerificationMailer(mailConfig?.submission,mailLimits),
  origin: process.env.AUTHNJS_ACCOUNT_ORIGIN,
  database: join(process.env.AUTHNJS_DATA_DIR, 'accounts.sqlite'),
});
const origin = process.env.AUTHNJS_ACCOUNT_ORIGIN;
const state = process.env.AUTHNJS_DATA_DIR;
const storageVolumes=parseStorageVolumes(process.env.AUTHNJS_STORAGE_VOLUMES);
const friends = configuration ? openFriends(join(state,'accounts.sqlite'),accounts.available) : null;
const friendRoutes = friends && createFriendRoutes({accounts,friends});
const otherStorage=(owner,includeHosted=true)=>{
  const data=accounts.usage(owner);
  return {...data,apps:data.apps+(store?.usage(owner)??0)+(includeHosted?applicationData?.accountUsage(owner)??0:0),mail:mail?.usage(owner)??0};
};
const accountFiles = configuration ? createAccountFiles({
  usage:otherStorage,friends,appContainers:owner=>applicationData?.containers(owner)??[],
  fileAccess:(token,scopes)=>provider?.fileAccess(token,scopes),
  database:join(state,'user-files.sqlite'),accounts,origin,
  key:Buffer.from(hkdfSync('sha256',Buffer.from(configuration.profileKey,'hex'),'','authnjs.files.v1',32)),
}) : null;
const registry = openRegistry(join(state, 'apps.sqlite'));
const reviewApps=createAdminAppRoutes({accounts,registry});
const mail = mailConfig?.inboundDomains?.length ? openMailStore({ configuration:mailConfig,
  accountService:accounts,accountsPath:join(state,'accounts.sqlite'), mailPath:join(state,'mail.sqlite') }) : null;
function notifyAppChange(owner,client,kind){
  if(!mail||!accounts.available(owner))return;
  const username=accounts.username(owner);
  if(!username)return;
  const name=registry.publicDetails(client)?.name??accounts.linkedAppLabel(owner,client)??'A connected app';
  const message={
    linked:['New app linked',name+' was linked to your X-Center ID.'],
    permissions:['App permissions updated','Permissions for '+name+' were updated.'],
    unlinked:['App unlinked',name+' was removed from your X-Center ID.'],
  }[kind];
  if(!message)return;
  const [subject,summary]=message;
  void localAccountMessage({
    from:'X-Center ID Security <security@id.xcenter.it>',to:username+'@mail.xcenter.it',subject,
    paragraphs:[summary,'If you don’t recognize this activity, review your linked apps and contact Support.'],
    action:{label:'Review linked apps',url:origin+'/apps'},
  }).then(content=>{
    if(accounts.available(owner)&&!mail.notice(owner,content,{verified:true}))console.warn('Account activity notice could not be delivered.');
  }).catch(()=>console.warn('Account activity notice could not be generated.'));
}
const support = createSupportRoutes({accounts,mail,sendExternal:createSupportMailer(mailConfig?.submission,mailLimits)});
const adminUsers=createAdminUsers({accounts,registry,mail,containers:owner=>applicationData?.containers(owner)??[]});
let provider;
const applicationData=configuration?openApplicationData({path:join(state,'app-data.sqlite'),registry,accounts,
  key:Buffer.from(hkdfSync('sha256',Buffer.from(configuration.profileKey,'hex'),'','xcenter.appdata.v1',32)),
  authenticate:token=>provider?.dataAccess(token,{native:true}),
  otherUsage:owner=>accountFiles.fileBytes(owner)+Object.values(otherStorage(owner,false)).reduce((sum,value)=>sum+value,0),
  notify:notifyAppChange,
}):null;
if(applicationData)registry.attachStorage(join(state,'app-data.sqlite'));
const configurationRoute=appConfiguration({accounts,registry,applicationData});
provider = configuration ? createIdentityProvider({
  issuer: origin, database: join(state, 'oidc.sqlite'), accounts, configuration, mail:mailConfig?.publicDelivery?mail:null, registry,applicationData,notify:notifyAppChange,
}) : null;
const store = configuration ? openStore(join(state, 'sample-data.sqlite'), Buffer.from(configuration.sampleKey, 'hex')) : null;
const friendRecordRoutes = friends && store && createFriendRecordRoutes({ accounts, records:openFriendRecords({
  database:join(state,'sample-data.sqlite'),store,friends,
  publishers:new Map((configuration.friendRecordPublishers??[]).map(({id,name})=>[id,name])),
  allowed:(owner,source)=>registry.has(source)&&!accounts.isDisconnected(owner,source),
}) });
const sampleOrigins=new Set(configuration?.clients.filter(client=>['notes-external','trips-external'].includes(client.client_id))
  .map(client=>new URL(client.redirect_uris[0]).origin)??[]);
const samples = provider && store ? createSamples({ issuer: origin, configuration:process.env.AUTHNJS_PUBLIC_SAMPLE_APPS==='true'?configuration:{...configuration,clients:configuration.clients.filter(client=>!['notes-external','trips-external'].includes(client.client_id))}, provider, accounts, store }) : null;
const samplePermissions = store ? createSamplePermissions({store,accounts,origin,clients:configuration?.clients.map(client=>client.client_id)}) : null;
const developerClient = 'account-developer-session';
const developer = createApiHandler({
  registry, developerClient, apps: registry,
  authenticate(req) {
    const session = accounts.current(req);
    return session && accounts.identity(session.owner) ? { owner: session.owner, client: developerClient, developer: true } : null;
  },
});
const resolver = new Resolver({ timeout:2500, tries:1 });
const verificationAttempts = new Map();
const dataApi = provider && store ? createApiHandler({
  registry, store, apps:registry,
  canGrant:(owner,source,destination)=>registry.access(owner,source).allowed&&!accounts.isDisconnected(owner,source)&&!registry.brand(destination)?.local&&registry.crossReadAllowed(source,destination),
  authenticate(req) {
    const token = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(req.headers.authorization ?? '')?.[1];
    return token ? provider.dataAccess(token) : null;
  },
}) : null;

async function activateApplication(req,res,id) {
  const json = (status,result) => {
    res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(result));
  };
  if (!provider || req.method !== 'POST' || !accounts.allowsMutation(req) ||
      req.headers['x-authnjs-request'] !== 'developer-portal') return json(403,{error:'invalid_request'});
  const active = accounts.current(req);
  const app = active && registry.lookup(active.owner,id);
  if (!app || app.status !== 'pending') return json(404,{error:'registration_unavailable'});
  if((app.local||app.callbackApproved)&&!accounts.recentlyConfirmed(req))return json(403,{error:'Confirm your identity to activate a local registration.'});
  const time = Date.now();
  for (const [key,after] of verificationAttempts) if (after <= time) verificationAttempts.delete(key);
  if (verificationAttempts.has(id) || verificationAttempts.size >= 100) return json(429,{error:'retry_later'});
  verificationAttempts.set(id,time+30_000);
  const host = new URL(app.callback).hostname;
  if (!app.local&&host.replace(/\.$/,'') === new URL(origin).hostname) return json(422,{error:'use_separate_app_domain'});
  if (!app.local&&(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host) ||
      /\.(?:localhost|local|internal|test|example)$/i.test(host))) return json(422,{error:'public_domain_required'});
  const check = app.local||app.callbackApproved?[]:await resolver.resolveTxt('_xcenter-id.'+host).catch(() => []);
  if (!app.local&&!app.callbackApproved&&!check.some((pieces) => pieces.join('') === 'xcenter-id='+id)) return json(422,{error:'domain_proof_unavailable'});
  const credentials = await provider.provision(app);
  const latestOwner=accounts.current(req)?.owner;
  if(latestOwner!==active.owner||((app.local||app.callbackApproved)&&!accounts.recentlyConfirmed(req))||
     !registry.activateRegistration(app,credentials.clientId)) {
    await credentials.discard();
    return json(409,{error:'registration_changed'});
  }
  return json(201,{clientId:credentials.clientId,clientSecret:credentials.clientSecret});
}

const consentApi = provider && store ? createApiHandler({
  registry, store, apps:registry, consoleClient:'account-consent-session', allowPersistentGrants:true,
  canGrant:(owner,source,destination)=>registry.access(owner,source).allowed&&registry.access(owner,destination).allowed&&!registry.brand(destination)?.local&&registry.crossReadAllowed(source,destination)&&!accounts.isDisconnected(owner,source)&&!accounts.isDisconnected(owner,destination),
  authenticate(req) {
    const session = accounts.current(req);
    return session ? {owner:session.owner,client:'account-consent-session'} : null;
  },
}) : null;
const oidcRoutes = /^\/(?:\.well-known\/openid-configuration|auth(?:\/[^/]+)?|device(?:\/[A-Za-z0-9_-]+)?|token|jwks|me|session\/end(?:\/[^/]+)?)$/;
const types = new Map(Object.entries({
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8',
  webmanifest: 'application/manifest+json', json: 'application/json', png: 'image/png',
  svg: 'image/svg+xml', css:'text/css; charset=utf-8', ttf: 'font/ttf', txt: 'text/plain',
}));

const deviceVerificationAttempts=new Map();
const developerLookupAttempts=new Map();
const appFriendRoutes=provider&&friends&&createAppFriendRoutes({
  accounts,friends,authorize:provider.friendAccess,subject:provider.friendSubject,
});

const consentTestConfig=process.env.AUTHNJS_CONSENT_TEST_CONFIG?
  JSON.parse(readFileSync(process.env.AUTHNJS_CONSENT_TEST_CONFIG,'utf8')):null;
const consentTest=consentTestConfig&&createConsentTest({issuer:origin,...consentTestConfig});

accounts.retryDeletions();
setInterval(()=>accounts.retryDeletions(),5*60_000).unref();

createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, (req, res) => {
  const target = new URL(req.url, 'http://localhost');
  const path = target.pathname;
  const forwardedOrigin='https://'+req.headers['x-forwarded-host'];
  if(consentTest&&forwardedOrigin==='https://consent-test.xcenter.it'&&req.headers['x-forwarded-proto']==='https'){
    const testUrl=new URL(forwardedOrigin);
    testUrl.pathname=path;testUrl.search=target.search;
    void consentTest(req,res,testUrl).catch(()=>{
      if(!res.headersSent)res.writeHead(502,{'Cache-Control':'no-store','Content-Type':'text/plain'});
      res.end('The consent test could not complete sign-in. Return to the app and try again.');
    });
    return;
  }
  const externalSample=sampleOrigins.has(forwardedOrigin)&&req.headers['x-forwarded-proto']==='https';
  if(path==='/v1/profile/friends'&&appFriendRoutes){
    void appFriendRoutes(req,res).catch(()=>{
      if(!res.headersSent)res.writeHead(503,{'Cache-Control':'no-store'});
      res.end();
    });
    return;
  }
  if(path==='/v1/profile/avatar'){
    const headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(req.method==='OPTIONS'){
      res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization'}).end();
      return;
    }
    if(req.method!=='GET'){res.writeHead(405,headers).end();return;}
    const token=/^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(req.headers.authorization??'')?.[1];
    void (token&&provider?provider.profileAvatar(token):Promise.resolve(undefined)).then(picture=>{
      if(!picture){res.writeHead(picture===undefined?401:404,headers).end();return;}
      res.writeHead(200,{...headers,'Content-Type':'image/jpeg'}).end(Buffer.from(picture,'base64'));
    }).catch(()=>res.writeHead(503,headers).end());
    return;
  }
  if(path==='/account/app-data-permissions'&&req.method==='PUT'&&req.headers['x-authnjs-request']!=='account-consent'){
    res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:'Change permissions from your account.'}));return;
  }
  if(applicationData&&(/^\/(?:public|v1)\/apps\//.test(path)||path.startsWith('/account/app-storage/')||path.startsWith('/account/file-containers/')||path==='/account/app-data-permissions')){
    void applicationData.handle(req,res,target);return;
  }
  const appIcon=/^\/public\/app-icons\/([0-9a-f-]{36})$/.exec(path)?.[1];
  if(appIcon){
    res.setHeader('Access-Control-Allow-Origin','*');
    const icon=['GET','HEAD'].includes(req.method)?registry.icon(appIcon):null;
    res.writeHead(icon?200:404,{'Content-Type':'image/png','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(icon&&req.method==='GET'?Buffer.from(icon,'base64'):undefined);
    return;
  }
  const publicAvatar=/^\/public\/profiles\/([a-z0-9._-]{3,24})\/avatar$/.exec(path)?.[1];
  if(publicAvatar){res.setHeader('Access-Control-Allow-Origin','*');const picture=req.method==='GET'?accounts.publicProfileAvatar(publicAvatar):null;
    res.writeHead(picture?200:404,{'Content-Type':picture?'image/jpeg':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(picture?Buffer.from(picture,'base64'):'{}');return;}
  const publicUser=/^\/public\/profiles\/([a-z0-9._-]{3,24})$/.exec(path)?.[1];
  if(publicUser){
    res.setHeader('Access-Control-Allow-Origin','*');
    const person=req.method==='GET'?accounts.publicProfile(publicUser):null;
    res.writeHead(person?200:404,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(person??{error:'Profile unavailable.'}));return;
  }
  if(externalSample&&process.env.AUTHNJS_PUBLIC_SAMPLE_APPS!=='true'){res.writeHead(404,{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}).end('Development sample disabled.');return;}
  if(path==='/samples'&&!accounts.current(req)){res.writeHead(302,{'Location':'/signin','Cache-Control':'no-store'}).end();return;}
  if (samples && (externalSample || path === '/samples' || path.startsWith('/samples/'))) {
    const sampleUrl=new URL(target.pathname+target.search,externalSample?forwardedOrigin:origin);
    void samples(req, res, sampleUrl).catch(() => {
      if (!res.headersSent) res.writeHead(502, { 'Cache-Control': 'no-store' });
      res.end('The sample application could not complete the request.');
    });
    return;
  }
  if(path==='/account/admin/storage-volumes'){
    const status=req.method!=='GET'?405:accounts.adminStatus(req)!==200?403:200;
    res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(
      status===200?{volumes:storageVolumeStatus(state,storageVolumes)}:{error:status===403?'Confirm administrator access.':'Method unavailable.'}
    ));
    return;
  }
  if (dataApi && /^\/v1\/records\/saved-place(?:\/[0-9a-f-]{36})?$/.test(path)) {
    void dataApi(req,res);
    return;
  }
  if (friendRecordRoutes && /^\/account\/friends\/records(?:\/[0-9a-f-]{36})?$/.test(path)) {
    void friendRecordRoutes(req,res,path,target).catch(()=>{
      if(!res.headersSent) res.writeHead(500,{'Cache-Control':'no-store'});
      res.end();
    });
    return;
  }
  if (friendRoutes && (path === '/account/friends' || path.startsWith('/account/friends/'))) {
    void friendRoutes(req,res,path).catch(()=>{
      if(!res.headersSent) res.writeHead(500,{'Cache-Control':'no-store'});
      res.end();
    });
    return;
  }
  if (accountFiles && (/^\/account\/files\/(?:destinations|uploads(?:\/[0-9a-f-]{36})?)$/.test(path)||/^\/(?:account|v1)\/files(?:\/(?:folders|shared)(?:\/[0-9a-f-]{36})?|\/[0-9a-f-]{36})?$/.test(path))) {
    if(path.startsWith('/v1/')){
      res.setHeader('Access-Control-Allow-Origin','*');
      res.setHeader('Access-Control-Expose-Headers','Content-Disposition');
      if(req.method==='OPTIONS'){
        const methods=path==='/v1/files/shared'||path.startsWith('/v1/files/shared/')?'GET, OPTIONS':'GET, POST, PATCH, DELETE, OPTIONS';
        return res.writeHead(204,{'Access-Control-Allow-Methods':methods,'Access-Control-Allow-Headers':'Authorization, Content-Type'}).end();
      }
    }
    void accountFiles(req,res,path).catch(()=>{
      if(!res.headersSent) res.writeHead(500,{'Cache-Control':'no-store'});
      res.end();
    });
    return;
  }
  if (samplePermissions && path === '/account/sample-grants') {
    void samplePermissions(req,res);
    return;
  }
  if (consentApi && path === '/account/data-grants') {
    if(req.method==='PUT'){res.writeHead(405,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:'Apps request data permissions during authorization.'}));return;}
    if (req.method !== 'GET' && (!accounts.allowsMutation(req) || req.headers['x-authnjs-request'] !== 'account-consent')) {
      res.writeHead(403, {'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"error":"invalid_origin"}');
      return;
    }
    req.url = '/v1/grants';
    void consentApi(req,res);
    return;
  }
  const permissionsClient=/^\/account\/connected-apps\/([A-Za-z0-9_-]{1,100})\/permissions$/.exec(path)?.[1];
  if(provider&&permissionsClient){
    const identity=accounts.current(req);
    const answer=(status,result)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(result));
    if(!identity)return answer(401,{error:'Sign in to view connected app permissions.'});
    if(req.method!=='GET'&&req.method!=='PUT')return answer(405,{error:'Method unavailable.'});
    const write=req.method==='PUT';
    if(write&&(!accounts.allowsMutation(req)||req.headers['x-authnjs-request']!=='account-consent')){
      return answer(403,{error:'Change permissions from your account.'});
    }
    void (async()=>{
      const change=write?await readJson(req,1024):undefined;
      if(change&&(typeof change.scope!=='string'||typeof change.enabled!=='boolean'))return answer(422,{error:'Choose a valid permission.'});
      if(accounts.current(req)?.owner!==identity.owner)return answer(401,{error:'Sign in again to continue.'});
      const permissions=await provider.connectedPermissions(identity.owner,permissionsClient,change);
      return permissions===null?answer(404,{error:'This app has no active sign-in grant.'}):
        permissions===false?answer(422,{error:'This permission cannot be changed here.'}):answer(200,{permissions});
    })().catch(error=>answer(error.status??503,{error:'Could not access app permissions.'}));
    return;
  }
  if(provider && req.method==='POST' && path==='/account/connected-apps/unlink'){
    const identity=accounts.current(req);
    const answer=(status,result)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(result));
    if(!identity||!accounts.allowsMutation(req)||req.headers['x-authnjs-request']!=='account-consent'){
      answer(403,{error:'Sign in to X-Center ID to unlink an app.'});
      return;
    }
    void (async()=>{
      let text='';
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        text+=chunk.toString();
        if(text.length>1024){req.resume();return answer(413,{error:'Request too large.'});}
      }
      const {client}=JSON.parse(text);
      if(typeof client!=='string'||client.length>100)return answer(422,{error:'Choose a connected app.'});
      const unlinked = await provider.unlink(identity.owner,client);
      if(!unlinked && !accounts.isDisconnected(identity.owner,client))return answer(404,{error:'App is already unlinked.'});
      store?.revokeApp(identity.owner,client);applicationData?.revokeApp(identity.owner,client);
      if(unlinked)notifyAppChange(identity.owner,client,'unlinked');
      return answer(200,{ok:true});
    })().catch(()=>answer(400,{error:'Could not unlink the app.'}));
    return;
  }
  if (provider && req.method === 'GET' && path === '/account/apps') {
    const session = accounts.current(req);
    if (!session) { res.writeHead(401, {'Cache-Control':'no-store'}).end(); return; }
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({apps:registry.published().filter(({client})=>!accounts.isDisconnected(session.owner,client))}));
    return;
  }
  const configurationId=/^\/account\/developer\/apps\/([0-9a-f-]{36})\/configuration$/.exec(path)?.[1];
  if(configurationId){
    void configurationRoute(req,res,configurationId).catch(()=>{if(!res.headersSent)res.writeHead(503,{'Cache-Control':'no-store'});res.end();});
    return;
  }
  const accessId=/^\/account\/developer\/apps\/([0-9a-f-]{36})\/access$/.exec(path)?.[1];
  if(accessId){
    const answer=(status,body)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(body));
    const owner=accounts.current(req)?.owner;
    if(!owner||!accounts.identity(owner))return answer(403,{error:'Sign in to manage app access.'});
    const view=()=>{
      const settings=registry.accessSettings(owner,accessId);
      return settings?{...settings,readerTrust:registry.readerTrust(accessId),members:settings.members.flatMap(({account,approved})=>{
        const username=accounts.username(account);
        return username?[{username,approved:!!approved}]:[];
      })}:null;
    };
    if(req.method==='GET'){
      const settings=view();
      if(!settings)return answer(404,{error:'App unavailable.'});
      const name=target.searchParams.get('username');
      if(name===null)return answer(200,settings);
      if(!settings.private||!isUsername(name))return answer(422,{error:'Enter an exact username.'});
      const minute=Math.floor(Date.now()/60_000);
      for(const [id,entry] of developerLookupAttempts)if(entry.minute!==minute)developerLookupAttempts.delete(id);
      const attempts=developerLookupAttempts.get(owner)?.attempts??0;
      if(attempts>=30||developerLookupAttempts.size>=4096)return answer(429,{error:'Wait a moment before searching again.'});
      developerLookupAttempts.set(owner,{minute,attempts:attempts+1});
      const candidate=accounts.ownerForUsername(name);
      return answer(200,{username:candidate&&candidate!==owner&&accounts.available(candidate)?name:null});
    }
    const allowed=()=>accounts.current(req)?.owner===owner&&accounts.allowsMutation(req)&&req.headers['x-authnjs-request']==='developer-portal';
    if(req.method!=='PUT'||!allowed())return answer(403,{error:'Open the developer portal to manage access.'});
    void (async()=>{
      const input=await readJson(req,2048);
      if(!allowed())return answer(403,{error:'Sign in to manage app access.'});
      if(!registry.accessSettings(owner,accessId))return answer(404,{error:'App unavailable.'});
      if(input.action==='reader-trust'){
        if(!['secure','verified','any'].includes(input.mode))return answer(422,{error:'Choose a valid reader trust level.'});
        registry.setReaderTrust(owner,accessId,input.mode);
        return answer(200,view());
      }
      if(input.action==='settings'){
        if(typeof input.private!=='boolean'||typeof input.requests!=='boolean')return answer(422,{error:'Choose valid access settings.'});
      }else if(['approve','remove'].includes(input.action)&&isUsername(input.username)){
        input.account=accounts.ownerForUsername(input.username);
        if(!input.account||input.account===owner)return answer(422,{error:'Choose another existing username.'});
      }else return answer(422,{error:'Choose a valid access action.'});
      if(!registry.saveAccess(owner,accessId,input))return answer(409,{error:'Could not update access.'});
      return answer(200,view());
    })().catch(error=>answer(error.status??503,{error:'Could not manage app access.'}));
    return;
  }
  const credentialsId=/^\/account\/developer\/apps\/([0-9a-f-]{36})\/client-secret$/.exec(path)?.[1];
  if(credentialsId&&provider){
    const answer=(status,body)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(body));
    const active=accounts.current(req);
    if(req.method!=='POST')return answer(405,{error:'Method unavailable.'});
    const allowed=()=>active&&accounts.current(req)?.owner===active.owner&&accounts.allowsMutation(req)&&
      req.headers['x-authnjs-request']==='developer-portal'&&accounts.recentlyConfirmed(req);
    if(!allowed())return answer(403,{error:'Confirm your identity to manage client credentials.'});
    void (async()=>{
      const {action}=await readJson(req,1024);
      if(!allowed())return answer(403,{error:'Confirm your identity to manage client credentials.'});
      const app=registry.lookup(active.owner,credentialsId);
      if(app?.status!=='active'||!app.client||app.native)return answer(404,{error:'Confidential app registration unavailable.'});
      if(action!=='rotate'&&action!=='revoke')return answer(422,{error:'Choose a credential action.'});
      const result=await provider.changeClientSecret(app.client,action);
      return result?answer(200,result):answer(404,{error:'Confidential app registration unavailable.'});
    })().catch(error=>answer(error.status??503,{error:'Could not manage the app secret.'}));
    return;
  }
  const revocationId = /^\/account\/developer\/apps\/([0-9a-f-]{36})\/revoke$/.exec(path)?.[1];
  if (revocationId && provider && req.method === 'POST') {
    const owner = accounts.current(req)?.owner;
    const ok = accounts.allowsMutation(req) && req.headers['x-authnjs-request'] === 'developer-portal' &&
      owner && registry.revokeOwned(owner,revocationId);
    res.writeHead(ok ? 200 : 403, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(ok?{ok:true}:{error:'This registration could not be deleted.'}));
    return;
  }
  const verificationId = /^\/account\/developer\/apps\/([0-9a-f-]{36})\/verify$/.exec(path)?.[1];
  if (verificationId) {
    void activateApplication(req,res,verificationId).catch(() => {
      if (!res.headersSent) res.writeHead(500, { 'Cache-Control':'no-store' });
      res.end();
    });
    return;
  }
  if (['/account/developer/apps','/account/developer/profile'].includes(path) || /^\/account\/developer\/apps\/[0-9a-f-]{36}\/(?:brand|profile|permissions)$/.test(path)) {
    if (req.method !== 'GET' && (!accounts.allowsMutation(req) || req.headers['x-authnjs-request'] !== 'developer-portal')) {
      res.writeHead(403, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_origin' }));
      return;
    }
    req.url = '/v1'+path.slice('/account'.length);
    void developer(req, res);
    return;
  }
  if (provider && path.startsWith('/interaction/')) {
    void provider.interaction(req, res, path).catch(() => {
      if (!res.headersSent) res.writeHead(500, { 'Cache-Control': 'no-store' });
      res.end('The sign-in request could not be completed.');
    });
    return;
  }
  if (provider && oidcRoutes.test(path)) {
    if(path==='/device'){
      if(req.method==='POST'){
        // The service is loopback-only. The reverse proxy appends the actual peer last.
        const peer=String(req.headers['x-forwarded-for']??req.socket.remoteAddress).split(',').at(-1).trim();
        const minute=Math.floor(Date.now()/60_000);
        for(const [key,value] of deviceVerificationAttempts)if(value.minute!==minute)deviceVerificationAttempts.delete(key);
        const previous=deviceVerificationAttempts.get(peer);
        if((previous?.count??0)>=16||!previous&&deviceVerificationAttempts.size>=2048){
          return res.writeHead(429,{'Cache-Control':'no-store','Retry-After':'60'}).end('Try again in a minute.');
        }
        deviceVerificationAttempts.set(peer,{minute,count:(previous?.count??0)+1});
      }else if(req.method==='GET'){
        const code=target.searchParams.get('code')?.toUpperCase();
        req.url=code&&provider.deviceCodePattern.test(code)?'/device?user_code='+code:'/device';
      }
    }
    void provider.oidc(req, res);
    return;
  }
  if (path === '/account/mail/aliases' || path.startsWith('/account/mail/aliases/')) {
    void handleMailAliases(req,res,path,accounts,mail).then(handled=>{if(!handled)res.writeHead(404,{'Cache-Control':'no-store'}).end();}).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});
    return;
  }
  if (path === '/account/inbox' || path.startsWith('/account/inbox/')) {
    void handleInbox(req,res,path,accounts,mail).then(handled=>{
      if (!handled) res.writeHead(404,{'Cache-Control':'no-store'}).end();
    }).catch(()=>{ if (!res.headersSent) res.writeHead(500); res.end(); });
    return;
  }
  if(/^\/account\/(?:admin\/)?support(?:\/|$)/.test(path)){
    void support(req,res,path).catch(()=>{if(!res.headersSent)res.writeHead(500,{'Cache-Control':'no-store'});res.end();});
    return;
  }
  const adminUsername=/^\/account\/admin\/users\/([a-z0-9._-]{3,24})$/.exec(path)?.[1];
  if(adminUsername){
    void adminUsers(req,res,adminUsername).catch(()=>{if(!res.headersSent)res.writeHead(500,{'Cache-Control':'no-store'});res.end();});
    return;
  }
  if(path==='/account/admin/apps'){
    void reviewApps(req,res);
    return;
  }
  if (path.startsWith('/account/')) {
    void accounts.handle(req, res, path);
    return;
  }
  const webPages = new Set(['/mail-clients','/changelog','/docs','/','/signin','/signup','/native-session','/dashboard','/profile','/profile/visibility','/profile/username','/profile/developer','/security','/permissions','/settings','/developer','/apps','/devices','/storage','/files','/friends','/mail','/admin','/support','/reauth']);
  const relative = webPages.has(path)||/^\/docs\/sdk(?:\/[a-z0-9-]{1,60})?$/.test(path)||/^\/changelog\/\d+\.\d+\.\d+$/.test(path)||/^\/developer\/storage\/[0-9a-f-]{36}$/.test(path)||/^\/permissions\/[A-Za-z0-9_-]{1,100}$/.test(path)||
    /^\/(?:mail\/[0-9a-f-]{36}|admin\/users\/[a-z0-9._-]{3,24})$/.test(path) ? 'index.html' : path.slice(1);
  const valid = /^(?:index\.html|offline\.html|revision\.txt|manifest\.webmanifest|service-worker\.js|authnjs-[\w-]+\.(?:svg|png)|(?:_expo|assets)\/[\w@./-]+)$/.test(relative);
  if (!valid || relative.split('/').some((part) => part === '.' || part === '..') ||
      (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404).end();
    return;
  }
  const file = join(root, relative);
  const stat = statSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, {
    'Content-Type': types.get(file.split('.').at(-1)) ?? 'application/octet-stream',
    'Content-Length': stat.size, 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': /^(?:assets|_expo)\//.test(relative) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).on('error', () => res.destroy()).pipe(res);
}).listen(8080, '0.0.0.0');
