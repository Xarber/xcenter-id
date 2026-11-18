import {createHash,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {Resolver} from 'node:dns/promises';
import {authenticate} from 'mailauth';
import {simpleParser} from 'mailparser';

const recipient='verify@mail.xcenter.it';
const digest=value=>createHash('sha256').update(value).digest('hex');
const addressPattern=/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;

export function openInboundVerification(database,{enabled=false,resolver}={}){
  const db=new DatabaseSync(database);
  db.exec(`PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS account_email_addresses(owner TEXT NOT NULL,address TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(owner,address)) STRICT;
    CREATE TABLE IF NOT EXISTS inbound_verification_results(owner TEXT PRIMARY KEY,address TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS inbound_verifications(owner TEXT PRIMARY KEY, address TEXT NOT NULL,
      hash TEXT UNIQUE NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS inbound_verification_rates(owner TEXT PRIMARY KEY, created INTEGER NOT NULL) STRICT;`);
  const lookup=db.prepare('SELECT * FROM inbound_verifications WHERE hash=? AND expires>?');
  const owner=db.prepare('SELECT * FROM inbound_verifications WHERE owner=?');
  const dns=new Resolver({timeout:1800,tries:1});
  const resolve=resolver??((name,type)=>dns.resolve(name,type));
  function add(account,candidate){
    const address=typeof candidate==='string'?candidate.trim().toLowerCase():'';
    if(address.length>254||!addressPattern.test(address)||address.includes('..'))return {status:422,error:'Enter a valid email address.'};
    if(db.prepare('SELECT count(*) AS n FROM account_email_addresses WHERE owner=?').get(account).n>=10&&!db.prepare('SELECT 1 FROM account_email_addresses WHERE owner=? AND address=?').get(account,address))return {status:409,error:'Verify or remove an address before adding more.'};
    db.prepare('INSERT OR IGNORE INTO account_email_addresses VALUES(?,?,?)').run(account,address,Date.now());
    return {ok:true,address};
  }
  return {
    add,
    addresses:account=>db.prepare('SELECT address,0 AS verified FROM account_email_addresses WHERE owner=? AND address NOT IN(SELECT address FROM verified_emails WHERE owner=?)').all(account,account),
    result:account=>db.prepare('SELECT address,status,created FROM inbound_verification_results WHERE owner=?').get(account)??null,
    enabled,
    recipient,
    start(account,candidate){
      if(!enabled)return {status:503,error:'Incoming email verification is unavailable.'};
      const address=typeof candidate==='string'?candidate.trim().toLowerCase():'';
      if(address.length>254||!addressPattern.test(address)||address.includes('..'))return {status:422,error:'Enter a valid email address.'};
      const existing=db.prepare('SELECT owner FROM verified_emails WHERE address=?').get(address);
      if(existing?.owner===account)return {status:409,error:'This address is already verified on your account.'};
      const added=add(account,address);if(!added.ok)return added;
      const now=Date.now();
      db.prepare('DELETE FROM inbound_verifications WHERE expires<=?').run(now);
      db.prepare('DELETE FROM inbound_verification_rates WHERE created<?').run(now-3600_000);
      if(now-(db.prepare('SELECT created FROM inbound_verification_rates WHERE owner=?').get(account)?.created??0)<60_000||
        db.prepare('SELECT count(*) AS n FROM inbound_verification_rates WHERE created>?').get(now-60_000).n>=30)
        return {status:429,error:'Please wait before requesting another verification.'};
      db.prepare('DELETE FROM inbound_verification_results WHERE owner=?').run(account);
      const code=randomBytes(32).toString('base64url');
      const expires=now+20*60_000;
      db.prepare(`INSERT INTO inbound_verifications VALUES (?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET
        address=excluded.address,hash=excluded.hash,created=excluded.created,expires=excluded.expires`)
        .run(account,address,digest(code),now,expires);
      db.prepare('INSERT INTO inbound_verification_rates VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET created=excluded.created').run(account,now);
      const subject='X-Center ID email verification '+code;
      const text='Hello X-Center ID,\n\nI am sending this message from '+address+
        ' to verify that I control this email address for my X-Center ID account.\n\nVerification code: '+code+
        '\n\nPlease send this email from '+address+' with the subject unchanged. This code expires in 20 minutes. '+
        'If you did not request this verification, do not send this message.\n';
      return {ok:true,address,expires,mailto:'mailto:'+recipient+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(text)};
    },
    pending(account){
      const record=owner.get(account);
      return record&&record.expires>Date.now()?{address:record.address,expires:record.expires}:null;
    },
    async receive(raw,{ip,helo,sender}){
      if(!enabled||raw.length>64*1024)return false;
      const parsed=await simpleParser(raw,{skipHtmlToText:true,skipTextToHtml:true,skipImageLinks:true});
      if(parsed.headerLines.filter(header=>header.key==='dkim-signature').length>8)return false;
      if(parsed.headerLines.filter(header=>header.key==='from').length!==1||
        parsed.from?.value.length!==1)return false;
      const from=parsed.from.value[0].address?.toLowerCase();
      const code=/^X-Center ID email verification ([A-Za-z0-9_-]{43})$/.exec(parsed.subject??'')?.[1];
      if(!code)return false;
      const record=lookup.get(digest(code),Date.now());
      if(!record||record.address!==from||!parsed.text?.includes('Verification code: '+code))return false;
      const domain=from.split('@')[1];
      // Recompute authentication from the original message and SMTP peer. Sender headers are untrusted.
      const result=await authenticate(raw,{ip,helo,sender,trustReceived:false,mta:'mail.xcenter.it',
        minBitLength:2048,rejectRsaSha1:true,disableArc:true,disableBimi:true,resolver:resolve});
      const signed=result.dkim?.results.some(signature=>signature.status.result==='pass'&&
        signature.signingDomain?.toLowerCase()===domain&&['rsa-sha256','ed25519-sha256'].includes(signature.algo)&&
        signature.canonBodyLength===signature.canonBodyLengthTotal&&
        ['from','subject'].every(field=>signature.signingHeaders?.keys?.split(':').map(key=>key.trim().toLowerCase()).includes(field)));
      if(result.dmarc?.status?.result!=='pass'||!signed)return false;
      db.exec('BEGIN IMMEDIATE');
      try{
        const current=lookup.get(digest(code),Date.now());
        const valid=current&&current.owner===record.owner&&current.address===from&&
          !db.prepare('SELECT 1 FROM account_restrictions WHERE owner=?').get(record.owner);
        if(!valid){db.exec('ROLLBACK');return false;}
        const previous=db.prepare('SELECT owner FROM verified_emails WHERE address=?').get(from)?.owner;
        const competing=db.prepare('SELECT owner FROM inbound_verifications WHERE address=?').all(from);
        db.prepare('DELETE FROM verified_emails WHERE address=?').run(from);
        db.prepare('INSERT INTO verified_emails VALUES(?,?,?)').run(record.owner,from,Date.now());
        // Invalidate sign-in/verification capabilities issued before this address transfer.
        if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='email_signins'").get()){
          for(const account of new Set([previous,record.owner].filter(Boolean)))db.prepare('DELETE FROM email_signins WHERE owner=?').run(account);
        }
        if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='email_verifications'").get())db.prepare('DELETE FROM email_verifications WHERE address=?').run(from);
        for(const request of competing)db.prepare('INSERT INTO inbound_verification_results VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET address=excluded.address,status=excluded.status,created=excluded.created')
          .run(request.owner,from,request.owner===record.owner?'verified':'superseded',Date.now());
        db.prepare('DELETE FROM account_email_addresses WHERE owner=? AND address=?').run(record.owner,from);
        db.prepare('DELETE FROM inbound_verifications WHERE address=?').run(from);
        db.exec('COMMIT');
        return true;
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    close(){db.close();},
  };
}
