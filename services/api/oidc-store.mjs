import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function openOidcStore(path, key) {
  if (key.length !== 32) throw new Error('OIDC storage requires a 32-byte key');
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS oidc_objects (
      model TEXT NOT NULL, id TEXT NOT NULL, grant_id TEXT, uid TEXT, user_code TEXT,
      expires INTEGER NOT NULL, consumed INTEGER, payload BLOB NOT NULL, PRIMARY KEY(model,id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS oidc_by_grant ON oidc_objects(grant_id);
    CREATE INDEX IF NOT EXISTS oidc_by_uid ON oidc_objects(model,uid);
    CREATE INDEX IF NOT EXISTS oidc_by_code ON oidc_objects(model,user_code);
  `);
  const put = db.prepare(`INSERT INTO oidc_objects(model,id,grant_id,uid,user_code,expires,payload) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(model,id) DO UPDATE SET grant_id=excluded.grant_id,uid=excluded.uid,user_code=excluded.user_code,
    expires=excluded.expires,payload=excluded.payload`);
  const get = db.prepare('SELECT * FROM oidc_objects WHERE model=? AND id=? AND expires>?');
  const updateGrantExpiry=db.prepare("UPDATE oidc_objects SET expires=?,payload=? WHERE model='Grant' AND id=?");
  const byUid = db.prepare('SELECT * FROM oidc_objects WHERE model=? AND uid=? AND expires>?');
  const byCode = db.prepare('SELECT * FROM oidc_objects WHERE model=? AND user_code=? AND expires>?');
  const rm = db.prepare('DELETE FROM oidc_objects WHERE model=? AND id=?');
  const consume = db.prepare('UPDATE oidc_objects SET consumed=? WHERE model=? AND id=? AND consumed IS NULL');
  const revoke = db.prepare('DELETE FROM oidc_objects WHERE model=? AND grant_id=?');
  const purge = db.prepare('DELETE FROM oidc_objects WHERE expires<=?');
  const now = () => Math.floor(Date.now() / 1000);
  let lastPurge = 0;

  function encode(model, id, value) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify([model,id])));
    const data = Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),data]);
  }

  function decode(row) {
    if (!row) return undefined;
    const packed = Buffer.from(row.payload);
    const cipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0,12));
    cipher.setAAD(Buffer.from(JSON.stringify([row.model,row.id])));
    cipher.setAuthTag(packed.subarray(12,28));
    const value = JSON.parse(Buffer.concat([cipher.update(packed.subarray(28)),cipher.final()]).toString());
    if (row.consumed !== null) value.consumed = row.consumed;
    return value;
  }

  return class Adapter {
    constructor(model) { this.model = model; }
    async upsert(id, value, ttl) {
      const time = now();
      if (time - lastPurge > 3600) { purge.run(time); lastPurge = time; }
      if(this.model==='DeviceCode'){
        const old=decode(get.get(this.model,id,time));
        if(old?.nativeApproval||old?.nativeCompleted)throw new Error('Device authorization already handled');
      }
      put.run(this.model, id, value.grantId ?? null, value.uid ?? null, value.userCode ?? null,
        ttl === undefined ? Number.MAX_SAFE_INTEGER : time + ttl, encode(this.model,id,value));
    }
    nativeDevice(id,operation,details={}) {
      const time=now();
      db.exec('BEGIN IMMEDIATE');
      try{
        const row=get.get('DeviceCode',id,time);
        const value=decode(row);
        const allowed=value&&!value.accountId&&!value.error&&!value.consumed&&
          (operation==='claim'?!value.inFlight:value.nativeApproval===true);
        if(allowed){
          const result={...value,inFlight:operation!=='release',nativeApproval:operation==='claim',
            nativeCompleted:operation==='finish',...details};
          put.run('DeviceCode',id,result.grantId??null,row.uid,row.user_code,row.expires,encode('DeviceCode',id,result));
        }
        db.exec('COMMIT');
        return !!allowed;
      }catch(error){db.exec('ROLLBACK');throw error;}
    }
    async find(id) { return decode(get.get(this.model,id,now())); }
    async findByUid(uid) { return decode(byUid.get(this.model,uid,now())); }
    async findByUserCode(code) { return decode(byCode.get(this.model,code,now())); }
    async consume(id) {
      const time=now();
      if(consume.run(time,this.model,id).changes!==1){
        const prior=get.get(this.model,id,time);
        throw Object.assign(new Error('Authorization artifact already consumed'),{code:'already_consumed',grantId:prior?.grant_id});
      }
    }
    renewGrant(id,ttl) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const time=now();
        const grant=decode(get.get('Grant',id,time));
        if(grant){
          grant.exp=time+ttl;
          updateGrantExpiry.run(grant.exp,encode('Grant',id,grant),id);
        }
        db.exec('COMMIT');
        return !!grant;
      } catch(error) { db.exec('ROLLBACK'); throw error; }
    }
    copyGrant(id,replacement,owner,client) {
      const time=now();
      const row=get.get('Grant',id,time);
      const grant=decode(row);
      if(!grant||grant.accountId!==owner||grant.clientId!==client)return false;
      const selection=get.get('ClaimSelection',id,time);
      db.exec('BEGIN IMMEDIATE');
      try{
        put.run('Grant',replacement,null,null,null,row.expires,encode('Grant',replacement,{...grant,jti:replacement}));
        if(selection)put.run('ClaimSelection',replacement,null,null,null,selection.expires,
          encode('ClaimSelection',replacement,decode(selection)));
        db.exec('COMMIT');
        return true;
      }catch(error){db.exec('ROLLBACK');throw error;}
    }
    async destroy(id) { rm.run(this.model,id); }
    async revokeByGrantId(id) { revoke.run(this.model,id); }
  };
}
