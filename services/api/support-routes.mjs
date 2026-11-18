import nodemailer from 'nodemailer';

const output = nodemailer.createTransport({streamTransport:true, buffer:true, disableFileAccess:true, disableUrlAccess:true});
const message = async (subject,text) => (await output.sendMail({from:'X-Center Support <support@id.xcenter.it>',
  subject,text,headers:{'Auto-Submitted':'auto-generated'}})).message;
const paths = /^\/account\/(support|admin\/support)(?:\/([0-9a-f-]{36}))?$/;
const answer = (res,code,value) => res.writeHead(code,{'Cache-Control':'no-store',
  'Content-Type':'application/json','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(value));

async function input(req) {
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return null;
  const chunks=[];
  let size=0;
  for await (const part of req.iterator({destroyOnReturn:false})) {
    size+=part.length;
    if(size>16_384){req.resume();return null;}
    chunks.push(part);
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return null;}
}

export function createSupportRoutes({accounts,mail}) {
  return async (req,res,path)=>{
    const route=paths.exec(path);
    if(!route)return answer(res,404,{error:'Support route unavailable.'});
    const admin=route[1]==='admin/support';
    const id=route[2];
    const current=admin?accounts.current(req):accounts.supportCurrent(req);
    if(!current)return answer(res,401,{error:'Sign in to use support.'});
    if(admin&&accounts.adminStatus(req)!==200)return answer(res,403,{error:'Administrator access is required.'});
    if(!mail)return answer(res,503,{error:'Support mail is unavailable.'});
    if(!admin&&req.method==='GET'&&!id)return answer(res,200,{requests:await mail.ownSupport(current.owner)});
    if(admin&&req.method==='GET'){
      if(!id)return answer(res,200,{requests:mail.listSupport()});
      const details=await mail.readSupport(id);
      return details?answer(res,200,details):answer(res,404,{error:'Request unavailable.'});
    }
    if((req.method!=='POST'&&req.method!=='DELETE')||(admin?!id:!!id) ||
      (!admin&&req.method!=='POST'))return answer(res,405,{error:'Method unavailable.'});
    const permits=()=>(admin?accounts.current(req)&&accounts.allowsMutation(req):
      accounts.supportCurrent(req)?.owner===current.owner&&accounts.allowsSupportMutation(req))&&req.headers['x-authnjs-request']==='account-consent';
    if(!permits())return answer(res,403,{error:'Open the account manager to continue.'});
    if(admin&&req.method==='DELETE'){
      if(accounts.adminStatus(req,true)!==200)return answer(res,403,{error:'Confirm your identity before removing a request.'});
      return mail.removeSupport(id)?answer(res,200,{ok:true}):answer(res,404,{error:'Request unavailable.'});
    }
    const data=await input(req);
    const text=typeof data?.text==='string'&&data.text.trim();
    const subject=typeof data?.subject==='string'&&data.subject.trim();
    if(!text||text.length>3000||(!admin&&(!subject||subject.length>120||/[\r\n\u0000]/.test(subject))))
      return answer(res,422,{error:'Check the message and subject length.'});
    const content=await message(admin?'Reply from X-Center Support':subject,text);
    if(!permits())return answer(res,403,{error:'Sign in again to continue.'});
    if(admin){
      return mail.replySupport(id,content)?answer(res,200,{ok:true}):
        answer(res,409,{error:'This request was already answered, or its mailbox is unavailable.'});
    }
    if(!accounts.username(current.owner))return answer(res,403,{error:'Finish setting up your profile.'});
    return mail.submitSupport(current.owner,content)?answer(res,201,{ok:true}):
      answer(res,429,{error:'Support is at its message limit. Try again later.'});
  };
}
