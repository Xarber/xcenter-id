import { createCipheriv, createDecipheriv, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { simpleParser } from 'mailparser';
import { convert } from 'html-to-text';

const supportOwner='@xcenter-support';
const externalSupportOwner='@xcenter-support-email';

export function openMailStore({ accountsPath, mailPath, configuration,accountService }) {
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
    CREATE TABLE IF NOT EXISTS mail_items(uid INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,folder TEXT NOT NULL DEFAULT 'INBOX',flags TEXT NOT NULL DEFAULT '[]') STRICT;
    CREATE TABLE IF NOT EXISTS mail_metadata(name TEXT PRIMARY KEY,value INTEGER NOT NULL) STRICT;
    INSERT OR IGNORE INTO mail_metadata VALUES('uidvalidity',CAST(strftime('%s','now') AS INTEGER));
    CREATE TABLE IF NOT EXISTS inbox_trust(id TEXT PRIMARY KEY,verified INTEGER NOT NULL,admin INTEGER NOT NULL) STRICT;
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
    CREATE TABLE IF NOT EXISTS support_external_deliveries(id TEXT PRIMARY KEY,status TEXT NOT NULL,updated INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS support_replies(request TEXT PRIMARY KEY, reply TEXT NOT NULL) STRICT;
  `);
  db.exec("INSERT OR IGNORE INTO mail_items(id) SELECT id FROM inbox ORDER BY received,id;");
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
  const list = db.prepare("SELECT id,received,size FROM inbox WHERE owner=? AND id IN (SELECT id FROM mail_items WHERE folder='INBOX') ORDER BY received DESC,id LIMIT 101");
  const older = db.prepare(`SELECT id,received,size FROM inbox WHERE owner=? AND id IN (SELECT id FROM mail_items WHERE folder='INBOX') AND (received<? OR (received=? AND id>?))
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
      return owner&&username.get(owner)&&!accounts.prepare('SELECT 1 FROM account_restrictions WHERE owner=?').get(owner)?owner:null;
    }
    const owner=lookup.get(local)?.owner??accounts.prepare('SELECT owner FROM mailbox_aliases WHERE local=? AND active=1').get(local)?.owner;
    return owner&&username.get(owner)&&!accounts.prepare('SELECT 1 FROM account_restrictions WHERE owner=?').get(owner)?owner:null;
  }

  function context(id,owner) { return Buffer.from(JSON.stringify(['authnjs.mail.v1',id,owner])); }
  function deliver(owner,content,trust) {
    const used = count.get(owner);
    if (used.bytes + content.length > 64 * 1024 * 1024 || used.messages >= 1000) return null;
    const id = randomUUID();
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm',key,nonce);
    cipher.setAAD(context(id,owner));
    const ciphertext = Buffer.concat([cipher.update(content),cipher.final()]);
    add.run(id,owner,Date.now(),content.length,Buffer.concat([nonce,cipher.getAuthTag(),ciphertext]));
    if(trust?.verified||trust?.admin)db.prepare('INSERT INTO inbox_trust VALUES(?,?,?)').run(id,Number(!!trust.verified),Number(!!trust.admin));
    db.prepare('INSERT INTO mail_items(id) VALUES(?)').run(id);
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
    createPrivateAddress(owner,name){
      if(accountService.premiumEligible(owner))return accountService.createMailboxAlias(owner,name);
      if(name||!domains.has('hme.xcenter.it'))return null;
      return this.alias(owner,'dashboard:'+randomUUID());
    },
    deleteAlias(owner,address){
      const parts=/^([a-z0-9.-]{1,63})@(hme\.xcenter\.it|mail\.xcenter\.it)$/.exec(address);
      if(!parts)return false;
      if(parts[2]==='hme.xcenter.it')return db.prepare('DELETE FROM aliases WHERE owner=? AND id=?').run(owner,parts[1]).changes===1;
      if(accountService?.deleteMailboxAlias(owner,parts[1]))return true;
      return db.prepare('DELETE FROM premium_aliases WHERE owner=? AND id=?').run(owner,parts[1]).changes===1;
    },
    alias(owner,client) {
      if (!domains.has('hme.xcenter.it')) return null;
      const current=alias.get(owner,client);
      if(current)return current.id+'@hme.xcenter.it';
      if(db.prepare('SELECT count(*) AS n FROM aliases WHERE owner=?').get(owner).n>=30)return null;
      const id = randomUUID();
      insertAlias.run(id,owner,client);
      const found = alias.get(owner,client);
      return found ? found.id+'@hme.xcenter.it' : null;
    },
    premiumAlias(owner,client) {
      if (!domains.has('mail.xcenter.it')) return null;
      const previous=premiumAlias.get(owner,client);
      if(!previous&&accountService)return accountService.createMailboxAlias(owner,null,client);
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
      const dashboard=accounts.prepare("SELECT local AS id,coalesce(client,'dashboard') AS client,active FROM mailbox_aliases WHERE owner=? ORDER BY created DESC").all(owner);
      return [...entries(dashboard,'mail.xcenter.it',true),...entries(standardForOwner.all(owner),'hme.xcenter.it',false),...entries(premiumForOwner.all(owner),'mail.xcenter.it',true)];
    },
    setAlias(owner,address,enabled){
      const parts=/^([a-z0-9.-]{1,63})@(hme\.xcenter\.it|mail\.xcenter\.it)$/.exec(address);
      if(!parts||typeof enabled!=='boolean')return false;
      if(parts[2]==='mail.xcenter.it'){
        if(enabled&&!accountService?.premiumEligible(owner))return false;
        if(accountService?.setMailboxAlias(owner,parts[1],enabled))return true;
        if(!premiumAlias.get(owner,parts[1])&&!db.prepare('SELECT 1 FROM premium_aliases WHERE owner=? AND id=?').get(owner,parts[1]))return false;
        if(enabled)db.prepare('DELETE FROM revoked_premium_aliases WHERE id=?').run(parts[1]);else revokePremium.run(parts[1],owner);
        return true;
      }
      return db.prepare('UPDATE aliases SET active=? WHERE id=? AND owner=?').run(Number(enabled),parts[1],owner).changes===1;
    },
    revokeAlias(owner,address) {
      const parts=/^([a-z0-9.-]{1,63})@(hme\.xcenter\.it|mail\.xcenter\.it)$/.exec(address);
      if (!parts) return false;
      if(parts[2]==='mail.xcenter.it'&&accountService?.setMailboxAlias(owner,parts[1],false))return true;
      const result=(parts[2]==='hme.xcenter.it'?revokeStandard:revokePremium).run(parts[1],owner);
      return result.changes===1;
    },
    receive(recipients, content,trust) {
      const unique = [...new Set(recipients.map(resolveRecipient))];
      if (!unique.length || unique.includes(null)) return false;
      return transaction(()=>unique.every(owner=>deliver(owner,content,trust)));
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
    async ownSupport(owner) {
      const rows=db.prepare('SELECT id,created,replied FROM support_requests WHERE owner=? ORDER BY created DESC LIMIT 30').all(owner);
      return Promise.all(rows.map(async row=>{
        const request=retrieve(supportOwner,row.id);
        const reference=db.prepare('SELECT reply FROM support_replies WHERE request=?').get(row.id);
        const reply=reference&&retrieve(owner,reference.reply);
        const parsed=request&&await simpleParser(request,{skipImageLinks:true,skipTextToHtml:true,skipHtmlToText:true});
        const response=reply&&await simpleParser(reply,{skipImageLinks:true,skipTextToHtml:true,skipHtmlToText:true});
        return {id:row.id,created:row.created,replied:row.replied,subject:parsed?.subject??'Support request',
          text:parsed?.text??'',reply:response?.text??null};
      }));
    },
    notice(owner,content) {return !!deliver(owner,content,{admin:true});},
    trust(owner,id){return get.get(owner,id)?db.prepare('SELECT verified,admin FROM inbox_trust WHERE id=?').get(id)??{verified:0,admin:0}:{verified:0,admin:0};},
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
        canReply:row?!!sender&&!row.replied:!db.prepare('SELECT 1 FROM support_external_deliveries WHERE id=?').get(id)&&value.from?.value?.length===1,external:!row};
    },
    async claimExternalSupport(id){
      const raw=retrieve(externalSupportOwner,id);if(!raw)return null;
      const parsed=await simpleParser(raw,{skipImageLinks:true,skipTextToHtml:true,skipHtmlToText:true});
      if(parsed.from?.value.length!==1)return null;
      const address=parsed.from.value[0].address;
      if(!address||!db.prepare("INSERT OR IGNORE INTO support_external_deliveries VALUES(?,'sending',?)").run(id,Date.now()).changes)return null;
      return {address,subject:('Re: '+(parsed.subject??'Support')).replace(/[\r\n\0]/g,' ').slice(0,120)};
    },
    externalSupportResult:(id,ok)=>db.prepare('UPDATE support_external_deliveries SET status=?,updated=? WHERE id=?').run(ok?'sent':'uncertain',Date.now(),id),
    replySupport(id,content) {
      return transaction(()=>{
        const row=db.prepare('SELECT owner,replied FROM support_requests WHERE id=?').get(id);
        if(!row||row.replied||!username.get(row.owner)||!retrieve(supportOwner,id))return false;
        const reply=deliver(row.owner,content,{admin:true});
        if(!reply)return false;
        db.prepare('INSERT INTO support_replies VALUES(?,?)').run(id,reply);
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
    removeMany(owner,ids) {
      return transaction(()=>{
        const deleted=ids.reduce((total,id)=>total+Number(remove.run(owner,id).changes),0);
        return {deleted};
      }).deleted;
    },
    retrieve,
    imapValidity:()=>db.prepare("SELECT value FROM mail_metadata WHERE name='uidvalidity'").get().value,
    imapNext:()=>Number(db.prepare("SELECT seq FROM sqlite_sequence WHERE name='mail_items'").get()?.seq??0)+1,
    imapList:(owner,folder)=>db.prepare('SELECT m.uid,m.flags,i.id,i.received,i.size FROM mail_items m JOIN inbox i ON i.id=m.id WHERE i.owner=? AND m.folder=? ORDER BY m.uid LIMIT 1000').all(owner,folder).map(row=>({...row,flags:JSON.parse(row.flags)})),
    imapFlags(owner,id,flags){return db.prepare('UPDATE mail_items SET flags=? WHERE id=? AND id IN(SELECT id FROM inbox WHERE owner=?)').run(JSON.stringify(flags),id,owner).changes===1;},
    imapMove(owner,id,folder){return transaction(()=>{const row=db.prepare('SELECT m.flags FROM mail_items m JOIN inbox i ON i.id=m.id WHERE i.owner=? AND i.id=?').get(owner,id);if(!row)return false;db.prepare('DELETE FROM mail_items WHERE id=?').run(id);db.prepare('INSERT INTO mail_items(id,folder,flags) VALUES(?,?,?)').run(id,folder,row.flags);return true;});},
    imapAppend(owner,folder,raw){return transaction(()=>{const id=deliver(owner,raw);if(!id)return false;db.prepare('UPDATE mail_items SET folder=? WHERE id=?').run(folder,id);return id;});},
    close() { accounts.close(); db.close(); },
  };
}
