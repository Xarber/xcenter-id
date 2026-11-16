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
      put.run(this.model, id, value.grantId ?? null, value.uid ?? null, value.userCode ?? null,
        ttl === undefined ? Number.MAX_SAFE_INTEGER : time + ttl, encode(this.model,id,value));
    }
    async find(id) { return decode(get.get(this.model,id,now())); }
    async findByUid(uid) { return decode(byUid.get(this.model,uid,now())); }
    async findByUserCode(code) { return decode(byCode.get(this.model,code,now())); }
    async consume(id) {
      if (consume.run(now(),this.model,id).changes !== 1) throw new Error('Authorization artifact already consumed');
    }
    async destroy(id) { rm.run(this.model,id); }
    async revokeByGrantId(id) { revoke.run(this.model,id); }
  };
}
