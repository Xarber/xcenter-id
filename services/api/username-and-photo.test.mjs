import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import sharp from 'sharp';
import {createAccounts} from './accounts.mjs';
import {openMailStore} from './mail-store.mjs';
import {validateUsername} from './identity-profile.mjs';

test('punctuated usernames resolve through mailbox delivery and cannot use unsafe dot placement',()=>{
  const username='3.a_b-c';
  assert.deepEqual(validateUsername(' 3.A_B-C '),{username});
  for(const invalid of ['ab..c','.abc','abc.','a/b','support','...']){
    assert.ok(validateUsername(invalid).error,invalid);
  }
  const dir=mkdtempSync(join(tmpdir(),'xcenter-names-'));
  const database=join(dir,'accounts.sqlite');
  createAccounts({database,origin:'https://id.example.test'});
  const db=new DatabaseSync(database);
  try{
    db.exec("INSERT INTO accounts VALUES('member','Fixture Member',0);");
    db.prepare("INSERT INTO identity_profiles VALUES('member',?,'Fixture','Member','adult')").run(username);
    const mail=openMailStore({accountsPath:database,mailPath:join(dir,'mail.sqlite'),
      configuration:{storageKey:Buffer.alloc(32,3).toString('hex'),inboundDomains:['mail.xcenter.it','hme.xcenter.it']}});
    assert.equal(mail.resolveRecipient(username+'@mail.xcenter.it'),'member');
    assert.equal(mail.resolveRecipient(username+'@hme.xcenter.it'),null);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('profile photos increase charged bytes and cannot exceed remaining account quota',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'xcenter-photo-'));
  const database=join(dir,'accounts.sqlite');
  const origin='https://id.example.test';
  let otherBytes=0;
  const accounts=createAccounts({database,origin,profileKey:Buffer.alloc(32,4),extraStorage:()=>otherBytes});
  const db=new DatabaseSync(database);
  const now=Date.now();
  db.exec("INSERT INTO accounts VALUES ('member','Fixture Member',0);");
  db.prepare('INSERT INTO account_sessions VALUES(?,?,?,?)').run(createHash('sha256').update('fixture-session').digest('hex'),'member',now,now+600_000);
  const server=createServer((req,res)=>void accounts.handle(req,res,req.url)).listen(0,'127.0.0.1');
  await once(server,'listening');
  const save=picture=>fetch('http://127.0.0.1:'+server.address().port+'/account/profile',{
    method:'POST',headers:{origin,'Content-Type':'application/json',cookie:'__Host-authnjs=fixture-session'},
    body:JSON.stringify({username:'3.a_b-c',givenName:'Fixture',surname:'Member',birthday:'1990-01-01',picture}),
  });
  try{
    assert.equal((await save()).status,200);
    const baseline=accounts.usage('member').account;
    const picture=(await sharp({create:{width:8,height:8,channels:3,background:'#449966'}}).jpeg().toBuffer()).toString('base64');
    otherBytes=accounts.storageCapacity('member')-baseline;
    assert.equal((await save(picture)).status,409);
    assert.equal(accounts.usage('member').account,baseline);
    assert.equal(accounts.identity('member').hasPicture,false);
    otherBytes=0;
    assert.equal((await save(picture)).status,200);
    assert.ok(accounts.usage('member').account>baseline);
    assert.equal(accounts.identity('member').hasPicture,true);
    assert.equal((await save(null)).status,200);
    assert.equal(accounts.usage('member').account,baseline);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
