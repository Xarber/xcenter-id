import { validateApplicationProfile } from './application-profile.mjs';
import { validateApplicationBrand } from './application-brand.mjs';
import { createServer } from 'node:http';
import { closeSync, mkdirSync, openSync, constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRemoteJWKSet, jwtVerify, errors } from 'jose';
import { openStore, untilRevoked } from './store.mjs';
import { openRegistry } from './registry.mjs';

const dataset = 'saved-place.v1';
const jsonLimit = 8192;
const maxGrantMs = 30 * 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

async function readJson(req,limit=jsonLimit) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
    throw new HttpError(415, 'expected_json');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      req.resume();
      throw new HttpError(413, 'payload_too_large');
    }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch {
    // Return the same error for malformed JSON and invalid top-level values.
  }
  throw new HttpError(400, 'invalid_json');
}

function savedPlace(body) {
  const { label, latitude, longitude } = body;
  if (typeof label !== 'string' || !label.trim() || label.length > 160 ||
      !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new HttpError(422, 'invalid_saved_place');
  }
  return { label: label.trim(), latitude, longitude };
}

export function createApiHandler({ store, authenticate, apps, consoleClient, developerClient, registry, allowPersistentGrants = false, canGrant = () => true }) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const method = req.method;
      if (method === 'GET' && url.pathname === '/health') return json(res, 200, { status: 'ok' });
      const brandId=/^\/v1\/developer\/apps\/([0-9a-f-]{36})\/(brand|profile|permissions)$/.exec(url.pathname);
      const developerRoute = url.pathname === '/v1/developer/apps' || !!brandId || url.pathname==='/v1/developer/profile';
      const consoleRoute = url.pathname === '/v1/grants';
      const recordRoute = url.pathname === '/v1/records/saved-place';
      const recordId = url.pathname.match(/^\/v1\/records\/saved-place\/([^/]+)$/)?.[1];
      if (!developerRoute && !consoleRoute && !recordRoute && !recordId) throw new HttpError(404, 'not_found');
      const principal = await authenticate(req);
      if (!principal?.owner || !principal.client) throw new HttpError(401, 'invalid_token');
      const { owner, client } = principal;
      if (developerRoute) {
        if (!registry || client !== developerClient || principal.developer !== true) throw new HttpError(403, 'forbidden');
        if(url.pathname==='/v1/developer/profile'){
          if(method==='GET')return json(res,200,registry.developer(owner));
          if(method!=='POST')throw new HttpError(405,'method_not_allowed');
          const input=await readJson(req);
          const name=typeof input.name==='string'?input.name.trim():'';
          if(!name||name.length>80||/[\p{Cc}\p{Cf}]/u.test(name))throw new HttpError(422,'Enter a developer display name.');
          const developer=registry.saveDeveloper(owner,name,input.requestVerification===true);
          if(!developer)throw new HttpError(422,'Add a public GitHub repository to an active app before requesting review.');
          return json(res,200,developer);
        }
        if (brandId) {
          if(method!=='PUT')throw new HttpError(405,'method_not_allowed');
          const input=await readJson(req,64_000);
          const [ ,id,kind]=brandId;
          if(kind==='permissions'){
            if(typeof input.email!=='boolean'||typeof input.age_range!=='boolean')throw new HttpError(422,'Choose whether each permission is required.');
            const requirements=registry.saveRequirements(owner,id,input);
            if(!requirements)throw new HttpError(404,'registration_unavailable');
            return json(res,200,{requirements});
          }
          if(kind==='profile'){
            const profile=await validateApplicationProfile(input).catch(error=>{throw new HttpError(422,error.message);});
            const item=registry.saveApp(owner,id,profile);
            if(!item)throw new HttpError(422,'Keep the verified callback origin or register a new app.');
            return json(res,200,item);
          }
          const brand=await validateApplicationBrand(input).catch(()=>{throw new HttpError(422,'invalid_app_brand');});
          if(!registry.updateBrand(owner,id,brand))throw new HttpError(404,'registration_unavailable');
          return json(res,200,brand);
        }
        if (method === 'GET') return json(res, 200, { apps: registry.list(owner) });
        if (method !== 'POST') throw new HttpError(405, 'method_not_allowed');
        const input=await readJson(req,64_000);
        const profile=await validateApplicationProfile(input).catch(error=>{throw new HttpError(422,error.message);});
        const app=registry.submit(owner,profile.name,profile.callbacks[0],{icon:profile.icon,developerName:profile.developerName},input.native===true,profile);
        if (!app) throw new HttpError(409, 'registration_quota_reached');
        return json(res, 201, app);
      }
      if (consoleRoute) {
        if (client !== consoleClient) throw new HttpError(403, 'forbidden');
        if (method === 'GET') return json(res, 200, { grants: store.listGrants(owner).filter(({source,destination})=>canGrant(owner,source,destination)) });
        if (method !== 'PUT' && method !== 'DELETE') throw new HttpError(405, 'method_not_allowed');
        const { source, destination, expires, persistent } = await readJson(req);
        if (!apps.has(source) || !apps.has(destination) || source === destination) {
          throw new HttpError(422, 'invalid_grant');
        }
        if (method === 'DELETE') {
          store.revoke(owner, source, destination, dataset);
          return json(res, 200, { revoked: true });
        }
        if (!canGrant(owner,source,destination)) throw new HttpError(409, 'app_unlinked');
        const now = Date.now();
        const permanent = persistent === true && allowPersistentGrants;
        if (!permanent && (!Number.isSafeInteger(expires) || expires <= now || expires > now + maxGrantMs)) {
          throw new HttpError(422, 'invalid_expiry');
        }
        const expiry = permanent ? untilRevoked : expires;
        store.grant(owner, source, destination, dataset, expiry);
        return json(res, 200, { source, destination, dataset, expires:expiry });
      }

      if (!apps.has(client) || (registry && principal.confidential !== true)) throw new HttpError(403, 'forbidden');
      if (recordId) {
        if (!uuid.test(recordId)) throw new HttpError(404, 'not_found');
        if (method === 'PUT') {
          const revision = /^"([1-9][0-9]*)"$/.exec(req.headers['if-match'] ?? '')?.[1];
          if (!revision || !Number.isSafeInteger(Number(revision)) || Number(revision) >= Number.MAX_SAFE_INTEGER) {
            throw new HttpError(428, 'expected_revision');
          }
          const updated = store.update(owner, client, dataset, recordId, Number(revision), savedPlace(await readJson(req)));
          if (!updated) throw new HttpError(412, 'revision_mismatch');
          return json(res, 200, updated);
        }
        if (method !== 'DELETE') throw new HttpError(405, 'method_not_allowed');
        if (!store.remove(owner, client, dataset, recordId)) throw new HttpError(404, 'not_found');
        return json(res, 200, { deleted: true });
      }
      if (method === 'POST') {
        const created = store.create(owner, client, dataset, savedPlace(await readJson(req)));
        if (!created) throw new HttpError(409, 'dataset_quota_reached');
        return json(res, 201, created);
      }
      if (method === 'GET') {
        const source = url.searchParams.get('source') ?? client;
        if (!apps.has(source)) throw new HttpError(404, 'not_found');
        const after = url.searchParams.get('after');
        if (after !== null && !uuid.test(after)) throw new HttpError(422, 'invalid_cursor');
        const page = store.read(owner, source, client, dataset, after ?? '');
        if (page === null) throw new HttpError(403, 'consent_required');
        return json(res, 200, page);
      }
      throw new HttpError(405, 'method_not_allowed');
    } catch (error) {
      if (error instanceof HttpError) return json(res, error.status, { error: error.message });
      if (error instanceof errors.JOSEError) return json(res, 401, { error: 'invalid_token' });
      console.error(JSON.stringify({ event: 'request_failed', kind: error?.constructor?.name }));
      return json(res, 500, { error: 'internal_error' });
    }
  };
}

export function createApi(options) {
  return createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, createApiHandler(options));
}

function required(env, name) {
  if (!env[name]) throw new Error(`Missing ${name}`);
  return env[name];
}

function httpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) {
    throw new Error('Expected an HTTPS identity endpoint');
  }
  return url;
}

export function createAuthenticator({ issuer, audience, jwks, scope }) {
  return async (req) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match) throw new HttpError(401, 'missing_token');
    const { payload } = await jwtVerify(match[1], jwks, {
      issuer, audience, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat', 'azp'],
      maxTokenAge: '10m',
    });
    if (payload.typ !== 'Bearer' || typeof payload.azp !== 'string' || !payload.azp || !payload.sub ||
        typeof payload.scope !== 'string' || !payload.scope.split(/\s+/).includes(scope)) {
      throw new HttpError(401, 'invalid_token');
    }
    return {
      owner: payload.sub,
      client: payload.azp,
      developer: payload.authnjs_developer === true,
      confidential: payload.authnjs_confidential === true,
    };
  };
}

function start(env) {
  const issuer = required(env, 'AUTHNJS_ISSUER');
  httpsUrl(issuer);
  const jwks = createRemoteJWKSet(httpsUrl(required(env, 'AUTHNJS_JWKS_URL')));
  const audience = required(env, 'AUTHNJS_AUDIENCE');
  const consoleClient = required(env, 'AUTHNJS_CONSOLE_CLIENT');
  const developerClient = required(env, 'AUTHNJS_DEVELOPER_CLIENT');
  if (developerClient === consoleClient) throw new Error('Use separate developer and account console clients');
  const keyHex = required(env, 'AUTHNJS_DATA_KEY_HEX');
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) throw new Error('Invalid data key');
  const directory = resolve(required(env, 'AUTHNJS_DATA_DIR'));
  mkdirSync(directory, { mode: 0o700, recursive: true });
  const databasePath = join(directory, 'authnjs.sqlite');
  closeSync(openSync(databasePath, constants.O_CREAT | constants.O_NOFOLLOW | constants.O_RDWR, 0o600));
  const store = openStore(databasePath, Buffer.from(keyHex, 'hex'));
  const authenticate = createAuthenticator({
    issuer, audience, jwks, scope: required(env, 'AUTHNJS_USER_SCOPE'),
  });
  const registry = openRegistry(databasePath);
  const apps = { has: (client) => client !== consoleClient && client !== developerClient && registry.has(client) };
  createApi({ store, authenticate, apps, consoleClient, developerClient, registry })
    .listen(Number(env.AUTHNJS_PORT ?? 8787), '127.0.0.1', () => console.log('AuthNJS API listening'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) start(process.env);
