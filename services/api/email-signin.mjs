import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const lifetime=5*60_000;
const nonce=()=>randomBytes(32).toString('base64url');

export function openEmailSignIn(db,{send,secret}) {
  db.exec(`CREATE TABLE IF NOT EXISTS email_signins(
    owner TEXT PRIMARY KEY REFERENCES accounts(id), ticket TEXT NOT NULL UNIQUE,
    digest BLOB NOT NULL, channel TEXT NOT NULL, attempts INTEGER NOT NULL,
    created INTEGER NOT NULL, expires INTEGER NOT NULL
  ) STRICT;`);
  const recent=db.prepare('SELECT created FROM email_signins WHERE owner=?');
  const total=db.prepare('SELECT count(*) AS count FROM email_signins WHERE created>?');
  const save=db.prepare(`INSERT INTO email_signins VALUES (?,?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET
    ticket=excluded.ticket,digest=excluded.digest,channel=excluded.channel,attempts=excluded.attempts,
    created=excluded.created,expires=excluded.expires`);
  const attempt=db.prepare(`UPDATE email_signins SET attempts=attempts-1
    WHERE ticket=? AND channel=? AND expires>? AND attempts>0 RETURNING owner,digest`);
  const used=db.prepare('UPDATE email_signins SET expires=0 WHERE ticket=?');
  const hash=(ticket,code)=>createHmac('sha256',secret).update(ticket+':'+code).digest();
  return {
    enabled:!!send,
    async start(owner,address,channel) {
      const now=Date.now();
      if(!send)return {status:503,error:'Email sign-in is unavailable. Use a passkey.'};
      if(now-(recent.get(owner)?.created??0)<60_000||total.get(now-60_000).count>=25){
        return {status:429,error:'Wait a minute before requesting another code.'};
      }
      const ticket=nonce();
      const code=String(randomInt(1_000_000)).padStart(6,'0');
      save.run(owner,ticket,hash(ticket,code),channel,5,now,now+lifetime);
      try{await send({address,code});}
      catch{used.run(ticket);return {status:503,error:'Could not send a code. You can sign in with a passkey.'};}
      return {method:'email',ticket};
    },
    finish(ticket,code,channel) {
      if(typeof ticket!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(ticket)||typeof code!=='string'||!/^\d{6}$/.test(code))return null;
      db.exec('BEGIN IMMEDIATE');
      try {
        const row=attempt.get(ticket,channel,Date.now());
        const accepted=row&&timingSafeEqual(row.digest,hash(ticket,code));
        if(accepted)used.run(ticket);
        db.exec('COMMIT');
        return accepted?row.owner:null;
      } catch(error){db.exec('ROLLBACK');throw error;}
    },
  };
}
