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
    deviceBrowserSession:req=>req.headers.authorization==='native'?{owner:'account',hash:'existing'}:null,
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
  const startPath='/account-approval/start?continue=https://another.example.test';
  assert.equal((await call(startPath)).headers.get('location'),'/signin?qr=1');
  assert.equal((await call(startPath,{method:'POST'})).status,403);
  const start=await call(startPath,{method:'POST',headers:{origin}});
  const cookie=start.headers.get('set-cookie').split(';')[0];
  const {code,image}=await start.json();
  assert.match(image,/^data:image\/svg\+xml;base64,/);
  assert.match(Buffer.from(image.split(',')[1],'base64').toString(),/xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  const path=codePath(code);
  assert.match(path,/^\/account-approval\//);
  assert.deepEqual(await (await call('/account-approval/status',{headers:{cookie}})).json(),{state:'waiting'});
  const html=await (await call(path,{headers:{authorization:'approver'}})).text();
  assert.doesNotMatch(html,/Code from the original device/);
  const proof=html.match(/name="proof" value="([^"]+)"/)?.[1];
  const approve=await call(path,{method:'POST',headers:{origin,authorization:'approver'},body:new URLSearchParams({action:'approve',proof})});
  assert.equal(approve.status,200);
  assert.equal(codePath(code),null);
  assert.equal(approve.headers.get('set-cookie'),null);
  assert.equal((await call('/account-approval/finish',{method:'POST',headers:{origin}})).status,400);
  const finish=await call('/account-approval/finish',{method:'POST',headers:{origin,cookie}});
  assert.equal(finish.headers.get('location'),'/dashboard');
  assert.match(finish.headers.get('set-cookie'),/^account=selected/);
  assert.equal((await call('/account-approval/finish',{method:'POST',headers:{origin,cookie}})).status,400);
  const nativeStart=await call('/account-approval/start',{method:'POST',headers:{origin}});
  const nativeCode=(await nativeStart.json()).code;
  const nativePath=codePath(nativeCode);
  const headers={origin,authorization:'native'};
  const nativeReview=await (await call(nativePath,{headers})).text();
  const nativeProof=nativeReview.match(/name="proof" value="([^"]+)"/)?.[1];
  const done=await call(nativePath,{method:'POST',headers,body:new URLSearchParams({action:'approve',proof:nativeProof})});
  assert.equal(done.headers.get('location'),'authnjs-dashboard://device-review');

});
