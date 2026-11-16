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
    :root{color-scheme:light dark;font:1rem/1.5 system-ui}body{margin:0;padding:2rem;background:Canvas;color:CanvasText}
    main{max-width:34rem;margin:8vh auto}h1{line-height:1.08;letter-spacing:-.04em}
    label{display:flex;gap:.7em;padding:.6em 0}button,a{font:inherit}button{padding:.55em 1em;margin:.6em .4em .6em 0}
    </style><main>${content}</main></html>`);
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
      const email = selection?.alias ? mail?.alias(owner, selection.client) :
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
    if (!person) return html(res, `<h1>Sign in to X-Center ID</h1><p>Sign in with a passkey, then return to continue to ${escape(client.client_name ?? client.client_id)}.</p>
      <a href="/?continue=${escape(path)}">Open X-Center ID</a>`);
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
      const alias = selected === 'masked' ? mail?.alias(active.owner,client.client_id) : null;
      if (selected === 'masked' && !alias) return html(res,'<h1>Hide My Email is unavailable</h1>',409);
      const email = alias || selected;
      if (email && !alias && !person.emails.some(({address}) => address === email)) return html(res,'<h1>Select a verified address</h1>',400);
      const allowed = ['openid', ...['profile','age_range','app_data'].filter((scope) => requested.has(scope)),
        ...(email ? ['email'] : [])];
      const grant = new provider.Grant({ accountId:active.owner, clientId:client.client_id });
      grant.addOIDCScope(allowed.join(' '));
      if (requested.has('email') && !email) grant.rejectOIDCScope('email');
      const grantId = await grant.save();
      if (email) await selections.upsert(grantId,alias ? { alias:true, client:client.client_id } : { email },3600);
      await provider.interactionFinished(req,res,{ consent:{ grantId } });
      return;
    }
    if (req.method !== 'GET') return html(res,'<h1>Method unavailable</h1>',405);
    const missing = new Set(prompt.details.missingOIDCScope ?? []);
    return html(res,`<h1>Continue to ${escape(client.client_name ?? client.client_id)}</h1>
      <p>Using ${escape(person.givenName)} ${escape(person.surname)}. The app receives an ID scoped to this app.</p><p>Registered callback domain: <strong>${escape(client.host)}</strong>.</p>
      ${missing.has('profile') ? '<p>This app requests your given name and surname.</p>' : ''}
      ${missing.has('age_range') ? '<p>This app requests your age range.</p>' : ''}
      ${missing.has('app_data') ? '<p>This app can access its own records. Cross-app grants are managed separately.</p>' : ''}
      <form method="post">${missing.has('email') ? `<fieldset><legend>Email address to share</legend>
      <label><input type="radio" name="email" value="" checked>Share only my user ID and the other agreed details</label>
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
