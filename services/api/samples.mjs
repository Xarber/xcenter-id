import * as oidc from 'openid-client';
import { randomBytes } from 'node:crypto';

import { sampleApps, samplePartner, sampleNotes as noteDataset, sampleSharedDataset, sampleShared as shared } from './sample-permissions.mjs';
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
    <style>:root{color-scheme:light dark;font:1rem/1.5 system-ui}*{box-sizing:border-box}body{margin:0;background:Canvas;color:CanvasText}
    main{max-width:46rem;margin:auto;padding:clamp(1rem,5vw,3rem)}
    h1{font-size:clamp(1.8rem,6vw,2.6rem);line-height:1.15;letter-spacing:-.05em}
    section,article{border:1px solid ButtonBorder;border-radius:1rem;padding:1rem;margin:1rem 0}
    label{display:block;margin:.55rem 0}label input{display:block;width:100%}
    input,textarea,button,.button{font:inherit;border:1px solid ButtonBorder;border-radius:.55rem;padding:.55rem .7rem}
    button,.button{display:inline-block;cursor:pointer}.primary{background:#214fbe;color:#fff;text-decoration:none}
    .note,code{overflow-wrap:anywhere}:focus-visible{outline:3px solid #6b94ff;outline-offset:3px}
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

function notes(page, folder, canDelete = () => false) {
  return page?.records.length
    ? page.records.map(({id,value}) => `<article>${value.title ? `<strong>${escape(value.title)}</strong>` : ''}
      <p class="note">${escape(value.text)}</p>
      ${value.details?.date ? `<p><time>${escape(value.details.date)}</time></p>` : ''}
      ${value.details?.tags?.length ? `<small>${escape(value.details.tags.join(' · '))}</small>` : ''}
      ${canDelete(value) ? `<form method="post"><input type="hidden" name="action" value="delete">
        <input type="hidden" name="folder" value="${folder}"><button name="record" value="${escape(id)}">Delete note</button></form>` : ''}
      </article>`).join('')
    : '<p>No notes yet.</p>';
}

export function createSamples({ issuer, configuration, provider, store }) {
  const clients = configuration.clients.filter(({client_id}) => sampleApps.has(client_id));
  const external = new Map(clients.filter(client=>new URL(client.redirect_uris[0]).origin!==issuer)
    .map(client=>[new URL(client.redirect_uris[0]).origin,client]));
  const locals = clients.filter(client=>new URL(client.redirect_uris[0]).origin===issuer);
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
    const externalClient=external.get(url.origin);
    const appOrigin=externalClient?url.origin:issuer;
    if (!externalClient&&url.pathname === '/samples') {
      const localLinks=locals.map(client=>`<li><a href="/samples/${client.client_id}">${escape(client.client_name)}</a></li>`);
      const externalLinks=[...external].map(([host,client])=>`<li><a href="${escape(host)}">${escape(client.client_name)}</a> · external app</li>`);
      return respond(res,'X-Center ID sample apps','<p>Use fictional data. Sample app records are separate from other datasets.</p><ul>'+
        [...localLinks,...externalLinks].join('')+'</ul>');
    }
    if (!externalClient&&url.pathname === '/samples/permissions') {
      if (req.method !== 'GET') return respond(res,'Permission management moved','<a href="/permissions">Open X-Center ID permissions</a>',405);
      return redirect(res,'/permissions');
    }

    const path=externalClient?url.pathname.match(/^\/(start|callback)?$/):url.pathname.match(/^\/samples\/([a-z-]+)(?:\/(start|callback))?$/);
    const id=externalClient?.client_id??path?.[1];
    const action=externalClient?path?.[1]:path?.[2];
    const client=externalClient??locals.find(({client_id})=>client_id===id);
    if(!path||!client)return respond(res,'Sample app unavailable','',404);
    const base=externalClient?'':'/samples/'+id;
    const home=base||'/';
    const permissions=issuer+'/permissions';
    const sharedDataset=sampleSharedDataset(id);
    const callback=client.redirect_uris[0];
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
        scope:'openid profile email age_range', redirect_uri:callback, state, nonce,
        code_challenge:await oidc.calculatePKCECodeChallenge(pkce), code_challenge_method:'S256',
      });
      res.setHeader('Set-Cookie',`${flowCookie}=${ticket}; Path=${home}; Secure; HttpOnly; SameSite=Lax; Max-Age=120`);
      return redirect(res,auth);
    }
    if (req.method === 'GET' && action === 'callback') {
      if(url.searchParams.has('error'))return respond(res,'Linking canceled',`<a href="${home}">Return to the app</a>`);
      const ticket = cookie(req,flowCookie);
      const flow = flows.get(ticket);
      flows.delete(ticket);
      if (!flow || flow.id !== id || flow.expires < Date.now()) return respond(res,'Sign-in expired','<a href="/samples">Start again</a>',400);
      const config = await discovery(client);
      const tokens = await oidc.authorizationCodeGrant(config,new URL(url.pathname+url.search,appOrigin),{
        pkceCodeVerifier:flow.pkce, expectedState:flow.state, expectedNonce:flow.nonce, idTokenExpected:true,
      });
      const claims = tokens.claims();
      const identity = await oidc.fetchUserInfo(config,tokens.access_token,claims.sub);
      prune(sessions);
      const session = random();
      sessions.set(session,{ id, access:tokens.access_token, identity, expires:Date.now()+Math.min(tokens.expires_in ?? 900,900)*1000 });
      res.setHeader('Set-Cookie',`${username}=${session}; Path=${home}; Secure; HttpOnly; SameSite=Lax; Max-Age=900`);
      return redirect(res,home);
    }
    if (action) return respond(res,'Method unavailable','',405);
    const sessionId = cookie(req,username);
    const state = sessions.get(sessionId);
    if (req.method === 'POST' && url.searchParams.get('action') === 'signout') {
      if (req.headers.origin !== appOrigin) return respond(res,'Invalid origin','',403);
      if (state?.id === id) sessions.delete(sessionId);
      res.setHeader('Set-Cookie',`${username}=; Path=${home}; Secure; HttpOnly; SameSite=Lax; Max-Age=0`);
      return redirect(res,home);
    }
    const active = state?.id === id && state.expires > Date.now() ? await provider.delegatedAccess(state.access,id) : null;
    if (!active) return respond(res,client.client_name,`<p>Sign in with your X-Center ID.</p><a class="button primary" href="${base}/start">Sign in</a>`);
    const {owner} = active;
    const other=samplePartner.get(id);
    if (req.method === 'POST') {
      if (req.headers.origin !== appOrigin) return respond(res,'Invalid origin','',403);
      const input = await form(req);
      const folder = input.get('folder');
      if (!['own','shared'].includes(folder)) return respond(res,'Invalid folder','',422);
      const source = folder === 'shared' ? shared : id;
      const dataset = folder === 'shared' ? sharedDataset : noteDataset;
      const sharedPage = folder === 'shared' ? store.read(owner,shared,id,sharedDataset) : null;
      if (folder === 'shared' && !sharedPage) return respond(res,'Allow shared-folder access first','',403);
      if (input.get('action') === 'delete') {
        const record = input.get('record');
        if (!record || (sharedPage && !sharedPage.records.some(item=>item.id===record && item.value.author===id))) {
          return respond(res,'Note unavailable','',404);
        }
        return store.remove(owner,source,dataset,record) ? redirect(res,home) : respond(res,'Note unavailable','',404);
      }
      const note = input.get('note')?.trim();
      const title = input.get('title')?.trim() ?? '';
      const date = input.get('date') ?? '';
      const tags = (input.get('tags') ?? '').split(',').map(tag=>tag.trim()).filter(Boolean);
      if (!note || note.length > 500 || title.length > 100 || tags.length > 8 || tags.some(tag=>tag.length > 30)
        || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return respond(res,'Invalid note','',422);
      const created = store.create(owner,source,dataset,{ title,text:note,details:{date,tags},author:id });
      return created ? redirect(res,home) : respond(res,'Sample storage is full','',409);
    }
    if (req.method !== 'GET') return respond(res,'Method unavailable','',405);
    const otherPage = store.read(owner,other,id,noteDataset);
    const sharedPage = store.read(owner,shared,id,sharedDataset);
    const noteForm = (folder) => `<details><summary>New note</summary><form method="post">
      <input type="hidden" name="folder" value="${folder}">
      <label>Title<input name="title" maxlength="100"></label>
      <label>Note<textarea name="note" maxlength="500" required></textarea></label>
      <label>Date<input type="date" name="date"></label>
      <label>Tags<input name="tags" maxlength="200" placeholder="Separate tags with commas"></label>
      <button class="primary">Save note</button></form></details>`;
    return respond(res,client.client_name,`<section><p>Signed in as ${escape(state.identity.name ?? 'X-Center ID user')}.</p>
      <a class="button" href="${permissions}">Manage permissions</a>
      <form method="post" action="${base}?action=signout"><button>Sign out</button></form>
      <details><summary>Shared identity details</summary><p>App-specific ID <code>${escape(state.identity.sub)}</code></p>
      ${state.identity.age_range ? `<p>Shared age range ${escape(state.identity.age_range)}</p>` : ''}
      ${state.identity.email ? `<p>Shared email ${escape(state.identity.email)}</p>` : ''}</details></section>
      <section><h2>Your notes</h2>${notes(store.read(owner,id,id,noteDataset),'own',()=>true)}${noteForm('own')}</section>
      <section><h2>Other app’s notes</h2>${otherPage ? notes(otherPage) : '<p>Access has not been granted.</p>'}</section>
      <section><h2>Shared folder</h2>${sharedPage ? notes(sharedPage,'shared',value=>value.author===id)+noteForm('shared') : '<p>Access has not been granted.</p>'}</section>
      <p><a href="${issuer}/samples">Other sample apps</a></p>`);
  };
}
