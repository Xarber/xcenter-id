import {localAccountMessage} from './account-mail.mjs';

export function createAdminUsers({accounts,registry,mail}){
  return async(req,res,username)=>{
    const send=(code,value)=>res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(value));
    const permits=()=>accounts.adminStatus(req,req.method!=='GET')===200&&
      (req.method==='GET'||req.headers['x-authnjs-request']==='account-consent');
    if(!permits())return send(403,{error:'Confirm administrator access.'});
    const details=accounts.adminDetails(username);
    if(!details)return send(404,{error:'Account unavailable.'});
    const {owner,...publicDetails}=details;
    if(req.method==='GET')return send(200,{account:publicDetails,registered:registry.managed(owner)});
    if(req.method!=='POST')return send(405,{error:'Method unavailable.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required.'});
    let size=0;
    const chunks=[];
    for await(const part of req.iterator({destroyOnReturn:false})){
      size+=part.length;
      if(size>8192){req.resume();return send(413,{error:'Request too large.'});}
      chunks.push(part);
    }
    let input;
    try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(422,{error:'Invalid request.'});}
    if(!permits())return send(403,{error:'Confirm administrator access.'});
    if(input.action==='external-mail-limits'){
      try{accounts.setMailLimits(owner,{daily:input.daily,monthly:input.monthly});}catch{return send(422,{error:'Set whole-number mail limits, or leave them unlimited.'});}
    }else if(['verify-user','set-admin'].includes(input.action)){
      try{accounts.setAccountFlag(req,owner,input.action==='verify-user'?'verified':'admin',input.enabled);}catch(error){return send(error.status??400,{error:error.status?error.message:'Could not update account status.'});}
    }else if(input.action==='warn'){
      const text=typeof input.text==='string'&&input.text.trim();
      if(!text||text.length>3000)return send(422,{error:'Enter a warning of up to 3000 characters.'});
      if(!mail)return send(503,{error:'Mailbox delivery unavailable.'});
      const message=await localAccountMessage({from:'X-Center Administration <support@id.xcenter.it>',
        subject:'Account warning from X-Center',text,paragraphs:[text]});
      if(!permits())return send(403,{error:'Confirm administrator access.'});
      if(!mail.notice(owner,message))return send(409,{error:'The mailbox is full.'});
    }else if(['restrict','restore','delete'].includes(input.action)){
      if(typeof input.app!=='string'||input.action==='delete'&&input.confirmation!==input.app)
        return send(422,{error:'Confirm the selected app.'});
      if(!registry.moderate(owner,input.app,input.action))return send(409,{error:'App unavailable.'});
    }else return send(422,{error:'Choose a valid action.'});
    accounts.auditAdmin(req,owner,input.action==='warn'?'warning':input.action+'-app');
    return send(200,{ok:true});
  };
}
