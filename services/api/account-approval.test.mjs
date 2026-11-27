import {createServer} from 'node:http';
import {once} from 'node:events';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAccountApprovalRoute} from './account-approval.mjs';
import {createAppApprovals} from './app-approval.mjs';

test('account QR waits for explicit approval and saves only to the originating browser',async t=>{
  const origin='https://id.example.test';
  const approvals=createAppApprovals();
  const {handle,codePath}=createAccountApprovalRoute({origin,approvals,accounts:{
    current:req=>req.headers.authorization==='approver'?{owner:'account',hash:'existing'}:null,
    deviceBrowserSession:()=>null,
    finishApprovedSignIn(_req,res,approval){
      assert.deepEqual(approval,{owner:'account',source:'existing'});
      res.setHeader('set-cookie','account=selected; Secure; HttpOnly');
      return true;
    },
  }});
  const server=createServer((req,res)=>void handle(req,res,new URL(req.url,origin))).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const host='http://127.0.0.1:'+server.address().port;
  const call=(path,options)=>fetch(host+path,{redirect:'manual',...options});
  const start=await call('/account-approval/start?continue=https://another.example.test');
  const cookie=start.headers.get('set-cookie').split(';')[0];
  const code=(await start.text()).match(/<strong>(\d{6})<\/strong>/)?.[1];
  const path=codePath(code);
  assert.match(path,/^\/account-approval\//);
  assert.deepEqual(await (await call('/account-approval/status',{headers:{cookie}})).json(),{state:'waiting'});
  const html=await (await call(path,{headers:{authorization:'approver'}})).text();
  const proof=html.match(/name="proof" value="([^"]+)"/)?.[1];
  const approve=await call(path,{method:'POST',headers:{origin,authorization:'approver'},body:new URLSearchParams({code,proof})});
  assert.equal(approve.status,200);
  assert.equal(approve.headers.get('set-cookie'),null);
  assert.equal((await call('/account-approval/finish',{method:'POST',headers:{origin}})).status,400);
  const finish=await call('/account-approval/finish',{method:'POST',headers:{origin,cookie}});
  assert.equal(finish.headers.get('location'),'/dashboard');
  assert.match(finish.headers.get('set-cookie'),/^account=selected/);
  assert.equal((await call('/account-approval/finish',{method:'POST',headers:{origin,cookie}})).status,400);
});
