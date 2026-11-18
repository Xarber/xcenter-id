import {parseStorageVolumes,storageVolumeStatus} from './storage-volumes.mjs';
import {createSupportMailer} from './service-mail.mjs';
import {openMailLimits} from './mail-limits.mjs';
import {openApplicationData} from './application-data.mjs';
import { createAdminUsers } from './admin-users.mjs';
import { createSupportRoutes } from './support-routes.mjs';
import { createFriendRecordRoutes, openFriendRecords } from './friend-records.mjs';
import { createFriendRoutes, openFriends } from './account-friends.mjs';
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
import { createApiHandler } from './server.mjs';
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
    allowSender:(owner,from)=>accounts.mailboxSender(owner,from),
    deliverLocal:(recipient,raw,from)=>mail?.receive([recipient],raw,accounts.badgeForAddress(from)),
  }),
  appBrand:client=>registry.brand(client),
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
const otherStorage=(owner)=>{
  const data=accounts.usage(owner);
  return {...data,apps:data.apps+(store?.usage(owner)??0),mail:mail?.usage(owner)??0};
};
const accountFiles = configuration ? createAccountFiles({
  usage:otherStorage,friends,
  database:join(state,'user-files.sqlite'),accounts,origin,
  key:Buffer.from(hkdfSync('sha256',Buffer.from(configuration.profileKey,'hex'),'','authnjs.files.v1',32)),
}) : null;
const registry = openRegistry(join(state, 'apps.sqlite'));
const reviewApps=createAdminAppRoutes({accounts,registry});
const mail = mailConfig?.inboundDomains?.length ? openMailStore({ configuration:mailConfig,
  accountService:accounts,accountsPath:join(state,'accounts.sqlite'), mailPath:join(state,'mail.sqlite') }) : null;
const support = createSupportRoutes({accounts,mail,sendExternal:createSupportMailer(mailConfig?.submission,mailLimits)});
const adminUsers=createAdminUsers({accounts,registry,mail});
let provider;
const applicationData=configuration?openApplicationData({path:join(state,'app-data.sqlite'),registry,accounts,
  key:Buffer.from(hkdfSync('sha256',Buffer.from(configuration.profileKey,'hex'),'','xcenter.appdata.v1',32)),
  authenticate:token=>provider?.dataAccess(token,{native:true}),
}):null;
provider = configuration ? createIdentityProvider({
  issuer: origin, database: join(state, 'oidc.sqlite'), accounts, configuration, mail:mailConfig?.publicDelivery?mail:null, registry,applicationData,
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
  const time = Date.now();
  for (const [key,after] of verificationAttempts) if (after <= time) verificationAttempts.delete(key);
  if (verificationAttempts.has(id) || verificationAttempts.size >= 100) return json(429,{error:'retry_later'});
  verificationAttempts.set(id,time+30_000);
  const host = new URL(app.callback).hostname;
  if (host.replace(/\.$/,'') === new URL(origin).hostname) return json(422,{error:'use_separate_app_domain'});
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host) ||
      /\.(?:localhost|local|internal|test|example)$/i.test(host)) return json(422,{error:'public_domain_required'});
  const check = await resolver.resolveTxt('_xcenter-id.'+host).catch(() => []);
  if (!check.some((pieces) => pieces.join('') === 'xcenter-id='+id)) return json(422,{error:'domain_proof_unavailable'});
  const credentials = await provider.provision(app);
  if (!registry.approve(id,credentials.clientId)) {
    await credentials.discard();
    return json(409,{error:'registration_changed'});
  }
  return json(201,{clientId:credentials.clientId,clientSecret:credentials.clientSecret});
}

const consentApi = provider && store ? createApiHandler({
  registry, store, apps:registry, consoleClient:'account-consent-session', allowPersistentGrants:true,
  canGrant:(owner,source,destination)=>!accounts.isDisconnected(owner,source)&&!accounts.isDisconnected(owner,destination),
  authenticate(req) {
    const session = accounts.current(req);
    return session ? {owner:session.owner,client:'account-consent-session'} : null;
  },
}) : null;
const oidcRoutes = /^\/(?:\.well-known\/openid-configuration|auth(?:\/[^/]+)?|token|jwks|me|session\/end(?:\/[^/]+)?)$/;
const types = new Map(Object.entries({
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8',
  webmanifest: 'application/manifest+json', json: 'application/json', png: 'image/png',
  svg: 'image/svg+xml', css:'text/css; charset=utf-8', ttf: 'font/ttf', txt: 'text/plain',
}));

createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, (req, res) => {
  const target = new URL(req.url, 'http://localhost');
  const path = target.pathname;
  const forwardedOrigin='https://'+req.headers['x-forwarded-host'];
  const externalSample=sampleOrigins.has(forwardedOrigin)&&req.headers['x-forwarded-proto']==='https';
  if(applicationData&&(/^\/(?:public|v1)\/apps\//.test(path)||path.startsWith('/account/app-storage/')||path==='/account/app-data-permissions')){
    void applicationData.handle(req,res,target);return;
  }
  const publicAvatar=/^\/public\/profiles\/([a-z][a-z0-9]{2,23})\/avatar$/.exec(path)?.[1];
  if(publicAvatar){const picture=req.method==='GET'?accounts.publicProfileAvatar(publicAvatar):null;
    res.writeHead(picture?200:404,{'Content-Type':picture?'image/jpeg':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(picture?Buffer.from(picture,'base64'):'{}');return;}
  const publicUser=/^\/public\/profiles\/([a-z][a-z0-9]{2,23})$/.exec(path)?.[1];
  if(publicUser){
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
  if (accountFiles && (path === '/account/files' || path === '/account/files/folders' || /^\/account\/files\/shared(?:\/[0-9a-f-]{36})?$/.test(path) || /^\/account\/files\/(?:folders\/)?[0-9a-f-]{36}$/.test(path))) {
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
    if (req.method !== 'GET' && (!accounts.allowsMutation(req) || req.headers['x-authnjs-request'] !== 'account-consent')) {
      res.writeHead(403, {'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"error":"invalid_origin"}');
      return;
    }
    req.url = '/v1/grants';
    void consentApi(req,res);
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
  if (['/account/developer/apps','/account/developer/profile'].includes(path) || /^\/account\/developer\/apps\/[0-9a-f-]{36}\/(?:brand|profile)$/.test(path)) {
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
  const adminUsername=/^\/account\/admin\/users\/([a-z][a-z0-9]{2,23})$/.exec(path)?.[1];
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
  const webPages = new Set(['/mail-clients','/docs','/','/signin','/signup','/native-session','/dashboard','/profile','/profile/visibility','/profile/username','/profile/developer','/security','/permissions','/settings','/developer','/apps','/devices','/storage','/files','/friends','/mail','/admin','/support','/reauth']);
  const relative = webPages.has(path)||/^\/developer\/storage\/[0-9a-f-]{36}$/.test(path)||/^\/permissions\/[A-Za-z0-9_-]{1,100}$/.test(path)||
    /^\/(?:mail\/[0-9a-f-]{36}|admin\/users\/[a-z][a-z0-9]{2,23})$/.test(path) ? 'index.html' : path.slice(1);
  const valid = /^(?:index\.html|revision\.txt|manifest\.webmanifest|service-worker\.js|authnjs-[\w-]+\.(?:svg|png)|(?:_expo|assets)\/[\w@./-]+)$/.test(relative);
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
