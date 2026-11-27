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
    if(entry.expires>now())return entry;
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
      const entry={uid:details.uid,key,code,expires,processing:false,result:null};
      byInteraction.set(details.uid,entry);
      bySecret.set(digest(key),entry);
      byCode.set(code,entry);
      return entry;
    },
    pending:entry=>current(byInteraction.get(entry.uid))===entry&&!entry.result&&!entry.processing,
    remove,
  };
}

export function approvalQr(url) {
  const pixels=toQR(url);
  const width=Math.sqrt(pixels.length);
  const marks=Array.from(pixels,(dark,i)=>dark?`M${i%width},${Math.floor(i/width)}h1v1h-1z`:'').join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR code to approve sign-in" viewBox="-4 -4 ${width+8} ${width+8}" width="220" height="220" shape-rendering="crispEdges" style="display:block;max-width:100%;background:white"><path fill="black" d="${marks}"/></svg>`;
}


export function approvalDetails(origin,path,entry){
  const image='data:image/svg+xml;base64,'+Buffer.from(approvalQr(origin+path+entry.key)).toString('base64');
  return {image,code:entry.code,expires:entry.expires};
}

export function approvalJson(res,value,status=200){
  return res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(value));
}


export function returnToNativeReview(res){
  return res.writeHead(303,{Location:'authnjs-dashboard://device-review','Cache-Control':'no-store'}).end();
}
