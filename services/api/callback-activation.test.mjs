import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,randomBytes} from 'node:crypto';
import {Resolver} from 'node:dns/promises';
import {once} from 'node:events';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {Server} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import {openRegistry} from './registry.mjs';

test('admin callback approval allows only the confirmed owner to obtain credentials and skips DNS',async()=>{
  const origin='https://id.example.test';
  const data=mkdtempSync(join(tmpdir(),'xcenter-callback-activation-'));
  const config=join(data,'config.json');
  const key=()=>randomBytes(32).toString('hex');
  const jwk=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'jwk'});
  writeFileSync(config,JSON.stringify({profileKey:key(),sampleKey:key(),storageKey:key(),subjectKey:key(),
    cookieKeys:[key()],clients:[],jwks:{keys:[{...jwk,kid:'local-fixture',alg:'RS256',use:'sig'}]}}),{mode:0o600});
  const settings={AUTHNJS_DATA_DIR:data,AUTHNJS_OIDC_CONFIG:config,AUTHNJS_ACCOUNT_ORIGIN:origin,
    AUTHNJS_WEB_ROOT:data,AUTHNJS_ADMIN_ACCOUNT_IDS:'admin'};
  const previous=new Map(Object.keys(settings).map(name=>[name,process.env[name]]));
  Object.assign(process.env,settings);
  const listen=Server.prototype.listen,resolve=Resolver.prototype.resolveTxt;
  let server,lookups=0;
  Server.prototype.listen=function(){server=this;return listen.call(this,0,'127.0.0.1');};
  Resolver.prototype.resolveTxt=async function(){lookups++;return [];};
  try{
    await import('./account-web.mjs');
    Server.prototype.listen=listen;
    if(!server.address())await once(server,'listening');
    const db=new DatabaseSync(join(data,'accounts.sqlite'));
    try{
      const now=Date.now();
      for(const [user,age] of [['admin',0],['owner',0],['other',0],['stale',900_000]]){
        if(user!=='stale'){
          db.prepare('INSERT INTO accounts VALUES(?,?,?)').run(user,user,0);
          db.prepare('INSERT INTO identity_profiles VALUES(?,?,?,?,?)').run(user,user,'Fixture','User','adult');
        }
        db.prepare('INSERT INTO account_sessions VALUES(?,?,?,?)')
          .run(createHash('sha256').update(user+'-session').digest('hex'),user==='stale'?'owner':user,now-age,now+600_000);
      }
    }finally{db.close();}
    const registry=openRegistry(join(data,'apps.sqlite'));
    const first=registry.submit('owner','Confidential','https://app.example.org/first');
    const second=registry.submit('owner','Public','https://app.example.org/second',undefined,true);
    registry.close();
    const send=(path,{user,method='GET',intent='account-consent',body,headers={}}={})=>
      fetch('http://127.0.0.1:'+server.address().port+path,{
        method,headers:{origin,'x-authnjs-request':intent,...(user?{cookie:'__Host-authnjs='+user+'-session'}:{}),...headers},
        ...(body?{body:JSON.stringify(body)}:{}),
      });
    const approve=app=>send('/account/admin/apps',{user:'admin',method:'POST',
      body:{type:'callback',id:app.id,verified:true,callbacks:[app.callback]}});
    const claim=(app,user)=>send('/account/developer/apps/'+app.id+'/verify',{user,method:'POST',intent:'developer-portal'});
    assert.equal((await approve(first)).status,200);
    assert.equal((await claim(first,'other')).status,404);
    assert.equal((await claim(first,'stale')).status,403);
    const approved=await (await send('/account/developer/apps',{user:'owner',intent:'developer-portal'})).json();
    assert.equal(approved.apps.find(item=>item.id===first.id).callbackApproved,true);
    const confidential=await claim(first,'owner');
    assert.equal(confidential.status,201);
    const keys=await confidential.json();
    assert.match(keys.clientId,/^xid-/);
    assert.ok(keys.clientSecret);
    assert.equal((await claim(first,'owner')).status,404);
    assert.equal((await approve(second)).status,200);
    const publicClient=await claim(second,'owner');
    assert.equal(publicClient.status,201);
    assert.equal((await publicClient.json()).clientSecret,null);
    assert.equal(lookups,0);
    const preflight=await send('/v1/files',{method:'OPTIONS',headers:{origin:'https://client.example.org',
      'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
    assert.equal(preflight.status,204);
    assert.match(preflight.headers.get('access-control-allow-headers'),/Authorization/);
    const files=await send('/v1/files');
    assert.equal(files.status,401);
    assert.equal(files.headers.get('access-control-allow-origin'),'*');
    assert.equal((await send('/public/profiles/missing')).headers.get('access-control-allow-origin'),'*');
  }finally{
    Server.prototype.listen=listen;
    Resolver.prototype.resolveTxt=resolve;
    if(server)await new Promise(resolve=>server.close(resolve));
    for(const [name,value] of previous){
      if(value===undefined)delete process.env[name];
      else process.env[name]=value;
    }
    rmSync(data,{recursive:true,force:true});
  }
});
