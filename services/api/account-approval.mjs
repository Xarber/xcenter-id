import {createHash,randomBytes} from 'node:crypto';
import {approvalQr} from './app-approval.mjs';

export const accountApprovalPath=/^\/account-approval\/([A-Za-z0-9_-]{43})$/;
export const approvalTarget=path=>/^\/(?:account-approval|app-approval)\/[A-Za-z0-9_-]{43}$/.test(path);
const cookieName='__Host-xid-account-approval';
const nativeReturn=/^\/native-session\?challenge=[A-Za-z0-9_-]{43}&state=[A-Za-z0-9_-]{43}$/;
const browserId=value=>createHash('sha256').update(value).digest('base64url');
const page=(res,status,content,nonce='')=>res.writeHead(status,{
  'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':`default-src 'none'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'${nonce?`; script-src 'nonce-${nonce}'`:''}`,
}).end(`<!doctype html><html lang="en"><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Sign in with X-Center ID</title>
<style>body{color-scheme:light dark;font:1rem/1.55 system-ui;margin:0;padding:1.5rem}main{max-width:32rem;margin:auto}button,input{font:inherit;padding:.55rem}svg{border-radius:.6rem}</style><main>${content}</main></html>`);

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
      const active=accounts.deviceBrowserSession(req,path)||session(req);
      if(!active)return res.writeHead(303,{Location:'/signin?continue='+encodeURIComponent(path),'Cache-Control':'no-store'}).end();
      const proof=browserId(entry.key+':'+active.hash);
      if(req.method==='GET')return page(res,200,`<h1>Sign in to X-Center ID on another device?</h1>
        <p>This adds your account to the device that started the request. Continue only if you started it.</p>
        <form method="post"><input type="hidden" name="proof" value="${proof}"><label>Code from the original device <input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" required></label>
        <p><button type="submit">Approve sign-in</button></p></form>`);
      if(req.method!=='POST'||req.headers.origin!==origin)return page(res,403,'<h1>Could not verify the request</h1>');
      let body='';
      for await(const chunk of req){body+=chunk;if(body.length>1024)return ended();}
      const input=new URLSearchParams(body);
      if(input.get('proof')!==proof||(accounts.deviceBrowserSession(req,path)||session(req))?.hash!==active.hash||
        !approvals.matches(entry,input.get('code')))return page(res,409,'<h1>Code could not be confirmed</h1>');
      entry.result={owner:active.owner,source:active.hash};
      return page(res,200,'<h1>Sign-in approved</h1><p>Return to the device where you started.</p>');
    }
    if(path==='/account-approval/status'&&req.method==='GET'){
      const state=own?.result?'ready':own?'waiting':'expired';
      return res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({state}));
    }
    if(path==='/account-approval/finish'&&req.method==='POST'){
      if(req.headers.origin!==origin||!own?.result)return ended();
      approvals.remove(own);
      if(!accounts.finishApprovedSignIn(req,res,own.result))return page(res,409,'<h1>Could not add this account</h1><a href="/signin?addAccount=1">Try again</a>');
      return res.writeHead(303,{Location:own.destination,'Cache-Control':'no-store'}).end();
    }
    if(path!=='/account-approval/start'||req.method!=='GET')return ended();
    if(own)approvals.remove(own);
    const secret=randomBytes(32).toString('base64url');
    const entry=approvals.start({uid:'browser:'+browserId(secret),exp:Date.now()/1000+180});
    if(!entry)return page(res,429,'<h1>Try again in a moment</h1>');
    entry.account=true;
    const destination=url.searchParams.get('continue')??'';
    entry.destination=nativeReturn.test(destination)?destination:'/dashboard';
    res.setHeader('Set-Cookie',cookieName+'='+secret+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=180');
    const nonce=randomBytes(18).toString('base64');
    return page(res,200,`<h1>Sign in on another device</h1><p>Scan in the signed-in X-Center ID app, or enter these digits on that device.</p>
      ${approvalQr(origin+devicePath(entry))}<p><strong>${entry.code}</strong></p><p id="status" role="status">Waiting for approval…</p>
      <form id="finish" action="/account-approval/finish" method="post" hidden></form><p><a href="/signin">Use a passkey instead</a></p>
      <script nonce="${nonce}">async function poll(){try{const {state}=await (await fetch('/account-approval/status',{cache:'no-store'})).json();
      if(state==='ready'){document.querySelector('#finish').requestSubmit();return;}
      if(state==='expired'){document.querySelector('#status').textContent='Code expired. Reload to try again.';return;}}catch{}setTimeout(poll,2000);}poll();</script>`,nonce);
  }
  return {handle,codePath:code=>{const entry=approvals.forCode(code);return entry&&!entry.result?devicePath(entry):null;}};
}
