import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openOidcStore } from './oidc-store.mjs';

test('renewal extends a live grant without overwriting its scope or restoring a revoked grant',async()=>{
  const Adapter=openOidcStore(':memory:',Buffer.alloc(32,44));
  const grants=new Adapter('Grant');
  const ttl=14*86400;
  await grants.upsert('fixture-grant',{openid:{scope:'openid offline_access'},exp:Math.floor(Date.now()/1000)+60},60);
  assert.equal(grants.renewGrant('fixture-grant',ttl),true);
  const renewed=await grants.find('fixture-grant');
  assert.equal(renewed.openid.scope,'openid offline_access');
  assert.ok(renewed.exp>=Math.floor(Date.now()/1000)+ttl-1);
  await grants.destroy('fixture-grant');
  assert.equal(grants.renewGrant('fixture-grant',ttl),false);
  assert.equal(await grants.find('fixture-grant'),undefined);
});

test('only one concurrent consumer claims a refresh token and replay identifies its grant',async()=>{
  const Adapter=openOidcStore(':memory:',Buffer.alloc(32,45));
  const tokens=new Adapter('RefreshToken');
  await tokens.upsert('fixture-token',{grantId:'fixture-grant'},60);
  const attempts=await Promise.allSettled([tokens.consume('fixture-token'),tokens.consume('fixture-token')]);
  assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1);
  const rejected=attempts.find(result=>result.status==='rejected');
  assert.equal(rejected.reason.code,'already_consumed');
  assert.equal(rejected.reason.grantId,'fixture-grant');
});
