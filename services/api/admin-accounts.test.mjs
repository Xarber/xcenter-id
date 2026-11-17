import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
