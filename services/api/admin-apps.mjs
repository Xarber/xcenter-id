export function createAdminAppRoutes({accounts,registry}){
  return async (req,res)=>{
    const answer=(status,value)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(value));
    const write=req.method==='POST';
    if(accounts.adminStatus(req,write)!==200||write&&req.headers['x-authnjs-request']!=='account-consent'){
      return answer(403,{error:'Sign in again with an administrator account.'});
    }
    if(req.method==='GET')return answer(200,registry.administration());
    if(!write)return answer(405,{error:'Method unavailable.'});
    try{
      let body='';
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        body+=chunk.toString();
        if(body.length>2048){req.resume();return answer(413,{error:'Request too large.'});}
      }
      const {type,id,verified}=JSON.parse(body);
      if(!['app','developer'].includes(type)||typeof id!=='string'||id.length>100||typeof verified!=='boolean'){
        return answer(422,{error:'Choose an app or developer.'});
      }
      const updated=type==='app'?registry.verifyApp(id,verified):registry.verifyDeveloper(id,verified);
      return updated?answer(200,{ok:true}):answer(409,{error:'This app or request cannot be verified.'});
    }catch{return answer(400,{error:'Invalid verification request.'});}
  };
}
