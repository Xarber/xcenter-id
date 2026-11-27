import {createHash} from 'node:crypto';
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
 const service=openApplicationData({path,key:Buffer.alloc(32,19),registry,accounts:{available:()=>true,isDisconnected:()=>false,linkedGrant:()=> 'fixture',current:()=>({owner:'user'})},authenticate:()=>({client:'a',owner:'user'})});
 const server=createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost'))).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 try{
  const secret='Sensitive private record '+Date.now();
  assert.equal((await fetch(base+'/v1/apps/a/data/posts/one',{method:'PUT',headers:{authorization:'Bearer '+ 'x'.repeat(25),'content-type':'application/json','if-match':'"0"'},body:JSON.stringify({data:{secret},public:false})})).status,200);
  assert.equal(readFileSync(path).includes(Buffer.from(secret)),false);
  const db=new DatabaseSync(path);db.prepare('UPDATE app_records SET public=1').run();db.close();
  const response=await fetch(base+'/public/apps/a/data/posts');assert.equal(response.status,500);assert.equal((await response.text()).includes(secret),false);
  const upload=base+'/v1/apps/a/files/uploads';
  const headers={authorization:'Bearer '+'x'.repeat(25),'content-type':'application/json'};
  const initiate=await fetch(upload,{method:'POST',headers,body:JSON.stringify({name:'private-backup.zip',size:0})});
  assert.equal(initiate.status,201);
  const {id}=await initiate.json();
  assert.equal((await fetch(upload+'/'+id,{method:'POST',headers,body:'{}'})).status,201);
  assert.equal(readFileSync(path).includes(Buffer.from('private-backup.zip')),false);
  const changed=new DatabaseSync(path);
  changed.prepare('UPDATE app_files SET browseable=1 WHERE id=?').run(id);
  changed.close();
  const binary=await fetch(base+'/account/app-files/a/'+id);
  assert.equal(binary.status,500);
  assert.doesNotMatch(await binary.text(),/private-backup/);
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
      ...(payload?{'content-type':'application/json'}:{}),'X-AuthNJS-Request':'account-consent',...(revision?{'if-match':revision}:{})},
    ...(payload?{body:JSON.stringify(payload)}:{})});
  const files='/v1/apps/backup/files',uploads=files+'/uploads',browser='/account/app-files/backup';
  const portal='/account/app-storage/'+primary.id;
  const backups='/account/app-backups/backup', appBackups='/v1/apps/backup/backups';
  const backup=(path='',options={})=>call(backups+path,{cookie:'player',...options});

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
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal((await write(user,id,0,content.subarray(0,chunkSize))).status,200);
  assert.equal((await write(user,id,0,content.subarray(0,chunkSize))).status,200);
  assert.equal((await write(user,id,chunkSize,content.subarray(chunkSize))).status,200);
  assert.equal((await complete(user,id)).status,201);
  assert.equal((await complete(user,id)).status,200);
  const [original]=await list(browser,{cookie:'player'});
  assert.equal(original.name,'Beat Saber.zip');
  assert.equal(original.sha256,digest(content));
  assert.deepEqual(await (await call(files+'/'+id+'?metadata=1',{token:user})).json(),original);
  assert.equal((await call(files+'/'+id+'?metadata=1',{token:stranger})).status,404);
  assert.equal(data.containers('player')[0].showInFiles,true);
  assert.equal(data.containers('player')[0].canManage,false);
  assert.equal(data.containers('player')[0].visibleBytes,600000);

  assert.equal((await manage({action:'backup-policy',enabled:true,restore:false,version:1})).status,200);
  const beforeSnapshots=data.accountUsage('player');
  const largeSnapshots=[];
  for(let index=0;index<3;index++){
    const copy=await backup('',{method:'POST'});
    assert.equal(copy.status,201);
    largeSnapshots.push(await copy.json());
  }
  assert.equal(data.accountUsage('player')-beforeSnapshots,3*1024);
  for(const copy of largeSnapshots)assert.equal((await backup('/'+copy.id,{method:'DELETE'})).status,200);
  assert.equal((await manage({action:'backup-policy',enabled:false})).status,200);
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
  assert.equal((await start(user,{name:'invalid.zip',size:1,editable:true})).status,422);
  assert.equal((await call(files+'/'+id,{token:user,method:'PUT',payload:{browseable:true,editable:true}})).status,200);
  assert.equal((await list(browser,{cookie:'player'}))[0].editable,true);
  const edit=(path,method,payload)=>call(browser+path,{cookie:'player',method,payload});
  assert.equal((await call(browser+'/'+id,{cookie:'stranger',method:'PUT',payload:{name:'foreign.zip'}})).status,404);
  assert.equal((await fetch(base+browser+'/'+id,{method:'DELETE',headers:{cookie:'player'}})).status,403);
  assert.equal((await edit('/'+id,'PUT',{name:'renamed.zip'})).status,200);
  const [renamed]=await list(browser,{cookie:'player'});
  assert.equal(renamed.name,'renamed.zip');
  assert.equal(renamed.sha256,original.sha256);
  assert.equal((await edit('/uploads','POST',{replace:id,size:700001})).status,409);
  const draft=async size=>(await (await edit('/uploads','POST',{replace:id,size})).json()).id;
  const stale=await draft(3);
  assert.equal(data.accountUsage('player'),600000);
  assert.equal((await edit('/uploads','POST',{replace:id,size:3})).status,409);
  assert.equal((await edit('/uploads/'+stale,'PUT',{position:0,content:'YWJj'})).status,200);
  assert.equal((await call(files+'/'+id,{token:user,method:'PUT',payload:{browseable:true,editable:false}})).status,200);
  assert.equal((await edit('/uploads/'+stale,'POST',{})).status,405);
  assert.equal((await edit('/'+id,'DELETE')).status,405);
  assert.equal((await edit('/uploads/'+stale,'DELETE')).status,200);
  assert.equal((await call(files+'/'+id,{token:user,method:'PUT',payload:{browseable:true,editable:true}})).status,200);
  const revision=await draft(3);
  assert.equal((await status(user,revision)).status,404);
  assert.equal((await edit('/uploads/'+revision,'PUT',{position:0,content:'eHl6'})).status,200);
  assert.equal((await edit('/uploads/'+revision,'POST',{})).status,201);
  assert.deepEqual(await (await edit('/uploads/'+revision,'POST',{})).json(),{id});
  assert.equal(await (await call(files+'/'+id,{token:user})).text(),'xyz');
  const replaced=await (await call(browser+'/'+id+'?metadata=1',{cookie:'player'})).json();
  assert.equal(replaced.id,id);
  assert.equal(replaced.sha256,digest('xyz'));
  assert.notEqual(replaced.sha256,original.sha256);
  assert.equal(data.accountUsage('player'),3);
  assert.equal((await backup('',{method:'POST'})).status,403);
  assert.equal((await manage({action:'backup-policy',enabled:true,restore:true,version:1})).status,200);
  assert.equal((await call(appBackups,{token:user,method:'POST'})).status,403);
  assert.equal((await backup('/permission',{method:'PUT',payload:{enabled:true}})).status,200);
  assert.equal((await call(appBackups,{token:wrongApp,method:'POST'})).status,403);
  const notes='/v1/apps/backup/data/notes/first';
  assert.equal((await call(notes,{token:user,method:'PUT',revision:'"0"',payload:{data:{name:'first'},public:false}})).status,200);
  const createBackup=await call(appBackups,{token:user,method:'POST'});
  assert.equal(createBackup.status,201,await createBackup.clone().text());
  const saved=await createBackup.json();
  assert.equal(saved.records,1);
  assert.equal(saved.files,1);
  const charged=data.accountUsage('player');
  const manual=await backup('',{method:'POST'});
  assert.equal(manual.status,201);
  const secondSnapshot=await manual.json();
  assert.equal(data.accountUsage('player')-charged,1024);
  assert.equal((await call(appBackups+'/'+secondSnapshot.id,{token:user,method:'DELETE'})).status,404);
  assert.equal((await call(appBackups+'/'+saved.id,{token:user,method:'DELETE'})).status,200);
  assert.equal(data.accountUsage('player'),charged);
  const restoreRequest=await call(appBackups+'/'+secondSnapshot.id+'/restore',{token:user,method:'POST'});
  assert.equal(restoreRequest.status,202);
  assert.ok((await (await backup()).json()).snapshots[0].requested);

  const proof=await backup('',{cookie:'stranger'});
  assert.deepEqual((await proof.json()).snapshots,[]);
  assert.equal((await edit('/'+id,'DELETE')).status,200);
  assert.equal((await call(files+'/'+id,{token:user})).status,404);
  const previous=await (await call(notes,{token:user})).json();
  assert.equal((await call(notes,{token:user,method:'PUT',revision:JSON.stringify(String(previous.revision)),payload:{data:{name:'changed'},public:false}})).status,200);
  assert.equal((await manage({action:'backup-policy',enabled:true,restore:true,version:2})).status,200);
  assert.equal((await backup('/'+secondSnapshot.id+'/restore',{method:'POST'})).status,409);
  assert.equal((await manage({action:'backup-policy',enabled:true,restore:true,version:1})).status,200);
  const restored=await backup('/'+secondSnapshot.id+'/restore',{method:'POST'});
  assert.equal(restored.status,200,await restored.clone().text());
  assert.equal(await (await call(files+'/'+id,{token:user})).text(),'xyz');
  const restoredNote=await (await call(notes,{token:user})).json();
  assert.deepEqual(restoredNote.data,{name:'first'});
  assert.ok(restoredNote.revision>previous.revision+1);
  const {snapshots}=await (await backup()).json();
  assert.equal(snapshots.length,2);
  for(const entry of snapshots)assert.equal((await backup('/'+entry.id,{method:'DELETE'})).status,200);
  assert.equal((await call(notes,{token:user,method:'DELETE',revision:JSON.stringify(String(restoredNote.revision))})).status,200);


  const makeExtra=async (name,browseable)=>{
    const extra=(await (await start(user,{name,browseable,size:1})).json()).id;
    assert.equal((await write(user,extra,0,Buffer.from('p'))).status,200);
    assert.equal((await complete(user,extra)).status,201);
    return extra;
  };
  const readOnly=await makeExtra('Read-only file',true);
  const privateFile=await makeExtra('Private file',false);
  const included='/v1/apps/backup/data/notes/included';
  const ignored='/v1/apps/backup/data/notes/ignored';
  const otherCollection='/v1/apps/backup/data/settings/display';
  const putRecord=async(path,name,revision='0')=>call(path,{token:user,method:'PUT',revision:JSON.stringify(revision),payload:{data:{name},public:false}});
  for(const path of [included,ignored,otherCollection])assert.equal((await putRecord(path,'before')).status,200);
  const policy={action:'backup-policy',enabled:true,restore:true,version:3};
  const selectedRecords=['notes/included','settings'];
  for(const [files,expected] of [['none',0],['editable',1],['browseable',2],['all',3]]){
    assert.equal((await manage({...policy,selection:{records:selectedRecords,files}})).status,200);
    const snapshot=await (await backup('',{method:'POST'})).json();
    assert.equal(snapshot.files,expected);
    assert.equal(snapshot.records,2);
    assert.equal((await backup('/'+snapshot.id,{method:'DELETE'})).status,200);
  }
  const partialPolicy={...policy,selection:{records:selectedRecords,files:'editable'}};
  assert.equal((await manage(partialPolicy)).status,200);
  const partial=await (await backup('',{method:'POST'})).json();
  assert.equal(partial.files,1);
  assert.equal((await putRecord(included,'changed','1')).status,200);
  assert.equal((await putRecord(ignored,'keep changed','1')).status,200);
  assert.equal((await edit('/'+id,'PUT',{name:'Different.zip'})).status,200);
  assert.equal((await call(files+'/'+id,{token:user,method:'PUT',payload:{browseable:true,editable:false}})).status,200);
  assert.equal((await backup('/'+partial.id+'/restore',{method:'POST'})).status,409);
  assert.equal((await call(files+'/'+id,{token:user,method:'PUT',payload:{browseable:true,editable:true}})).status,200);

  assert.equal((await backup('/'+partial.id+'/restore',{method:'POST'})).status,200);
  assert.equal((await (await call(included,{token:user})).json()).data.name,'before');
  assert.equal((await (await call(ignored,{token:user})).json()).data.name,'keep changed');
  assert.equal((await (await call(files+'/'+id+'?metadata=1',{token:user})).json()).name,'renamed.zip');
  assert.equal((await call(files+'/'+readOnly,{token:user})).status,200);
  assert.equal((await call(files+'/'+privateFile,{token:user})).status,200);
  for(const entry of (await (await backup()).json()).snapshots)assert.equal((await backup('/'+entry.id,{method:'DELETE'})).status,200);
  for(const path of [included,ignored,otherCollection]){
    const {revision}=await (await call(path,{token:user})).json();
    assert.equal((await call(path,{token:user,method:'DELETE',revision:JSON.stringify(String(revision))})).status,200);
  }
  for(const item of [readOnly,privateFile])assert.equal((await call(files+'/'+item,{token:user,method:'DELETE'})).status,200);
  assert.equal((await edit('/'+id,'DELETE')).status,200);
  assert.equal(data.accountUsage('player'),0);
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
  assert.equal((await (await call(files+'/'+service+'?metadata=1',{token:key})).json()).sha256,digest('s'));
  assert.equal((await list(portal+'/files',{cookie:'developer'}))[0].sha256,digest('s'));
  assert.equal((await (await call(portal,{cookie:'developer'})).json()).used,1);

  const devFile=(await (await start(developer,{name:'dev.bin',size:0})).json()).id;
  assert.equal((await complete(developer,devFile)).status,201);
  assert.deepEqual(await list(browser,{cookie:'developer'}),[]);
  assert.equal((await manage({action:'file-visibility',enabled:true})).status,200);
  const [empty]=await list(browser,{cookie:'developer'});
  assert.equal(empty.id,devFile);
  assert.equal(empty.sha256,digest(''));
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
