import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {appConfiguration} from './application-configuration.mjs';
import {openApplicationData} from './application-data.mjs';
import {openRegistry} from './registry.mjs';

test('app configuration round trips without secrets and applies authorized changes together',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'xcenter-app-configuration-'));
  const registry=openRegistry(join(dir,'apps.sqlite'));
  const origin='https://id.example.test';
  const accounts={
    current:req=>req.headers.cookie ? {owner:req.headers.cookie} : null,
    available:()=>true,allowsMutation:req=>req.headers.origin===origin,
    recentlyConfirmed:req=>req.headers['x-fixture-confirmed']==='yes',
    adminStatus:()=>403,linkedGrant:()=>'fixture-grant',
  };
  const dataPath=join(dir,'data.sqlite');
  const data=openApplicationData({path:dataPath,key:Buffer.alloc(32,3),registry,accounts});
  registry.attachStorage(dataPath);
  const publisher=registry.submit('publisher','Garden','https://garden.example.test/callback');
  const receiver=registry.submit('owner','Journal','https://journal.example.test/callback');
  for(const [registration,client] of [[publisher,'garden-app'],[receiver,'journal-app']]){
    assert.ok(registry.approve(registration.id,client));
    assert.ok(registry.verifyApp(registration.id,true));
  }
  const config=appConfiguration({accounts,registry,applicationData:data});
  const server=createServer((req,res)=>{
    if(req.url.startsWith('/storage/')){
      return void data.handle(req,res,new URL('/account/app-storage/'+req.url.split('/').at(-1),origin));
    }
    void config(req,res,receiver.id);
  }).listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const send=(path,{owner='owner',confirmed=true,method='GET',body}={})=>fetch(base+path,{
    method,headers:{cookie:owner,origin,'X-AuthNJS-Request':'developer-portal','X-Fixture-Confirmed':confirmed?'yes':'no',
      'Content-Type':'application/json'},body:body&&JSON.stringify(body),
  });
  try{
    assert.equal((await send('/storage/'+publisher.id,{owner:'publisher',method:'POST',
      body:{action:'sharing',shared:['plants'],requests:[]}})).status,200);
    assert.equal((await send('/',{owner:'other'})).status,404);
    const initial=await (await send('/')).json();
    const invalid=structuredClone(initial);
    invalid.configuration.profile.callbacks=['https://different.example.test/callback'];
    invalid.configuration.requirements.email=true;
    assert.equal((await send('/',{method:'PUT',body:invalid})).status,422);
    assert.deepEqual(await (await send('/')).json(),initial);
    const revised=structuredClone(initial);
    revised.configuration.requirements.email=true;
    revised.configuration.storage.requests=[{source:'garden-app',collection:'plants',name:'read_plants',
      label:'Read plants',description:'Show plants from your garden journal.',icon:'folder'}];
    revised.configuration.storage.showInFiles=true;
    assert.equal((await send('/',{method:'PUT',body:revised,confirmed:false})).status,403);
    const saved=await send('/',{method:'PUT',body:revised});
    assert.equal(saved.status,200);
    const receipt=await saved.json();
    assert.deepEqual(receipt.configuration,revised.configuration);
    assert.equal(registry.brand('journal-app').verified,1);
    assert.deepEqual(Object.keys(receipt.configuration.storage).sort(),['requests','shared','showInFiles']);
    assert.equal(data.authorize('member','journal-app',['garden-app/plants']),true);
    assert.equal(data.permissions('member')[0].enabled,true);
    assert.equal((await send('/',{method:'PUT',body:initial})).status,409);
    receipt.configuration.storage.requests=[];
    assert.equal((await send('/',{method:'PUT',body:receipt})).status,200);
    assert.equal(data.permissions('member').length,0);
    const newConfig=await (await send('/')).json();
    newConfig.configuration.storage.requests=revised.configuration.storage.requests;
    assert.equal((await send('/',{method:'PUT',body:newConfig})).status,200);
    assert.equal(data.permissions('member')[0].enabled,false);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    registry.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
