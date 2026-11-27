import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createVault,recoverVault,encryptObject,decryptObject,createDeviceStorageKey,createHandoffKey,wrapDeviceHandoff,acceptDeviceHandoff,createDeviceSigningKey,signApproval,verifyApproval} from './crypto.mjs';

test('a fresh client can recover ciphertext only with the matching recovery key and account',async()=>{
  const account=['https://issuer.example.test','test-account','vault'];
  const object=[...account,'record-id','1'];
  const other=[...object.slice(0,-1),'2'];
  const first=await createVault(account);
  const second=await createVault(account);
  const plaintext=new TextEncoder().encode('Private backup data');
  const ciphertext=await encryptObject(first.key,plaintext,object);
  assert.notDeepEqual(await encryptObject(first.key,plaintext,object),ciphertext);
  assert.equal(first.key.extractable,false);
  assert.equal(JSON.stringify(ciphertext).includes('Private backup data'),false);
  const restored=await recoverVault(first.recoveryKey,first.recoveryEnvelope,account);
  assert.equal(restored.extractable,false);
  assert.deepEqual(await decryptObject(restored,ciphertext,object),plaintext);
  await assert.rejects(recoverVault(second.recoveryKey,first.recoveryEnvelope,account));
  await assert.rejects(recoverVault(first.recoveryKey,first.recoveryEnvelope,[account[0],'another-account','vault']));
  await assert.rejects(decryptObject(restored,ciphertext,other));
  const corrupted={...ciphertext,data:(ciphertext.data[0]==='A'?'B':'A')+ciphertext.data.slice(1)};
  await assert.rejects(decryptObject(restored,corrupted,object));
});

test('a handoff envelope binds its account scope, ephemeral destination key and request',async()=>{
  const scope=['https://issuer.example.test','test-account','app-collection'];
  const deviceKey=await createDeviceStorageKey();
  const targetDeviceKey=await createDeviceStorageKey();
  const recipient=await createHandoffKey();
  const different=await createHandoffKey();
  const vault=await createVault(scope,deviceKey);
  const packet=await wrapDeviceHandoff({deviceKey,deviceEnvelope:vault.deviceEnvelope,
    recipient:recipient.publicKey,scope,requestId:'request'});
  const accept={deviceKey:targetDeviceKey,recipient,packet,scope,requestId:'request'};
  const received=await acceptDeviceHandoff(accept);
  const object=[...scope,'object'];
  const bytes=new Uint8Array([1,2,3]);
  assert.deepEqual(await decryptObject(received.key,await encryptObject(vault.key,bytes,object),object),bytes);
  await assert.rejects(acceptDeviceHandoff({...accept,requestId:'other'}));
  await assert.rejects(acceptDeviceHandoff({...accept,recipient:different}));
  await assert.rejects(acceptDeviceHandoff({...accept,scope:[...scope,'another-collection']}));
});

test('the registered signer approves the exact scope, purpose, packet and deadline',async()=>{
  const trusted=await createDeviceSigningKey(), stranger=await createDeviceSigningKey();
  const target=await createHandoffKey();
  const scope=['https://issuer.example.test','test-account','protected-notes'];
  const host=await createDeviceStorageKey();
  const vault=await createVault(scope,host);
  const requestId='approval-test',now=1000;
  const packet=await wrapDeviceHandoff({deviceKey:host,deviceEnvelope:vault.deviceEnvelope,
    recipient:target.publicKey,scope,requestId});
  const approval={scope,requestId,target:target.publicKey,mode:'web',expiry:now+100,packet};
  const signature=await signApproval(trusted.privateKey,approval);
  assert.equal(await verifyApproval(trusted.publicKey,signature,approval,{now}),true);
  assert.equal(await verifyApproval(trusted.publicKey,signature,{...approval,mode:'device'},{now}),false);
  assert.equal(await verifyApproval(trusted.publicKey,signature,{...approval,requestId:'other'},{now}),false);
  assert.equal(await verifyApproval(trusted.publicKey,signature,approval,{now:now+100}),false);
  assert.equal(await verifyApproval(stranger.publicKey,signature,approval,{now}),false);
});
