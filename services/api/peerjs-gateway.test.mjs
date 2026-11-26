import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {test} from 'node:test';
import {WebSocket} from 'ws';
import {createPeerJsGateway} from './peerjs-gateway.mjs';

test('stock protocol isolates IDs, directory and signaling by registration',async()=>{
  const users=new Map([
    ['same-user-a',{owner:'player',client:'app-a'}],['same-user-b',{owner:'player',client:'app-b'}],
    ['friend-a',{owner:'friend',client:'app-a'}],
  ]);
  const settings=new Map(['app-a','app-b'].map(client=>[client,{enabled:true,discovery:true,generation:1}]));
  const origin='https://app.example.test';
  const gateway=createPeerJsGateway({authenticate:async token=>users.get(token),settings:client=>settings.get(client)});
  const server=createServer((req,res)=>void gateway.handle(req,res,new URL(req.url,'http://localhost')));
  gateway.attach(server);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const call=(method,token,body)=>fetch(base+'/v1/peers/peerjs/session',{method,headers:{Authorization:'Bearer '+token,
    'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  const start=async (token,id,discoverable=true)=>{
    const response=await call('POST',token,{id,discoverable});
    assert.equal(response.status,201);
    return response.json();
  };
  const sockets=[];
  async function connect(lease,override={}){
    const params=new URLSearchParams({key:lease.key,id:lease.id,token:lease.token,...override});
    const socket=new WebSocket(base.replace('http','ws')+'/peerjs/peerjs?'+params,{origin});
    sockets.push(socket);
    const [message]=await once(socket,'message');
    assert.equal(JSON.parse(message).type,'OPEN');
    return socket;
  }
  const directory=lease=>fetch(base+'/peerjs/'+lease.key+'/peers',{headers:{Origin:origin}});
  async function next(socket){const [data]=await once(socket,'message');return JSON.parse(data);}
  try{
    assert.equal((await call('POST','bad',{discoverable:true})).status,401);
    const a=await start('same-user-a','Player');
    const b=await start('same-user-b','Player');
    const friend=await start('friend-a','Friend');
    assert.equal((await call('POST','friend-a',{id:'Player',discoverable:true})).status,409);
    await assert.rejects(connect(a,{token:b.token}),/403/);
    await assert.rejects(connect(a,{id:'Friend'}),/403/);
    const socketA=await connect(a), socketB=await connect(b), socketFriend=await connect(friend);
    assert.deepEqual(await (await directory(a)).json(),['Friend']);
    assert.deepEqual(await (await directory(b)).json(),[]);
    assert.equal((await fetch(base+'/peerjs/'+a.key+'/peers',{headers:{Origin:'https://other.test'}})).status,401);
    const offer={type:'OFFER',dst:'Friend',src:'Bob',payload:{connectionId:'first'}};
    const received=next(socketFriend);
    socketA.send(JSON.stringify(offer));
    assert.deepEqual(await received,{...offer,src:'Player'});
    const rejected=next(socketB);
    socketB.send(JSON.stringify(offer));
    assert.deepEqual(await rejected,{type:'EXPIRE',src:'Friend'});
    assert.equal((await call('PUT','same-user-b',{key:a.key})).status,404);
    users.set('renewed-a',users.get('same-user-a'));
    assert.equal((await call('PUT','renewed-a',{key:a.key})).status,200);
    users.delete('same-user-a');
    assert.deepEqual(await (await directory(a)).json(),['Friend']);
    settings.get('app-a').discovery=false;
    assert.equal((await directory(a)).status,401);
    users.delete('renewed-a');
    const closed=once(socketA,'close');
    socketA.send(JSON.stringify({type:'HEARTBEAT'}));
    assert.equal((await closed)[0],1008);
    assert.equal((await call('DELETE','same-user-b',{key:b.key})).status,200);
  }finally{
    for(const socket of sockets)socket.terminate();
    await new Promise(resolve=>server.close(resolve));
  }
});
