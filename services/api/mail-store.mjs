import { createCipheriv, createDecipheriv, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export function openMailStore({ accountsPath, mailPath, configuration }) {
  const key = Buffer.from(configuration.storageKey ?? '', 'hex');
  if (key.length !== 32) throw new Error('Mail storage requires a 32-byte key');
  const domains = new Set(configuration.inboundDomains ?? []);
  if (!domains.size || [...domains].some((value) => !['xcenter.it','mail.xcenter.it','hme.xcenter.it'].includes(value))) {
    throw new Error('Invalid inbound mail domain');
  }
  const accounts = new DatabaseSync(accountsPath, { readOnly:true });
  const db = new DatabaseSync(mailPath);
  db.exec(`
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS aliases (id TEXT PRIMARY KEY, owner TEXT NOT NULL, client TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, UNIQUE(owner,client)) STRICT;
    CREATE TABLE IF NOT EXISTS premium_aliases (id TEXT PRIMARY KEY, owner TEXT NOT NULL, client TEXT NOT NULL,
      UNIQUE(owner,client)) STRICT;
    CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, owner TEXT NOT NULL, received INTEGER NOT NULL,
      size INTEGER NOT NULL, envelope BLOB NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS inbox_owner ON inbox(owner,received);
  `);
  const alias = db.prepare('SELECT id FROM aliases WHERE owner=? AND client=? AND active=1');
  const insertAlias = db.prepare('INSERT INTO aliases (id,owner,client) VALUES (?,?,?) ON CONFLICT(owner,client) DO NOTHING');
  const resolveAlias = db.prepare('SELECT owner FROM aliases WHERE id=? AND active=1');
  const premiumAlias = db.prepare('SELECT id FROM premium_aliases WHERE owner=? AND client=?');
  const insertPremium = db.prepare('INSERT OR IGNORE INTO premium_aliases VALUES (?,?,?)');
  const resolvePremium = db.prepare('SELECT owner FROM premium_aliases WHERE id=?');
  const given = ['mira','nova','leo','luca','thea','noa','iris','elio','aya','max'];
  const surnames = ['reed','hale','woods','mason','stone','lane','cove','park','hart','brooks'];
  const lookup = accounts.prepare('SELECT owner FROM identity_profiles WHERE username=?');
  const add = db.prepare('INSERT INTO inbox VALUES (?,?,?,?,?)');
  const count = db.prepare('SELECT total(size) AS bytes,count(*) AS messages FROM inbox WHERE owner=?');
  const list = db.prepare('SELECT id,received,size FROM inbox WHERE owner=? ORDER BY received DESC,id LIMIT 100');
  const get = db.prepare('SELECT * FROM inbox WHERE owner=? AND id=?');

  function resolveRecipient(value) {
    const match = /^([a-z0-9][a-z0-9.-]{1,62})@([a-z.]+)$/i.exec(value);
    if (!match) return null;
    const local = match[1].toLowerCase();
    const domain = match[2].toLowerCase();
    if (!domains.has(domain)) return null;
    if (domain === 'hme.xcenter.it') return resolveAlias.get(local)?.owner ?? null;
    if (domain === 'mail.xcenter.it' && local.includes('.')) return resolvePremium.get(local)?.owner ?? null;
    return lookup.get(local)?.owner ?? null;
  }

  function context(id,owner) { return Buffer.from(JSON.stringify(['authnjs.mail.v1',id,owner])); }

  return {
    resolveRecipient,
    maskedAvailable: domains.has('hme.xcenter.it'),
    premiumAvailable: domains.has('mail.xcenter.it'),
    alias(owner,client) {
      if (!domains.has('hme.xcenter.it')) return null;
      const id = randomUUID();
      insertAlias.run(id,owner,client);
      const found = alias.get(owner,client);
      return found ? found.id+'@hme.xcenter.it' : null;
    },
    premiumAlias(owner,client) {
      if (!domains.has('mail.xcenter.it')) return null;
      for (let retry=0;retry<4;retry++) {
        const current=premiumAlias.get(owner,client);
        if(current) return current.id+'@mail.xcenter.it';
        const id=given[randomInt(given.length)]+'.'+surnames[randomInt(surnames.length)]+'.'+randomBytes(3).toString('hex');
        if(insertPremium.run(id,owner,client).changes===1) return id+'@mail.xcenter.it';
      }
      return null;
    },
    receive(recipients, content) {
      const unique = [...new Set(recipients.map(resolveRecipient))];
      if (!unique.length || unique.includes(null)) return false;
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const owner of unique) {
          const used = count.get(owner);
          if (used.bytes + content.length > 64 * 1024 * 1024 || used.messages >= 1000) {
            db.exec('ROLLBACK');
            return false;
          }
          const id = randomUUID();
          const nonce = randomBytes(12);
          const cipher = createCipheriv('aes-256-gcm',key,nonce);
          cipher.setAAD(context(id,owner));
          const ciphertext = Buffer.concat([cipher.update(content),cipher.final()]);
          add.run(id,owner,Date.now(),content.length,Buffer.concat([nonce,cipher.getAuthTag(),ciphertext]));
        }
        db.exec('COMMIT');
        return true;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    list: (owner) => list.all(owner),
    retrieve(owner,id) {
      const row = get.get(owner,id);
      if (!row) return null;
      const packed = Buffer.from(row.envelope);
      const cipher = createDecipheriv('aes-256-gcm',key,packed.subarray(0,12));
      cipher.setAAD(context(id,owner));
      cipher.setAuthTag(packed.subarray(12,28));
      return Buffer.concat([cipher.update(packed.subarray(28)),cipher.final()]);
    },
    close() { accounts.close(); db.close(); },
  };
}
