import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {test} from 'node:test';
import {
  acceptDeviceHandoff,createDeviceSigningKey,createDeviceStorageKey,createHandoffKey,
  createVault,decryptObject,encryptObject,signApproval,signDeviceClaim,signObjectWrite,wrapDeviceHandoff,
} from '../../packages/protected-storage/crypto.mjs';
import {openProtectedVault} from './protected-vault.mjs';

test('pilot stores opaque ciphertext and gates app data and web approval on current authorization',async t=>{
  let now=1000,appAllowed=false;
  const issuer='https://identity.example.test',owner='fixture-account';
  const service=openProtectedVault({database:':memory:',issuer,now:()=>now,
    canProtectAppData:(account,app)=>appAllowed&&account===owner&&app==='fixture-app'});
  t.after(()=>service.close());
  const id=randomBytes(32).toString('base64url');
  const first=await createDeviceSigningKey(), wrong=await createDeviceSigningKey();
  const storage=await createDeviceStorageKey(), browser=await createDeviceStorageKey();
  const recoveryScope=[issuer,id,'device-root'];
  const vault=await createVault(recoveryScope,storage);
  assert.equal(service.create(owner,id,vault.recoveryEnvelope,first.publicKey),true);
  assert.equal(service.create(owner,id,vault.recoveryEnvelope,wrong.publicKey),false);
  assert.equal(service.info('other'),null);
  const scope=[issuer,id,'fixture-app'];
  const appVault=await createVault(scope,storage);
  const revisionScope=[...scope,'fixture-object','1'];
  const plain=new TextEncoder().encode('synthetic private record');
  const envelope=await encryptObject(appVault.key,plain,revisionScope);
  const signature=await signObjectWrite(first.privateKey,revisionScope,envelope);
  const object={namespace:'fixture-app',id:'fixture-object',revision:1,envelope,signature,device:first.publicKey};
  assert.equal(service.putObject(owner,object),false);
  appAllowed=true;
  assert.equal(service.putObject(owner,{...object,device:wrong.publicKey}),false);
  assert.equal(service.putObject(owner,object),true);
  assert.equal(service.putObject(owner,object),false);
  const copy=service.object(owner,object.namespace,object.id);
  assert.deepEqual(copy,{revision:1,envelope});
  assert.equal(service.object('other',object.namespace,object.id),null);
  const receiver=await createHandoffKey();
  const session='browser-session';
  const request=service.requestWeb(owner,'fixture-app',session,receiver.publicKey);
  const packet=await wrapDeviceHandoff({deviceKey:storage,deviceEnvelope:appVault.deviceEnvelope,recipient:receiver.publicKey,scope,requestId:request.id});
  const approval={scope,requestId:request.id,target:request.target,mode:'web',expiry:request.expires,packet};
  const approveSignature=await signApproval(first.privateKey,approval);
  assert.equal(service.approve(owner,wrong.publicKey,approval,approveSignature),false);
  assert.equal(service.approve(owner,first.publicKey,{...approval,target:(await createHandoffKey()).publicKey},approveSignature),false);
  assert.equal(service.approve(owner,first.publicKey,approval,approveSignature),true);
  assert.equal(service.approve(owner,first.publicKey,approval,approveSignature),false);
  assert.equal(service.claim(owner,request.id,'wrong-session'),null);
  appAllowed=false;
  assert.equal(service.object(owner,object.namespace,object.id),null);
  assert.equal(service.claim(owner,request.id,session),null);
  appAllowed=true;
  const granted=service.claim(owner,request.id,session);
  assert.equal(service.claim(owner,request.id,session),null);
  const accepted=await acceptDeviceHandoff({deviceKey:browser,recipient:receiver,packet:granted.packet,scope,requestId:request.id});
  assert.deepEqual(await decryptObject(accepted.key,copy.envelope,revisionScope),plain);
  const newDevice=await createDeviceSigningKey();
  assert.equal(service.requestWeb(owner,'device-root',session,receiver.publicKey),null);
  const enrollment=service.requestDevice(owner,session,receiver.publicKey,newDevice.publicKey);
  assert.ok(service.pending(owner,first.publicKey).find(row=>row.id===enrollment.id));
  assert.deepEqual(service.pending(owner,wrong.publicKey),[]);
  const enrollmentPacket=await wrapDeviceHandoff({deviceKey:storage,deviceEnvelope:vault.deviceEnvelope,
    recipient:receiver.publicKey,scope:enrollment.scope,deviceScope:recoveryScope,requestId:enrollment.id});
  const enrollmentApproval={scope:enrollment.scope,requestId:enrollment.id,target:enrollment.target,mode:'device',
    expiry:enrollment.expires,packet:enrollmentPacket};
  assert.equal(service.approve(owner,first.publicKey,enrollmentApproval,await signApproval(first.privateKey,enrollmentApproval)),true);
  assert.equal(service.claim(owner,enrollment.id,session),null);
  const claim=await signDeviceClaim(newDevice.privateKey,enrollment.scope,enrollment.id,enrollment.target);
  const received=service.claim(owner,enrollment.id,session,{signature:claim});
  assert.ok(received);
  const enrolled=await acceptDeviceHandoff({deviceKey:browser,recipient:receiver,packet:received.packet,
    scope:enrollment.scope,deviceScope:recoveryScope,requestId:enrollment.id});
  const recoveryObject=[...recoveryScope,'example','1'];
  const protectedFile=await encryptObject(vault.key,plain,recoveryObject);
  assert.deepEqual(await decryptObject(enrolled.key,protectedFile,recoveryObject),plain);
  assert.equal(service.claim(owner,enrollment.id,session,{signature:claim}),null);
  const expired=service.requestWeb(owner,'private',session,receiver.publicKey);
  now=expired.expires;
  assert.equal(service.claim(owner,expired.id,session),null);
  service.removeOwner(owner);
  assert.equal(service.info(owner),null);
});
