import * as oidc from 'openid-client';
import { randomBytes } from 'node:crypto';

const sampleIds = ['places-demo', 'trips-demo'];
const noteDataset = 'sample-notes.v1';
const sharedDataset = 'sample-shared.v1';
const shared = 'account-shared';
const escape = (value) => String(value).replace(/[&<>"']/g,(c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
})[c]);
const random = () => randomBytes(32).toString('base64url');

function respond(res, title, content, status = 200) {
  res.writeHead(status, {
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'same-origin',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  });
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title>
    <style>:root{color-scheme:light dark;font:1rem/1.5 system-ui}main{max-width:42rem;margin:3rem auto;padding:1rem}
    form{margin:1rem 0}textarea{width:100%}button{font:inherit;padding:.5em}.note{white-space:pre-wrap}</style>
    <main><h1>${escape(title)}</h1>${content}</main></html>`);
}

function redirect(res, url) {
  res.writeHead(303, { Location: String(url), 'Cache-Control':'no-store' }).end();
}

function cookie(req,name) {
  return req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(name+'='))?.slice(name.length+1);
}

async function form(req) {
  if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) throw new Error('Unsupported form');
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({destroyOnReturn:false})) {
    size += chunk.length;
    if (size > 4096) { req.resume(); throw new Error('Form too large'); }
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

function prune(map) {
  for (const [key,item] of map) if (item.expires < Date.now()) map.delete(key);
  if (map.size >= 300) throw new Error('Too many sample sessions');
}

function notes(page) {
  return page?.records.length
    ? '<ul>' + page.records.map(({value}) => `<li class="note">${escape(value.text)}</li>`).join('') + '</ul>'
    : '<p>No notes yet.</p>';
}

export function createSamples({ issuer, configuration, provider, accounts, store }) {
  const clients = configuration.clients.filter(({client_id}) => sampleIds.includes(client_id));
  const sessions = new Map();
  const flows = new Map();
  const discovered = new Map();
  async function localProviderFetch(input, options) {
    const target = new URL(input);
    if (target.origin !== issuer || !['/.well-known/openid-configuration','/token','/me','/jwks'].includes(target.pathname)) {
      throw new Error('Unexpected identity backchannel');
    }
    const headers = new Headers(options?.headers);
    headers.set('X-Forwarded-Proto','https');
    headers.set('X-Forwarded-Host',target.host);
    return fetch('http://127.0.0.1:8080'+target.pathname, { ...options, headers, redirect:'error' });
  }
  async function discovery(client) {
    if (!discovered.has(client.client_id)) {
      discovered.set(client.client_id, oidc.discovery(new URL(issuer),client.client_id,client.client_secret,
        oidc.ClientSecretBasic(client.client_secret), { [oidc.customFetch]:localProviderFetch }).catch((error) => {
        discovered.delete(client.client_id);
        throw error;
      }));
    }
    return discovered.get(client.client_id);
  }

  return async (req,res,url) => {
    if (url.pathname === '/samples') {
      return respond(res,'X-Center ID sample apps', '<p>Use fictional data. Sample app records are separate from other datasets.</p><ul>' +
        clients.map((client) => `<li><a href="/samples/${client.client_id}">${escape(client.client_name)}</a></li>`).join('') + '</ul>');
    }
    if (url.pathname === '/samples/permissions') {
      const active = accounts.current(req);
      if (!active) return respond(res,'Sample permissions','<p>Sign in to authorize sample access.</p><a href="/">Open X-Center ID</a>',401);
      if (req.method === 'POST') {
        if (req.headers.origin !== issuer) return respond(res,'Invalid origin','',403);
        const input = await form(req);
        const source = input.get('source');
        const destination = input.get('destination');
        if (!sampleIds.includes(destination) || (source !== shared && !sampleIds.includes(source)) || source === destination) {
          return respond(res,'Invalid permission','',422);
        }
        const dataset = source === shared ? sharedDataset : noteDataset;
        if (input.get('action') === 'allow') store.grant(active.owner,source,destination,dataset,Date.now()+3600_000);
        else if (input.get('action') === 'revoke') store.revoke(active.owner,source,destination,dataset);
        else return respond(res,'Invalid permission','',422);
        return redirect(res,'/samples/permissions');
      }
      if (req.method !== 'GET') return respond(res,'Method unavailable','',405);
      const grants = store.listGrants(active.owner);
      const permissions = sampleIds.flatMap((destination) => [shared,...sampleIds.filter((id) => id !== destination)].map((source) => {
        const allowed = grants.some((grant) => grant.source === source && grant.destination === destination &&
          grant.dataset === (source === shared ? sharedDataset : noteDataset));
        return `<form method="post"><input type="hidden" name="source" value="${source}">
          <input type="hidden" name="destination" value="${destination}"><p>${destination} can ${source === shared ? 'read and write the sample shared folder' : 'read notes from ' + source}.</p>
          <button name="action" value="${allowed ? 'revoke' : 'allow'}">${allowed ? 'Revoke permission' : 'Allow for one hour'}</button></form>`;
      })).join('');
      return respond(res,'Sample permissions',permissions+'<p><a href="/samples">Back to sample apps</a></p>');
    }

    const [,id,action] = url.pathname.match(/^\/samples\/(places-demo|trips-demo)(?:\/(start|callback))?$/) ?? [];
    const client = clients.find(({client_id}) => client_id === id);
    if (!client) return respond(res,'Sample app unavailable','',404);
    const base = '/samples/' + id;
    const username = 'sample-' + id;
    const flowCookie = username + '-flow';
    if (req.method === 'GET' && action === 'start') {
      prune(flows);
      const ticket = random();
      const pkce = oidc.randomPKCECodeVerifier();
      const nonce = oidc.randomNonce();
      const state = oidc.randomState();
      flows.set(ticket,{ id, pkce, nonce, state, expires:Date.now()+120_000 });
      const auth = oidc.buildAuthorizationUrl(await discovery(client),{
        scope:'openid profile email age_range', redirect_uri:issuer+base+'/callback', state, nonce, prompt:'consent',
        code_challenge:await oidc.calculatePKCECodeChallenge(pkce), code_challenge_method:'S256',
      });
      res.setHeader('Set-Cookie',`${flowCookie}=${ticket}; Path=${base}; Secure; HttpOnly; SameSite=Lax; Max-Age=120`);
      return redirect(res,auth);
    }
    if (req.method === 'GET' && action === 'callback') {
      const ticket = cookie(req,flowCookie);
      const flow = flows.get(ticket);
      flows.delete(ticket);
      if (!flow || flow.id !== id || flow.expires < Date.now()) return respond(res,'Sign-in expired','<a href="/samples">Start again</a>',400);
      const config = await discovery(client);
      const tokens = await oidc.authorizationCodeGrant(config,new URL(url.pathname+url.search,issuer),{
        pkceCodeVerifier:flow.pkce, expectedState:flow.state, expectedNonce:flow.nonce, idTokenExpected:true,
      });
      const claims = tokens.claims();
      const identity = await oidc.fetchUserInfo(config,tokens.access_token,claims.sub);
      prune(sessions);
      const session = random();
      sessions.set(session,{ id, access:tokens.access_token, identity, expires:Date.now()+Math.min(tokens.expires_in ?? 900,900)*1000 });
      res.setHeader('Set-Cookie',`${username}=${session}; Path=${base}; Secure; HttpOnly; SameSite=Lax; Max-Age=900`);
      return redirect(res,base);
    }
    if (action) return respond(res,'Method unavailable','',405);
    const state = sessions.get(cookie(req,username));
    const active = state?.id === id && state.expires > Date.now() ? await provider.delegatedAccess(state.access,id) : null;
    if (!active) return respond(res,client.client_name,`<p>Sign in with your X-Center ID.</p><a href="${base}/start">Sign in</a>`);
    const {owner} = active;
    const other = sampleIds.find((candidate) => candidate !== id);
    const sharedPage = store.read(owner,shared,id,sharedDataset);
    if (req.method === 'POST') {
      if (req.headers.origin !== issuer) return respond(res,'Invalid origin','',403);
      const input = await form(req);
      const note = input.get('note')?.trim();
      const folder = input.get('folder');
      if (!note || note.length > 500 || !['own','shared'].includes(folder)) return respond(res,'Invalid note','',422);
      if (folder === 'shared' && !sharedPage) return respond(res,'Allow shared-folder access first','',403);
      const created = store.create(owner,folder === 'shared' ? shared : id,folder === 'shared' ? sharedDataset : noteDataset,{ text:note });
      return created ? redirect(res,base) : respond(res,'Sample storage is full','',409);
    }
    if (req.method !== 'GET') return respond(res,'Method unavailable','',405);
    const otherPage = store.read(owner,other,id,noteDataset);
    const noteForm = (folder) => `<form method="post"><input type="hidden" name="folder" value="${folder}"><label>Note<textarea name="note" maxlength="500" required></textarea></label><button>Save note</button></form>`;
    return respond(res,client.client_name,`<p>Signed in as ${escape(state.identity.name ?? 'X-Center ID user')}.</p>
      <p>App-specific ID <code>${escape(state.identity.sub)}</code></p>
      ${state.identity.age_range ? `<p>Shared age range ${escape(state.identity.age_range)}</p>` : ''}
      ${state.identity.email ? `<p>Shared email ${escape(state.identity.email)}</p>` : ''}
      <h2>Your notes</h2>${notes(store.read(owner,id,id,noteDataset))}${noteForm('own')}
      <h2>Other app’s notes</h2>${otherPage ? notes(otherPage) : '<p>Access has not been granted.</p>'}
      <h2>Shared folder</h2>${sharedPage ? notes(sharedPage)+noteForm('shared') : '<p>Access has not been granted.</p>'}
      <p><a href="/samples/permissions">Review sample permissions</a> · <a href="/samples">Other sample apps</a></p>`);
  };
}
