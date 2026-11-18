import {createHash,randomBytes,scryptSync,timingSafeEqual,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
export function openMailCredentials(path){
 const db=new DatabaseSync(path);db.exec(`PRAGMA busy_timeout=3000;CREATE TABLE IF NOT EXISTS mail_credentials(id TEXT PRIMARY KEY,owner TEXT NOT NULL,label TEXT NOT NULL,salt BLOB NOT NULL,hash BLOB NOT NULL,created INTEGER NOT NULL,last_used INTEGER) STRICT;`);
 const rates=new Map();
 return {
  list:owner=>db.prepare('SELECT id,label,created,last_used AS lastUsed FROM mail_credentials WHERE owner=? ORDER BY created DESC').all(owner),
  create(owner,label){if(typeof label!=='string'||!label.trim()||label.length>64||/[\p{Cc}\p{Cf}]/u.test(label))throw new Error('Name this mail client.');
   if(db.prepare('SELECT count(*) AS n FROM mail_credentials WHERE owner=?').get(owner).n>=10)throw new Error('Revoke an old mail client first.');
   const password=randomBytes(32).toString('base64url'),salt=randomBytes(16),id=randomUUID();
   db.prepare('INSERT INTO mail_credentials VALUES(?,?,?,?,?,?,NULL)').run(id,owner,label.trim(),salt,scryptSync(password,salt,32),Date.now());return {id,password};
  },
  revoke:(owner,id)=>db.prepare('DELETE FROM mail_credentials WHERE owner=? AND id=?').run(owner,id).changes===1,
  valid:(owner,id)=>!!db.prepare('SELECT 1 FROM mail_credentials c JOIN accounts a ON a.id=c.owner WHERE c.owner=? AND c.id=? AND NOT EXISTS(SELECT 1 FROM account_restrictions r WHERE r.owner=c.owner)').get(owner,id),
  authenticate(username,password,ip='unknown'){
   const now=Date.now();for(const [key,entry]of rates)if(now>entry.until)rates.delete(key);
   const key=createHash('sha256').update(String(ip)).digest('hex');const rate=rates.get(key)??{count:0,until:now+600000};
   if(rate.count>=15||rates.size>=10000)return null;rate.count++;rates.set(key,rate);
   if(typeof username!=='string'||typeof password!=='string'||password.length>256)return null;
   const name=username.toLowerCase().replace(/@mail\.xcenter\.it$/,'');
   const owner=db.prepare('SELECT owner FROM identity_profiles WHERE username=?').get(name)?.owner;
   if(!owner||db.prepare('SELECT 1 FROM account_restrictions WHERE owner=?').get(owner))return null;
   const credentials=db.prepare('SELECT id,salt,hash FROM mail_credentials WHERE owner=?').all(owner);
   for(const credential of credentials){if(timingSafeEqual(Buffer.from(credential.hash),scryptSync(password,credential.salt,32))){db.prepare('UPDATE mail_credentials SET last_used=? WHERE id=?').run(now,credential.id);return {owner,id:credential.id,username:name};}}
   return null;
  },
  close(){db.close();},
 };
}
