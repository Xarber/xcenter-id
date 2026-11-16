import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createAccountFiles } from './account-files.mjs';
import { createSamplePermissions } from './sample-permissions.mjs';
import { openStore } from './store.mjs';

const origin='https://id.example.test';
const accounts={current(req){return req.headers.authorization?{owner:req.headers.authorization}:null;}};

test('account file uploads and downloads are owner-scoped and use attachment headers',async()=>{
  const handle=createAccountFiles({database:':memory:',key:randomBytes(32),accounts,origin});
  const server=createServer((req,res)=>{void handle(req,res,new URL(req.url,origin).pathname);}).listen(0,'127.0.0.1');
  await once(server,'listening');
  const endpoint='http://127.0.0.1:'+server.address().port+'/account/files';
  const call=(owner,method='GET',path='',body)=>fetch(endpoint+path,{method,body:body&&JSON.stringify(body),
    headers:{authorization:owner,'content-type':'application/json','x-authnjs-request':'account-consent',origin}});
  try{
    const raw='File content.';
    const created=await call('first','POST','',{name:'example.txt',content:Buffer.from(raw).toString('base64')});
    assert.equal(created.status,201);
    const {id}=await created.json();
    assert.equal((await call('second','GET','/'+id)).status,404);
    assert.equal((await call('second','DELETE','/'+id,{})).status,404);
    const item=await call('first','GET','/'+id);
    assert.match(item.headers.get('content-disposition'),/^attachment/);
    assert.equal(await item.text(),raw);
    assert.equal((await call('first','DELETE','/'+id,{})).status,200);
    assert.equal((await call('first','GET','/'+id)).status,404);
    const root = await call('first','POST','/folders',{name:'Projects'});
    assert.equal(root.status,201);
    const {id:folder} = await root.json();
    assert.equal((await call('second','GET','?folder='+folder)).status,404);
    assert.equal((await call('second','POST','/folders',{name:'Private',folder})).status,404);
    assert.equal((await call('second','DELETE','/folders/'+folder,{})).status,404);
    const nested = await call('first','POST','/folders',{name:'Notes',folder});
    assert.equal(nested.status,201);
    const {id:child} = await nested.json();
    const upload = await call('first','POST','',{name:'inside.txt',content:Buffer.from(raw).toString('base64'),folder:child});
    assert.equal(upload.status,201);
    assert.equal((await call('first','DELETE','/folders/'+child,{})).status,409);
    const listing = await (await call('first','GET','?folder='+child)).json();
    assert.deepEqual(listing.breadcrumbs.map(item=>item.name),['Projects','Notes']);
    assert.equal(listing.files[0].name,'inside.txt');
    const index = await (await call('first','GET')).json();
    assert.equal(index.files.length,0);
    assert.equal(index.total,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('sample grants require an account session, exact origin and permission intent',async()=>{
  const store=openStore(':memory:',randomBytes(32));
  const handle=createSamplePermissions({store,origin,accounts});
  const server=createServer((req,res)=>{void handle(req,res);}).listen(0,'127.0.0.1');
  await once(server,'listening');
  const endpoint='http://127.0.0.1:'+server.address().port;
  const request=(headers)=>fetch(endpoint,{method:'PUT',headers:{'content-type':'application/json',...headers},
    body:JSON.stringify({source:'places-demo',destination:'trips-demo',persistent:true})});
  try {
    assert.equal((await request({origin,'x-authnjs-request':'account-consent'})).status,401);
    assert.equal((await request({authorization:'owner',origin:'https://app.example.test','x-authnjs-request':'account-consent'})).status,403);
    assert.equal((await request({authorization:'owner',origin})).status,403);
    assert.equal((await request({authorization:'owner',origin,'x-authnjs-request':'account-consent'})).status,200);
    assert.equal(store.listGrants('owner')[0].expires,Number.MAX_SAFE_INTEGER);
    assert.equal(store.listGrants('other').length,0);
  }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
