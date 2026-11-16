import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApi } from './server.mjs';
import { openStore } from './store.mjs';

test('registered apps can share only their account data and only while a grant permits it', async () => {
  const store = openStore(':memory:', randomBytes(32));
  const identities = new Map([
    ['alice-source', { owner: 'alice', client: 'source' }],
    ['alice-destination', { owner: 'alice', client: 'destination' }],
    ['alice-console', { owner: 'alice', client: 'console' }],
    ['bob-source', { owner: 'bob', client: 'source' }],
  ]);
  const server = createApi({ store, apps: new Set(['source', 'destination']), consoleClient: 'console',
    authenticate: (req) => identities.get(req.headers.authorization),
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    function call(client, path, method = 'GET', body, revision) {
      return fetch(`http://127.0.0.1:${server.address().port}/v1/${path}`, {
        method, headers: { authorization: client, 'content-type': 'application/json', ...(revision ? { 'if-match': revision } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }
    const records = 'records/saved-place';
    const value = { label: 'Piazza', latitude: 41.9, longitude: 12.5 };
    const created = await call('alice-source', records, 'POST', value);
    assert.equal(created.status, 201);
    const { id } = await created.json();
    assert.equal((await call('alice-source', records, 'POST', { ...value, latitude: 91 })).status, 422);
    const grant = { source: 'source', destination: 'destination', expires: Date.now() + 60_000 };
    assert.equal((await call('alice-destination', `${records}?source=source`)).status, 403);
    assert.equal((await call('alice-source', 'grants', 'PUT', grant)).status, 403);
    assert.equal((await call('alice-console', 'grants', 'PUT', grant)).status, 200);
    assert.deepEqual((await (await call('alice-destination', `${records}?source=source`)).json()).records[0].value, value);
    assert.deepEqual((await (await call('bob-source', records)).json()).records, []);
    assert.equal((await call('bob-source', `${records}/${id}`, 'DELETE')).status, 404);
    assert.equal((await call('alice-destination', `${records}/${id}`, 'DELETE')).status, 404);
    assert.equal((await call('alice-console', 'grants', 'DELETE', grant)).status, 200);
    assert.equal((await call('alice-destination', `${records}?source=source`)).status, 403);
    assert.equal((await call('unknown', records)).status, 401);
    assert.equal((await call('alice-source', `${records}/${id}`, 'PUT', value)).status, 428);
    const updated = await call('alice-source', `${records}/${id}`, 'PUT', { ...value, label: 'Updated' }, '"1"');
    assert.deepEqual(await updated.json(), { id, revision: 2 });
    assert.equal((await call('alice-source', `${records}/${id}`, 'PUT', value, '"1"')).status, 412);
    assert.equal((await call('alice-source', `${records}?after=${id}`)).status, 200);
    assert.equal((await call('alice-source', `${records}/${id}`, 'DELETE')).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

test('record payload is encrypted at rest and authenticates its context and key', () => {
  const directory = mkdtempSync(join(tmpdir(), 'authnjs-store-'));
  const path = join(directory, 'records.sqlite');
  const key = randomBytes(32);
  const label = 'unique synthetic record content';
  try {
    const store = openStore(path, key);
    store.create('alice', 'source', 'dataset', { label });
    store.close();
    assert.ok(!readFileSync(path).includes(Buffer.from(label)));
    const wrong = openStore(path, randomBytes(32));
    try {
      assert.throws(() => wrong.read('alice', 'source', 'source', 'dataset'));
    } finally {
      wrong.close();
    }
    const raw = new DatabaseSync(path);
    raw.exec("UPDATE records SET owner = 'bob'");
    raw.close();
    const moved = openStore(path, key);
    try {
      assert.throws(() => moved.read('bob', 'source', 'source', 'dataset'));
    } finally {
      moved.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('signed tokens require the configured issuer, audience, time and user scope', async () => {
  const { generateKeyPair, SignJWT } = await import('jose');
  const { createAuthenticator } = await import('./server.mjs');
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const issuer = 'https://issuer.example.test';
  const audience = 'authnjs-api';
  const authenticate = createAuthenticator({ issuer, audience, jwks: async () => publicKey, scope: 'authnjs-user' });
  const now = Math.floor(Date.now() / 1000);

  async function request(changes = {}, tokenIssuer = issuer, tokenAudience = audience, issued = now) {
    const token = await new SignJWT({ azp: 'source', typ: 'Bearer', scope: 'openid authnjs-user', ...changes })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(tokenIssuer)
      .setAudience(tokenAudience)
      .setSubject('alice')
      .setIssuedAt(issued)
      .setExpirationTime(now + 60)
      .sign(privateKey);
    return authenticate({ headers: { authorization: 'Bearer ' + token } });
  }

  assert.deepEqual(await request(), { owner: 'alice', client: 'source' });
  await assert.rejects(request({}, 'https://other.example.test'));
  await assert.rejects(request({}, issuer, 'other-api'));
  await assert.rejects(request({}, issuer, audience, now - 700));
  await assert.rejects(request({ typ: 'ID' }));
  await assert.rejects(request({ scope: 'openid' }));
});
