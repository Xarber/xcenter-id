import {createHash,randomBytes,randomInt} from 'node:crypto';
import {toQR} from 'toqr';

export const appApprovalPath=/^\/app-approval\/([A-Za-z0-9_-]{43})$/;
const digest=key=>createHash('sha256').update(key).digest('hex');

export function createAppApprovals(now=Date.now) {
  const byInteraction=new Map();
  const bySecret=new Map();
  const byCode=new Map();
  function remove(entry){
    byInteraction.delete(entry.uid);
    bySecret.delete(digest(entry.key));
    byCode.delete(entry.code);
  }
  function current(entry){
    if(!entry)return null;
    if(entry.expires>now()&&entry.attempts<8)return entry;
    remove(entry);
    return null;
  }
  return {
    forInteraction:uid=>current(byInteraction.get(uid)),
    forScan:key=>current(bySecret.get(digest(key))),
    forCode:code=>current(byCode.get(code)),
    start(details){
      const prior=current(byInteraction.get(details.uid));
      if(prior)return prior;
      for(const entry of byInteraction.values())current(entry);
      if(byInteraction.size>=2048)return null;
      const key=randomBytes(32).toString('base64url');
      let code;
      do{code=String(randomInt(1000000)).padStart(6,'0');}while(byCode.has(code));
      const expires=Math.min(now()+180000,details.exp*1000);
      if(!Number.isFinite(expires)||expires<=now())return null;
      const entry={uid:details.uid,key,code,expires,attempts:0,processing:false,result:null};
      byInteraction.set(details.uid,entry);
      bySecret.set(digest(key),entry);
      byCode.set(code,entry);
      return entry;
    },
    matches(entry,code){
      if(current(byInteraction.get(entry.uid))!==entry||entry.result||entry.processing)return false;
      if(code===entry.code)return true;
      entry.attempts++;
      return false;
    },
    remove,
  };
}

export function approvalQr(url) {
  const pixels=toQR(url);
  const width=Math.sqrt(pixels.length);
  const marks=Array.from(pixels,(dark,i)=>dark?`M${i%width},${Math.floor(i/width)}h1v1h-1z`:'').join('');
  return `<svg role="img" aria-label="QR code to approve app sign-in" viewBox="-4 -4 ${width+8} ${width+8}" width="220" height="220" shape-rendering="crispEdges" style="display:block;max-width:100%;background:white"><path fill="black" d="${marks}"/></svg>`;
}
