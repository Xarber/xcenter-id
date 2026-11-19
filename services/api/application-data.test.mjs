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
 const accounts={storageCapacity:()=>4096,ownerForUsername:username=>username==='bob'?'user2':username==='alice'?'user1':null,linkedGrant:()=>({id:'fixture-grant'}),available:()=>true,isDisconnected:()=>false,current:req=>req.headers.cookie==='session'?{owner:'developer'}:null,
  allowsMutation:req=>req.headers.origin==='https://id.example.test',recentlyConfirmed:()=>true,adminStatus:()=>403,auditAdmin:()=>{}};
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
  data.authorize('user1','b',['a/posts']);assert.equal((await request('/v1/apps/a/data/posts/one',{token:'b'.repeat(25)})).status,200);
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:'b'.repeat(25),method:'DELETE',revision:'"2"'})).status,403);
  data.authorize('user1','b',[]);assert.equal((await request('/v1/apps/a/data/posts/one',{token:'b'.repeat(25)})).status,403);
  const key=await (await manage(0,{action:'rotate-key'})).json();assert.ok(key.secret.startsWith('xid-db-'));
  assert.equal((await request('/v1/apps/b/data/posts/one',{token:key.secret})).status,401);
  assert.equal((await request('/v1/apps/a/data/posts/one',{token:key.secret})).status,404);
  assert.equal((await request('/v1/apps/a/data/posts/service',{token:key.secret,method:'PUT',revision:'"0"',body:{data:'backend only',public:false}})).status,200);
  const database=await (await request('/account/app-storage/'+registrations[0].id,{cookie:'session'})).json();
  assert.equal(database.records,1);
  assert.ok(database.used<data.accountUsage('user1'));
  assert.equal((await manage(0,{action:'capacity',capacity:1024**3})).status,403);
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
