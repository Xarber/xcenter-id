import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPasskeyLabelResolver, passkeyLabel } from './passkey-label.mjs';

test('uses the cached provider name and handles anonymous and unavailable authenticators',async()=>{
  const id='fcb1bcb4-f370-472f-8274-ef26a54f7bb0';
  let calls=0;
  const suggest=createPasskeyLabelResolver({fetchCatalog:async()=>{
    calls++;
    return Response.json({ [id]:{name:' Example provider '}, invalid:{name:'Ignore'} });
  }});
  assert.equal(await suggest({aaguid:id}), 'Example provider');
  assert.equal(await suggest({aaguid:id.toUpperCase()}), 'Example provider');
  assert.equal(await suggest({aaguid:'00000000-0000-0000-0000-000000000000',transports:['usb']}), 'Security key');
  assert.equal(calls,1);
  const offline=createPasskeyLabelResolver({fetchCatalog:async()=>{throw new Error('offline');}});
  assert.equal(await offline({aaguid:id}),'Passkey');
  assert.equal(passkeyLabel(' Work key '),'Work key');
  assert.equal(passkeyLabel('Invalid\nname'),null);
});
