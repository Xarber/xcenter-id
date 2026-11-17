import { createCipheriv, createDecipheriv, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { simpleParser } from 'mailparser';
import { convert } from 'html-to-text';

const supportOwner='@xcenter-support';
const externalSupportOwner='@xcenter-support-email';

export function openMailStore({ accountsPath, mailPath, configuration }) {
  const key = Buffer.from(configuration.storageKey ?? '', 'hex');
  if (key.length !== 32) throw new Error('Mail storage requires a 32-byte key');
  const domains = new Set(configuration.inboundDomains ?? []);
  if (!domains.size || [...domains].some((value) => !['xcenter.it','mail.xcenter.it','hme.xcenter.it'].includes(value))) {
    throw new Error('Invalid inbound mail domain');
  }
  const accounts = new DatabaseSync(accountsPath, { readOnly:true });
  const supportAddresses=new Set(configuration.supportAddresses??[]);
  if([...supportAddresses].some(address=>!['support@id.xcenter.it','support@xcenter.it'].includes(address)))
    throw new Error('Invalid support mail address');
  const db = new DatabaseSync(mailPath);
  db.exec(`
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS aliases (id TEXT PRIMARY KEY, owner TEXT NOT NULL, client TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, UNIQUE(owner,client)) STRICT;
    CREATE TABLE IF NOT EXISTS premium_aliases (id TEXT PRIMARY KEY, owner TEXT NOT NULL, client TEXT NOT NULL,
      UNIQUE(owner,client)) STRICT;
    CREATE TABLE IF NOT EXISTS revoked_premium_aliases (id TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, owner TEXT NOT NULL, received INTEGER NOT NULL,
      size INTEGER NOT NULL, envelope BLOB NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS inbox_owner ON inbox(owner,received);
    CREATE TABLE IF NOT EXISTS support_requests(id TEXT PRIMARY KEY, owner TEXT NOT NULL,
      created INTEGER NOT NULL, replied INTEGER) STRICT;
    CREATE INDEX IF NOT EXISTS support_requests_owner ON support_requests(owner,created);
  `);
  const alias = db.prepare('SELECT id FROM aliases WHERE owner=? AND client=? AND active=1');
  const insertAlias = db.prepare('INSERT INTO aliases (id,owner,client) VALUES (?,?,?) ON CONFLICT(owner,client) DO NOTHING');
  const resolveAlias = db.prepare('SELECT owner FROM aliases WHERE id=? AND active=1');
  const premiumAlias = db.prepare('SELECT id FROM premium_aliases WHERE owner=? AND client=?');
  const standardForOwner = db.prepare('SELECT id,client,active FROM aliases WHERE owner=? ORDER BY id');
  const premiumForOwner = db.prepare(`SELECT id,client,id NOT IN (SELECT id FROM revoked_premium_aliases) AS active
    FROM premium_aliases WHERE owner=? ORDER BY id`);
  const revokeStandard = db.prepare('UPDATE aliases SET active=0 WHERE id=? AND owner=?');
  const revokePremium = db.prepare('INSERT OR IGNORE INTO revoked_premium_aliases SELECT id FROM premium_aliases WHERE id=? AND owner=?');
  const premiumRevoked = db.prepare('SELECT 1 FROM revoked_premium_aliases WHERE id=?');
  const insertPremium = db.prepare('INSERT OR IGNORE INTO premium_aliases VALUES (?,?,?)');
  const resolvePremium = db.prepare('SELECT owner FROM premium_aliases WHERE id=? AND id NOT IN (SELECT id FROM revoked_premium_aliases)');
  const given = ['mira','nova','leo','luca','thea','noa','iris','elio','aya','max'];
  const surnames = ['reed','hale','woods','mason','stone','lane','cove','park','hart','brooks'];
  const lookup = accounts.prepare('SELECT owner FROM identity_profiles WHERE username=?');
  const username = accounts.prepare('SELECT username FROM identity_profiles WHERE owner=?');
  const add = db.prepare('INSERT INTO inbox VALUES (?,?,?,?,?)');
  const count = db.prepare('SELECT total(size) AS bytes,count(*) AS messages FROM inbox WHERE owner=?');
  const list = db.prepare('SELECT id,received,size FROM inbox WHERE owner=? ORDER BY received DESC,id LIMIT 101');
  const older = db.prepare(`SELECT id,received,size FROM inbox WHERE owner=? AND (received<? OR (received=? AND id>?))
    ORDER BY received DESC,id LIMIT 101`);
  const remove = db.prepare('DELETE FROM inbox WHERE owner=? AND id=?');
  const get = db.prepare('SELECT * FROM inbox WHERE owner=? AND id=?');

  function resolveRecipient(value) {
    if(supportAddresses.has(value.toLowerCase()))return externalSupportOwner;
    const match = /^([a-z0-9][a-z0-9.-]{1,62})@([a-z.]+)$/i.exec(value);
    if (!match) return null;
    const local = match[1].toLowerCase();
    const domain = match[2].toLowerCase();
    if (!domains.has(domain)) return null;
    if (domain === 'hme.xcenter.it' || (domain === 'mail.xcenter.it' && local.includes('.'))) {
      const owner=(domain==='hme.xcenter.it'?resolveAlias:resolvePremium).get(local)?.owner;
      return owner&&username.get(owner)?owner:null;
    }
    return lookup.get(local)?.owner ?? null;
  }

  function context(id,owner) { return Buffer.from(JSON.stringify(['authnjs.mail.v1',id,owner])); }
  function deliver(owner,content) {
    const used = count.get(owner);
    if (used.bytes + content.length > 64 * 1024 * 1024 || used.messages >= 1000) return null;
    const id = randomUUID();
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm',key,nonce);
    cipher.setAAD(context(id,owner));
    const ciphertext = Buffer.concat([cipher.update(content),cipher.final()]);
    add.run(id,owner,Date.now(),content.length,Buffer.concat([nonce,cipher.getAuthTag(),ciphertext]));
    return id;
  }
  function retrieve(owner,id) {
    const row = get.get(owner,id);
    if (!row) return null;
    const packed = Buffer.from(row.envelope);
    const cipher = createDecipheriv('aes-256-gcm',key,packed.subarray(0,12));
    cipher.setAAD(context(id,owner));
    cipher.setAuthTag(packed.subarray(12,28));
    return Buffer.concat([cipher.update(packed.subarray(28)),cipher.final()]);
  }
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result=work();
      db.exec(result?'COMMIT':'ROLLBACK');
      return result;
    } catch(error){db.exec('ROLLBACK');throw error;}
  }

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
        if(current) return premiumRevoked.get(current.id)?null:current.id+'@mail.xcenter.it';
        const id=given[randomInt(given.length)]+'.'+surnames[randomInt(surnames.length)]+'.'+randomBytes(3).toString('hex');
        if(insertPremium.run(id,owner,client).changes===1) return id+'@mail.xcenter.it';
      }
      return null;
    },
    aliases(owner) {
      const entries=(rows,domain,premium)=>rows.map(({id,client,active})=>({
        address:id+'@'+domain,client,active:!!active,premium,
      }));
      return [...entries(standardForOwner.all(owner),'hme.xcenter.it',false),...entries(premiumForOwner.all(owner),'mail.xcenter.it',true)];
    },
    revokeAlias(owner,address) {
      const parts=/^([a-z0-9.-]{1,63})@(hme\.xcenter\.it|mail\.xcenter\.it)$/.exec(address);
      if (!parts) return false;
      const result=(parts[2]==='hme.xcenter.it'?revokeStandard:revokePremium).run(parts[1],owner);
      return result.changes===1;
    },
    receive(recipients, content) {
      const unique = [...new Set(recipients.map(resolveRecipient))];
      if (!unique.length || unique.includes(null)) return false;
      return transaction(()=>unique.every(owner=>deliver(owner,content)));
    },
    submitSupport(owner,content) {
      return transaction(()=>{
        if(!username.get(owner))return false;
        db.prepare('DELETE FROM support_requests WHERE created<? AND id NOT IN (SELECT id FROM inbox WHERE owner=?)')
          .run(Date.now()-86400_000,supportOwner);
        if(db.prepare('SELECT count(*) AS total FROM support_requests WHERE owner=? AND created>?')
          .get(owner,Date.now()-86400_000).total>=5) return false;
        const id=deliver(supportOwner,content);
        if(!id)return false;
        db.prepare('INSERT INTO support_requests VALUES (?,?,?,NULL)').run(id,owner,Date.now());
        return true;
      });
    },
    listSupport() {
      const listRequests=db.prepare(`SELECT i.id,i.received,r.replied,r.owner IS NULL AS external
        FROM inbox i LEFT JOIN support_requests r ON i.id=r.id
        WHERE i.owner=? ORDER BY r.replied IS NOT NULL,i.received DESC,i.id LIMIT 100`);
      return [...listRequests.all(supportOwner),...listRequests.all(externalSupportOwner)];
    },
    async readSupport(id) {
      const raw=retrieve(supportOwner,id)??retrieve(externalSupportOwner,id);
      if(!raw)return null;
      const row=db.prepare('SELECT owner,replied FROM support_requests WHERE id=?').get(id);
      const value=await simpleParser(raw,{skipImageLinks:true,skipTextToHtml:true,skipHtmlToText:true});
      const sender=row?username.get(row.owner)?.username:null;
      return {subject:(value.subject??'').slice(0,120),sender:row?(sender?'@'+sender:'Deleted account'):
        (value.from?.text??'Unverified sender').slice(0,250),
        text:(value.text??(value.html?convert(value.html,{selectors:[{selector:'img',format:'skip'},
          {selector:'a',options:{ignoreHref:true}}]}):'')).slice(0,20_000),
        canReply:!!sender&&!row.replied,external:!row};
    },
    replySupport(id,content) {
      return transaction(()=>{
        const row=db.prepare('SELECT owner,replied FROM support_requests WHERE id=?').get(id);
        if(!row||row.replied||!username.get(row.owner)||!retrieve(supportOwner,id))return false;
        if(!deliver(row.owner,content))return false;
        db.prepare('UPDATE support_requests SET replied=? WHERE id=?').run(Date.now(),id);
        return true;
      });
    },
    removeSupport(id) {
      return remove.run(supportOwner,id).changes===1||remove.run(externalSupportOwner,id).changes===1;
    },
    usage: (owner) => count.get(owner).bytes,
    page(owner,cursor) {
      const rows = cursor ? older.all(owner,cursor.received,cursor.received,cursor.id) : list.all(owner);
      const messages = rows.slice(0,100);
      const last = messages.at(-1);
      return {messages,nextCursor:rows.length>100 ? last.received+':'+last.id : null};
    },
    remove: (owner,id) => remove.run(owner,id).changes === 1,
    retrieve,
    close() { accounts.close(); db.close(); },
  };
}
