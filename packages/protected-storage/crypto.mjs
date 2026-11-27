// Keep every operation that handles plaintext or unwrapped keys on the trusted client.
const utf8 = new TextEncoder();
const b64 = bytes => Array.from(new Uint8Array(bytes), byte => String.fromCharCode(byte)).join('');
const encode = bytes => btoa(b64(bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function decode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError('Invalid encoded bytes.');
  const bytes = Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')), character => character.charCodeAt(0));
  if (encode(bytes) !== value) throw new TypeError('Invalid encoded bytes.');
  return bytes;
}
const context = (purpose, ...scope) => utf8.encode(JSON.stringify(['xcenter-protected-v1', purpose, ...scope]));
const aes = (bytes, extractable=false) => crypto.subtle.importKey('raw',bytes,'AES-GCM',extractable,['encrypt','decrypt']);
const random = size => crypto.getRandomValues(new Uint8Array(size));
function checkScope(scope) {
  if (!Array.isArray(scope) || !scope.length || !scope.every(value => typeof value === 'string' && value.length > 0)) {
    throw new TypeError('Protected storage requires an explicit scope.');
  }
}

async function seal(key, plaintext, aad) {
  const iv = random(12);
  const data = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,plaintext);
  return {version:1,iv:encode(iv),data:encode(data)};
}

async function open(key, envelope, aad) {
  if (envelope?.version !== 1) throw new TypeError('Unsupported protected envelope.');
  const iv = decode(envelope.iv);
  if (iv.length !== 12) throw new TypeError('Invalid protected nonce.');
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,decode(envelope.data)));
}

export function createDeviceStorageKey() {
  return crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

export async function createVault(scope, deviceKey) {
  checkScope(scope);
  const secret = random(32);
  const recovery = random(32);
  try {
    const key = await aes(secret);
    const recoveryEnvelope = await seal(await aes(recovery),secret,context('recovery',...scope));
    const deviceEnvelope = deviceKey ? await seal(deviceKey,secret,context('device',...scope)) : undefined;
    return {key,recoveryKey:encode(recovery),recoveryEnvelope,deviceEnvelope};
  } finally {
    secret.fill(0);
    recovery.fill(0);
  }
}

export async function recoverVault(recoveryKey, envelope, scope, deviceKey) {
  checkScope(scope);
  const recovery = decode(recoveryKey.trim());
  if (recovery.length !== 32) throw new TypeError('Enter the full recovery key.');
  try {
    const secret = await open(await aes(recovery),envelope,context('recovery',...scope));
    try {
      const key = await aes(secret);
      if (!deviceKey) return key;
      return {key,deviceEnvelope:await seal(deviceKey,secret,context('device',...scope))};
    } finally { secret.fill(0); }
  } finally { recovery.fill(0); }
}

export async function createHandoffKey() {
  const pair = await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
  return {privateKey:pair.privateKey,publicKey:encode(await crypto.subtle.exportKey('raw',pair.publicKey))};
}

async function handoffKey(privateKey, publicKey, scope) {
  const peer = await crypto.subtle.importKey('raw',decode(publicKey),{name:'ECDH',namedCurve:'P-256'},false,[]);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:peer},privateKey,256));
  try {
    const hkdf = await crypto.subtle.importKey('raw',secret,'HKDF',false,['deriveKey']);
    return await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(32),
      info:context('handoff key',...scope)},hkdf,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  } finally { secret.fill(0); }
}

// The caller must authenticate both devices and bind the recipient key to the approved request.
export async function wrapDeviceHandoff({deviceKey,deviceEnvelope,recipient,scope,requestId,deviceScope=scope}) {
  checkScope([...scope,requestId,recipient]);
  const sender = await createHandoffKey();
  const binding = [...scope,requestId,sender.publicKey,recipient];
  const shared = await handoffKey(sender.privateKey,recipient,binding);
  const secret = await open(deviceKey,deviceEnvelope,context('device',...deviceScope));
  try { return {sender:sender.publicKey,envelope:await seal(shared,secret,context('handoff',...binding))}; }
  finally { secret.fill(0); }
}

export async function acceptDeviceHandoff({deviceKey,recipient,packet,scope,requestId,deviceScope=scope}) {
  checkScope([...scope,requestId,packet.sender,recipient.publicKey]);
  const binding = [...scope,requestId,packet.sender,recipient.publicKey];
  const shared = await handoffKey(recipient.privateKey,packet.sender,binding);
  const secret = await open(shared,packet.envelope,context('handoff',...binding));
  try {
    return {key:await aes(secret),deviceEnvelope:await seal(deviceKey,secret,context('device',...deviceScope))};
  } finally { secret.fill(0); }
}

export function encryptObject(key, plaintext, scope) {
  checkScope(scope);
  return seal(key,plaintext,context('object',...scope));
}

export function decryptObject(key, envelope, scope) {
  checkScope(scope);
  return open(key,envelope,context('object',...scope));
}

export async function createDeviceSigningKey() {
  const pair = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  return {privateKey:pair.privateKey,publicKey:encode(await crypto.subtle.exportKey('raw',pair.publicKey))};
}

function approvalMessage({scope,requestId,target,mode,expiry,packet}) {
  checkScope([...scope,requestId,target,packet.sender]);
  if (!['device','web'].includes(mode) || !Number.isSafeInteger(expiry) || expiry<=0 ||
      packet.envelope?.version!==1) throw new TypeError('Invalid device approval.');
  return context('signed approval',...scope,requestId,target,mode,String(expiry),packet.sender,packet.envelope.iv,packet.envelope.data);
}

export async function signApproval(privateKey, approval) {
  return encode(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,approvalMessage(approval)));
}

export async function verifyApproval(publicKey, signature, approval, {now=Date.now(),maxLifetime=300000}={}) {
  if (approval.expiry<=now || approval.expiry-now>maxLifetime) return false;
  const trusted = await crypto.subtle.importKey('raw',decode(publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},trusted,decode(signature),approvalMessage(approval));
}

export async function signObjectWrite(privateKey, scope, envelope) {
  checkScope(scope);
  if(scope.length!==5||envelope.version!==1) throw new TypeError('Invalid object write.');
  const message=context('object write',...scope,envelope.iv,envelope.data);
  return encode(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,message));
}

export async function signDeviceClaim(privateKey, scope, requestId, target) {
  checkScope([...scope,requestId,target]);
  return encode(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,
    context('claim device',...scope,requestId,target)));
}

export async function deriveVaultScope(deviceKey, rootEnvelope, rootScope, namespace) {
  checkScope([...rootScope,namespace]);
  if(rootScope.length!==3||rootScope[2]!=='device-root'||namespace==='device-root'){
    throw new TypeError('Choose a protected collection for this vault.');
  }
  const scope=[rootScope[0],rootScope[1],namespace];
  const root=await open(deviceKey,rootEnvelope,context('device',...rootScope));
  try {
    const hkdf=await crypto.subtle.importKey('raw',root,'HKDF',false,['deriveBits']);
    const bytes=new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',
      salt:new Uint8Array(32),info:context('collection key',...scope)},hkdf,256));
    try { return {key:await aes(bytes),deviceEnvelope:await seal(deviceKey,bytes,context('device',...scope))}; }
    finally { bytes.fill(0); }
  } finally { root.fill(0); }
}
