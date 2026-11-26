import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {readJson} from './server.mjs';

const peerId = /^[a-zA-Z0-9_-]{24}$/;
const proofPattern = /^[a-zA-Z0-9_-]{43}$/;
const kinds = new Set(['offer','answer','candidate','hangup']);
const headers = {
  'Access-Control-Allow-Origin':'*','Cache-Control':'no-store',
  'Content-Type':'application/json','X-Content-Type-Options':'nosniff',
};
const entropy = bytes => randomBytes(bytes).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('base64url');

export function createPeerSignaling({authenticate,settings,now=Date.now}){
  const peers = new Map();
  const maxPeers=2048;
  const idleMs=90_000;
  const send=(res,status,value)=>res.writeHead(status,headers).end(JSON.stringify(value));
  const namespaced=(client,id)=>hash(client)+':'+id;
  const valid=(peer,time,policy=settings(peer.client))=>
    peer.expires>time&&policy?.enabled&&peer.generation===policy.generation;
  return async function signal(req,res,url){
    if(req.method==='OPTIONS'){
      return res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':'Authorization, Content-Type, X-XCenter-Peer-Proof','Access-Control-Max-Age':'600'}).end();
    }
    const token=/^Bearer ([A-Za-z0-9._~-]{1,512})$/i.exec(req.headers.authorization??'')?.[1];
    const identity=token&&await authenticate(token);
    if(!identity)return send(res,401,{error:'Sign in with your registered app.'});
    const policy=settings(identity.client);
    if(!policy?.enabled)return send(res,403,{error:'Peer signaling is disabled for this app.'});
    const time=now();
    for(const [key,peer] of peers)if(peer.expires<=time||peer.client===identity.client&&peer.generation!==policy.generation)peers.delete(key);
    const base='/v1/peers';
    if(url.pathname===base&&req.method==='POST'){
      let body;
      try{body=await readJson(req,512);}catch{return send(res,422,{error:'Invalid peer settings.'});}
      if(!body||typeof body.discoverable!=='boolean')return send(res,422,{error:'Choose whether this peer is discoverable.'});
      const live=await authenticate(token);
      const latest=settings(identity.client);
      if(live?.owner!==identity.owner||live?.client!==identity.client||!latest?.enabled||latest.generation!==policy.generation){
        return send(res,403,{error:'Peer signaling authorization changed.'});
      }
      const local=[...peers.values()].filter(peer=>peer.client===identity.client);
      if(peers.size>=maxPeers||local.length>=256||local.filter(peer=>peer.owner===identity.owner).length>=8){
        return send(res,429,{error:'Too many active peers. Close a peer or wait for it to expire.'});
      }
      const id=entropy(18), proof=entropy(32);
      peers.set(namespaced(identity.client,id),{id,proof:hash(proof),...identity,
        generation:policy.generation, discoverable:body.discoverable, expires:time+idleMs, messages:[], window:time, count:0});
      return send(res,201,{id,proof,expiresIn:idleMs/1000});
    }
    const route=/^\/v1\/peers\/([A-Za-z0-9_-]{24})(?:\/(directory|messages))?$/.exec(url.pathname);
    if(!route)return send(res,404,{error:'Peer route unavailable.'});
    const [,id,action]=route;
    const key=namespaced(identity.client,id);
    const peer=peers.get(key);
    const proof=req.headers['x-xcenter-peer-proof'];
    if(!peer||peer.owner!==identity.owner||!proofPattern.test(proof??'')||
      !timingSafeEqual(Buffer.from(peer.proof),Buffer.from(hash(proof)))){
      return send(res,404,{error:'Peer unavailable.'});
    }
    if(time-peer.window>=10_000){peer.count=0;peer.window=time;}
    if(++peer.count>35)return send(res,429,{error:'Peer request limit reached.'});
    peer.expires=time+idleMs;
    if(req.method==='DELETE'&&!action){peers.delete(key);return send(res,200,{ok:true});}
    if(req.method==='GET'&&action==='directory'){
      if(!policy.discovery)return send(res,403,{error:'This app disabled peer discovery.'});
      return send(res,200,{peers:[...peers.values()].filter(other=>other.client===peer.client&&other.id!==id&&other.discoverable&&valid(other,time,policy)).map(other=>other.id)});
    }
    if(req.method==='GET'&&action==='messages')return send(res,200,{messages:peer.messages.splice(0)});
    if(req.method==='POST'&&action==='messages'){
      let input;
      try{input=await readJson(req,16*1024);}catch{return send(res,422,{error:'Invalid signaling message.'});}
      if(!input||!peerId.test(input.to??'')||!kinds.has(input.type)||!Object.hasOwn(input,'data')||
        input.data===null||typeof input.data!=='object'||Array.isArray(input.data)){
        return send(res,422,{error:'Choose a destination and an offer, answer, ICE candidate, or hang-up object.'});
      }
      const live=await authenticate(token);
      if(live?.owner!==peer.owner||live?.client!==peer.client||peers.get(key)!==peer||!valid(peer,now())){
        return send(res,403,{error:'Peer access is no longer active.'});
      }
      const destination=peers.get(namespaced(peer.client,input.to));
      if(!destination||destination===peer||!valid(destination,now()))return send(res,404,{error:'Destination unavailable.'});
      if(destination.messages.length>=24)return send(res,429,{error:'Destination has too many pending messages.'});
      destination.messages.push({from:id,type:input.type,data:input.data});
      return send(res,202,{accepted:true});
    }
    return send(res,405,{error:'Peer operation unavailable.'});
  };
}
