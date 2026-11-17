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
const accounts = createAccounts({
  outboundMail:createOutboundMail(mailConfig),
  canReceiveMail:!!mailConfig?.inboundDomains?.length,
  externalMail:!!mailConfig?.publicDelivery,
  profileKey: configuration ? Buffer.from(configuration.profileKey,'hex') : null,
  sendVerification: createVerificationMailer(mailConfig?.submission),
  origin: process.env.AUTHNJS_ACCOUNT_ORIGIN,
  database: join(process.env.AUTHNJS_DATA_DIR, 'accounts.sqlite'),
});
const origin = process.env.AUTHNJS_ACCOUNT_ORIGIN;
const state = process.env.AUTHNJS_DATA_DIR;
const otherStorage=(owner)=>{
  const data=accounts.usage(owner);
  return {...data,apps:data.apps+(store?.usage(owner)??0),mail:mail?.usage(owner)??0};
};
const accountFiles = configuration ? createAccountFiles({
  usage:otherStorage,
  database:join(state,'user-files.sqlite'),accounts,origin,
  key:Buffer.from(hkdfSync('sha256',Buffer.from(configuration.profileKey,'hex'),'','authnjs.files.v1',32)),
}) : null;
const registry = openRegistry(join(state, 'apps.sqlite'));
const mail = mailConfig?.inboundDomains?.length ? openMailStore({ configuration:mailConfig,
  accountsPath:join(state,'accounts.sqlite'), mailPath:join(state,'mail.sqlite') }) : null;
const provider = configuration ? createIdentityProvider({
  issuer: origin, database: join(state, 'oidc.sqlite'), accounts, configuration, mail:mailConfig?.publicDelivery?mail:null, registry,
}) : null;
const store = configuration ? openStore(join(state, 'sample-data.sqlite'), Buffer.from(configuration.sampleKey, 'hex')) : null;
const sampleOrigins=new Set(configuration?.clients.filter(client=>['notes-external','trips-external'].includes(client.client_id))
  .map(client=>new URL(client.redirect_uris[0]).origin)??[]);
const samples = provider && store ? createSamples({ issuer: origin, configuration, provider, accounts, store }) : null;
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
  if (samples && (externalSample || path === '/samples' || path.startsWith('/samples/'))) {
    const sampleUrl=new URL(target.pathname+target.search,externalSample?forwardedOrigin:origin);
    void samples(req, res, sampleUrl).catch(() => {
      if (!res.headersSent) res.writeHead(502, { 'Cache-Control': 'no-store' });
      res.end('The sample application could not complete the request.');
    });
    return;
  }
  if (dataApi && /^\/v1\/records\/saved-place(?:\/[0-9a-f-]{36})?$/.test(path)) {
    void dataApi(req,res);
    return;
  }
  if (accountFiles && (path === '/account/files' || path === '/account/files/folders' || /^\/account\/files\/(?:folders\/)?[0-9a-f-]{36}$/.test(path))) {
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
      if(!await provider.unlink(identity.owner,client))return answer(404,{error:'App is already unlinked.'});
      store?.revokeApp(identity.owner,client);
      return answer(200,{ok:true});
    })().catch(()=>answer(400,{error:'Could not unlink the app.'}));
    return;
  }
  if (provider && req.method === 'GET' && path === '/account/apps') {
    if (!accounts.current(req)) { res.writeHead(401, {'Cache-Control':'no-store'}).end(); return; }
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({apps:registry.published()}));
    return;
  }
  const revocationId = /^\/account\/developer\/apps\/([0-9a-f-]{36})\/revoke$/.exec(path)?.[1];
  if (revocationId && provider && req.method === 'POST') {
    const owner = accounts.current(req)?.owner;
    const ok = accounts.allowsMutation(req) && req.headers['x-authnjs-request'] === 'developer-portal' &&
      owner && registry.revokeOwned(owner,revocationId);
    res.writeHead(ok ? 200 : 403, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({ok:!!ok}));
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
  if (path === '/account/developer/apps' || /^\/account\/developer\/apps\/[0-9a-f-]{36}\/brand$/.test(path)) {
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
  if (mail && req.method === 'GET' && (path === '/account/inbox' || /^\/account\/inbox\/[0-9a-f-]{36}$/.test(path))) {
    const session = accounts.current(req);
    if (!session) { res.writeHead(401, { 'Cache-Control':'no-store' }).end(); return; }
    try {
      if (path === '/account/inbox') {
        res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
        res.end(JSON.stringify({ messages:mail.list(session.owner) }));
      } else {
        const message = mail.retrieve(session.owner, path.split('/').at(-1));
        if (!message) { res.writeHead(404, {'Cache-Control':'no-store'}).end(); return; }
        res.writeHead(200, {'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="message.eml"',
          'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        res.end(message);
      }
    } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
    return;
  }
  if (path.startsWith('/account/')) {
    void accounts.handle(req, res, path);
    return;
  }
  const webPages = new Set(['/','/signin','/signup','/native-session','/dashboard','/profile','/security','/permissions','/settings','/developer','/apps','/devices','/storage','/files','/mail','/admin']);
  const relative = webPages.has(path) ? 'index.html' : path.slice(1);
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
