import {createServer} from 'node:http';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPeerSignaling} from './peer-signaling.mjs';
import {openRegistry} from './registry.mjs';

test('peer policies are restricted to verified app owners and disabled by verification changes',()=>{
  const registry=openRegistry(':memory:');
  const app=registry.submit('owner','Fixture App','https://app.example.test/callback');
  assert.equal(registry.ownedPeerPolicy('owner',app.id,{enabled:true,discovery:true}),null);
  registry.approve(app.id,'app-client');
  registry.verifyApp(app.id,true);
  assert.equal(registry.ownedPeerPolicy('other',app.id,{enabled:true,discovery:true}),null);
  assert.equal(registry.ownedPeerPolicy('owner',app.id,{enabled:true,discovery:true}).discovery,true);
  const generation=registry.peerPolicy('app-client').generation;
  assert.equal(registry.ownedPeerPolicy('owner',app.id,{enabled:false,discovery:true}).discovery,false);
  assert.notEqual(registry.peerPolicy('app-client').generation,generation);
  registry.verifyApp(app.id,false);
  assert.equal(registry.peerPolicy('app-client'),null);
});

test('peers require app and account credentials, enforce discovery, and expire',async()=>{
  const users=new Map([['alice',{owner:'alice',client:'a'}],['bob',{owner:'bob',client:'a'}],
    ['other',{owner:'alice',client:'b'}],['unauthorized',{owner:'alice',client:'c'}]]);
  const policy=new Map([['a',{enabled:true,discovery:false,generation:0}],['b',{enabled:true,discovery:true,generation:0}]]);
  let time=1000;
  const handle=createPeerSignaling({authenticate:async token=>users.get(token),settings:client=>policy.get(client),now:()=>time});
  const server=createServer((req,res)=>void handle(req,res,new URL(req.url,'http://localhost'))).listen(0,'127.0.0.1');
  await once(server,'listening');
  const endpoint='http://127.0.0.1:'+server.address().port+'/v1/peers';
  const request=(token,path='',{peer,body,method=body?'POST':'GET'}={})=>fetch(endpoint+path,{
    method,headers:{authorization:'Bearer '+token,...(peer?{'X-XCenter-Peer-Proof':peer.proof}:{}),
      ...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),
  });
  const open=async(token,discoverable)=>{
    const response=await request(token,'',{body:{discoverable}});
    assert.equal(response.status,201);return response.json();
  };
  try{
    assert.equal((await request('unknown','',{body:{discoverable:true}})).status,401);
    assert.equal((await request('unauthorized','',{body:{discoverable:true}})).status,403);
    const alice=await open('alice',false), bob=await open('bob',true), other=await open('other',true);
    assert.match(alice.id,/^[a-zA-Z0-9_-]{24}$/);
    const poll=peer=>'/'+peer.id+'/messages';
    const directory=peer=>'/'+peer.id+'/directory';
    assert.equal((await request('alice',directory(alice),{peer:alice})).status,403);
    policy.get('a').discovery=true;
    assert.deepEqual(await (await request('alice',directory(alice),{peer:alice})).json(),{peers:[bob.id]});
    assert.deepEqual(await (await request('bob',directory(bob),{peer:bob})).json(),{peers:[]});
    assert.equal((await request('other',poll(alice),{peer:alice})).status,404);
    assert.equal((await request('alice',poll(bob),{peer:bob})).status,404);
    assert.equal((await request('alice',poll(alice))).status,404);
    const offer={type:'offer',data:{type:'offer',sdp:'fixture'}};
    assert.equal((await request('alice',poll(alice),{peer:alice,body:{...offer,to:other.id}})).status,404);
    assert.equal((await request('bob',poll(bob),{peer:bob,body:{...offer,to:alice.id}})).status,202);
    assert.deepEqual(await (await request('alice',poll(alice),{peer:alice})).json(),{messages:[{...offer,from:bob.id}]});
    assert.deepEqual(await (await request('alice',poll(alice),{peer:alice})).json(),{messages:[]});
    policy.get('a').enabled=false;
    assert.equal((await request('alice',poll(alice),{peer:alice})).status,403);
    policy.get('a').enabled=true;
    policy.get('a').generation++;
    assert.equal((await request('alice',poll(alice),{peer:alice})).status,404);
    users.delete('other');
    assert.equal((await request('other',poll(other),{peer:other})).status,401);
    const fresh=await open('alice',true);
    time+=91_000;
    assert.equal((await request('alice',poll(fresh),{peer:fresh})).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
