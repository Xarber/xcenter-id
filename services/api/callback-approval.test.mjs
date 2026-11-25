import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {test} from 'node:test';
import {createAdminAppRoutes} from './admin-apps.mjs';
import {openRegistry} from './registry.mjs';

test('a confirmed administrator can approve exact HTTPS callbacks without granting an app badge or issuing keys',async()=>{
  const registry=openRegistry(':memory:');
  const original=['https://fixture.example/callback','https://fixture.example/return'];
  const registration=registry.submit('owner','Fixture',original[0],undefined,false,{callbacks:original,description:'',repository:''});
  const audit=[];
  const handler=createAdminAppRoutes({registry,accounts:{
    adminStatus:req=>req.headers['x-confirmed']==='yes'?200:403,
    auditAdmin:(_req,id,action)=>audit.push([id,action]),
  }});
  const server=createServer((req,res)=>void handler(req,res)).listen(0,'127.0.0.1');
  await once(server,'listening');
  const post=(callbacks,confirmed='yes',verified=true)=>fetch('http://127.0.0.1:'+server.address().port,{
    method:'POST',headers:{'X-AuthNJS-Request':'account-consent','X-Confirmed':confirmed},
    body:JSON.stringify({type:'callback',id:registration.id,callbacks,verified}),
  });
  try{
    assert.equal((await post(original,'no')).status,403);
    assert.equal((await post(original.slice(0,1))).status,409);
    const approval=await post(original);
    assert.equal(approval.status,200);
    assert.deepEqual(await approval.json(),{ok:true});
    const reviewed=registry.lookup('owner',registration.id);
    assert.equal(reviewed.status,'pending');
    assert.equal(reviewed.verified,false);
    assert.equal(reviewed.callbackApproved,true);
    assert.equal(registry.lookup('another-owner',registration.id),undefined);
    assert.equal((await post(original,'yes',false)).status,200);
    assert.equal(registry.activateRegistration(reviewed,'stale-client'),false);
    assert.equal((await post(original)).status,200);
    const updated=['https://fixture.example/changed'];
    registry.saveApp('owner',registration.id,{name:'Fixture',callbacks:updated,description:'',repository:'',icon:null});
    assert.equal(registry.lookup('owner',registration.id).callbackApproved,false);
    assert.equal(registry.activateRegistration(reviewed,'stale-client'),false);
    assert.equal((await post(updated)).status,200);
    assert.equal(registry.activateRegistration(registry.lookup('owner',registration.id),'new-client'),true);
    assert.equal(registry.has('new-client'),true);
    assert.equal((await post(updated)).status,409);
    assert.equal(audit.length,4);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    registry.close();
  }
});
