import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateApplicationProfile } from './application-profile.mjs';
import { openRegistry } from './registry.mjs';

test('app profiles retain exact callbacks and admin verification is independent from callback activation',async()=>{
  const primary='https://app.example.test/auth/callback';
  const extra='https://app.example.test/mobile/callback';
  const profile=await validateApplicationProfile({name:'County Atlas',description:'A map',callbacks:[primary,extra,primary],repository:'https://github.com/example/atlas'});
  assert.deepEqual(profile.callbacks,[primary,extra]);
  await assert.rejects(validateApplicationProfile({...profile,callbacks:[primary,'https://other.example.test/callback']}));
  await assert.rejects(validateApplicationProfile({...profile,callbacks:[primary+'?next=somewhere']}));
  const registry=openRegistry(':memory:');
  try{
    const item=registry.submit('developer',profile.name,primary,profile,false,profile);
    assert.equal(registry.verifyApp(item.id,true),true);
    assert.equal(registry.has('atlas'),false);
    assert.equal(registry.saveDeveloper('developer','Atlas Team',true),null);
    assert.equal(registry.approve(item.id,'atlas'),true);
    assert.deepEqual(registry.publicDetails('atlas').callbacks,[primary,extra]);
    assert.equal(registry.saveDeveloper('developer','Atlas Team',true).status,'requested');
    assert.equal(registry.verifyDeveloper('developer',true),true);
    assert.equal(registry.verifyApp(item.id,true),true);
    assert.equal(registry.brand('atlas').developerName,'Atlas Team');
    assert.equal(registry.brand('atlas').verified,1);
    assert.deepEqual(registry.lookup('developer',item.id).requirements,{email:false,age_range:false});
    assert.equal(registry.saveRequirements('someone-else',item.id,{email:true,age_range:true}),null);
    assert.deepEqual(registry.saveRequirements('developer',item.id,{email:true,age_range:true}),{email:true,age_range:true});
    assert.equal(registry.brand('atlas').requiresEmail,1);
    assert.equal(registry.brand('atlas').requiresAgeRange,1);
    assert.equal(registry.brand('atlas').verified,1);
    assert.equal(registry.saveApp('someone-else',item.id,profile),null);
    assert.equal(registry.saveApp('developer',item.id,{...profile,callbacks:['https://new.example.test/callback']}),null);
    const edited=registry.saveApp('developer',item.id,{...profile,name:'Atlas',description:'Updated map',icon:'new-fixture-icon',callbacks:[extra]});
    assert.equal(edited.verified,false);
    assert.deepEqual(edited.requirements,{email:true,age_range:true});
    assert.equal(registry.brand('atlas').name,'Atlas');
    assert.equal(registry.brand('atlas').icon,'new-fixture-icon');
    assert.equal(registry.brand('atlas').description,'Updated map');
    assert.deepEqual(registry.published(),[{client:'atlas',name:'Atlas',verified:false}]);
    assert.equal(registry.verifyApp(item.id,true),true);
    assert.deepEqual(registry.published(),[{client:'atlas',name:'Atlas',verified:true}]);
    assert.deepEqual(registry.publicDetails('atlas').callbacks,[extra]);
    assert.equal(registry.saveDeveloper('developer','Atlas Team',false).status,'verified');
    assert.equal(registry.saveDeveloper('developer','New Name',false).status,'unverified');
    assert.equal(registry.brand('atlas').developerName,'New Name');
    assert.equal(registry.brand('atlas').verified,1);
  }finally{registry.close();}
});

test('registered clients lose discovery and data eligibility while restricted or deleted',()=>{
  const registry=openRegistry(':memory:');
  try{
    const app=registry.submit('owner','Native fixture','https://fixture.example.net/native',undefined,true);
    assert.equal(registry.has('unregistered'),false);
    assert.equal(registry.approve(app.id,'native-fixture'),true);
    assert.equal(registry.moderate('other',app.id,'restrict'),false);
    assert.equal(registry.moderate('owner',app.id,'restrict'),true);
    assert.equal(registry.has('native-fixture'),false);
    assert.equal(registry.publicDetails('native-fixture'),undefined);
    assert.equal(registry.published().length,0);
    assert.equal(registry.moderate('owner',app.id,'restore'),true);
    assert.equal(registry.has('native-fixture'),true);
    assert.equal(registry.moderate('owner',app.id,'delete'),true);
    assert.equal(registry.has('native-fixture'),false);
    assert.equal(registry.moderate('owner',app.id,'restore'),false);
    assert.equal(registry.publicDetails('native-fixture'),undefined);
  }finally{registry.close();}
});
