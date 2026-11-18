import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { interactionPolicy, Provider } from 'oidc-provider';
import { openOidcStore } from './oidc-store.mjs';

const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

function html(res, content, status = 200, callbackOrigin = '') {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'self' ${callbackOrigin}; base-uri 'none'`,
  });
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Continue with X-Center ID</title><style>
    :root{color-scheme:light dark;font:1rem/1.5 system-ui;--bg:#f4f7fc;--card:#fff;--text:#17223a;--muted:#526078;--border:#dbe3ef;--action:#214fbe;--soft:#edf2ff}
    *{box-sizing:border-box}body{margin:0;padding:clamp(1rem,5vw,3rem);background:var(--bg);color:var(--text)}
    main{max-width:34rem;margin:clamp(0rem,4vh,3rem) auto;padding:clamp(1.25rem,5vw,2.25rem);background:var(--card);border:1px solid var(--border);border-radius:1.45rem}
    h1{font-size:clamp(1.55rem,6vw,2.15rem);line-height:1.12;letter-spacing:-.04em;overflow-wrap:anywhere}p{color:var(--muted)}
    .brand{font-weight:800;letter-spacing:-.03em;color:var(--action)}.context{padding:.8rem 1rem;border-radius:.8rem;background:var(--soft);overflow-wrap:anywhere}
    fieldset{border:1px solid var(--border);border-radius:.85rem;padding:.6rem 1rem;margin:1.2rem 0;min-width:0}legend{font-weight:700}
    label{display:flex;gap:.7em;align-items:baseline;padding:.5em 0;overflow-wrap:anywhere}input{accent-color:var(--action)}
    button,.action{display:inline-block;font:inherit;font-weight:700;padding:.6em 1em;margin:.45rem .4rem 0 0;border-radius:.65rem;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer}
    button[value=approve],.action{background:var(--action);color:#fff;text-decoration:none;border-color:transparent}
    .connection{display:flex;align-items:center;gap:.9rem;margin:1.2rem 0}
    .connection .avatar{width:56px;height:56px;display:grid;place-items:center;overflow:hidden;border-radius:.8rem;background:var(--soft);color:var(--text);font-weight:800}
    .connection img{width:100%;height:100%;object-fit:cover}.permission-list{list-style:none;padding:0;display:grid;gap:.65rem}
    .permission-list .permission-toggle{display:flex;align-items:center;gap:.7rem;padding:.75rem .85rem;background:var(--soft);border-radius:.75rem;cursor:pointer;width:100%;min-height:46px}
    .permission-toggle input{margin-inline-start:auto;flex:none;appearance:none;width:2.7rem;height:1.55rem;border-radius:2rem;border:1px solid var(--border);background:var(--card);position:relative;cursor:pointer}
    .permission-toggle input::before{content:'';position:absolute;inset:.2rem auto .2rem .2rem;aspect-ratio:1;border-radius:50%;background:var(--muted);transition:transform 160ms ease}
    .permission-toggle input:checked{background:var(--action);border-color:var(--action)}.permission-toggle input:checked::before{background:white;transform:translateX(1.1rem)}
    @media(prefers-reduced-motion:reduce){.permission-toggle input::before{transition:none}}
    .permission-list li{display:flex;align-items:center;gap:.7rem}.permission-list svg,.connection svg{width:20px;height:20px;flex:none}
    :focus-visible{outline:3px solid #6b94ff;outline-offset:3px}
    @media(prefers-color-scheme:dark){:root{--bg:#101522;--card:#192132;--text:#f3f6ff;--muted:#b1c1dc;--border:#35445e;--action:#375fce;--soft:#23355d}.brand{color:#adc5ff}}
    </style><main><span class="brand">X-Center ID</span>${content}</main></html>`);
}

const iconPaths={
  link:'M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2',
  user:'M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  age:'M4 7h16v13H4z M4 11h16 M8 4v5m8-5v5',
  mail:'M3 5h18v14H3z m0 1 9 7 9-7',
  records:'M3 7h7l2 2h9v11H3z',
  id:'M3 5h18v14H3z M7 9h4m-4 4h4m4-4h3m-3 4h3',
  notes:'M5 3h10l4 4v14H5z M15 3v5h4 M8 12h8m-8 4h8',
  trips:'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15m6-12v15',
};
const glyph=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name]}"/></svg>`;

async function form(req) {
  if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) throw new Error('Invalid form');
  let value = '';
  for await (const chunk of req) {
    value += chunk.toString();
    if (value.length > 4096) throw new Error('Form too large');
  }
  return new URLSearchParams(value);
}

export function createIdentityProvider({ issuer, database, accounts, configuration, mail, registry, applicationData }) {
  const storageKey = Buffer.from(configuration.storageKey, 'hex');
  const subjectKey = Buffer.from(configuration.subjectKey, 'hex');
  if (subjectKey.length !== 32) throw new Error('Invalid stable subject key');
  const StorageAdapter = openOidcStore(database, storageKey);
  class Adapter extends StorageAdapter {
    async find(id) {
      if(this.model!=='Client')return super.find(id);
      const app=registry?.publicDetails(id);
      if(!app)return undefined;
      const saved=await super.find(id);
      return saved?{...saved,client_name:app.name,redirect_uris:app.callbacks}:undefined;
    }
  }
  const clientsStorage = new StorageAdapter('Client');
  const selections = new Adapter('ClaimSelection');
  const scopeClaims = {
    openid: ['sub'], profile: ['name', 'given_name', 'family_name'],
    age_range: ['age_range'], email: ['email', 'email_verified'],
  };
  const clients = configuration.clients.map((client) => ({
    ...client,
    response_types: ['code'], grant_types: ['authorization_code'],
    token_endpoint_auth_method: 'client_secret_basic', subject_type: 'pairwise',
  }));
  const knownClient=(client)=>clients.some(item=>item.client_id===client)||!!registry?.has(client);
  const policy=interactionPolicy.base();
  policy.get('login').checks.add(new interactionPolicy.Check('account_session','Sign in to X-Center ID',ctx=>{
    if(ctx.oidc.result?.login)return false;
    const active=accounts.current(ctx.req);
    return !active||ctx.oidc.session.accountId!==active.owner;
  }));
  const provider = new Provider(issuer, {
    clients, adapter: Adapter, jwks: configuration.jwks,
    cookies: { keys: configuration.cookieKeys, short: { secure: true, httpOnly: true, sameSite: 'lax' },
      long: { secure: true, httpOnly: true, sameSite: 'lax' } },
    claims: scopeClaims, scopes: ['openid','profile','email','age_range','app_data'], subjectTypes: ['pairwise'],
    pkce: { required: () => true },
    ttl: { AccessToken:600, AuthorizationCode:90, Interaction:300 },
    async loadExistingGrant(ctx) {
      const owner=ctx.oidc.session?.accountId;
      const client=ctx.oidc.client?.clientId;
      const id=ctx.oidc.result?.consent?.grantId ?? (owner&&client&&accounts.linkedGrant(owner,client));
      return id&&knownClient(client)&&accounts.grantAllowed(owner,client,id)?ctx.oidc.provider.Grant.find(id):undefined;
    },
    features: { devInteractions: { enabled: false } },
    interactions: { policy, url: (_ctx, interaction) => '/interaction/' + interaction.uid },
    async pairwiseIdentifier(_ctx, accountId, client) {
      return createHmac('sha256', subjectKey).update(JSON.stringify(['pairwise', client.clientId, accountId])).digest('base64url');
    },
    async findAccount(ctx, owner, source) {
      const client=source?.clientId??ctx.oidc.client?.clientId;
      if(client&&(!knownClient(client)||(source?.grantId&&!accounts.grantAllowed(owner,client,source.grantId))))return undefined;
      const person = accounts.identity(owner);
      if (!person) return undefined;
      const selection = source?.grantId ? await selections.find(source.grantId) : undefined;
      const email = selection?.premium ? mail?.premiumAlias(owner,selection.client) :
        selection?.alias ? mail?.alias(owner, selection.client) :
        selection?.email && person.emails.find(({ address }) => address === selection.email)?.address;
      return {
        accountId: owner,
        async claims() {
          return {
            sub: owner,
            name: person.givenName + ' ' + person.surname, given_name: person.givenName,
            family_name: person.surname, age_range: person.ageRange,
            ...(email ? { email, email_verified: true } : {}),
          };
        },
      };
    },
  });
  // Only the loopback-bound application receives requests from the trusted reverse proxy.
  provider.proxy = true;

  async function interaction(req, res, path) {
    let details;
    try { details = await provider.interactionDetails(req,res); }
    catch { return html(res, '<h1>Sign-in request expired</h1><p>Return to the app and start again.</p>', 400); }
    if (path !== '/interaction/' + details.uid) return html(res, '<h1>Sign-in request expired</h1>', 400);
    const active = accounts.current(req);
    const person = active && accounts.identity(active.owner);
    const { prompt, params } = details;
    const found = await provider.Client.find(params.client_id);
    const client = found && { client_id:found.clientId, client_name:found.clientName, host:new URL(found.redirectUris[0]).hostname };
    const callbackOrigin=found?.redirectUris.includes(params.redirect_uri)?new URL(params.redirect_uri).origin:'';
    if (!client||!knownClient(client.client_id)) return html(res, '<h1>This app is unavailable</h1>', 404);
    if (!person) {
      const location = '/signin?continue=' + encodeURIComponent(path);
      res.writeHead(303,{Location:location,'Cache-Control':'no-store'}).end();
      return;
    }
    if(req.method==='GET'&&prompt.name==='login'&&params.prompt!=='login'&&params.max_age===undefined&&accounts.linkedGrant(active.owner,client.client_id)){
      await provider.interactionFinished(req,res,{login:{accountId:active.owner,ts:Math.floor(active.created/1000)}},{mergeWithLastSubmission:false});
      return;
    }
    if (req.method === 'POST') {
      if (req.headers.origin !== issuer) return html(res,'<h1>Could not verify the request</h1>',403);
      let input;
      try { input = await form(req); } catch { return html(res,'<h1>Invalid request</h1>',400); }
      if (input.get('action') !== 'approve') {
        await provider.interactionFinished(req,res,{ error:'access_denied', error_description:'The user declined.' },{mergeWithLastSubmission:false});
        return;
      }
      if (prompt.name === 'login') {
        await provider.interactionFinished(req,res,{ login:{ accountId:active.owner, ts:Math.floor(active.created/1000) } },{mergeWithLastSubmission:false});
        return;
      }
      if (prompt.name !== 'consent' || details.session?.accountId !== active.owner) {
        return html(res,'<h1>The signed-in account changed</h1><p>Start again from the app.</p>',409);
      }
      const requested = new Set(prompt.details.missingOIDCScope ?? []);
      const selected = requested.has('email') ? input.get('email') : null;
      const eligible = accounts.premiumEligible(active.owner);
      const premium = selected === 'premium' && eligible ? mail?.premiumAlias(active.owner,client.client_id) : null;
      if(selected === 'premium' && !premium) return html(res,'<h1>Premium Hide My Email is unavailable</h1>',409);
      const alias = selected === 'masked' ? mail?.alias(active.owner,client.client_id) : null;
      if (selected === 'masked' && !alias) return html(res,'<h1>Hide My Email is unavailable</h1>',409);
      const email = premium || alias || selected;
      if (email && !alias && !premium && !person.emails.some(({address}) => address === email)) return html(res,'<h1>Select a verified address</h1>',400);
      if(applicationData&&String(details.params.scope??'').split(' ').includes('app_data'))applicationData.authorize(active.owner,client.client_id,input.getAll('data-permission'));
      const choices = new Set(input.getAll('permission'));
      const optional = ['profile','age_range','app_data'].filter(scope=>requested.has(scope));
      const allowed = ['openid',...optional.filter(scope=>choices.has(scope)),...(email?['email']:[])];
      const denied = [...optional.filter(scope=>!choices.has(scope)),...(requested.has('email')&&!email?['email']:[])];
      const linked=accounts.linkedGrant(active.owner,client.client_id);
      const grant=linked&&await provider.Grant.find(linked) || new provider.Grant({ accountId:active.owner, clientId:client.client_id });
      grant.addOIDCScope(allowed);
      if (denied.length) grant.rejectOIDCScope(denied);
      const grantId = await grant.save();
      if (email) await selections.upsert(grantId,premium ? { premium:true, client:client.client_id }
        : alias ? { alias:true, client:client.client_id } : { email });
      accounts.rememberApp(active.owner,client.client_id,client.client_name ?? client.client_id,grantId);
      await provider.interactionFinished(req,res,{ consent:{ grantId } });
      return;
    }
    if (req.method !== 'GET') return html(res,'<h1>Method unavailable</h1>',405);
    const missing = new Set(prompt.details.missingOIDCScope ?? []);
    const title=client.client_name??client.client_id;
    const brand=registry?.brand(client.client_id);
    const visual=client.client_id.startsWith('notes-')||client.client_id.startsWith('places-')?'notes':client.client_id.startsWith('trips-')?'trips':null;
    const developer=brand?.owner&&accounts.identity(brand.owner);
    const developerName=brand?.developerName||(developer?developer.givenName+' '+developer.surname:'X-Center');
    if(prompt.name==='login'){
      return html(res,`<h1>Choose your account</h1><p>Continue to ${escape(title)} as ${escape(person.givenName)} ${escape(person.surname)}.</p>
        <form method="post"><button name="action" value="approve">Continue</button><button name="action" value="deny">Cancel</button></form>`,200,callbackOrigin);
    }
    const incremental=!!accounts.linkedGrant(active.owner,client.client_id);
    const permissions=[
      ['user','Given name and surname','profile'],
      ['age','Age range','age_range'],
      ['records','Access to records belonging to this app','app_data'],
    ];
    return html(res,`<div class="connection" aria-hidden="true">
      <span class="avatar">${person.hasPicture?'<img alt="" src="/account/avatar">':glyph('user')}</span>${glyph('link')}
      <span class="avatar">${brand?.icon?`<img alt="" src="data:image/png;base64,${escape(brand.icon)}">`:visual?glyph(visual):escape(title.slice(0,2).toUpperCase())}</span></div>
      <h1>${incremental?'Authorize permissions':'Link '+escape(title)+' to X-Center ID'}</h1>
      ${incremental?`<p>${escape(title)} is requesting additional access.</p>`:''}
      ${brand?.description?`<p>${escape(brand.description)}</p>`:''}
      <div class="context"><strong>${escape(person.givenName)} ${escape(person.surname)}</strong><br>
      Developed by ${escape(developerName)} at <strong>${escape(client.host)}</strong>
      ${brand?.verified?'<br>Verified app':''}${brand?.developerStatus==='verified'?'<br>Verified developer':''}</div>
      <form method="post"><h2>Permissions</h2>
      <ul class="permission-list">
        ${!incremental?`<li>${glyph('id')}<span>App-specific account ID · required</span></li>`:''}
        ${permissions.filter(item=>missing.has(item[2])).map(([symbol,label,scope])=>`<li><label class="permission-toggle">${glyph(symbol)}<span>${label}</span><input type="checkbox" role="switch" name="permission" value="${scope}"></label></li>`).join('')}
      </ul>
      ${String(details.params.scope??'').split(' ').includes('app_data')?(applicationData?.requested(client.client_id)??[]).map(item=>`<label class="permission-toggle"><span>${escape(item.label)}<small> · Read ${escape(item.collection)} from ${escape(registry.publicDetails(item.source)?.name??item.source)}</small></span><input type="checkbox" role="switch" name="data-permission" value="${escape(item.source+'/'+item.collection)}"></label>`).join(''):''}
      <p>You can review app access in X-Center ID.</p>
      ${missing.has('email') ? `<fieldset><legend>Email address to share</legend>
      <label><input type="radio" name="email" value="" checked>Do not share an email address</label>
      ${mail?.premiumAvailable && accounts.premiumEligible(active.owner) ? '<label><input type="radio" name="email" value="premium">Use a premium private address</label>' : ''}
      ${mail?.maskedAvailable ? '<label><input type="radio" name="email" value="masked">Hide my email</label>' : ''}
      ${person.emails.map(({address}) => `<label><input type="radio" name="email" value="${escape(address)}">${escape(address)}</label>`).join('')}
      </fieldset>` : ''}
      <button name="action" value="approve">${incremental?'Authorize selected permissions':'Link app'}</button><button name="action" value="deny">Cancel</button></form>`,200,callbackOrigin);
  }

  return {
    oidc: provider.callback(), interaction,
    async provision(application) {
      const client_id = 'xid-' + randomUUID();
      const client_secret = application.native?null:randomBytes(48).toString('base64url');
      const metadata = {
        client_id, client_name:application.name,
        ...(client_secret?{client_secret}:{}), application_type:application.native?'native':'web',
        redirect_uris:application.callbacks??[application.callback], grant_types:['authorization_code'], response_types:['code'],
        token_endpoint_auth_method:application.native?'none':'client_secret_basic', subject_type:'pairwise',
      };
      await clientsStorage.upsert(client_id,metadata);
      return {
        clientId:client_id, clientSecret:client_secret,
        discard: () => clientsStorage.destroy(client_id),
      };
    },
    async unlink(owner,client) {
      const grants=accounts.disconnect(owner,client);
      if(!grants)return false;
      await Promise.all(grants.flatMap(({id})=>[new Adapter('Grant').destroy(id),...['AccessToken','AuthorizationCode','RefreshToken'].map(model=>new Adapter(model).revokeByGrantId(id))]));
      return true;
    },
    async dataAccess(value,{native=false}={}) {
      const access = await provider.AccessToken.find(value);
      if (!access?.accountId || !registry?.has(access.clientId) || (!native&&(await provider.Client.find(access.clientId))?.tokenEndpointAuthMethod!=='client_secret_basic') || !accounts.grantAllowed(access.accountId,access.clientId,access.grantId) || !access.scope?.split(' ').includes('app_data')) return null;
      return { owner:access.accountId, client:access.clientId, confidential:true };
    },
    async delegatedAccess(token, expectedClient) {
      const access = await provider.AccessToken.find(token);
      if (!access || access.clientId !== expectedClient || !access.accountId || !knownClient(access.clientId) || !accounts.grantAllowed(access.accountId,access.clientId,access.grantId) || !access.scope?.split(' ').includes('openid')) return null;
      return { owner: access.accountId, client: access.clientId };
    },
  };
}
