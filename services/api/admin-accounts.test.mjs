import assert from 'node:assert/strict';
import { createHash,generateKeyPairSync,sign } from 'node:crypto';
import {isoCBOR} from '@simplewebauthn/server/helpers';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createAccounts } from './accounts.mjs';

test('only a recently authenticated administrator can change a quota',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'authnjs-admin-'));
  const database=join(dir,'accounts.sqlite');
  const origin='https://id.example.test';
  const previous=process.env.AUTHNJS_ADMIN_ACCOUNT_IDS;
  process.env.AUTHNJS_ADMIN_ACCOUNT_IDS='admin-account';
  const service=createAccounts({database,origin});
  if(previous===undefined)delete process.env.AUTHNJS_ADMIN_ACCOUNT_IDS;
  else process.env.AUTHNJS_ADMIN_ACCOUNT_IDS=previous;
  const db=new DatabaseSync(database);
  const clock=Date.now();
  db.exec("INSERT INTO accounts VALUES ('admin-account','Administrator',0),('owner','Synthetic user',0);INSERT INTO identity_profiles VALUES ('owner','fixture','Example','User','adult');");
  const insert=db.prepare('INSERT INTO account_sessions VALUES (?,?,?,?)');
  for(const [token,owner,age] of [['admin-session','admin-account',0],['old-admin','admin-account',400_000],['member-session','owner',0]]){
    insert.run(createHash('sha256').update(token).digest('hex'),owner,clock-age,clock+600_000);
  }
  const server=createServer((req,res)=>void service.handle(req,res,req.url)).listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const change=(value,token)=>fetch(base+'/account/admin/storage',{method:'POST',headers:{
    origin,'content-type':'application/json',cookie:'__Host-authnjs='+token,
  },body:JSON.stringify({username:'fixture',capacity:value})});
  try{
    assert.equal(service.storageCapacity('owner'),10*1024**2);
    assert.equal((await change(3*1024**2,'member-session')).status,403);
    assert.equal((await change(3*1024**2,'old-admin')).status,403);
    assert.equal((await change(10,'admin-session')).status,422);
    assert.equal((await change(3*1024**2,'admin-session')).status,200);
    assert.equal(service.storageCapacity('owner'),3*1024**2);
  }finally{
    await new Promise(resolve=>server.close(resolve));db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('administrator account lists can page and filter beyond the legacy cap',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'authnjs-admin-page-'));
  const database=join(dir,'accounts.sqlite');
  const previous=process.env.AUTHNJS_ADMIN_ACCOUNT_IDS;
  process.env.AUTHNJS_ADMIN_ACCOUNT_IDS='list-owner';
  const service=createAccounts({database,origin:'https://id.example.test'});
  if(previous===undefined)delete process.env.AUTHNJS_ADMIN_ACCOUNT_IDS;
  else process.env.AUTHNJS_ADMIN_ACCOUNT_IDS=previous;
  const db=new DatabaseSync(database);
  const server=createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost').pathname)).listen(0,'127.0.0.1');
  await once(server,'listening');
  try{
    db.exec(`INSERT INTO accounts VALUES('list-owner','Synthetic admin',0);
      WITH RECURSIVE ids(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM ids WHERE n<520)
      INSERT INTO accounts SELECT 'owner-'||n,'Synthetic user',0 FROM ids;
      INSERT INTO identity_profiles SELECT id,'fixture-'||printf('%03d',substr(id,7)),'Example','User','adult'
        FROM accounts WHERE id!='list-owner';`);
    const time=Date.now();
    db.prepare('INSERT INTO account_sessions VALUES (?,?,?,?)')
      .run(createHash('sha256').update('list-session').digest('hex'),'list-owner',time,time+60_000);
    const request=query=>fetch('http://127.0.0.1:'+server.address().port+'/account/admin/accounts'+query,
      {headers:{cookie:'__Host-authnjs=list-session'}});
    const legacy=await (await request('')).json();
    assert.equal(legacy.accounts.length,500);
    const last=await (await request('?page=999&size=25')).json();
    assert.equal(last.total,520);
    assert.equal(last.page,21);
    assert.equal(last.accounts.at(-1).username,'fixture-520');
    const filtered=await (await request('?q=FIXTURE-51&size=10')).json();
    assert.equal(filtered.total,10);
    assert.equal(filtered.accounts[0].username,'fixture-510');
    assert.equal((await request('?size=0')).status,422);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('operator rename preserves ownership and re-authenticates encrypted profile data', () => {
  const dir=mkdtempSync(join(tmpdir(),'authnjs-rename-'));
  const database=join(dir,'accounts.sqlite');
  const service=createAccounts({database,origin:'https://id.example.test',profileKey:Buffer.alloc(32,37)});
  const db=new DatabaseSync(database);
  try {
    db.exec("INSERT INTO accounts VALUES ('owner','Synthetic owner',0),('other','Another user',0); INSERT INTO identity_profiles VALUES ('owner','original','Ada','Rossi','adult'),('other','taken','Other','User','adult');");
    assert.equal(service.renameStoredUsername('other','original','xarber'),false);
    assert.equal(service.renameStoredUsername('owner','original','taken'),false);
    assert.equal(service.renameStoredUsername('owner','original','xarber'),true);
    const row=db.prepare("SELECT owner,username,given_name FROM identity_profiles WHERE owner='owner'").get();
    assert.equal(row.owner,'owner');
    assert.equal(row.username,'xarber');
    assert.match(row.given_name,/^profile-v1:/);
    assert.equal(service.renameStoredUsername('owner','xarber','original'),true);
  } finally {
    db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('signup checks username availability before creating WebAuthn options', async () => {
  const dir=mkdtempSync(join(tmpdir(),'authnjs-signup-'));
  const database=join(dir,'accounts.sqlite');
  const origin='https://id.example.test';
  const service=createAccounts({database,origin});
  const db=new DatabaseSync(database);
  db.exec("INSERT INTO accounts VALUES ('owner','Synthetic owner',0); INSERT INTO identity_profiles VALUES ('owner','taken','Ada','Rossi','adult');");
  const server=createServer((req,res)=>void service.handle(req,res,req.url)).listen(0,'127.0.0.1');
  await once(server,'listening');
  const enroll=username=>fetch('http://127.0.0.1:'+server.address().port+'/account/signup/options',{
    method:'POST', headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({username}),
  });
  try {
    assert.equal((await enroll('xarber')).status,422);
    assert.equal((await enroll('taken')).status,409);
    const response=await enroll('ExampleNew');
    assert.equal(response.status,200);
    const options=await response.json();
    assert.equal(options.user.name,'examplenew');
    assert.equal(options.user.displayName,'examplenew');
    assert.equal(db.prepare('SELECT count(*) AS n FROM signup_usernames').get().n,0);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('admin moderation and support enforce role, ownership and one mailbox reply',async(t)=>{
  const {openMailStore}=await import('./mail-store.mjs');
  const {createSupportRoutes}=await import('./support-routes.mjs');
  const {simpleParser}=await import('mailparser');
  const dir=mkdtempSync(join(tmpdir(),'authnjs-support-'));
  const database=join(dir,'accounts.sqlite');
  const origin='https://id.example.test';
  const saved=process.env.AUTHNJS_ADMIN_ACCOUNT_IDS;
  process.env.AUTHNJS_ADMIN_ACCOUNT_IDS='admin,other-admin';
  const service=createAccounts({database,origin,profileKey:Buffer.alloc(32,29)});
  if(saved===undefined)delete process.env.AUTHNJS_ADMIN_ACCOUNT_IDS;
  else process.env.AUTHNJS_ADMIN_ACCOUNT_IDS=saved;
  const db=new DatabaseSync(database);
  db.exec(`INSERT INTO accounts VALUES ('admin','Administrator',0),('other-admin','Other admin',0),('member','Member',0);
    INSERT INTO identity_profiles VALUES ('admin','adminuser','Example','Admin','adult'),('member','fixture','Example','User','adult');`);
  const session=db.prepare('INSERT INTO account_sessions VALUES (?,?,?,?)');
  const cookie=(token)=>({cookie:'__Host-authnjs='+token});
  for(const [token,owner,age] of [['recent','admin',0],['old','admin',400_000],['other','other-admin',0],['member','member',0]]){
    session.run(createHash('sha256').update(token).digest('hex'),owner,Date.now()-age,Date.now()+600_000);
  }
  const mail=openMailStore({accountsPath:database,mailPath:join(dir,'mail.sqlite'),configuration:{
    inboundDomains:['mail.xcenter.it'],supportAddresses:['support@id.xcenter.it'],storageKey:'ab'.repeat(32),
  }});
  const externalReplies=[];
  const support=createSupportRoutes({accounts:service,mail,sendExternal:async(...args)=>externalReplies.push(args)});
  const server=createServer((req,res)=>void (req.url.includes('/support')?support(req,res,req.url):service.handle(req,res,req.url)));
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));mail.close();db.close();rmSync(dir,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port+'/account/';
  const get=(path,token)=>fetch(base+path,{headers:cookie(token)});
  const post=(path,token,data)=>fetch(base+path,{method:'POST',headers:{
    ...cookie(token),origin,'X-AuthNJS-Request':'account-consent','Content-Type':'application/json',
  },body:JSON.stringify(data)});
  const moderate=(token,action,confirmation,username='fixture')=>post('admin/account-status',token,{username,action,confirmation});
  assert.equal((await get('admin/accounts/fixture/avatar','member')).status,403);
  assert.equal((await get('admin/support','member')).status,403);
  assert.equal((await post('support','member',{subject:'Isolated feedback',text:'A request'})).status,201);
  const items=(await (await get('admin/support','recent')).json()).requests;
  assert.equal(items.length,1);
  assert.deepEqual((await (await get('admin/support','other')).json()).requests,items);
  const details=await (await get('admin/support/'+items[0].id,'other')).json();
  assert.equal(details.sender,'@fixture');
  assert.equal(details.text.trim(),'A request');
  const reply='admin/support/'+items[0].id;
  assert.equal((await post(reply,'member',{text:'Denied'})).status,403);
  assert.equal((await post(reply,'other',{text:'Isolated response'})).status,200);
  assert.equal((await post(reply,'recent',{text:'Duplicate'})).status,409);
  const {messages}=mail.page('member');
  assert.equal(messages.length,1);
  assert.equal((await simpleParser(mail.retrieve('member',messages[0].id))).text.trim(),'Isolated response');
  assert.equal(mail.page('admin').messages.length,0);
  assert.equal(mail.resolveRecipient('mailbox@id.xcenter.it'),null);
  assert.equal(mail.resolveRecipient('support@xcenter.it'),null);
  assert.equal(mail.receive(['support@id.xcenter.it'],Buffer.from('From: fixture@mail.xcenter.it\r\nSubject: Synthetic inbound\r\n\r\nHello.')),true);
  const external=mail.listSupport().find(item=>item.external);
  assert.equal((await mail.readSupport(external.id)).canReply,true);
  assert.equal((await post('admin/support/'+external.id,'old',{text:'Denied'})).status,403);
  assert.equal((await post('admin/support/'+external.id,'recent',{text:'External reply'})).status,200);
  assert.equal(externalReplies.length,1);assert.equal(externalReplies[0][1],'fixture@mail.xcenter.it');
  assert.equal((await mail.readSupport(external.id)).canReply,false);
  assert.equal((await post('admin/support/'+external.id,'recent',{text:'Duplicate'})).status,409);
  assert.equal((await moderate('member','lock')).status,403);
  assert.equal((await moderate('old','lock')).status,403);
  assert.equal((await moderate('recent','lock',undefined,'adminuser')).status,422);
  assert.equal((await moderate('recent','lock')).status,200);
  assert.deepEqual(await (await get('me','member')).json(),{account:null,locked:true});
  assert.equal(service.grantAllowed('member','client','grant'),false);
  assert.equal((await post('support','member',{subject:'Locked account appeal',text:'Please review my restriction.'})).status,201);
  const owned=await (await get('support','member')).json();
  assert.ok(owned.requests.some(item=>item.subject==='Locked account appeal'));
  const appeal=mail.listSupport().find(item=>!item.external&&!item.replied);
  assert.equal((await post('admin/support/'+appeal.id,'other',{text:'Appeal received.'})).status,200);
  assert.ok((await (await get('support','member')).json()).requests.some(item=>item.reply?.includes('Appeal received.')));

  assert.equal((await moderate('recent','unlock')).status,200);
  assert.equal((await (await get('me','member')).json()).account.profile.username,'fixture');
  assert.equal((await post('username-change','member',{action:'request',username:'fixtureupdated'})).status,200);
  const {request}=await (await get('username-change','member')).json();
  assert.equal((await post('admin/username-changes','recent',{action:'approve',id:request.id})).status,404);
  assert.equal((await post('username-change','other',{action:'confirm',id:request.id})).status,404);
  assert.equal((await post('username-change','member',{action:'confirm',id:request.id})).status,200);
  assert.equal((await post('admin/username-changes','member',{action:'approve',id:request.id})).status,403);
  assert.equal((await post('admin/username-changes','recent',{action:'approve',id:request.id})).status,200);
  assert.equal(service.identity('member').username,'fixtureupdated');
  assert.equal(service.identity('member').givenName,'Example');
  assert.equal(mail.resolveRecipient('fixtureupdated@mail.xcenter.it'),'member');
  assert.equal(mail.resolveRecipient('fixture@mail.xcenter.it'),null);
  assert.equal((await moderate('recent','revoke-sessions',undefined,'fixtureupdated')).status,200);
  assert.equal((await (await get('me','member')).json()).account,null);
  assert.equal(service.available('member'),true);
  assert.equal((await moderate('recent','delete','wrong','fixtureupdated')).status,422);
  assert.equal((await moderate('recent','delete','fixtureupdated','fixtureupdated')).status,200);
  assert.equal(service.identity('member'),undefined);
  assert.equal((await post('signup/options','member',{username:'fixture'})).status,409);
  assert.equal(db.prepare('SELECT count(*) AS total FROM account_admin_events').get().total,6);
});

test('live admin delegation, user verification and public profile flags enforce server trust boundaries',async()=>{
 const {createAdminUsers}=await import('./admin-users.mjs');
 const dir=mkdtempSync(join(tmpdir(),'xcenter-roles-')),database=join(dir,'accounts.sqlite'),origin='https://id.example.test';
 const previous=process.env.AUTHNJS_ADMIN_ACCOUNT_IDS;process.env.AUTHNJS_ADMIN_ACCOUNT_IDS='root';
 const accounts=createAccounts({database,origin});if(previous===undefined)delete process.env.AUTHNJS_ADMIN_ACCOUNT_IDS;else process.env.AUTHNJS_ADMIN_ACCOUNT_IDS=previous;
 const db=new DatabaseSync(database);db.exec("INSERT INTO accounts VALUES('root','Root',0),('member','Member',0);INSERT INTO identity_profiles VALUES('root','rootuser','Root','User','adult'),('member','fixture','Test','Member','adult')");
 for(const token of ['root','member'])db.prepare('INSERT INTO account_sessions VALUES(?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),token,Date.now(),Date.now()+600000);
 const users=createAdminUsers({accounts,registry:{managed:()=>[],hasDeveloper:()=>false},mail:null});
 const server=createServer((req,res)=>{const username=/^\/account\/admin\/users\/([a-z]+)$/.exec(req.url)?.[1];void(username?users(req,res,username):accounts.handle(req,res,req.url));}).listen(0,'127.0.0.1');await once(server,'listening');
 const post=(path,body,token='root')=>fetch('http://127.0.0.1:'+server.address().port+'/account/'+path,{method:'POST',headers:{origin,'content-type':'application/json','x-authnjs-request':'account-consent',cookie:'__Host-authnjs='+token},body:JSON.stringify(body)});
 try{
  assert.equal((await post('admin/users/fixture',{action:'set-admin',enabled:true},'member')).status,403);
  assert.equal((await post('admin/users/fixture',{action:'set-admin',enabled:true})).status,200);
  assert.equal(accounts.adminDetails('fixture').admin,true);
  assert.equal((await post('admin/users/rootuser',{action:'set-admin',enabled:false})).status,403);
  assert.equal((await post('admin/users/fixture',{action:'verify-user',enabled:true})).status,200);
  assert.equal(accounts.badgeForAddress('fixture@mail.xcenter.it').verified,true);
  assert.equal((await post('admin/storage',{username:'fixture',capacity:2*1024**4})).status,200);
  assert.equal(accounts.storageCapacity('member'),2*1024**4);
  assert.equal(accounts.publicProfile('fixture'),null);
  assert.equal((await post('profile/visibility',{fields:['givenName']},'member')).status,200);
  assert.deepEqual(accounts.publicProfile('fixture'),{username:'fixture',givenName:'Test',verified:true,admin:true});
  assert.equal((await post('profile/visibility',{fields:['birthday']},'member')).status,422);
  assert.equal((await post('admin/users/fixture',{action:'set-admin',enabled:false})).status,200);
  assert.equal(accounts.adminDetails('fixture').admin,false);
  assert.deepEqual(accounts.publicProfile('fixture'),{username:'fixture',givenName:'Test',verified:true});
  assert.equal((await post('admin/users/fixture',{action:'verify-user',enabled:false})).status,200);
  assert.deepEqual(accounts.publicProfile('fixture'),{username:'fixture',givenName:'Test'});
 }finally{await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('browser can switch only among its own saved sessions and self-deletion preserves other accounts',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'authnjs-switcher-'));
  const database=join(dir,'accounts.sqlite');
  const origin='https://id.example.test';
  const purged=[];
  const service=createAccounts({database,origin,purgeAccount:owner=>purged.push(owner)});
  const db=new DatabaseSync(database);
  const timestamp=Date.now();
  const first='a'.repeat(43),second='b'.repeat(43),old='c'.repeat(43);
  db.exec("INSERT INTO accounts VALUES ('one','First user',0),('two','Second user',0); INSERT INTO identity_profiles VALUES ('one','firstuser','First','User','adult'),('two','seconduser','Second','User','adult');");
  const insert=db.prepare('INSERT INTO account_sessions VALUES (?,?,?,?)');
  for(const [value,owner,age] of [[first,'one',0],[second,'two',0],[old,'two',400_000]])insert.run(createHash('sha256').update(value).digest('hex'),owner,timestamp-age,timestamp+600_000);
  const server=createServer((req,res)=>void service.handle(req,res,req.url)).listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/account/';
  const call=(path,cookie,data)=>fetch(base+path,{method:data?'POST':'GET',body:data&&JSON.stringify(data),
    headers:{cookie,origin,'content-type':'application/json','x-authnjs-request':'account-consent'}});
  const cookies='__Host-authnjs='+first+'; __Host-authnjs-switcher='+second;
  try{
    const list=await (await call('switcher',cookies)).json();
    assert.deepEqual(list.accounts.map(({username,current})=>[username,current]),[['firstuser',true],['seconduser',false]]);
    assert.equal((await call('switcher','__Host-authnjs='+first,{slot:1})).status,404);
    const select=await call('switcher',cookies,{slot:1});
    assert.equal(select.status,200);
    assert.ok(select.headers.getSetCookie().some(item=>item.startsWith('__Host-authnjs='+second+';')));
    assert.equal((await call('delete','__Host-authnjs='+old,{confirmation:'seconduser'})).status,403);
    assert.equal((await call('delete',cookies,{confirmation:'seconduser'})).status,422);
    assert.equal((await call('delete',cookies,{confirmation:'firstuser'})).status,200);
    assert.deepEqual(purged,['one']);
    assert.equal((await (await call('me',cookies)).json()).account,null);
    assert.equal((await (await call('me','__Host-authnjs='+second)).json()).account.profile.username,'seconduser');
    assert.deepEqual((await (await call('switcher',cookies)).json()).accounts.map(({username})=>username),['seconduser']);
  }finally{await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('explicit add-account intent permits passkey and email login while preserving the active session',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'authnjs-add-account-'));
  const database=join(dir,'accounts.sqlite');
  const origin='https://id.example.test';
  const codes=[];
  const service=createAccounts({database,origin,sendVerification:async({code})=>codes.push(code)});
  const db=new DatabaseSync(database);
  db.exec("INSERT INTO accounts VALUES ('one','First',0),('two','Second',0); INSERT INTO identity_profiles VALUES ('one','firstuser','First','User','adult'),('two','seconduser','Second','User','adult'); INSERT INTO verified_emails VALUES ('two','second@example.test',1);");
  const now=Date.now(),first='x'.repeat(43),otherBrowser='y'.repeat(43);
  const store=db.prepare('INSERT INTO account_sessions VALUES (?,?,?,?)');
  for(const value of [first,otherBrowser])store.run(createHash('sha256').update(value).digest('hex'),'one',now,now+600_000);
  const server=createServer((req,res)=>void service.handle(req,res,req.url)).listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/account/';
  const post=(path,data,session=first)=>fetch(base+path,{method:'POST',body:JSON.stringify(data),
    headers:{cookie:'__Host-authnjs='+session,origin,'content-type':'application/json','x-authnjs-request':'account-consent'}});
  try{
    assert.equal((await post('login/options',{username:'seconduser'})).status,409);
    assert.equal((await post('login/options',{username:'seconduser',addAccount:true})).status,200);
    const enrollment=await post('signup/options',{username:'thirduser',addAccount:true});
    assert.equal(enrollment.status,200);
    const signup=await enrollment.json();
    assert.equal(signup.user.name,'thirduser');
    assert.notEqual(signup.user.id,Buffer.from('one').toString('base64url'));
    assert.equal((await post('login/username',{username:'seconduser'})).status,409);
    const started=await post('login/username',{username:'seconduser',addAccount:true});
    assert.equal(started.status,200);
    const {ticket}=await started.json();
    assert.ok(codes[0]);
    assert.equal((await post('login/code',{ticket,code:codes[0],addAccount:true},otherBrowser)).status,401);
    const completed=await post('login/code',{ticket,code:codes[0],addAccount:true});
    assert.equal(completed.status,200);
    assert.ok(completed.headers.getSetCookie().some(value=>value.startsWith('__Host-authnjs-switcher='+first+';')));
    const active=completed.headers.getSetCookie().find(value=>value.startsWith('__Host-authnjs=')).split(';')[0];
    const me=await (await fetch(base+'me',{headers:{cookie:active}})).json();
    assert.equal(me.account.profile.username,'seconduser');
  }finally{await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('native confirmation verifies the app account passkey independently of the browser account',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'authnjs-native-admin-'));
  const database=join(dir,'accounts.sqlite');
  const origin='https://id.example.test';
  const service=createAccounts({database,origin});
  const db=new DatabaseSync(database);
  const now=Date.now();
  const digest=value=>createHash('sha256').update(value).digest();
  const token='n'.repeat(43),browserToken='b'.repeat(43);
  const nativeHash=digest(token).toString('hex');
  const browserHash=digest(browserToken).toString('hex');
  db.exec(`INSERT INTO accounts VALUES ('native','Native admin',0),('browser','Browser user',0);
    INSERT INTO account_flags(owner,admin) VALUES('native',1);
    INSERT INTO identity_profiles VALUES('native','nativeuser','Native','Admin','adult'),('browser','browseruser','Browser','User','adult');`);
  const insert=db.prepare('INSERT INTO account_sessions VALUES(?,?,?,?)');
  insert.run(nativeHash,'native',now-400_000,now+600_000);
  insert.run(browserHash,'browser',now-400_000,now+600_000);
  db.prepare('INSERT INTO native_sessions VALUES(?)').run(nativeHash);
  function passkey(owner){
    const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
    const {x,y}=publicKey.export({format:'jwk'});
    const id=Buffer.from(owner+' synthetic test credential').toString('base64url');
    const cose=isoCBOR.encode(new Map([[1,2],[3,-7],[-1,1],[-2,Buffer.from(x,'base64url')],[-3,Buffer.from(y,'base64url')]]));
    db.prepare('INSERT INTO passkeys VALUES(?,?,?,?,?,?,?)').run(id,owner,'Fixture key',cose,0,'[]',now);
    return {id,assertion(options){
      const clientData=Buffer.from(JSON.stringify({type:'webauthn.get',challenge:options.challenge,origin,crossOrigin:false}));
      const authenticatorData=Buffer.concat([digest(new URL(origin).hostname),Buffer.from([5,0,0,0,1])]);
      const signature=sign('sha256',Buffer.concat([authenticatorData,digest(clientData)]),privateKey);
      return {id,rawId:id,type:'public-key',clientExtensionResults:{},response:{
        clientDataJSON:clientData.toString('base64url'),authenticatorData:authenticatorData.toString('base64url'),
        signature:signature.toString('base64url'),userHandle:Buffer.from(owner).toString('base64url'),
      }};
    }};
  }
  const primary=passkey('native'),other=passkey('browser');
  const server=createServer((req,res)=>void service.handle(req,res,req.url)).listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/account/';
  const nativeHeaders={'x-authnjs-native':'account-manager',authorization:'Bearer '+token};
  const browserCookie='__Host-authnjs='+browserToken;
  const post=(route,data,headers)=>fetch(base+route,{method:'POST',body:JSON.stringify(data),
    headers:{'content-type':'application/json',...headers}});
  try{
    db.exec(`INSERT INTO verified_emails VALUES('native','verified@example.test',1);
      INSERT INTO account_email_addresses VALUES('native','pending@example.test',1);`);
    const remove=address=>post('email/remove',{email:address},nativeHeaders);
    assert.equal((await remove('verified@example.test')).status,403);
    assert.equal((await remove('pending@example.test')).status,403);
    const start=await post('device/browser',{code:'ABCD23'},nativeHeaders);
    assert.equal(start.status,200);
    const handoff=new URL((await start.json()).url);
    const exchange=key=>post('device/browser/exchange',{key},{origin,'x-authnjs-request':'device-review',cookie:browserCookie});
    const redeemed=await exchange(handoff.hash.slice(1));
    assert.equal(redeemed.status,200);
    const deviceCookie=redeemed.headers.getSetCookie()[0].split(';')[0];
    assert.equal(service.deviceBrowserSession({headers:{cookie:deviceCookie}}).owner,'native');
    assert.equal(service.current({headers:{cookie:deviceCookie}}),undefined);
    assert.equal((await exchange(handoff.hash.slice(1))).status,401);
    const admin=async()=> (await(await fetch(base+'admin/access',{headers:nativeHeaders})).json()).authorized;
    assert.equal(await admin(),false);
    const {state}=await(await post('reauth/native',{},nativeHeaders)).json();
    const open=(cookie='')=>post('reauth/options',{request:state},{origin,...(cookie?{cookie}:{})});
    const anonymous=await open();
    assert.equal(anonymous.status,200);
    assert.deepEqual((await anonymous.json()).allowCredentials.map(item=>item.id),[primary.id]);

    const confirm=async(key)=>{
      const opened=await open(browserCookie);
      assert.equal(opened.status,200);
      const challengeCookie=opened.headers.getSetCookie()[0].split(';')[0];
      const response=key.assertion(await opened.json());
      return post('reauth/finish',{response},{origin,cookie:browserCookie+'; '+challengeCookie});
    };
    assert.equal((await confirm(other)).status,403);
    assert.equal(await admin(),false);
    const success=await confirm(primary);
    assert.equal(success.status,200,await success.clone().text());
    assert.equal((await success.json()).returnTo,'authnjs-dashboard://reauth?state='+state);
    assert.equal(await admin(),true);
    assert.equal((await remove('verified@example.test')).status,200);
    assert.equal((await remove('pending@example.test')).status,200);
    assert.equal(db.prepare('SELECT count(*) AS n FROM verified_emails WHERE owner=?').get('native').n,0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM account_email_addresses WHERE owner=?').get('native').n,0);

    assert.equal(db.prepare('SELECT 1 AS found FROM session_confirmations WHERE hash=?').get(browserHash),undefined);
    assert.equal((await open(browserCookie)).status,403);
  }finally{await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
});
