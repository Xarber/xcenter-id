import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createAccountFiles } from './account-files.mjs';
import { createAppFriendRoutes, openFriends } from "./account-friends.mjs";
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
    const {id:uploadedId}=await upload.json();
    assert.equal((await call('second','PATCH','/folders/'+child,{name:'Not yours'})).status,404);
    assert.equal((await call('first','PATCH','/folders/'+child,{name:'Archive'})).status,200);
    assert.equal((await call('first','PATCH','/'+uploadedId,{name:'Bad/name'})).status,422);
    assert.equal((await call('first','PATCH','/'+uploadedId,{name:'renamed.txt'})).status,200);
    const listing = await (await call('first','GET','?folder='+child)).json();
    assert.deepEqual(listing.breadcrumbs.map(item=>item.name),['Projects','Archive']);
    assert.equal(listing.files[0].name,'renamed.txt');
    assert.equal(await (await call('first','GET','/'+uploadedId)).text(),raw);
    const index = await (await call('first','GET')).json();
    assert.equal(index.files.length,0);
    assert.equal(index.total,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('sample grants require an account session, exact origin and permission intent',async()=>{
  const store=openStore(':memory:',randomBytes(32));
  let disconnected = false;
  const handle=createSamplePermissions({store,origin,accounts:{...accounts,
    isDisconnected:(owner,client)=>disconnected&&owner==='owner'&&client==='trips-demo',
  }});
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
    disconnected = true;
    assert.equal((await request({authorization:'owner',origin,'x-authnjs-request':'account-consent'})).status,409);
    const {permissions} = await (await fetch(endpoint,{headers:{authorization:'owner'}})).json();
    assert.ok(permissions.every(item=>item.source!=='trips-demo'&&item.destination!=='trips-demo'));

  }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});

test('friend invitations and file shares isolate recipients and do not revive on relink',async t=>{
  const friends=openFriends(':memory:');
  const identity={...accounts,username:owner=>owner,allowsMutation:req=>req.headers.origin===origin};
  const files=createAccountFiles({database:':memory:',key:randomBytes(32),accounts:identity,origin,friends});
  const server=createServer((req,res)=>void files(req,res,new URL(req.url,origin).pathname)).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));friends.close();});
  const endpoint='http://127.0.0.1:'+server.address().port+'/account/files';
  const call=(owner,path='',method='GET',data,from=origin)=>fetch(endpoint+path,{
    method,body:data&&JSON.stringify(data),headers:{
      authorization:owner,origin:from,'content-type':'application/json','x-authnjs-request':'account-consent',
    },
  });
  const invite=friends.invite('owner');
  assert.equal(friends.accept('owner',invite.code),false);
  assert.equal(friends.accept('recipient',invite.code),true);
  assert.equal(friends.accept('another',invite.code),false);
  const [{id:friend}]=friends.list('owner');
  const {id:file}=await (await call('owner','','POST',{name:'letter.txt',content:'c2hhcmVk'})).json();
  assert.equal((await call('recipient','/shared','POST',{file,friend})).status,404);
  assert.equal((await call('owner','/shared','POST',{file,friend},'https://app.example.test')).status,403);
  assert.equal((await call('owner','/shared','POST',{file,friend})).status,200);
  const {incoming:[share]}=await (await call('recipient','/shared')).json();
  assert.equal(share.name,'letter.txt');
  assert.equal((await call('another','/shared/'+share.id)).status,404);
  assert.equal((await call('recipient','/'+file)).status,404);
  assert.equal(await (await call('recipient','/shared/'+share.id)).text(),'shared');
  assert.equal(friends.remove('another',friend),false);
  assert.equal(friends.remove('recipient',friend),true);
  assert.equal((await call('recipient','/shared/'+share.id)).status,404);
  assert.equal(friends.accept('recipient',friends.invite('owner').code),true);
  assert.equal((await call('recipient','/shared/'+share.id)).status,404);
});

test('only the named recipient can accept a username friend request',()=>{
  const friends=openFriends(':memory:');
  try{
    friends.request('sender','recipient');
    const [{id}]=friends.pending('recipient');
    assert.equal(friends.answer('other',id,true),false);
    assert.equal(friends.linked('sender','recipient'),undefined);
    assert.equal(friends.answer('recipient',id,true),true);
    assert.ok(friends.linked('sender','recipient'));
    assert.equal(friends.answer('recipient',id,true),false);
  }finally{friends.close();}
});


test('app friend import requires a scoped user token and only includes same-app subjects',async()=>{
  const friends=openFriends(':memory:');
  assert.equal(friends.accept('same-app',friends.invite('member').code),true);
  assert.equal(friends.accept('other-app',friends.invite('member').code),true);
  const token=randomBytes(32).toString('base64url');
  const handler=createAppFriendRoutes({
    accounts:{username:owner=>owner},friends,
    authorize:value=>value===token?{owner:'member',client:'fixture-app'}:null,
    subject:(owner,client)=>owner==='same-app'&&client==='fixture-app'?'pairwise-fixture':undefined,
  });
  const server=createServer((req,res)=>void handler(req,res)).listen(0,'127.0.0.1');
  await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port+'/v1/profile/friends';
  try{
    assert.equal((await fetch(url)).status,401);
    const response=await fetch(url,{headers:{Authorization:'Bearer '+token}});
    assert.equal(response.headers.get('cache-control'),'no-store');
    const {friends:result}=await response.json();
    assert.deepEqual(result.find(item=>item.username==='same-app'),{username:'same-app',sub:'pairwise-fixture'});
    assert.deepEqual(result.find(item=>item.username==='other-app'),{username:'other-app'});
    assert.equal(result.length,2);
  }finally{await new Promise(resolve=>server.close(resolve));friends.close();}
});

test('delegated file read, write and shared read permissions are independently enforced',async t=>{
  const photos={name:'photo.txt',content:Buffer.from('photo').toString('base64')};
  const friends={linked:(owner,recipient)=>owner==='first'&&recipient==='second'?'friendship':null,
    list:owner=>owner==='first'?[{id:'friendship',owner:'second'}]:[]};
  const grants=new Map([
    ['read',{owner:'first',scope:'files_read'}],
    ['write',{owner:'first',scope:'files_write'}],
    ['other',{owner:'second',scope:'files_read'}],
    ['share',{owner:'second',scope:'shared_files_read'}],
  ]);
  const handle=createAccountFiles({database:':memory:',key:randomBytes(32),origin,friends,
    accounts:{...accounts,username:owner=>owner,allowsMutation:()=>true},
    fileAccess:(token,scopes)=>scopes.includes(grants.get(token)?.scope)?grants.get(token):null,
  });
  const server=createServer((req,res)=>void handle(req,res,new URL(req.url,origin).pathname)).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const endpoint='http://127.0.0.1:'+server.address().port;
  const call=(path,token,method='GET',body)=>fetch(endpoint+path,{method,body:body&&JSON.stringify(body),
    headers:{authorization:path.startsWith('/v1')?'Bearer '+token:token,'content-type':'application/json','x-authnjs-request':'account-consent'}});
  const start='/v1/files';
  const upload=await call(start,'write','POST',photos);
  assert.equal(upload.status,201);
  const {id}=await upload.json();
  assert.equal((await call(start+'/'+id,'read')).status,200);
  assert.equal((await call(start+'/'+id,'other')).status,404);
  assert.equal((await call(start+'/'+id,'read','DELETE')).status,401);
  assert.equal((await call(start,'share')).status,401);
  assert.equal((await call(start+'/shared','other')).status,401);
  assert.equal((await call('/account/files/shared','first','POST',{file:id,friend:'friendship'})).status,200);
  const shared=await (await call(start+'/shared','share')).json();
  assert.equal(shared.incoming.length,1);
  assert.equal(shared.outgoing,undefined);
  const sharePath=start+'/shared/'+shared.incoming[0].id;
  assert.equal(await (await call(sharePath,'share')).text(),'photo');
  assert.equal((await call(sharePath,'share','DELETE')).status,405);
  grants.delete('share');
  assert.equal((await call(sharePath,'share')).status,401);
  assert.equal((await call(start+'/'+id,'write','DELETE')).status,200);
});

test('parallel uploads reserve quota, retain encrypted chunk order, and move without changing contents',async()=>{
  const handle=createAccountFiles({database:':memory:',key:randomBytes(32),accounts:{...accounts,storageCapacity:()=>3*1024*1024},origin});
  const server=createServer((req,res)=>{void handle(req,res,new URL(req.url,origin).pathname);}).listen(0,'127.0.0.1');
  await once(server,'listening');
  const endpoint='http://127.0.0.1:'+server.address().port+'/account/files';
  const call=(method,path,body,owner='owner')=>fetch(endpoint+path,{method,
    body:body&&JSON.stringify(body),headers:{authorization:owner,'content-type':'application/json','x-authnjs-request':'account-consent',origin}});
  try{
    const begin=await call('POST','/uploads',{name:'parallel.bin',size:2*1024*1024+29});
    assert.equal(begin.status,201);
    const {id,chunkSize}=await begin.json();
    const other=await call('POST','/uploads',{name:'cancel.bin',size:512*1024});
    const {id:cancelled}=await other.json();
    assert.equal((await call('POST','/uploads',{name:'too-big.bin',size:512*1024})).status,409);
    await call('DELETE','/uploads/'+cancelled,{});
    assert.equal((await call('POST','/uploads/'+cancelled,{})).status,404);
    assert.equal((await call('POST','/uploads/'+id,{})).status,409);
    const raw=randomBytes(2*1024*1024+29);
    for(let position=0;position<raw.length;position+=chunkSize){
      const content=raw.subarray(position,position+chunkSize).toString('base64');
      assert.equal((await call('PUT','/uploads/'+id,{position,content},'other')).status,404);
      assert.equal((await call('PUT','/uploads/'+id,{position,content})).status,200);
      if(position===0)assert.equal((await call('PUT','/uploads/'+id,{position,content})).status,200);
    }
    assert.equal((await call('POST','/uploads/'+id,{})).status,201);
    assert.equal((await call('POST','/uploads/'+id,{})).status,200);
    const {id:folder}=await (await call('POST','/folders',{name:'Folder'})).json();
    const {id:child}=await (await call('POST','/folders',{name:'Child',folder})).json();
    assert.equal((await call('PATCH','/folders/'+folder,{folder:child})).status,409);
    assert.equal((await call('PATCH','/'+id,{folder,name:'Moved.bin'})).status,200);
    const list=await (await call('GET','?folder='+folder)).json();
    assert.equal(list.files[0].name,'Moved.bin');
    const download=await call('GET','/'+id);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()),raw);
    assert.equal((await call('DELETE','/'+id,{})).status,200);
    assert.equal(handle.fileBytes('owner'),0);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
