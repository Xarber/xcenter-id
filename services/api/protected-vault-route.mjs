import {readJson} from './server.mjs';

const requestPattern=/^[A-Za-z0-9_-]{43}$/;
const objectId=/^[A-Za-z0-9_-]{1,100}$/;

export function protectedVaultRoute({vault,accounts}){
  return async function handle(req,res,url){
    const reply=(status,value)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}).end(JSON.stringify(value));
    const session=accounts.current(req);
    if(!session)return reply(401,{error:'Sign in to access protected storage.'});
    const {owner,hash}=session;
    const [, , , action,namespace,id]=url.pathname.split('/');
    try{
      if(req.method==='GET'){
        if(!action)return reply(200,{vault:vault.info(owner)});
        if(action==='object'&&objectId.test(namespace??'')&&objectId.test(id??'')&&url.pathname.split('/').length===6){
          const record=vault.object(owner,namespace,id);
          return record?reply(200,record):reply(404,{error:'Protected object unavailable.'});
        }
        return reply(404,{error:'Protected storage endpoint unavailable.'});
      }
      if(req.method!=='POST'||namespace!==undefined)return reply(405,{error:'Method unavailable.'});
      if(!accounts.allowsMutation(req)||req.headers['x-authnjs-request']!=='account-consent'){
        return reply(403,{error:'Use your account to change protected storage.'});
      }
      const input=await readJson(req,action==='object'?134*1024:8192);
      const active=accounts.current(req);
      if(active?.owner!==owner||active.hash!==hash)return reply(403,{error:'Your session changed.'});
      if(['initialize','approve','request-device','pending'].includes(action)&&!accounts.recentlyConfirmed(req)){
        return reply(403,{error:'Confirm your identity for this protected storage action.'});
      }
      if(action==='initialize'){
        const created=vault.create(owner,input.id,input.recovery,input.device);
        return created?reply(201,{id:input.id}):reply(409,{error:'Protected vault could not be initialized.'});
      }
      if(action==='request-web'||action==='request-device'){
        const request=action==='request-web'?vault.requestWeb(owner,input.namespace,hash,input.target):
          vault.requestDevice(owner,hash,input.target,input.device);
        return request?reply(201,request):reply(409,{error:'Protected access cannot be requested.'});
      }
      if(action==='pending')return reply(200,{requests:vault.pending(owner,input.device)});
      if(action==='approve'){
        const approved=vault.approve(owner,input.device,input.approval,input.signature);
        return approved?reply(200,{ok:true}):reply(409,{error:'This approval is invalid or unavailable.'});
      }
      if(action==='claim'){
        const approved=typeof input.id==='string'&&requestPattern.test(input.id)&&vault.claim(owner,input.id,hash,input);
        return approved?reply(200,approved):reply(404,{error:'No approved access for this session.'});
      }
      if(action==='object'){
        const saved=vault.putObject(owner,input);
        return saved?reply(200,{revision:input.revision}):reply(409,{error:'Protected data or app permission changed.'});
      }
      return reply(404,{error:'Protected storage endpoint unavailable.'});
    }catch(error){
      return reply(error.status??503,{error:error.status?'Invalid protected storage request.':'Protected storage is unavailable.'});
    }
  };
}
