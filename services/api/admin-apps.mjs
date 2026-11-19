export function createAdminAppRoutes({accounts,registry}){
  return async (req,res)=>{
    const answer=(status,value)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(value));
    const write=req.method==='POST';
    if(accounts.adminStatus(req,write)!==200||write&&req.headers['x-authnjs-request']!=='account-consent'){
      return answer(403,{error:'Confirm administrator access.'});
    }
    if(req.method==='GET'){
      const {apps,developers}=registry.administration();
      return answer(200,{apps,developers:developers.map(item=>({...item,name:item.name||accounts.username?.(item.owner)||'Developer'}))});
    }
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
      if(accounts.adminStatus(req,true)!==200)return answer(403,{error:'Confirm administrator access.'});
      if(type==='developer'&&accounts.available&&!accounts.available(id))return answer(404,{error:'Developer account unavailable.'});
      const updated=type==='app'?registry.verifyApp(id,verified):registry.verifyDeveloper(id,verified,accounts.username?.(id));
      return updated?answer(200,{ok:true}):answer(409,{error:'This app or request cannot be verified.'});
    }catch{return answer(400,{error:'Invalid verification request.'});}
  };
}
