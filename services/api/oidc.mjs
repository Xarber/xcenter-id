import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { errors, interactionPolicy, Provider } from 'oidc-provider';
import { openOidcStore } from './oidc-store.mjs';

const deviceGrant = 'urn:ietf:params:oauth:grant-type:device_code';
const deviceCodePattern = /^[A-Z0-9]{6}$/;
const refreshIdleSeconds = 14 * 24 * 60 * 60;
const filePermissions = {
  files_read: ['Read account files','List folders and download your own files.'],
  files_write: ['Read and write account files','List, download, add and delete your own files and folders.'],
  shared_files_read: ['Read files shared with you','List and download files other people currently share with you.'],
};
const fileScopes=Object.keys(filePermissions);
const accountPermissions = ['profile','app_data','email','age_range','friends','offline_access',...fileScopes];

function approveScopes(grant, scopes) {
  if(grant.rejected?.openid?.scope){
    grant.rejected.openid.scope=grant.getRejectedOIDCScope().split(' ').filter(scope=>!scopes.includes(scope)).join(' ');
  }
  grant.addOIDCScope(scopes);
}

const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

function pageHeaders(callbackOrigin = '', scriptNonce = '') {
  return {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'self' ${callbackOrigin}; base-uri 'none'${scriptNonce ? `; script-src 'nonce-${scriptNonce}'` : ''}`,
  };
}

function html(res, content, status = 200, callbackOrigin = '', consent = false) {
  res.writeHead(status, pageHeaders(callbackOrigin)).end(page(content, consent));
}

function page(content, consent = false) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Continue with X-Center ID</title><style>
    :root{color-scheme:light dark;font:1rem/1.5 system-ui;--bg:#f4f7fc;--card:#fff;--text:#17223a;--muted:#526078;--border:#dbe3ef;--action:#214fbe;--soft:#edf2ff}
    *{box-sizing:border-box}body{margin:0;padding:clamp(1rem,5vw,3rem);background:var(--bg);color:var(--text)}
    main{max-width:34rem;margin:clamp(0rem,4vh,3rem) auto;padding:clamp(1.25rem,5vw,2.25rem);background:var(--card);border:1px solid var(--border);border-radius:1.45rem}
    body.consent{background:radial-gradient(ellipse at 75% 8%,#202e4d,transparent 68%) fixed,linear-gradient(145deg,#11192d,#0c1325) fixed}
    body.consent::before{content:'';position:fixed;inset:0;pointer-events:none;background:
      radial-gradient(circle at 13% 21%,#d6e4ff80 0 1px,transparent 4px),
      radial-gradient(circle at 84% 17%,#c4d6ff66 0 1px,transparent 4px),
      radial-gradient(circle at 8% 63%,#e1e8ff55 0 1px,transparent 3px),
      radial-gradient(circle at 74% 87%,#d7e4ff66 0 1px,transparent 4px),
      radial-gradient(circle at 94% 58%,#c5d6ff55 0 1px,transparent 3px),
      radial-gradient(circle at 35% 76%,#cbdcff44 0 1px,transparent 3px);animation:star-shimmer 9s ease-in-out infinite alternate}
    @keyframes star-shimmer{from{opacity:.55;transform:translate(0,0)}to{opacity:1;transform:translate(3px,-2px)}}
    @media(prefers-reduced-motion:reduce){body.consent::before{animation:none}}
    body.consent main{position:relative;box-shadow:0 24px 70px #060b1766}
    .source-permissions{margin:1rem 0;border:1px solid var(--border);border-radius:.9rem;padding:.85rem}
    .source-heading{display:flex;align-items:center;gap:.65rem;margin:0;overflow-wrap:anywhere;font-size:1rem}
    .source-heading .source-icon{width:2rem;height:2rem;border-radius:.5rem;object-fit:cover;background:var(--soft);color:var(--action);display:grid;place-items:center;flex:none}
    .source-permissions .permission-list{margin-bottom:0}
    h1{font-size:clamp(1.55rem,6vw,2.15rem);line-height:1.12;letter-spacing:-.04em;overflow-wrap:anywhere}p{color:var(--muted)}
    .badge{display:inline-block;border:1px solid currentColor;border-radius:1rem;padding:.1rem .5rem;font-size:.8rem;font-weight:700}.brand{font-weight:800;letter-spacing:-.03em;color:var(--action)}.context{padding:.8rem 1rem;border-radius:.8rem;background:var(--soft);overflow-wrap:anywhere}
    .account-choice{color:var(--text);display:flex;align-items:center;gap:.65rem;text-align:left;width:100%;min-height:48px;margin:0;padding:.55rem .65rem;border:1px solid var(--border);border-radius:.7rem;background:var(--card);text-decoration:none}
    .account-choice:hover{border-color:var(--action)}.account-choice .account-text{flex:1;min-width:0;overflow-wrap:anywhere}
    .account-choice .account-handle{display:block;font-size:.8rem;color:var(--muted)}
    .account-choice .avatar{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:50%;background:var(--soft);overflow:hidden}
    .account-choice img{width:100%;height:100%;object-fit:cover}.account-choice svg{width:18px;height:18px}
    .account-choices{display:grid;gap:.6rem;margin-block:1rem}.account-actions{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap}
    .identity-contexts{display:grid;gap:.65rem}.context small{display:block;color:var(--muted);margin-bottom:.25rem}.badge-row{display:flex;flex-wrap:wrap;gap:.35rem;margin:.5rem 0}.permission-toggle.permission-fixed{cursor:default}.permission-check{margin-inline-start:auto;color:var(--action);font-weight:800}.permission-toggle small{display:block;color:var(--muted)}
    fieldset{border:1px solid var(--border);border-radius:.85rem;padding:.6rem 1rem;margin:1.2rem 0;min-width:0}legend{font-weight:700}
    .device-back{color:var(--text)}.device-code{font-size:1.6rem;font-weight:750;letter-spacing:.15em}
    .device-boxes{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.35rem;inline-size:min(100%,21rem);font:700 clamp(1.125rem,5vw,1.6rem)/1 ui-monospace,monospace}
    .device-boxes[hidden]{display:none}
    .device-boxes input{min-width:0;width:100%;height:3.15rem;border:1px solid var(--border);border-radius:.55rem;background:var(--soft);font:inherit;color:var(--text);text-align:center;text-transform:uppercase;padding:0}
    .device-boxes input:focus-visible{outline:2px solid var(--action);outline-offset:1px}

    label{display:flex;gap:.7em;align-items:baseline;padding:.5em 0;overflow-wrap:anywhere}input{accent-color:var(--action)}
    button,.action{display:inline-block;font:inherit;font-weight:700;padding:.6em 1em;margin:.45rem .4rem 0 0;border-radius:.65rem;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer}
    button[value=approve],.action{background:var(--action);color:#fff;text-decoration:none;border-color:transparent}
    .connection{display:flex;align-items:center;gap:.9rem;margin:1.2rem 0}
    .connection .avatar{width:56px;height:56px;display:grid;place-items:center;overflow:hidden;border-radius:.8rem;background:var(--soft);color:var(--text);font-weight:800}
    .connection img{width:100%;height:100%;object-fit:cover}.permission-list{list-style:none;padding:0;display:grid;gap:.65rem}
    .permission-toggle{display:flex;align-items:center;gap:.7rem;padding:.75rem .85rem;background:var(--soft);border-radius:.75rem;cursor:pointer;width:100%;min-height:46px}
    .permission-toggle input{margin-inline-start:auto;flex:none;appearance:none;width:2.7rem;height:1.55rem;border-radius:2rem;border:1px solid var(--border);background:var(--card);position:relative;cursor:pointer}
    .permission-toggle input::before{content:'';position:absolute;inset:.2rem auto .2rem .2rem;aspect-ratio:1;border-radius:50%;background:var(--muted);transition:transform 160ms ease}
    .permission-toggle input:checked{background:var(--action);border-color:var(--action)}.permission-toggle input:checked::before{background:white;transform:translateX(1.1rem)}
    @media(prefers-reduced-motion:reduce){.permission-toggle input::before{transition:none}}
    .permission-list li{display:flex;align-items:center;gap:.7rem}.permission-list svg,.connection svg{width:20px;height:20px;flex:none}
    :focus{outline:none}:focus-visible{box-shadow:0 0 0 2px #6b94ff}
    @media(prefers-color-scheme:dark){:root{--bg:#101522;--card:#192132;--text:#f3f6ff;--muted:#b1c1dc;--border:#35445e;--action:#375fce;--soft:#23355d}.brand{color:#adc5ff}}
    </style><body class="${consent?'consent':''}"><main><span class="brand">X-Center ID</span>${content}</main></body></html>`;
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

export function createIdentityProvider({ issuer, database, accounts, configuration, mail, registry, applicationData, notify=()=>{} }) {
  const storageKey = Buffer.from(configuration.storageKey, 'hex');
  const subjectKey = Buffer.from(configuration.subjectKey, 'hex');
  if (subjectKey.length !== 32) throw new Error('Invalid stable subject key');
  const subjectFor=(owner,clientId)=>createHmac('sha256',subjectKey).update(JSON.stringify(['pairwise',clientId,owner])).digest('base64url');
  const StorageAdapter = openOidcStore(database, storageKey);
  class Adapter extends StorageAdapter {
    async upsert(id,value,ttl) {
      if(this.model==='DeviceCode'&&value.params?.nonce)value={...value,nonce:value.params.nonce};
      return super.upsert(id,value,ttl);
    }
    async find(id) {
      if(this.model!=='Client')return super.find(id);
      const app=registry?.publicDetails(id);
      if(!app)return undefined;
      const saved=await super.find(id);
      if(!saved||saved.clientSecretRevoked)return undefined;
      const deviceCapable=saved.token_endpoint_auth_method==='client_secret_basic';
      return {...saved,client_name:app.name,redirect_uris:app.callbacks,
        // The OAuth device grant uses the same client-bound subject as browser sign-in.
        // For secret-authenticated clients, return that subject directly in claims().
        subject_type:deviceCapable?'public':'pairwise',
        grant_types:['authorization_code','refresh_token',...(deviceCapable?[deviceGrant]:[])],
      };
    }
    async consume(id) {
      try { await super.consume(id); }
      catch(error) {
        if(['RefreshToken','DeviceCode'].includes(this.model)&&error.code==='already_consumed'){
          if(this.model==='RefreshToken'&&error.grantId)await revokeGrant(error.grantId);
          throw new errors.InvalidGrant('Authorization already used');
        }
        throw error;
      }
    }
  }
  const grantStorage=new StorageAdapter('Grant');
  async function revokeGrant(grantId){
    await Promise.all([grantStorage.destroy(grantId),...['AccessToken','AuthorizationCode','RefreshToken'].map(model=>new StorageAdapter(model).revokeByGrantId(grantId))]);
  }
  const clientsStorage = new StorageAdapter('Client');
  const selections = new Adapter('ClaimSelection');
  async function grantedEmail(owner,person,grantId) {
    if(!grantId||!person)return undefined;
    const selection=await selections.find(grantId);
    if(selection?.primary)return mail?person.username+'@mail.xcenter.it':undefined;
    if(selection?.premium||selection?.alias||selection?.privateAddress){
      return mail?.aliases(owner).find(item=>item.active&&item.client===selection.client&&(!selection.privateAddress||item.address===selection.privateAddress))?.address;
    }
    return person.emails.find(({address})=>address===selection?.email)?.address;
  }
  const scopeClaims = {
    openid: ['sub','name','given_name','family_name','preferred_username','picture','xcenter_verified','xcenter_admin'],
    profile: ['name','given_name','family_name','preferred_username','picture','xcenter_verified','xcenter_admin'],
    age_range: ['age_range'], email: ['email', 'email_verified'],
  };
  const clients = configuration.clients.map((client) => ({
    ...client,
    response_types: ['code'], grant_types: ['authorization_code'],
    token_endpoint_auth_method: 'client_secret_basic', subject_type: 'pairwise',
  }));
  const canUse=(owner,client)=>registry?.access(owner,client).allowed!==false;
  const knownClient=(client)=>clients.some(item=>item.client_id===client)||!!registry?.has(client);
  const policy=interactionPolicy.base();
  policy.get('login').checks.add(new interactionPolicy.Check('account_session','Sign in to X-Center ID',ctx=>{
    const client=ctx.oidc.client;
    if(registry?.brand(client.clientId)?.local&&ctx.oidc.params.redirect_uri&&!client.redirectUris.includes(ctx.oidc.params.redirect_uri)){
      const error=new errors.InvalidRequest('Use the exact registered loopback callback.');
      error.allow_redirect=false;
      throw error;
    }
    if(ctx.oidc.result?.login)return false;
    const active=accounts.current(ctx.req);
    return !active||ctx.oidc.session.accountId!==active.owner;
  }));
  policy.get('consent').checks.add(new interactionPolicy.Check('link_account','Link this application',ctx=>{
    if(ctx.oidc.result?.consent?.grantId)return false;
    const owner=ctx.oidc.session?.accountId;
    return !!owner&&!accounts.linkedGrant(owner,ctx.oidc.client.clientId);
  }));
  policy.get('consent').checks.add(new interactionPolicy.Check('app_requirements','Approve access needed by this app',async ctx=>{
    const {client,grant,session,requestParamOIDCScopes}=ctx.oidc;
    if(!canUse(session.accountId,client.clientId))return true;
    const brand=registry?.brand(client.clientId);
    if((brand?.requiresEmail&&!requestParamOIDCScopes.has('email'))||(brand?.requiresAgeRange&&!requestParamOIDCScopes.has('age_range'))){
      throw new errors.InvalidScope('The app must request its configured required scopes.');
    }
    const granted=new Set(grant.getOIDCScope().split(' '));
    if(brand?.requiresEmail&&(!granted.has('email')||!await grantedEmail(session.accountId,accounts.identity(session.accountId),grant.jti)))return true;
    if(brand?.requiresAgeRange&&!granted.has('age_range'))return true;
    return requestParamOIDCScopes.has('app_data')&&!granted.has('app_data');
  }));
  policy.get('consent').checks.add(new interactionPolicy.Check('confirm_linked_signin','Confirm sign-in to the linked app',ctx=>
    !ctx.oidc.result?.consent?.grantId&&!!accounts.linkedGrant(ctx.oidc.session.accountId,ctx.oidc.client.clientId)));
  const deviceAttempts=new Map();
  function devicePage(ctx,content,scriptNonce) {
    ctx.set(pageHeaders('',scriptNonce));
    ctx.body=page(content+'<p><a class="device-back" href="/devices">Back to Devices</a> · <a class="device-back" href="/dashboard">Open dashboard</a></p>');
  }
  const provider = new Provider(issuer, {
    clients, adapter: Adapter, jwks: configuration.jwks,
    cookies: { keys: configuration.cookieKeys, short: { secure: true, httpOnly: true, sameSite: 'lax' },
      long: { secure: true, httpOnly: true, sameSite: 'lax' } },
    claims: scopeClaims, scopes: ['openid','profile','email','age_range','app_data','friends','offline_access',...fileScopes], subjectTypes: ['pairwise','public'],
    pkce: { required: () => true },
    ttl: { AccessToken:600, AuthorizationCode:90, DeviceCode:300, Interaction:300, RefreshToken:refreshIdleSeconds, Grant:refreshIdleSeconds },
    async issueRefreshToken(ctx,client,source) {
      if(!registry?.has(client.clientId)||!source.scopes.has('offline_access'))return false;
      if(!grantStorage.renewGrant(ctx.oidc.entities.Grant.jti,refreshIdleSeconds))throw new errors.InvalidGrant('App grant expired');
      return true;
    },
    async rotateRefreshToken(ctx) {
      if(!grantStorage.renewGrant(ctx.oidc.entities.Grant.jti,refreshIdleSeconds))throw new errors.InvalidGrant('App grant expired');
      return true;
    },
    async loadExistingGrant(ctx) {
      const owner=ctx.oidc.session?.accountId;
      const client=ctx.oidc.client?.clientId;
      const id=ctx.oidc.result?.consent?.grantId ?? (owner&&client&&accounts.linkedGrant(owner,client));
      return id&&knownClient(client)&&accounts.grantAllowed(owner,client,id)?ctx.oidc.provider.Grant.find(id):undefined;
    },
    features: {
      devInteractions: { enabled: false },
      deviceFlow: {
        enabled:true, charset:'base-20', mask:'******',
        deviceInfo(ctx) {
          const {client,params}=ctx.oidc;
          const brand=registry?.brand(client.clientId);
          const requested=new Set(String(params.scope??'').split(' '));
          if(!brand||client.clientAuthMethod!=='client_secret_basic')throw new errors.UnauthorizedClient('Device sign-in requires an active confidential registration.');
          if(brand.requiresEmail&&!requested.has('email')||brand.requiresAgeRange&&!requested.has('age_range'))throw new errors.InvalidScope('Request the required app permissions.');
          if(!/^[A-Za-z0-9_-]{22,128}$/.test(params.nonce??''))throw new errors.InvalidRequest('Supply a transaction nonce.');
          const minute=Math.floor(Date.now()/60_000);
          for(const [id,entry] of deviceAttempts)if(entry.minute!==minute)deviceAttempts.delete(id);
          const prior=deviceAttempts.get(client.clientId);
          if((prior?.count??0)>=60)throw new errors.InvalidRequest('Too many device authorizations. Try again in a minute.');
          deviceAttempts.set(client.clientId,{minute,count:(prior?.count??0)+1});
          return {};
        },
        userCodeInputSource(ctx,form,_out,error) {
          const help=error?'That device code is unavailable. Enter a new code from your device.':'Enter the six-character code shown on your TV or other device.';
          const nonce=randomBytes(18).toString('base64');
          const boxes=Array.from({length:6},(_,index)=>
            `<input type="text" aria-label="Character ${index+1} of 6" autocapitalize="characters" spellcheck="false" autocomplete="${index===0?'one-time-code':'off'}" required form="op.deviceInputForm">`).join('');
          devicePage(ctx,`<h1>Sign in on another device</h1><p>${help}</p>${form}
            <fieldset class="device-boxes" hidden><legend>Device code</legend>${boxes}</fieldset>
            <button value="approve" form="op.deviceInputForm">Continue</button>
            <script nonce="${nonce}">
              const original = document.querySelector('input[name="user_code"]');
              const group = document.querySelector('.device-boxes');
              const cells = [...group.querySelectorAll('input')];
              if (original) {
                original.type = 'hidden';
                group.hidden = false;
                const update = () => { original.value = cells.map(cell => cell.value).join(''); };
                const enter = (index, value) => {
                  const text = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  if (!text) { cells[index].value = ''; update(); return; }
                  const start = text.length >= 6 ? 0 : index;
                  const letters = text.slice(0, cells.length - start);
                  [...letters].forEach((letter, offset) => { cells[start + offset].value = letter; });
                  update();
                  cells[Math.min(start + letters.length, cells.length - 1)].focus();
                };
                cells.forEach((cell, index) => {
                  cell.addEventListener('focus', () => cell.select());
                  cell.addEventListener('input', () => enter(index, cell.value));
                  cell.addEventListener('paste', event => {
                    event.preventDefault(); enter(index, event.clipboardData.getData('text'));
                  });
                  cell.addEventListener('keydown', event => {
                    if (index && event.key === 'Backspace' && !cell.value) cells[index - 1].focus();
                  });
                });
              }
            </script>`,nonce);
        },
        userCodeConfirmSource(ctx,form,client,_info,code) {
          devicePage(ctx,`<h1>Confirm sign-in on this device?</h1><p>Sign in to <strong>${escape(client.clientName)}</strong> on your other device.</p>
            <p>Continue only if you started this sign-in and this code matches the one on your device.</p>
            <p class="device-code">${escape(code)}</p>${form}
            <button value="approve" form="op.deviceConfirmForm">Continue</button>
            <button form="op.deviceConfirmForm" name="abort" value="yes">Cancel</button>`);
        },
        successSource(ctx) {
          devicePage(ctx,'<h1>Device sign-in approved</h1><p>You can close this page and return to your other device.</p>');
        },
      },
    },
    interactions: { policy, url: (_ctx, interaction) => '/interaction/' + interaction.uid },
    async pairwiseIdentifier(_ctx, accountId, client) {
      return subjectFor(accountId,client.clientId);
    },
    async findAccount(ctx, owner, source) {
      const client=source?.clientId??ctx.oidc.client?.clientId;
      if(client&&(!knownClient(client)||source&&!canUse(owner,client)||(source?.grantId&&!accounts.grantAllowed(owner,client,source.grantId))))return undefined;
      const person = accounts.identity(owner);
      if (!person) return undefined;
      const email=await grantedEmail(owner,person,source?.grantId);
      if(source&&ctx.oidc.entities.RefreshToken===source){
        const grant=ctx.oidc.entities.Grant;
        const brand=registry?.brand(client);
        const renewed=new Set(grant.getOIDCScopeFiltered(ctx.oidc.params.scope?ctx.oidc.requestParamOIDCScopes:source.scopes).split(' '));
        if(!renewed.has('offline_access')||(brand?.requiresEmail&&(!renewed.has('email')||!email))||
          (brand?.requiresAgeRange&&(!renewed.has('age_range')||!person.ageRange)))return undefined;
      }
      return {
        accountId: owner,
        async claims() {
          return {
            sub:ctx.oidc.client?.subjectType==='public'?subjectFor(owner,client):owner,
            name: person.givenName + ' ' + person.surname, given_name: person.givenName,
            family_name: person.surname, preferred_username:person.username, age_range: person.ageRange,
            ...(person.verified?{xcenter_verified:true}:{}),
            ...(person.admin?{xcenter_admin:true}:{}),
            ...(person.hasPicture?{picture:issuer+'/v1/profile/avatar'}:{}),
            ...(email ? { email, email_verified: true } : {}),
          };
        },
      };
    },
  });
  // Only the loopback-bound application receives requests from the trusted reverse proxy.
  provider.proxy = true;
  provider.on('device_authorization.success',(ctx,result)=>{
    result.verification_uri=issuer+'/device';
    result.verification_uri_complete=issuer+'/device?code='+result.user_code;
    result.interval=5;
  });

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
    const brand=registry?.brand(client.client_id);
    const scopes=new Set(String(params.scope??'').split(' '));
    const missing=new Set(prompt.details.missingOIDCScope??[]);
    const requiredEmail=!!brand?.requiresEmail;
    const requiredAge=!!brand?.requiresAgeRange;
    const choose=new URL(req.url,issuer).searchParams.get('choose')==='account';
    const chooser=path+'?choose=account';
    const signIn=(adding=false)=>'/signin?continue='+encodeURIComponent(path)+(adding?'&addAccount=1':'');
    const title=brand?.name??client.client_name??client.client_id;
    const redirect=(location)=>res.writeHead(303,{Location:location,'Cache-Control':'no-store'}).end();
    const accountRow=(selected,avatar)=>`<span class="avatar">${selected.hasPicture?`<img alt="" src="${avatar}">`:glyph('user')}</span>
      <span class="account-text"><strong>${escape(selected.givenName)} ${escape(selected.surname)}</strong><span class="account-handle">@${escape(selected.username)}</span></span>
      <span aria-hidden="true">›</span>`;
    const accountPicker=person?`<a class="account-choice" href="${chooser}" aria-label="Switch account">${accountRow(person,'/account/avatar')}</a>`:'';
    if(choose){
      if(req.method==='POST'){
        if(req.headers.origin!==issuer)return html(res,'<h1>Could not verify the request</h1>',403);
        let input;
        try{input=await form(req);}catch{return html(res,'<h1>Invalid request</h1>',400);}
        const slot=input.get('slot');
        if(!/^[012]$/.test(slot??'')||!accounts.activateBrowserAccount?.(req,res,Number(slot))){
          return html(res,'<h1>Account unavailable</h1><p>Choose a signed-in account or add another.</p>',409);
        }
        return redirect(path);
      }
      if(req.method!=='GET')return html(res,'<h1>Method unavailable</h1>',405);
      const saved=accounts.browserAccountOptions?.(req)??{accounts:[],canAdd:true};
      const rows=saved.accounts.map(item=>`<button class="account-choice" name="slot" value="${item.slot}"${item.current?' aria-current="true"':''}>
        ${accountRow(item,'/account/switcher/avatar/'+item.slot)}</button>`).join('');
      return html(res,`<h1>Choose your account</h1><p>Select an account to continue to ${escape(title)}.</p>
        <form action="${chooser}" method="post" class="account-choices">${rows}</form>
        <div class="account-actions">${saved.canAdd?`<a class="action" href="${escape(signIn(true))}">Add another account</a>`:''}
        <a class="device-back" href="${path}">Back</a></div>`,200,callbackOrigin,true);
    }
    if(!person)return redirect(signIn());
    const device=!!details.deviceCode;
    if(req.method==='GET'&&(prompt.name==='login'||details.session?.accountId!==active.owner)){
      const authTime=Math.floor(active.created/1000);
      const wantsFresh=String(params.prompt??'').split(' ').includes('login')&&authTime<(details.iat??0);
      const expired=params.max_age!==undefined&&(Number(params.max_age)===0?authTime<(details.iat??0):Date.now()/1000-authTime>=Number(params.max_age));
      if(wantsFresh||expired)return redirect(signIn(true));
      await provider.interactionFinished(req,res,{login:{accountId:active.owner,ts:authTime}},{mergeWithLastSubmission:false});
      return;
    }
    if(req.method==='POST'&&details.session?.accountId!==active.owner){
      return html(res,`<h1>The signed-in account changed</h1><p><a href="${path}">Review this authorization again</a></p>`,409,callbackOrigin);
    }
    if(!canUse(active.owner,client.client_id)){
      const access=registry.access(active.owner,client.client_id);
      if(req.method==='POST'){
        if(req.headers.origin!==issuer)return html(res,'<h1>Could not verify the request</h1>',403);
        let input;
        try{input=await form(req);}catch{return html(res,'<h1>Invalid request</h1>',400);}
        if(input.get('action')==='request'&&access.canRequest&&accounts.current(req)?.owner===active.owner){
          if(!registry.requestAccess(active.owner,client.client_id))return html(res,'<h1>Request unavailable</h1>',409);
          return html(res,`<h1>Access requested</h1><p>Return to the app after its developer approves your request.</p>${accountPicker}<p><a href="/dashboard">Open dashboard</a></p>`,200,callbackOrigin,true);
        }
        if(input.get('action')==='deny'){
          await provider.interactionFinished(req,res,{error:'access_denied',error_description:"You don't have permission to use this app."},{mergeWithLastSubmission:false});
          return;
        }
        return html(res,'<h1>Invalid request</h1>',400);
      }
      if(req.method!=='GET')return html(res,'<h1>Method unavailable</h1>',405);
      return html(res,`<h1>You don’t have permission to use this app</h1><p>${escape(title)} is private.</p>${accountPicker}
        <form method="post">${access.pending?'<p>Your access request is pending.</p>':access.canRequest?'<button name="action" value="request">Request access</button>':''}
        <button name="action" value="deny">Return to app</button></form>`,200,callbackOrigin,true);
    }
    const linked=accounts.linkedGrant(active.owner,client.client_id);
    const existingGrant=linked&&await provider.Grant.find(linked);
    const existingScopes=new Set(existingGrant?.getOIDCScope().split(' '));
    const sharedEmail=linked&&(!existingGrant||existingScopes.has('email'))?await grantedEmail(active.owner,person,linked):undefined;
    const explicitConsent=String(params.prompt??'').split(' ').includes('consent');
    const chooseEmail=scopes.has('email')&&!linked;
    const emailUnavailable=requiredEmail&&!chooseEmail&&!sharedEmail;
    const showAge=scopes.has('age_range')&&(missing.has('age_range')||!existingGrant||explicitConsent||requiredAge&&!existingScopes.has('age_range'));
    const appData=scopes.has('app_data');
    const ownsStorage=appData;
    const showFriends=scopes.has('friends')&&(missing.has('friends')||explicitConsent);
    const requestedFileScopes=fileScopes.filter(scope=>scopes.has(scope));
    const previouslyAllowed=scope=>existingScopes.has(scope);
    const showOffline=scopes.has('offline_access')&&(missing.has('offline_access')||explicitConsent);
    if (req.method === 'POST') {
      if (req.headers.origin !== issuer) return html(res,'<h1>Could not verify the request</h1>',403);
      let input;
      try { input = await form(req); } catch { return html(res,'<h1>Invalid request</h1>',400); }
      if (input.get('action') !== 'approve') {
        await provider.interactionFinished(req,res,{ error:'access_denied', error_description:'The user declined.' },{mergeWithLastSubmission:false});
        return;
      }
      if (prompt.name !== 'consent' || details.session?.accountId !== active.owner || accounts.current(req)?.owner!==active.owner || !canUse(active.owner,client.client_id)) {
        return html(res,'<h1>The signed-in account changed</h1><p>Start again from the app.</p>',409);
      }
      if(emailUnavailable)return html(res,'<h1>Email permission unavailable</h1><p>Unlink this app from your account, then link it again to choose a verified address.</p><a href="/apps">Manage linked apps</a>',409);
      const selected=chooseEmail?input.get('email'):null;
      if(requiredEmail&&chooseEmail&&(!selected||selected==='current'&&!sharedEmail))return html(res,'<h1>Choose an email address</h1><p>This app requires this info to work. Go back to choose an address, or cancel the request.</p>',400);
      const eligible = accounts.premiumEligible(active.owner);
      const premium = (selected === 'premium'||selected==='masked') && eligible && mail?.premiumAvailable ? mail?.premiumAlias(active.owner,client.client_id) : null;
      if(selected === 'premium' && !premium) return html(res,'<h1>Premium Hide My Email is unavailable</h1>',409);
      const alias = selected === 'masked' && !premium && !(eligible&&mail?.premiumAvailable) ? mail?.alias(active.owner,client.client_id) : null;
      if (selected === 'masked' && !alias && !premium) return html(res,'<h1>Hide My Email is unavailable</h1>',409);
      if(selected==='primary'&&!mail)return html(res,'<h1>Select a verified address</h1>',400);
      const primary=selected==='primary';
      const email = selected==='current'?sharedEmail:premium || alias || (primary?person.username+'@mail.xcenter.it':selected);
      if (selected!=='current' && email && !alias && !premium && !primary && !person.emails.some(({address}) => address === email)) return html(res,'<h1>Select a verified address</h1>',400);
      if(appData&&brand?.local&&input.get('confirm-unsecure')!=='yes')return html(res,'<h1>Confirm unsecure app access</h1><p>Confirm the warning in the authorization form.</p>',400);
      const dataChanged=appData&&applicationData?.authorize(active.owner,client.client_id,input.getAll('data-permission'));
      const selectedPermissions=new Set(input.getAll('permission'));
      const fileAllowed=requestedFileScopes.filter(scope=>selectedPermissions.has(scope));
      const fileDenied=requestedFileScopes.filter(scope=>!selectedPermissions.has(scope));
      const keepSession=showOffline&&input.getAll('permission').includes('offline_access');
      const shareFriends=showFriends&&input.getAll('permission').includes('friends');
      const ageAllowed=scopes.has('age_range')&&showAge&&(requiredAge||input.getAll('permission').includes('age_range'));
      const allowed=['openid','profile',...fileAllowed,...(ageAllowed?['age_range']:[]),...(appData?['app_data']:[]),...(shareFriends?['friends']:[]),...(keepSession?['offline_access']:[]),...(email||scopes.has('email')&&sharedEmail&&(!existingGrant||requiredEmail)?['email']:[])];
      const denied=[...fileDenied,...(showAge&&!ageAllowed?['age_range']:[]),...((chooseEmail&&!email||linked&&scopes.has('email')&&!existingScopes.has('email')&&!allowed.includes('email'))?['email']:[]),...(showFriends&&!shareFriends?['friends']:[]),...(showOffline&&!keepSession?['offline_access']:[])];
      const grant=existingGrant||new provider.Grant({accountId:active.owner,clientId:client.client_id});
      approveScopes(grant, allowed);
      if(denied.length)grant.rejectOIDCScope(denied);
      const grantId = await grant.save();
      if (email && selected!=='current') await selections.upsert(grantId,premium||alias ? { privateAddress:email, client:client.client_id } : primary?{primary:true}:{ email });
      else if(sharedEmail&&linked!==grantId) {
        const selection=await selections.find(linked);
        if(selection)await selections.upsert(grantId,selection);
      }
      accounts.rememberApp(active.owner,client.client_id,client.client_name ?? client.client_id,grantId);
      const after=grant.getOIDCScope().split(' ');
      const scopeChanged=after.length!==existingScopes.size||after.some(scope=>!existingScopes.has(scope));
      if(!linked)notify(active.owner,client.client_id,'linked');
      else if(dataChanged||scopeChanged||email&&email!==sharedEmail)notify(active.owner,client.client_id,'permissions');
      await provider.interactionFinished(req,res,{ consent:{ grantId } });
      return;
    }
    if (req.method !== 'GET') return html(res,'<h1>Method unavailable</h1>',405);
    const personBadges=[person.verified&&'<span class="badge">✓ Verified profile</span>',person.admin&&'<span class="badge">◆ Administrator</span>'].filter(Boolean).join('');
    const badgeRow=content=>content?'<div class="badge-row">'+content+'</div>':'';
    const visual=client.client_id.startsWith('notes-')||client.client_id.startsWith('places-')?'notes':client.client_id.startsWith('trips-')?'trips':null;
    const developer=brand?.owner&&accounts.identity(brand.owner);
    const developerProfile=brand?.owner?registry.developer(brand.owner):null;
    const developerName=developerProfile?.name||brand?.developerName||developer?.username||'X-Center';
    const incremental=!!existingGrant;
    const requiredNote='This app requires this info to work.';
    const activeDataPermissions=appData?(applicationData?.permissions(active.owner)??[]).filter(item=>item.destination===client.client_id&&item.enabled):[];
    const hasEmailChoice=!!(sharedEmail||mail||person.emails.length);
    const fixed=(icon,label,note='')=>`<li><div class="permission-toggle permission-fixed">${glyph(icon)}<span>${label}${note?`<small>${note}</small>`:''}</span><span class="permission-check" role="img" aria-label="Allowed">✓</span></div></li>`;
    const sources = new Map();
    for (const item of appData ? applicationData?.requestsForOwner(active.owner,client.client_id) ?? [] : []) {
      if (!sources.has(item.source)) sources.set(item.source, []);
      sources.get(item.source).push(item);
    }
    const sourceSections = [...sources].map(([source, items]) => {
      const profile = registry.brand(source);
      const name = profile?.name ?? registry.publicDetails(source)?.name ?? source;
      const icon = profile?.icon
        ? `<img alt="" class="source-icon" src="${escape(profile.iconUrl??'data:image/png;base64,'+profile.icon)}">`
        : `<span class="source-icon" aria-hidden="true">${escape(name.slice(0,2).toUpperCase())}</span>`;
      const title = `<h2 class="source-heading">${icon}${escape(name)}</h2>`;
      const access = items[0].linked ? `<ul class="permission-list">${items.map(item => {
        const checked = activeDataPermissions.some(permission => permission.source===source&&permission.collection===item.collection);
        const label = escape(item.label);
        return `<li><label class="permission-toggle">${glyph('records')}<span>${label}<small>Read ${escape(item.collection)}</small></span>
          <input type="checkbox" role="switch" name="data-permission" value="${escape(source+'/'+item.collection)}" aria-label="${label}"${checked?' checked':''}></label></li>`;
      }).join('')}</ul>` : '<p>Access declined. Link this app to your account first.</p>';
      return `<section class="source-permissions">${title}${access}</section>`;
    }).join('');
    return html(res,`<div class="connection" aria-hidden="true">
      <span class="avatar">${person.hasPicture?'<img alt="" src="/account/avatar">':glyph('user')}</span>${glyph('link')}
      <span class="avatar">${brand?.icon?`<img alt="" src="${escape(brand.iconUrl??'data:image/png;base64,'+brand.icon)}">`:visual?glyph(visual):escape(title.slice(0,2).toUpperCase())}</span></div>
      <h1>${incremental?'Authorize logging back into '+escape(title)+'?':'Link '+escape(title)+' to X-Center ID'}</h1>
      ${device?'<p>You’re approving sign-in on your other device.</p>':''}
      ${incremental?`<p>${escape(title)} is already linked to your X-Center ID. Review its permissions before continuing.</p>`:''}
      ${brand?.description?`<p>${escape(brand.description)}</p>`:''}
      ${brand?.local?'<p role="alert">Unsecure app. Its hosting domain has not been verified. Continue only if you trust this installation.</p>':''}
      ${brand?.verified?badgeRow('<span class="badge">✓ Verified app</span>'):''}
      <div class="identity-contexts">
        <section class="context" aria-label="App developer"><small>App developer</small>
          <strong>${escape(developerName)}</strong><div>${escape(client.host)}</div>
          ${developerProfile?.status==='verified'?badgeRow('<span class="badge">✓ Verified developer</span>'):''}
        </section>
        <section class="context" aria-label="Signing in as"><small>Signing in as</small>
          ${accountPicker}${badgeRow(personBadges)}
        </section>
      </div>
      <form method="post"><h2>Permissions</h2>
      <ul class="permission-list">
        ${fixed('id','Account ID, name, username and profile photo',requiredNote)}
        ${showAge&&!requiredAge?`<li><label class="permission-toggle">${glyph('age')}<span>Age range</span><input aria-label="Age range" type="checkbox" role="switch" name="permission" value="age_range"${existingScopes.has('age_range')?' checked':''}></label></li>`:''}
        ${requiredAge||!showAge&&existingScopes.has('age_range')?fixed('age','Age range',requiredAge?requiredNote:''):''}
        ${showFriends?`<li><label class="permission-toggle">${glyph('user')}<span>Friends list<small>Share accepted friends and identify those who already use this app.</small></span><input type="checkbox" role="switch" name="permission" value="friends" aria-label="Friends list"${existingScopes.has('friends')?' checked':''}></label></li>`:existingScopes.has('friends')?fixed('user','Friends list'):''}
        ${showOffline?`<li><label class="permission-toggle">${glyph('id')}<span>Stay signed in<small>Let this app renew your session while you use it.</small></span><input type="checkbox" role="switch" name="permission" value="offline_access" aria-label="Stay signed in"${existingScopes.has('offline_access')||!incremental?' checked':''}></label></li>`:existingScopes.has('offline_access')?fixed('id','Stay signed in'):''}
        ${fileScopes.filter(scope=>scopes.has(scope)||previouslyAllowed(scope)).map(scope=>{
          const [label,description]=filePermissions[scope];
          return scopes.has(scope)
            ? `<li><label class="permission-toggle">${glyph('records')}<span>${label}<small>${description}</small></span><input type="checkbox" role="switch" name="permission" value="${scope}" aria-label="${label}"${previouslyAllowed(scope)?' checked':''}></label></li>`
            : fixed('records',label,description);
        }).join('')}
        ${ownsStorage?fixed('records','Private app storage','This app can save and access your records in its own storage.'):''}
        ${!chooseEmail&&sharedEmail?fixed('mail','Email address',escape(sharedEmail)+(requiredEmail?` · ${requiredNote}`:'')):''}
      </ul>
      ${appData&&brand?.local?'<p role="alert">Granting data access shares records with an unsecure app.</p><label><input type="checkbox" name="confirm-unsecure" value="yes">I understand the risk of granting this app access.</label>':''}
      ${sourceSections}
      <p>You can review app access in X-Center ID.</p>
      ${emailUnavailable?'<p role="alert">This app needs a verified email address. Unlink it in <a href="/apps">Linked apps</a>, then link it again to choose an address.</p>':''}
      ${chooseEmail ? `<fieldset><legend>Email address to share</legend>
      ${requiredEmail?`<p>${requiredNote}</p>${hasEmailChoice?'':'<p>Add and verify an email in X-Center ID, then return to the app to start again.</p>'}`:`<label><input type="radio" name="email" value=""${sharedEmail?'':' checked'}>Do not share an email address</label>`}
      ${sharedEmail?`<label><input type="radio" name="email" value="current" checked>Keep sharing ${escape(sharedEmail)}</label>`:''}
      ${mail?`<label><input type="radio" name="email" value="primary">X-Center ID · ${escape(person.username)}@mail.xcenter.it</label>`:''}
      ${(mail?.maskedAvailable||mail?.premiumAvailable&&accounts.premiumEligible(active.owner)) ? '<label><input type="radio" name="email" value="masked">Hide my email</label>' : ''}
      ${person.emails.map(({address}) => `<label><input type="radio" name="email" value="${escape(address)}">${escape(address)}</label>`).join('')}
      </fieldset>` : ''}
      <button name="action" value="approve"${(emailUnavailable||requiredEmail&&chooseEmail&&!hasEmailChoice)?' disabled':''}>${incremental?(missing.size||explicitConsent?'Authorize selected permissions':'Authorize sign-in'):'Link app'}</button><button name="action" value="deny">Cancel</button></form>`,200,callbackOrigin,true);
  }

  async function activeGrant(access) {
    if(!canUse(access.accountId,access.clientId)||!accounts.grantAllowed(access.accountId,access.clientId,access.grantId))return null;
    return provider.Grant.find(access.grantId);
  }

  async function connectedPermissions(owner,client,change) {
    const linked=accounts.linkedGrant(owner,client);
    const grant=linked&&knownClient(client)&&await activeGrant({accountId:owner,clientId:client,grantId:linked});
    if(!grant||grant.accountId!==owner||grant.clientId!==client)return null;
    const brand=registry?.brand(client);
    const current=new Set(grant.getOIDCScope().split(' '));
    const encountered=new Set(grant.getOIDCScopeEncountered().split(' '));
    const email=await grantedEmail(owner,accounts.identity(owner),linked);
    const required=scope=>scope==='profile'||scope==='app_data'||scope==='email'&&!!brand?.requiresEmail||scope==='age_range'&&!!brand?.requiresAgeRange;
    if(change){
      const {scope,enabled}=change;
      if(!accountPermissions.includes(scope)||!encountered.has(scope)||required(scope)||enabled&&scope==='email'&&!email) return false;
      const changed=current.has(scope)!==enabled;
      if(enabled){approveScopes(grant,[scope]);current.add(scope);}
      else{grant.rejectOIDCScope([scope]);current.delete(scope);}
      if(!accounts.grantAllowed(owner,client,linked)) return null;
      await grant.save();
      if(changed)notify(owner,client,'permissions');
    }
    return accountPermissions.filter(scope=>scope==='profile'||encountered.has(scope)||scope!=='app_data'&&required(scope)).map(scope=>({
      scope,required:required(scope),enabled:scope==='profile'||current.has(scope)&&(scope!=='email'||!!email),
      canEnable:scope!=='email'||!!email,...(scope==='email'&&current.has(scope)&&email?{address:email}:{}),
    }));
  }

  return {
    oidc: provider.callback(), interaction, connectedPermissions, deviceCodePattern,
    async changeClientSecret(client,action) {
      const previous=await clientsStorage.find(client);
      if(previous?.token_endpoint_auth_method!=='client_secret_basic')return null;
      if(action==='revoke'){
        await clientsStorage.upsert(client,{...previous,client_secret:undefined,clientSecretRevoked:true});
        return {clientId:client};
      }
      const clientSecret=randomBytes(48).toString('base64url');
      await clientsStorage.upsert(client,{...previous,client_secret:clientSecret,clientSecretRevoked:false});
      return {clientId:client,clientSecret};
    },
    async provision(application) {
      const client_id = 'xid-' + randomUUID();
      const client_secret = application.native?null:randomBytes(48).toString('base64url');
      const metadata = {
        client_id, client_name:application.name,
        ...(client_secret?{client_secret}:{}), application_type:application.native||application.local?'native':'web',
        redirect_uris:application.callbacks??[application.callback], grant_types:['authorization_code','refresh_token'], response_types:['code'],
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
      await Promise.all(grants.map(({id})=>revokeGrant(id)));
      return true;
    },
    async dataAccess(value,{native=false}={}) {
      const access = await provider.AccessToken.find(value);
      if (!access?.accountId || !registry?.has(access.clientId) || !accounts.linkedGrant(access.accountId,access.clientId) || (!native&&(await provider.Client.find(access.clientId))?.tokenEndpointAuthMethod!=='client_secret_basic') || !await activeGrant(access) || !access.scope?.split(' ').includes('app_data')) return null;
      return { owner:access.accountId, client:access.clientId, confidential:true };
    },
    async fileAccess(token, scopes) {
      const access=await provider.AccessToken.find(token);
      if(!access?.accountId||!registry?.has(access.clientId)||!accounts.linkedGrant(access.accountId,access.clientId))return null;
      const grant=await activeGrant(access);
      const current=new Set(grant?.getOIDCScope().split(' '));
      const issued=new Set(access.scope?.split(' '));
      if(!scopes.some(scope=>fileScopes.includes(scope)&&current.has(scope)&&issued.has(scope)))return null;
      return {owner:access.accountId,client:access.clientId};
    },
    async profileAvatar(token) {
      const access=await provider.AccessToken.find(token);
      if(!access?.accountId||!knownClient(access.clientId)||!accounts.linkedGrant(access.accountId,access.clientId)||
        !await activeGrant(access)||!access.scope?.split(' ').includes('openid'))return undefined;
      return accounts.profileAvatar(access.accountId)??null;
    },
    async friendAccess(token) {
      const access=await provider.AccessToken.find(token);
      if(!access?.accountId||!registry?.has(access.clientId)||!accounts.linkedGrant(access.accountId,access.clientId)||
        !accounts.grantAllowed(access.accountId,access.clientId,access.grantId)||!access.scope?.split(' ').includes('friends'))return null;
      const grant=await activeGrant(access);
      if(!grant?.getOIDCScope().split(' ').includes('friends'))return null;
      return {owner:access.accountId,client:access.clientId};
    },
    friendSubject(owner,client){
      return canUse(owner,client)&&accounts.linkedGrant(owner,client)?subjectFor(owner,client):undefined;
    },
    async delegatedAccess(token, expectedClient) {
      const access = await provider.AccessToken.find(token);
      if (!access || access.clientId !== expectedClient || !access.accountId || !knownClient(access.clientId) || !await activeGrant(access) || !access.scope?.split(' ').includes('openid')) return null;
      return { owner: access.accountId, client: access.clientId };
    },
  };
}
