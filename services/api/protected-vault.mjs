// The pilot stores only ciphertext. The account credential cannot decrypt or approve device keys.
import {createPublicKey,randomBytes,verify} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const identifier=/^[A-Za-z0-9_-]{1,100}$/;
const envelopeSize=96*1024;
const lifetime=5*60_000;
const requestId=()=>randomBytes(32).toString('base64url');
const same=(first,second)=>JSON.stringify(first)===JSON.stringify(second);

function bytes(value,length){
  if(typeof value!=='string'||!value.length||value.length>Math.ceil(length*4/3)||!/^[A-Za-z0-9_-]+$/.test(value))return null;
  const data=Buffer.from(value,'base64url');
  return data.length<=length&&data.toString('base64url')===value?data:null;
}

function validEnvelope(value,max){
  if(!value||Object.keys(value).length!==3||value.version!==1||bytes(value.iv,12)?.length!==12)return false;
  return (bytes(value.data,max)?.length??0)>=16;
}

function publicKey(value){
  const raw=bytes(value,65);
  if(raw?.length!==65||raw[0]!==4)return null;
  try{return createPublicKey({format:'jwk',key:{kty:'EC',crv:'P-256',x:raw.subarray(1,33).toString('base64url'),y:raw.subarray(33).toString('base64url')}});}
  catch{return null;}
}

function matchesSignature(key,signature,message){
  const signatureBytes=bytes(signature,64);
  return signatureBytes?.length===64&&verify('sha256',Buffer.from(JSON.stringify(message)),{key,dsaEncoding:'ieee-p1363'},signatureBytes);
}

const signedApproval=({scope,requestId,target,mode,expiry,packet})=>[
  'xcenter-protected-v1','signed approval',...scope,requestId,target,mode,String(expiry),packet.sender,packet.envelope.iv,packet.envelope.data,
];

export function openProtectedVault({database,issuer,canProtectAppData,remaining=()=>10485760,now=Date.now}){
  const db=new DatabaseSync(database);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS protected_vaults(owner TEXT PRIMARY KEY,vault TEXT NOT NULL UNIQUE,recovery TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS protected_devices(owner TEXT NOT NULL REFERENCES protected_vaults(owner) ON DELETE CASCADE,
      signer TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(owner,signer)) STRICT;
    CREATE TABLE IF NOT EXISTS protected_revocations(owner TEXT PRIMARY KEY REFERENCES protected_vaults(owner) ON DELETE CASCADE,
      nonce TEXT NOT NULL, signer TEXT NOT NULL, target TEXT NOT NULL, expires INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS protected_requests(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES protected_vaults(owner) ON DELETE CASCADE,
      namespace TEXT NOT NULL,session TEXT NOT NULL,target TEXT NOT NULL,expires INTEGER NOT NULL,approval TEXT,
      targetSigner TEXT) STRICT;
    CREATE INDEX IF NOT EXISTS protected_requests_owner ON protected_requests(owner);
    CREATE TABLE IF NOT EXISTS protected_objects(owner TEXT NOT NULL REFERENCES protected_vaults(owner) ON DELETE CASCADE,
      namespace TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,envelope TEXT NOT NULL,
      PRIMARY KEY(owner,namespace,id)) STRICT;
  `);
  const query=sql=>db.prepare(sql);
  const usage=query('SELECT coalesce(sum(length(envelope)+512),0) AS bytes FROM protected_objects WHERE owner=?');
  const vault=owner=>query('SELECT * FROM protected_vaults WHERE owner=?').get(owner);
  const signer=(owner,value)=>query('SELECT signer FROM protected_devices WHERE owner=? AND signer=?').get(owner,value)&&publicKey(value);
  function transaction(fn){
    db.exec('BEGIN IMMEDIATE');
    try{const result=fn();db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }
  const namespaceAllowed=(owner,namespace)=>namespace==='private'||(namespace!=='device-root'&&
    typeof namespace==='string'&&identifier.test(namespace)&&canProtectAppData(owner,namespace));
  const requestAllowed=(owner,namespace,targetSigner)=>targetSigner?namespace==='device-root':namespaceAllowed(owner,namespace);
  const scoped=(owner,row)=>[issuer,vault(owner).vault,row.namespace,...(row.targetSigner?[row.targetSigner]:[])];
  function request(owner,namespace,session,target,targetSigner=null){
    if(!vault(owner)||!requestAllowed(owner,namespace,targetSigner)||!session||!publicKey(target)||targetSigner&&!publicKey(targetSigner))return null;
    return transaction(()=>{
      const time=now();
      query('DELETE FROM protected_requests WHERE expires<=?').run(time);
      if(query('SELECT count(*) AS count FROM protected_requests WHERE owner=?').get(owner).count>=10)return null;
      const id=requestId(),expires=time+lifetime;
      query('INSERT INTO protected_requests VALUES(?,?,?,?,?,?,NULL,?)').run(id,owner,namespace,session,target,expires,targetSigner);
      return {id,expires,target,scope:scoped(owner,{namespace,targetSigner})};
    });
  }
  return {
    create(owner,id,recovery,device){
      if(bytes(id,32)?.length!==32||!validEnvelope(recovery,48)||bytes(recovery.data,48)?.length!==48||!publicKey(device))return false;
      return transaction(()=>{
        const created=query('INSERT OR IGNORE INTO protected_vaults VALUES(?,?,?)').run(owner,id,JSON.stringify(recovery));
        if(!created.changes)return false;
        query('INSERT INTO protected_devices VALUES(?,?,?)').run(owner,device,now());
        return true;
      });
    },
    info(owner){
      const row=vault(owner);
      return row?{id:row.vault,recovery:JSON.parse(row.recovery)}:null;
    },
    requestWeb:(owner,namespace,session,target)=>request(owner,namespace,session,target),
    requestDevice:(owner,session,target,targetSigner)=>targetSigner&&request(owner,'device-root',session,target,targetSigner),
    pending(owner,device){
      if(!signer(owner,device))return [];
      return query('SELECT id,namespace,target,expires,targetSigner FROM protected_requests WHERE owner=? AND expires>? AND approval IS NULL ORDER BY expires')
        .all(owner,now()).map(row=>({id:row.id,target:row.target,expires:row.expires,scope:scoped(owner,row),mode:row.targetSigner?'device':'web'}));
    },
    approve(owner,device,approval,signature){
      const key=signer(owner,device);
      const id=approval?.requestId;
      if(!key||typeof id!=='string'||!publicKey(approval?.packet?.sender)||!validEnvelope(approval.packet?.envelope,48)||
        bytes(approval.packet.envelope.data,48)?.length!==48)return false;
      return transaction(()=>{
        const row=query('SELECT * FROM protected_requests WHERE id=? AND owner=? AND expires>? AND approval IS NULL').get(id,owner,now());
        if(!row||!requestAllowed(owner,row.namespace,row.targetSigner)||approval.mode!==(row.targetSigner?'device':'web')||approval.target!==row.target||
          approval.expiry!==row.expires||!same(approval.scope,scoped(owner,row))||
          !matchesSignature(key,signature,signedApproval(approval)))return false;
        const packet={requestId:id,scope:approval.scope,target:row.target,mode:approval.mode,expiry:row.expires,
          packet:{sender:approval.packet.sender,envelope:approval.packet.envelope},signature,device};
        query('UPDATE protected_requests SET approval=? WHERE id=?').run(JSON.stringify(packet),id);
        return true;
      });
    },
    claim(owner,id,session,{signature}={}){
      return transaction(()=>{
        const row=query('SELECT * FROM protected_requests WHERE id=? AND owner=? AND session=? AND expires>? AND approval IS NOT NULL')
          .get(id,owner,session,now());
        if(!row||!requestAllowed(owner,row.namespace,row.targetSigner))return null;
        const approval=JSON.parse(row.approval);
        if(!signer(owner,approval.device))return null;
        if(row.targetSigner){
          const proof=['xcenter-protected-v1','claim device',...approval.scope,row.id,row.target];
          const key=publicKey(row.targetSigner);
          if(!key||!matchesSignature(key,signature,proof))return null;
          if(!signer(owner,row.targetSigner)&&query('SELECT count(*) AS total FROM protected_devices WHERE owner=?').get(owner).total>=8)return null;
          query('INSERT OR IGNORE INTO protected_devices VALUES(?,?,?)').run(owner,row.targetSigner,now());
        }
        query('DELETE FROM protected_requests WHERE id=?').run(id);
        return approval;
      });
    },
    devices(owner){
      return query('SELECT signer,created FROM protected_devices WHERE owner=? ORDER BY created,signer').all(owner);
    },
    prepareRevocation(owner,device,target){
      if(typeof device!=='string'||typeof target!=='string'||!signer(owner,device)||!signer(owner,target)||device===target)return null;
      const nonce=requestId(),expires=now()+lifetime,scope=[issuer,vault(owner).vault];
      query('INSERT OR REPLACE INTO protected_revocations VALUES(?,?,?,?,?)').run(owner,nonce,device,target,expires);
      return {nonce,target,expires,scope};
    },
    revokeDevice(owner,{nonce,device,signature}){
      if(typeof nonce!=='string'||typeof device!=='string')return false;
      return transaction(()=>{
        const key=signer(owner,device);
        const op=query('SELECT * FROM protected_revocations WHERE owner=? AND nonce=? AND signer=? AND expires>?').get(owner,nonce,device,now());
        if(!key||!op||!matchesSignature(key,signature,['xcenter-protected-v1','revoke device',
          issuer,vault(owner).vault,nonce,op.target,String(op.expires)]))return false;
        query('DELETE FROM protected_revocations WHERE owner=?').run(owner);
        query("DELETE FROM protected_requests WHERE owner=? AND (targetSigner=? OR json_extract(approval,'$.device')=?)").run(owner,op.target,op.target);
        return query('DELETE FROM protected_devices WHERE owner=? AND signer=?').run(owner,op.target).changes===1;
      });
    },
    putObject(owner,{namespace,id,revision,envelope,device,signature}){
      const key=signer(owner,device);
      const current=vault(owner);
      if(!key||!current||!namespaceAllowed(owner,namespace)||typeof id!=='string'||!identifier.test(id)||
        !Number.isSafeInteger(revision)||revision<1||!validEnvelope(envelope,envelopeSize)||
        !matchesSignature(key,signature,['xcenter-protected-v1','object write',issuer,current.vault,namespace,id,
          String(revision),envelope.iv,envelope.data]))return false;
      return transaction(()=>{
        const previous=query('SELECT revision,length(envelope)+512 AS bytes FROM protected_objects WHERE owner=? AND namespace=? AND id=?').get(owner,namespace,id);
        const sealed=JSON.stringify(envelope);
        const increase=sealed.length+512-(previous?.bytes??0);
        if(revision!==(previous?.revision??0)+1||increase>0&&increase>remaining(owner))return false;
        query(`INSERT INTO protected_objects VALUES(?,?,?,?,?) ON CONFLICT(owner,namespace,id)
          DO UPDATE SET envelope=excluded.envelope,revision=excluded.revision`).run(owner,namespace,id,revision,sealed);
        return true;
      });
    },
    object(owner,namespace,id){
      if(!namespaceAllowed(owner,namespace)||typeof id!=='string'||!identifier.test(id))return null;
      const row=query('SELECT revision,envelope FROM protected_objects WHERE owner=? AND namespace=? AND id=?').get(owner,namespace,id);
      return row?{revision:row.revision,envelope:JSON.parse(row.envelope)}:null;
    },
    usage:owner=>usage.get(owner).bytes,
    removeOwner:owner=>query('DELETE FROM protected_vaults WHERE owner=?').run(owner),
    close:()=>db.close(),
  };
}
