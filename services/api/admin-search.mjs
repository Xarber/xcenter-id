const sections=['users','apps','developers','support','usernames','storage'];
const allowedSizes=new Set([10,25,50,100]);

export const matchAdminQuery=(query,...values)=>values.some(value=>typeof value==='string'&&value.toLowerCase().includes(query));

export function createAdminSearch({accounts,registry,mail,volumes}){
  const pending=new Set();
  return async function search(req,res,url){
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    const answer=(status,value)=>res.writeHead(status,headers).end(JSON.stringify(value));
    if(req.method!=='GET')return answer(405,{error:'Method unavailable.'});
    if(accounts.adminStatus(req)!==200)return answer(403,{error:'Confirm administrator access.'});
    const session=accounts.current(req);
    const query=(url.searchParams.get('q')??'').trim().toLowerCase();
    const section=url.searchParams.get('section');
    const page=Number(url.searchParams.get('page')??1);
    const size=Number(url.searchParams.get('size')??10);
    if(query.length<2||query.length>120||section&&!sections.includes(section)||!Number.isSafeInteger(page)||page<1||!allowedSizes.has(size)){
      return answer(422,{error:'Enter a search of 2–120 characters or select a valid page.'});
    }
    if(!session||pending.has(session.hash))return answer(429,{error:'A search is already running.'});
    pending.add(session.hash);
    try{
      const sources={
        users:()=>accounts.searchAdminUsers(query),
        apps:()=>registry.searchAdminApps(query,owner=>accounts.username(owner)),
        developers:()=>registry.searchAdminDevelopers(query,owner=>accounts.username(owner)),
        support:()=>mail?.searchSupport(query,()=>res.destroyed)??[],
        usernames:()=>accounts.searchAdminUsernameChanges(query),
        storage:()=>volumes().filter(item=>matchAdminQuery(query,item.id,item.label,item.status))
          .map(item=>({id:item.id,title:item.label,description:item.status})),
      };
      const groups=Object.create(null);
      for(const key of section?[section]:sections){
        if(res.destroyed)return;
        const entries=await sources[key]();
        const total=entries.length;
        const pages=Math.max(1,Math.ceil(total/size));
        const selected=Math.min(page,pages);
        groups[key]={total,page:selected,items:entries.slice((selected-1)*size,selected*size)};
      }
      if(res.destroyed)return;
      if(accounts.adminStatus(req)!==200||accounts.current(req)?.hash!==session.hash){
        return answer(403,{error:'The administrator session changed.'});
      }
      return answer(200,{groups});
    }finally{
      pending.delete(session.hash);
    }
  };
}
