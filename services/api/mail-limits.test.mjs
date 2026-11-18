import {test} from 'node:test';import assert from 'node:assert/strict';import {openMailLimits} from './mail-limits.mjs';
test('external mail allowances persist per user and enforce service cap even for unlimited administrators',()=>{
 const limits=openMailLimits(':memory:',{daily:12,monthly:12});
 try{
  for(let i=0;i<10;i++)assert.equal(limits.reserve('one'),true);
  assert.equal(limits.reserve('one'),false);assert.equal(limits.view('two').usedToday,0);
  limits.set('one',{daily:null,monthly:null});assert.equal(limits.reserve('one'),true);assert.equal(limits.reserve('two'),true);
  assert.equal(limits.reserve('one'),false);assert.equal(limits.view('one').usedToday,11);
  limits.set('two',{daily:0,monthly:10});assert.equal(limits.reserve('two'),false);
  assert.throws(()=>limits.set('two',{daily:-1,monthly:null}));assert.throws(()=>limits.set('two',{daily:1.5,monthly:20}));
 }finally{limits.close();}
});
