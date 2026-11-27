import {randomBytes} from 'node:crypto';
import {approvalJson,appApprovalPath} from './app-approval.mjs';
import {accountApprovalPath} from './account-approval.mjs';
import {readJson} from './server.mjs';

export function createNativeApproval({accounts,provider,approvals,accountApproval}){
  const reviews=new Map();
  const error=(res,status,message)=>approvalJson(res,{error:message},status);
  const expired=res=>error(res,409,'This sign-in request expired or was already handled. Start again on the original device.');
  return async function nativeApproval(req,res){
    const active=accounts.nativeCurrent(req);
    if(!active)return error(res,401,'Sign in to the X-Center ID app first.');
    if(req.method!=='POST')return error(res,405,'Method unavailable.');
    let input;
    try{input=await readJson(req,16384);}catch{return error(res,400,'Invalid device approval request.');}
    for(const [key,review] of reviews)if(review.expires<=Date.now())reviews.delete(key);
    const replying=input.review!==undefined;
    let entry;
    if(replying){
      entry=typeof input.review==='string'&&reviews.get(input.review);
      if(!entry||entry.session!==active.hash||entry.busy)return expired(res);
      if(!['approve','deny'].includes(input.action))return error(res,422,'Choose whether to approve.');
      entry.busy=true;
    }else{
      if(reviews.size>=2048)return error(res,429,'Try again in a moment.');
      let path,device;
      if(typeof input.target==='string'&&(appApprovalPath.test(input.target)||accountApprovalPath.test(input.target)))path=input.target;
      else if(typeof input.code==='string'&&/^[A-Z0-9]{6}$/.test(input.code)){
        try{accounts.limitDeviceCodeLookup(active.owner);}catch{return error(res,429,'Too many code attempts. Try again shortly.');}
        if(/^\d{6}$/.test(input.code))path=accountApproval.codePath(input.code);
        else device=await provider.nativeDeviceId(input.code);
      }
      if(!path&&!device)return expired(res);
      entry={path,device,session:active.hash,expires:Date.now()+120000,busy:false};
    }
    try{
      const current=()=>accounts.nativeCurrent(req)?.hash===active.hash;
      const respond=(result,status=200)=>{
        if(status!==200)return error(res,status,result.error);
        if(replying){reviews.delete(input.review);return approvalJson(res,result);}
        if(reviews.size>=2048)return error(res,429,'Try again in a moment.');
        const review=randomBytes(32).toString('base64url');
        reviews.set(review,entry);
        return approvalJson(res,{...result,review});
      };
      const account=entry.path&&accountApprovalPath.exec(entry.path);
      if(account){
        const request=approvals.forScan(account[1]);
        if(!request?.account||!approvals.pending(request)||!current())return expired(res);
        if(replying){
          request.result=input.action==='approve'?{owner:active.owner,source:active.hash}:{denied:true};
          return respond({approved:input.action==='approve'});
        }
        const person=accounts.identity(active.owner);
        if(!person)return expired(res);
        return respond({kind:'account',name:'X-Center ID',username:person.username});
      }
      return await provider.interaction(req,res,entry.path??'/device', {
        active,device:entry.device,input:replying?input:null,respond,current,
      });
    }finally{entry.busy=false;}
  };
}
