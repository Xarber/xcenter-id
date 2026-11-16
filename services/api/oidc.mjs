import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Provider } from 'oidc-provider';
import { openOidcStore } from './oidc-store.mjs';

const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

function html(res, content, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
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
    :focus-visible{outline:3px solid #6b94ff;outline-offset:3px}
    @media(prefers-color-scheme:dark){:root{--bg:#101522;--card:#192132;--text:#f3f6ff;--muted:#b1c1dc;--border:#35445e;--action:#375fce;--soft:#23355d}.brand{color:#adc5ff}}
    </style><main><span class="brand">X-Center ID</span>${content}</main></html>`);
}

async function form(req) {
  if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) throw new Error('Invalid form');
  let value = '';
  for await (const chunk of req) {
    value += chunk.toString();
    if (value.length > 4096) throw new Error('Form too large');
  }
  return new URLSearchParams(value);
}

export function createIdentityProvider({ issuer, database, accounts, configuration, mail, registry }) {
  const storageKey = Buffer.from(configuration.storageKey, 'hex');
  const subjectKey = Buffer.from(configuration.subjectKey, 'hex');
  if (subjectKey.length !== 32) throw new Error('Invalid stable subject key');
  const StorageAdapter = openOidcStore(database, storageKey);
  class Adapter extends StorageAdapter {
    async find(id) {
      return this.model === 'Client' && !registry?.has(id) ? undefined : super.find(id);
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
  const provider = new Provider(issuer, {
    clients, adapter: Adapter, jwks: configuration.jwks,
    cookies: { keys: configuration.cookieKeys, short: { secure: true, httpOnly: true, sameSite: 'lax' },
      long: { secure: true, httpOnly: true, sameSite: 'lax' } },
    claims: scopeClaims, scopes: ['openid','profile','email','age_range','app_data'], subjectTypes: ['pairwise'],
    pkce: { required: () => true },
    ttl: { AccessToken:600, AuthorizationCode:90, Interaction:300 },
    async loadExistingGrant(ctx) {
      const id = ctx.oidc.result?.consent?.grantId;
      return id ? ctx.oidc.provider.Grant.find(id) : undefined;
    },
    features: { devInteractions: { enabled: false } },
    interactions: { url: (_ctx, interaction) => '/interaction/' + interaction.uid },
    async pairwiseIdentifier(_ctx, accountId, client) {
      return createHmac('sha256', subjectKey).update(JSON.stringify(['pairwise', client.clientId, accountId])).digest('base64url');
    },
    async findAccount(_ctx, owner, source) {
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
    if (!client) return html(res, '<h1>This app is unavailable</h1>', 404);
    if (!person) {
      const location = '/signin?continue=' + encodeURIComponent(path);
      res.writeHead(303,{Location:location,'Cache-Control':'no-store'}).end();
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
      const allowed = ['openid', ...['profile','age_range','app_data'].filter((scope) => requested.has(scope)),
        ...(email ? ['email'] : [])];
      const grant = new provider.Grant({ accountId:active.owner, clientId:client.client_id });
      grant.addOIDCScope(allowed.join(' '));
      if (requested.has('email') && !email) grant.rejectOIDCScope('email');
      const grantId = await grant.save();
      if (email) await selections.upsert(grantId,premium ? { premium:true, client:client.client_id }
        : alias ? { alias:true, client:client.client_id } : { email },3600);
      accounts.rememberApp(active.owner,client.client_id,client.client_name ?? client.client_id);
      await provider.interactionFinished(req,res,{ consent:{ grantId } });
      return;
    }
    if (req.method !== 'GET') return html(res,'<h1>Method unavailable</h1>',405);
    const missing = new Set(prompt.details.missingOIDCScope ?? []);
    return html(res,`<h1>Continue to ${escape(client.client_name ?? client.client_id)}</h1>
      <div class="context"><strong>${escape(person.givenName)} ${escape(person.surname)}</strong><br>App domain <strong>${escape(client.host)}</strong></div><p>The app receives an ID scoped to this app.</p>
      ${missing.has('profile') ? '<p>This app requests your given name and surname.</p>' : ''}
      ${missing.has('age_range') ? '<p>This app requests your age range.</p>' : ''}
      ${missing.has('app_data') ? '<p>This app can access its own records. Cross-app grants are managed separately.</p>' : ''}
      <form method="post">${missing.has('email') ? `<fieldset><legend>Email address to share</legend>
      <label><input type="radio" name="email" value="" checked>Share only my user ID and the other agreed details</label>
      ${mail?.premiumAvailable && accounts.premiumEligible(active.owner) ? '<label><input type="radio" name="email" value="premium">Use a premium private address</label>' : ''}
      ${mail?.maskedAvailable ? '<label><input type="radio" name="email" value="masked">Hide my email</label>' : ''}
      ${person.emails.map(({address}) => `<label><input type="radio" name="email" value="${escape(address)}">${escape(address)}</label>`).join('')}
      </fieldset>` : ''}
      <button name="action" value="approve">Continue</button><button name="action" value="deny">Cancel</button></form>`);
  }

  return {
    oidc: provider.callback(), interaction,
    async provision(application) {
      const client_id = 'xid-' + randomUUID();
      const client_secret = randomBytes(48).toString('base64url');
      const metadata = {
        client_id, client_secret, client_name:application.name,
        redirect_uris:[application.callback], grant_types:['authorization_code'], response_types:['code'],
        token_endpoint_auth_method:'client_secret_basic', subject_type:'pairwise',
      };
      await clientsStorage.upsert(client_id,metadata);
      return {
        clientId:client_id, clientSecret:client_secret,
        discard: () => clientsStorage.destroy(client_id),
      };
    },
    async dataAccess(value) {
      const access = await provider.AccessToken.find(value);
      if (!access?.accountId || !registry?.has(access.clientId) || !access.scope?.split(' ').includes('app_data')) return null;
      return { owner:access.accountId, client:access.clientId, confidential:true };
    },
    async delegatedAccess(token, expectedClient) {
      const access = await provider.AccessToken.find(token);
      if (!access || access.clientId !== expectedClient || !access.accountId || !access.scope?.split(' ').includes('openid')) return null;
      return { owner: access.accountId, client: access.clientId };
    },
  };
}
