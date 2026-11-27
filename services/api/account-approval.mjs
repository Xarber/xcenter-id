import {createHash,randomBytes} from 'node:crypto';
import {approvalDetails,approvalJson,returnToNativeReview} from './app-approval.mjs';
import {html} from './oidc.mjs';

export const accountApprovalPath=/^\/account-approval\/([A-Za-z0-9_-]{43})$/;
export const approvalTarget=path=>/^\/(?:account-approval|app-approval)\/[A-Za-z0-9_-]{43}$/.test(path);
const cookieName='__Host-xid-account-approval';
const nativeReturn=/^\/native-session\?challenge=[A-Za-z0-9_-]{43}&state=[A-Za-z0-9_-]{43}$/;
const browserId=value=>createHash('sha256').update(value).digest('base64url');
const page=(res,status,content)=>html(res,content,status,'',true);

export function createAccountApprovalRoute({approvals,accounts,origin}){
  const session=req=>accounts.current(req);
  function devicePath(entry){return (entry.account?'/account-approval/':'/app-approval/')+entry.key;}
  async function handle(req,res,url){
    const path=url.pathname;
    const scan=accountApprovalPath.exec(path);
    const cookie=req.headers.cookie?.match(/(?:^|; )__Host-xid-account-approval=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
    const own=cookie&&approvals.forInteraction('browser:'+browserId(cookie));
    const ended=()=>page(res,400,'<h1>Sign-in request expired</h1><p>Return to the device where you started and try again.</p>');
    if(scan){
      const entry=approvals.forScan(scan[1]);
      if(!entry?.account||entry.result)return ended();
      const native=accounts.deviceBrowserSession(req,path);
      const active=native||session(req);
      if(!active)return res.writeHead(303,{Location:'/signin?continue='+encodeURIComponent(path),'Cache-Control':'no-store'}).end();
      const proof=browserId(entry.key+':'+active.hash);
      if(req.method==='GET')return page(res,200,`<h1>Sign in to X-Center ID on another device?</h1>
        <p>This adds your account to the device that started the request. Continue only if you started it.</p>
        <form method="post"><input type="hidden" name="proof" value="${proof}">
        <p><button name="action" value="approve" type="submit">Approve sign-in</button><button name="action" value="cancel" type="submit">Cancel</button></p></form>`);
      if(req.method!=='POST'||req.headers.origin!==origin)return page(res,403,'<h1>Could not verify the request</h1>');
      let body='';
      for await(const chunk of req){body+=chunk;if(body.length>1024)return ended();}
      const input=new URLSearchParams(body);
      if(input.get('proof')!==proof||(accounts.deviceBrowserSession(req,path)||session(req))?.hash!==active.hash||
        !approvals.pending(entry))return page(res,409,'<h1>Approval could not be confirmed</h1>');
      if(input.get('action')==='cancel'){
        entry.result={denied:true};
        return native?returnToNativeReview(res):res.writeHead(303,{Location:'/devices','Cache-Control':'no-store'}).end();
      }
      if(input.get('action')!=='approve')return page(res,422,'<h1>Choose how to proceed</h1>');
      entry.result={owner:active.owner,source:active.hash};
      if(native)return returnToNativeReview(res);
      return page(res,200,'<h1>Sign-in approved</h1><p>Return to the device where you started.</p><a class="action" href="/devices">Done</a>');
    }
    if(path==='/account-approval/status'&&req.method==='GET'){
      const state=own?.result?.denied?'denied':own?.result?'ready':own?'waiting':'expired';
      return res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({state}));
    }
    if(path==='/account-approval/finish'&&req.method==='POST'){
      if(req.headers.origin!==origin||!own?.result||own.result.denied)return ended();
      approvals.remove(own);
      if(!accounts.finishApprovedSignIn(req,res,own.result))return page(res,409,'<h1>Could not add this account</h1><a href="/signin?addAccount=1">Try again</a>');
      return res.writeHead(303,{Location:own.destination,'Cache-Control':'no-store'}).end();
    }
    if(path!=='/account-approval/start')return ended();
    const destination=url.searchParams.get('continue')??'';
    if(req.method==='GET'){
      const params=new URLSearchParams({qr:'1'});
      if(nativeReturn.test(destination))params.set('continue',destination);
      if(session(req)||url.searchParams.has('addAccount'))params.set('addAccount','1');
      return res.writeHead(303,{Location:'/signin?'+params,'Cache-Control':'no-store'}).end();
    }
    if(req.method!=='POST'||req.headers.origin!==origin)return approvalJson(res,{error:'Invalid sign-in request.'},403);
    if(own)approvals.remove(own);
    const secret=randomBytes(32).toString('base64url');
    const entry=approvals.start({uid:'browser:'+browserId(secret),exp:Date.now()/1000+180});
    if(!entry)return approvalJson(res,{error:'Try again in a moment.'},429);
    entry.account=true;
    entry.destination=nativeReturn.test(destination)?destination:'/dashboard';
    res.setHeader('Set-Cookie',cookieName+'='+secret+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=180');
    return approvalJson(res,approvalDetails(origin,'/account-approval/',entry));
  }
  return {handle,codePath:code=>{const entry=approvals.forCode(code);return entry&&!entry.result?devicePath(entry):null;}};
}
