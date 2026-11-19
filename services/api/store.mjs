import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const untilRevoked = Number.MAX_SAFE_INTEGER;

export function openStore(path, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Expected a 32-byte data key');
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout = 3000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS records (
      owner TEXT NOT NULL, source TEXT NOT NULL, dataset TEXT NOT NULL,
      id TEXT NOT NULL, revision INTEGER NOT NULL, envelope BLOB NOT NULL,
      PRIMARY KEY (owner, source, dataset, id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS grants (
      owner TEXT NOT NULL, source TEXT NOT NULL, destination TEXT NOT NULL,
      dataset TEXT NOT NULL, expires INTEGER NOT NULL,
      PRIMARY KEY (owner, source, destination, dataset)
    ) STRICT;
  `);

  function bindings(owner, source, dataset, id, revision) {
    return Buffer.from(JSON.stringify(['authnjs.record.v1', owner, source, dataset, id, revision]));
  }

  function seal(record, aad) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(record), 'utf8'), cipher.final()]);
    return Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), encrypted]);
  }

  function unseal(bytes, aad) {
    const envelope = Buffer.from(bytes);
    if (envelope.length < 30 || envelope[0] !== 1) throw new Error('Invalid record envelope');
    const cipher = createDecipheriv('aes-256-gcm', key, envelope.subarray(1, 13));
    cipher.setAAD(aad);
    cipher.setAuthTag(envelope.subarray(13, 29));
    return JSON.parse(Buffer.concat([cipher.update(envelope.subarray(29)), cipher.final()]).toString('utf8'));
  }

  const insert = db.prepare('INSERT INTO records VALUES (?, ?, ?, ?, ?, ?)');
  const list = db.prepare('SELECT id, revision, envelope FROM records WHERE owner = ? AND source = ? AND dataset = ? AND id > ? ORDER BY id LIMIT 101');
  const one = db.prepare('SELECT revision,envelope FROM records WHERE owner=? AND source=? AND dataset=? AND id=?');
  const update = db.prepare('UPDATE records SET revision = ?, envelope = ? WHERE owner = ? AND source = ? AND dataset = ? AND id = ? AND revision = ?');
  const count = db.prepare('SELECT count(*) AS total FROM records WHERE owner = ? AND source = ? AND dataset = ?');
  const erase = db.prepare('DELETE FROM records WHERE owner = ? AND source = ? AND dataset = ? AND id = ?');
  const grant = db.prepare('INSERT INTO grants VALUES (?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET expires = excluded.expires');
  const revoke = db.prepare('DELETE FROM grants WHERE owner = ? AND source = ? AND destination = ? AND dataset = ?');
  const allowed = db.prepare('SELECT 1 FROM grants WHERE owner = ? AND source = ? AND destination = ? AND dataset = ? AND expires > ?');
  const listGrants = db.prepare('SELECT source, destination, dataset, expires FROM grants WHERE owner = ? AND expires > ? ORDER BY source, destination LIMIT 100');

  return {
    create(owner, source, dataset, value) {
      const id = randomUUID();
      const revision = 1;
      db.exec('BEGIN IMMEDIATE');
      try {
        if (count.get(owner, source, dataset).total >= 1000) {
          db.exec('ROLLBACK');
          return null;
        }
        insert.run(owner, source, dataset, id, revision, seal(value, bindings(owner, source, dataset, id, revision)));
        db.exec('COMMIT');
        return { id, revision };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    update(owner, source, dataset, id, previousRevision, value) {
      const revision = previousRevision + 1;
      const envelope = seal(value, bindings(owner, source, dataset, id, revision));
      return Number(update.run(revision, envelope, owner, source, dataset, id, previousRevision).changes) === 1
        ? { id, revision }
        : null;
    },
    read(owner, source, destination, dataset, after = '') {
      // Keep the grant decision and read on the same SQLite snapshot.
      db.exec('BEGIN');
      try {
        if (source !== destination && !allowed.get(owner, source, destination, dataset, Date.now())) return null;
        const page = list.all(owner, source, dataset, after);
        const records = page.slice(0, 100).map(({ id, revision, envelope }) => ({
          id, revision, value: unseal(envelope, bindings(owner, source, dataset, id, revision)),
        }));
        return { records, nextCursor: page.length > 100 ? records.at(-1).id : null };
      } finally {
        db.exec('ROLLBACK');
      }
    },
    readOne(owner,source,dataset,id) {
      const row=one.get(owner,source,dataset,id);
      return row ? unseal(row.envelope,bindings(owner,source,dataset,id,row.revision)) : null;
    },
    remove: (owner, source, dataset, id) => Number(erase.run(owner, source, dataset, id).changes) === 1,
    grant: (...parameters) => grant.run(...parameters),
    revoke: (...parameters) => revoke.run(...parameters),
    listGrants: (owner) => listGrants.all(owner, Date.now()),
    revokeApp(owner,client){
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare('DELETE FROM grants WHERE owner=? AND (source=? OR destination=?)').run(owner,client,client);
        db.prepare('DELETE FROM records WHERE owner=? AND source=?').run(owner,client);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    usage: (owner) => db.prepare('SELECT total(length(envelope)+length(id)+length(source)+length(dataset)+8) AS bytes FROM records WHERE owner=?').get(owner).bytes,
    close: () => db.close(),
  };
}
