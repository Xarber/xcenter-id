import {DatabaseSync} from 'node:sqlite';
import {Resolver} from 'node:dns/promises';
import {simpleParser} from 'mailparser';
import {authenticate} from 'mailauth';
export function openMailSenderTrust(path,{admins=[],resolver}={}){
 const db=new DatabaseSync(path,{readOnly:true});const dns=new Resolver({timeout:1800,tries:1});
 return async(raw,{ip,helo,sender})=>{
  const noTrust={verified:false,admin:false};
  if(raw.length>2*1024*1024)return noTrust;
  const parsed=await simpleParser(raw,{skipImageLinks:true,skipTextToHtml:true,skipHtmlToText:true});
  if(parsed.headerLines.filter(h=>h.key==='from').length!==1||parsed.from?.value.length!==1||parsed.headerLines.filter(h=>h.key==='dkim-signature').length>8)return noTrust;
  const address=parsed.from.value[0].address?.toLowerCase();if(!address)return noTrust;
  let owner=db.prepare('SELECT owner FROM verified_emails WHERE address=?').get(address)?.owner;
  const local=/^([a-z][a-z0-9]{2,23})@mail\.xcenter\.it$/.exec(address);
  if(!owner&&local)owner=db.prepare('SELECT owner FROM identity_profiles WHERE username=?').get(local[1])?.owner;
  if(!owner||db.prepare('SELECT 1 FROM account_restrictions WHERE owner=?').get(owner))return noTrust;
  const flags=db.prepare('SELECT verified,admin FROM account_flags WHERE owner=?').get(owner);
  const badges={verified:!!flags?.verified,admin:admins.includes(owner)||!!flags?.admin};
  if(!badges.verified&&!badges.admin)return noTrust;
  const proof=await authenticate(raw,{ip,helo,sender,trustReceived:false,mta:'mail.xcenter.it',minBitLength:2048,
    rejectRsaSha1:true,disableArc:true,disableBimi:true,resolver:resolver??((name,type)=>dns.resolve(name,type))});
  const signed=proof.dkim?.results.some(s=>s.status.result==='pass'&&s.signingDomain?.toLowerCase()===address.split('@')[1]&&
    ['rsa-sha256','ed25519-sha256'].includes(s.algo)&&s.canonBodyLength===s.canonBodyLengthTotal&&
    ['from','subject'].every(field=>s.signingHeaders?.keys?.split(':').map(x=>x.trim().toLowerCase()).includes(field)));
  return signed&&proof.dmarc?.status?.result==='pass'?badges:noTrust;
 };
}
