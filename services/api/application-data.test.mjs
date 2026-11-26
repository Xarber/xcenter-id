import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {openRegistry} from './registry.mjs';
import {openApplicationData} from './application-data.mjs';

test('verified app databases isolate users and services, encrypt records and gate public and delegated reads',async()=>{
 const registry=openRegistry(':memory:');
 const registrations=['a','b'].map(client=>{const r=registry.submit('developer',client,'https://'+client+'.example.test/callback');registry.approve(r.id,client);registry.verifyApp(r.id,true);return r;});
 const principal=token=>({['a'.repeat(25)]:{owner:'user1',client:'a'},['b'.repeat(25)]:{owner:'user1',client:'b'},['c'.repeat(25)]:{owner:'user2',client:'a'}}[token]);
 let extraBytes=0;
 let sourceLinked=true;
 const accounts={storageCapacity:()=>4096,ownerForUsername:username=>username==='bob'?'user2':username==='alice'?'user1':null,linkedGrant:(_owner,client)=>sourceLinked||client!=='a'?'fixture-grant':null,available:()=>true,isDisconnected:()=>false,current:req=>req.headers.cookie==='session'?{owner:'developer'}:req.headers.cookie==='user'?{owner:'user1'}:req.headers.cookie==='admin'?{owner:'admin'}:null,
  allowsMutation:req=>req.headers.origin==='https://id.example.test',recentlyConfirmed:()=>true,adminStatus:req=>req.headers.cookie==='admin'?200:403,auditAdmin:()=>{}};
 const data=openApplicationData({path:':memory:',key:Buffer.alloc(32,7),registry,accounts,authenticate:principal,otherUsage:()=>extraBytes});
 const server=createServer((req,res)=>void data.handle(req,res,new URL(req.url,'http://localhost'))).listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 const request=(path,{token,body,method='GET',revision,...extra}={})=>fetch(base+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{}),...(revision?{'if-match':revision}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await request('/v1/apps/a/data/posts/one',{method:'PUT',body:{data:'secret',public:false},revision:'"0"'})).status,401);
  const write=await request('/v1/apps/a/data/posts/one',{token:'a'.repeat(25),method:'PUT',body:{data:{text:'private'},public:false},revision:'"0"'});assert.equal(write.status,200);
  assert.equal(data.containers('user1')[0].client,'a');
  assert.ok(data.accountUsage('user1')>1024);
  assert.equal(data.accountUsage('user2'),0);
  extraBytes=3500;
  assert.equal((await request('/v1/apps/b/data/posts/two',{token:'b'.repeat(25),method:'PUT',body:{data:'backup',public:false},revision:'"0"'})).status,409);
  extraBytes=0;
  assert.equal(registry.verifyApp(registrations[1].id,false),true);
  const privateBackup='/v1/apps/b/data/backups/profile';
  const userB='b'.repeat(25);
  assert.equal((await request(privateBackup,{token:userB,method:'PUT',revision:'"0"',body:{data:{label:'private backup'},public:false}})).status,200);
  assert.equal((await (await request(privateBackup,{token:userB})).json()).data.label,'private backup');
  assert.equal((await request(privateBackup,{token:userB,method:'PUT',revision:'"1"',body:{data:'publish',public:true}})).status,403);
  assert.equal((await request('/public/apps/b/data/backups')).status,404);
  assert.equal((await request(privateBackup,{token:userB,method:'DELETE',revision:'"1"'})).status,200);
  assert.equal((await request('/account/app-storage/'+registrations[1].id,{method:'POST',body:{action:'rotate-key'},cookie:'session',origin:'https://id.example.test'})).status,403);
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:'b'.repeat(25)})).status,403);
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:'c'.repeat(25)})).status,404);
  assert.deepEqual((await (await request('/public/apps/a/data/posts')).json()).records,[]);
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:'a'.repeat(25),method:'PUT',body:{data:{text:'changed'},public:true},revision:'"0"'})).status,409);
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:'a'.repeat(25),method:'PUT',body:{data:{text:'published'},public:true},revision:'"1"'})).status,200);
  const pub=await (await request('/public/apps/a/data/posts')).json();assert.equal(pub.records[0].data.text,'published');assert.equal(pub.records[0].id.includes('user1'),false);
  assert.equal((await request('/public/apps/a/data/posts/'+pub.records[0].id)).status,200);
  const chat=await request('/v1/apps/a/data/messages/private_1',{token:'a'.repeat(25),method:'PUT',revision:'"0"',body:{data:{text:'Only Bob can read this'},public:false,readers:['bob']}});assert.equal(chat.status,200);
  const shared=await (await request('/v1/apps/a/data/messages',{token:'c'.repeat(25)})).json();assert.equal(shared.records[0].shared,true);assert.equal(shared.records[0].data.text,'Only Bob can read this');
  assert.equal((await request('/v1/apps/a/data/messages/'+shared.records[0].id,{token:'c'.repeat(25)})).status,200);
  assert.equal((await request('/v1/apps/a/data/messages/private_1',{token:'c'.repeat(25),method:'DELETE',revision:'"1"'})).status,409);
  assert.equal((await (await request('/public/apps/a/data/messages')).json()).records.length,0);
  await request('/v1/apps/a/data/messages/private_1',{token:'a'.repeat(25),method:'PUT',revision:'"1"',body:{data:{text:'Withdrawn'},public:false,readers:[]}});
  assert.equal((await request('/v1/apps/a/data/messages/'+shared.records[0].id,{token:'c'.repeat(25)})).status,404);
  const manage=(i,body)=>request('/account/app-storage/'+registrations[i].id,{method:'POST',body,cookie:'session',origin:'https://id.example.test'});
  assert.equal((await manage(0,{action:'sharing',shared:['posts']})).status,200);
  assert.equal((await manage(1,{action:'sharing',shared:[],requests:[{source:'a',collection:'posts',label:'Read your posts in A'}]})).status,200);
  sourceLinked=false;
  assert.equal(data.requestsForOwner('user1','b')[0].linked,false);
  assert.equal(data.authorize('user1','b',['a/posts']),false);
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:'b'.repeat(25)})).status,403);
  sourceLinked=true;
  data.authorize('user1','b',['a/posts']);assert.equal((await request('/v1/apps/a/data/posts/one',{token:'b'.repeat(25)})).status,200);
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:'b'.repeat(25),method:'DELETE',revision:'"2"'})).status,403);
  sourceLinked=false;
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:'b'.repeat(25)})).status,403);
  sourceLinked=true;
  data.authorize('user1','b',[]);assert.equal((await request('/v1/apps/a/data/posts/one',{token:'b'.repeat(25)})).status,403);
  const key=await (await manage(0,{action:'rotate-key'})).json();assert.ok(key.secret.startsWith('xid-db-'));
  assert.equal((await request('/v1/apps/b/data/posts/one',{token:key.secret})).status,401);
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:key.secret})).status,404);
  assert.equal((await request('/v1/apps/a/data/posts/service',{token:key.secret,method:'PUT',revision:'"0"',body:{data:'backend only',public:false}})).status,200);
  const database=await (await request('/account/app-storage/'+registrations[0].id,{cookie:'session'})).json();
  assert.equal(database.records,1);
  assert.ok(database.used<data.accountUsage('user1'));
  assert.equal((await manage(0,{action:'capacity',capacity:1024**3})).status,403);
  assert.equal((await request('/account/file-containers/a',{cookie:'user'})).status,404);
  assert.equal((await manage(0,{action:'file-visibility',enabled:true})).status,200);
  assert.equal(data.containers('user1').find(item=>item.client==='a').showInFiles,true);
  assert.equal(data.containers('user1').find(item=>item.client==='a').canManage,false);
  const container=(path='',extra={})=>request('/account/file-containers/a'+path,{cookie:'session',...extra});
  assert.equal((await container('',{cookie:'user'})).status,404);
  assert.equal((await container('/posts/one',{cookie:'user'})).status,404);
  assert.equal((await container('/posts/one?edit=1',{cookie:'user'})).status,404);
  assert.equal((await container('/posts/one?edit=1',{cookie:'admin'})).status,404);
  assert.equal((await container('/posts/one',{cookie:'user',method:'PUT',body:{data:42,revision:0}})).status,404);
  assert.deepEqual((await (await container()).json()).collections,[]);
  const details={method:'PUT',body:{data:{private:true},revision:0},origin:'https://id.example.test','x-authnjs-request':'account-consent'};
  assert.equal((await container('/posts/one',{...details,'x-authnjs-request':'other'})).status,403);
  assert.equal((await container('/posts/one',details)).status,200);
  assert.equal((await container('/posts/one',details)).status,409);
  assert.equal((await container('/posts/service')).status,404);
  assert.equal(data.containers('developer').find(item=>item.client==='a').canManage,true);
  assert.deepEqual((await (await container()).json()).collections,[{collection:'posts',records:1,bytes:1024+Buffer.byteLength(JSON.stringify({private:true}))}]);
  assert.deepEqual(await (await container('/posts/one?edit=1')).json(),{revision:1,data:{private:true}});
  assert.deepEqual(await (await container('/posts/one')).json(),{private:true});
  assert.equal((await container('/posts/one',{...details,method:'DELETE',body:{revision:1}})).status,200);
  assert.equal((await container('/posts/one')).status,404);
  assert.equal((await manage(0,{action:'file-visibility',enabled:false})).status,200);
  assert.equal((await container('/posts/one')).status,404);
  data.revokeApp('user1','a');
  assert.equal(data.accountUsage('user1'),0);
  assert.equal((await request('/v1/apps/a/data/posts/service',{token:key.secret})).status,200);
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:'a'.repeat(25)})).status,404);
  assert.equal(registry.verifyApp(registrations[0].id,false),true);
  assert.equal((await request('/v1/apps/a/data/posts/service',{token:key.secret})).status,401);
  assert.equal(registry.verifyApp(registrations[0].id,true),true);
  await manage(0,{action:'revoke-key'});assert.equal((await request('/v1/apps/a/data/posts/service',{token:key.secret})).status,401);
  registry.moderate('developer',registrations[0].id,'restrict');assert.equal((await request('/public/apps/a/data/posts')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));data.close();registry.close();}
});

test('hosted payload ciphertext authenticates publication and recipient flags at rest',async()=>{
 const {mkdtempSync,readFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {DatabaseSync}=await import('node:sqlite');
 const dir=mkdtempSync(join(tmpdir(),'xcenter-db-')),path=join(dir,'data.sqlite');
 const registry=openRegistry(':memory:');const app=registry.submit('developer','A','https://a.example.test/callback');registry.approve(app.id,'a');registry.verifyApp(app.id,true);
 const service=openApplicationData({path,key:Buffer.alloc(32,19),registry,accounts:{available:()=>true,isDisconnected:()=>false},authenticate:()=>({client:'a',owner:'user'})});
 const server=createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost'))).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 try{
  const secret='Sensitive private record '+Date.now();
  assert.equal((await fetch(base+'/v1/apps/a/data/posts/one',{method:'PUT',headers:{authorization:'Bearer '+ 'x'.repeat(25),'content-type':'application/json','if-match':'"0"'},body:JSON.stringify({data:{secret},public:false})})).status,200);
  assert.equal(readFileSync(path).includes(Buffer.from(secret)),false);
  const db=new DatabaseSync(path);db.prepare('UPDATE app_records SET public=1').run();db.close();
  const response=await fetch(base+'/public/apps/a/data/posts');assert.equal(response.status,500);assert.equal((await response.text()).includes(secret),false);
 }finally{await new Promise(resolve=>server.close(resolve));service.close();registry.close();rmSync(dir,{recursive:true,force:true});}
});

test('container files are quota-bound, app-scoped, and browsed only with the permitted visibility',async t=>{
  const registry=openRegistry(':memory:');
  const primary=registry.submit('developer','Backup','https://backup.example.test/return');
  const other=registry.submit('developer','Other','https://other.example.test/return');
  registry.approve(primary.id,'backup');registry.approve(other.id,'other');
  const user='u'.repeat(30), developer='d'.repeat(30), stranger='s'.repeat(30), wrongApp='w'.repeat(30);
  const principals=new Map([
    [user,{owner:'player',client:'backup'}],[developer,{owner:'developer',client:'backup'}],
    [stranger,{owner:'stranger',client:'backup'}],[wrongApp,{owner:'player',client:'other'}],
  ]);
  const data=openApplicationData({
    path:':memory:',key:Buffer.alloc(32,9),registry,authenticate:token=>principals.get(token),
    accounts:{storageCapacity:()=>700000,available:()=>true,linkedGrant:()=> 'linked',
      current:req=>req.headers.cookie?{owner:req.headers.cookie}:null,adminStatus:()=>403,
      allowsMutation:()=>true,recentlyConfirmed:()=>true},
  });
  const server=createServer((req,res)=>void data.handle(req,res,new URL(req.url,'http://localhost'))).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));data.close();registry.close();});
  const base='http://127.0.0.1:'+server.address().port;
  const call=(path,{token,cookie,method='GET',payload,revision}={})=>fetch(base+path,{method,
    headers:{...(token?{authorization:'Bearer '+token}:{}),...(cookie?{cookie}:{}),
      ...(payload?{'content-type':'application/json'}:{}),...(revision?{'if-match':revision}:{})},
    ...(payload?{body:JSON.stringify(payload)}:{})});
  const files='/v1/apps/backup/files',uploads=files+'/uploads',browser='/account/app-files/backup';
  const portal='/account/app-storage/'+primary.id;
  const start=(token,payload)=>call(uploads,{token,payload,method:'POST'});
  const status=(token,id)=>call(uploads+'/'+id,{token});
  const write=(token,id,position,bytes)=>call(uploads+'/'+id,{token,method:'PUT',payload:{position,content:bytes.toString('base64')}});
  const complete=(token,id)=>call(uploads+'/'+id,{token,method:'POST',payload:{}});
  const manage=payload=>call(portal,{cookie:'developer',method:'POST',payload});
  const list=async (path,options)=>(await (await call(path,options)).json()).files;

  assert.equal((await start(wrongApp,{name:'backup.zip',size:1})).status,403);
  assert.equal((await start(user,{name:'../backup.zip',size:1})).status,422);
  const {id,chunkSize}=await (await start(user,{name:'Beat Saber.zip',size:600000,browseable:true})).json();
  assert.equal(data.accountUsage('player'),600000);
  assert.equal((await start(user,{name:'other.zip',size:100001})).status,409);
  assert.equal((await status(stranger,id)).status,404);
  assert.equal((await complete(user,id)).status,409);
  assert.equal(data.containers('player').length,0);
  const content=Buffer.alloc(600000,42);
  assert.equal((await write(user,id,0,content.subarray(0,chunkSize))).status,200);
  assert.equal((await write(user,id,0,content.subarray(0,chunkSize))).status,200);
  assert.equal((await write(user,id,chunkSize,content.subarray(chunkSize))).status,200);
  assert.equal((await complete(user,id)).status,201);
  assert.equal((await complete(user,id)).status,200);
  assert.deepEqual((await list(browser,{cookie:'player'})).map(item=>item.name),['Beat Saber.zip']);
  assert.equal(data.containers('player')[0].showInFiles,true);
  assert.equal(data.containers('player')[0].canManage,false);
  assert.equal(data.containers('player')[0].visibleBytes,600000);
  const result=await call(browser+'/'+id,{cookie:'player'});
  assert.equal(result.headers.get('content-type'),'application/octet-stream');
  assert.match(result.headers.get('content-disposition'),/attachment/);
  assert.deepEqual(Buffer.from(await result.arrayBuffer()),content);
  assert.equal((await call('/account/files/'+id,{cookie:'player'})).status,404);
  assert.equal((await call(browser+'/'+id,{cookie:'stranger'})).status,404);
  assert.equal((await call(browser+'/'+id,{cookie:'player',method:'DELETE'})).status,405);
  assert.equal((await call('/public/apps/backup/files/'+id)).status,404);
  assert.equal((await call(files+'/'+id,{token:user,method:'PUT',payload:{browseable:false}})).status,200);
  assert.equal((await call(browser+'/'+id,{cookie:'player'})).status,404);
  assert.deepEqual(await list(browser,{cookie:'player'}),[]);
  assert.equal(data.containers('player')[0].showInFiles,false);
  assert.equal((await manage({action:'rotate-key'})).status,403);

  registry.verifyApp(primary.id,true);
  const key=(await (await manage({action:'rotate-key'})).json()).secret;
  assert.equal((await start(key,{name:'server.zip',size:1,browseable:true})).status,422);
  const service=(await (await start(key,{name:'service.zip',size:1})).json()).id;
  assert.equal((await write(key,service,0,Buffer.from('s'))).status,200);
  assert.equal((await complete(key,service)).status,201);
  assert.equal((await call(files+'/'+service,{token:user})).status,404);
  assert.equal((await call(files+'/'+id,{token:key})).status,404);
  assert.equal((await call(portal+'/files/'+service,{cookie:'player'})).status,404);
  assert.equal(await (await call(portal+'/files/'+service,{cookie:'developer'})).text(),'s');
  assert.equal((await (await call(portal,{cookie:'developer'})).json()).used,1);

  const devFile=(await (await start(developer,{name:'dev.bin',size:0})).json()).id;
  assert.equal((await complete(developer,devFile)).status,201);
  assert.deepEqual(await list(browser,{cookie:'developer'}),[]);
  assert.equal((await manage({action:'file-visibility',enabled:true})).status,200);
  assert.deepEqual((await list(browser,{cookie:'developer'})).map(item=>item.id),[devFile]);
  assert.equal((await call('/account/file-containers/backup',{cookie:'developer'})).status,200);
  assert.equal((await manage({action:'file-visibility',enabled:false})).status,200);
  assert.equal((await call('/account/file-containers/backup',{cookie:'developer'})).status,404);
  assert.equal((await call(browser+'/'+devFile,{cookie:'developer'})).status,404);

  const pending=(await (await start(user,{name:'pending',size:100000})).json()).id;
  data.revokeApp('player','backup');
  assert.equal((await status(user,pending)).status,404);
  assert.equal((await call(files+'/'+id,{token:user})).status,404);
  assert.equal(data.accountUsage('player'),0);
  assert.equal((await call(files+'/'+service,{token:key})).status,200);
  await manage({action:'revoke-key'});
  assert.equal((await call(files+'/'+service,{token:key})).status,403);
});
