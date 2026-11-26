import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {WebSocket,WebSocketServer} from 'ws';
import {readJson} from './server.mjs';

const prefix='/peerjs/';
const sessionPath='/v1/peers/peerjs/session';
const secret=/^[A-Za-z0-9_-]{43}$/;
const identifier=/^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/;
const validId=value=>typeof value==='string'&&value.length<=80&&identifier.test(value);
const hash=value=>createHash('sha256').update(value).digest();
const random=()=>randomBytes(32).toString('base64url');
const relayTypes=new Set(['OFFER','ANSWER','CANDIDATE','LEAVE','EXPIRE']);
const headers={
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Access-Control-Allow-Origin':'*','Referrer-Policy':'no-referrer',
};
const bearer=req=>/^Bearer ([A-Za-z0-9._~-]{1,512})$/i.exec(req.headers.authorization??'')?.[1];
const json=(res,status,value)=>res.writeHead(status,{...headers,'Content-Type':'application/json'}).end(JSON.stringify(value));
const send=(ws,value)=>{
  if(ws?.readyState!==WebSocket.OPEN||ws.bufferedAmount>128*1024)return false;
  ws.send(JSON.stringify(value));
  return true;
};

export function createPeerJsGateway({authenticate,settings,origin,now=Date.now}){
  const wss=new WebSocketServer({noServer:true,maxPayload:32*1024,perMessageDeflate:false});
  const tickets=new Map();
  const peers=new Map();
  const peerKey=(client,id)=>JSON.stringify([client,id]);
  const lookup=key=>secret.test(key??'')?tickets.get(hash(key).toString('hex')):undefined;
  const policy=entry=>settings(entry.client);
  const sameOrigin=(entry,req)=>!entry.origin||entry.origin===req.headers.origin||(!req.headers.origin&&entry.origin===origin);
  const available=entry=>{
    const current=policy(entry);
    return current?.enabled&&entry.generation===current.generation&&entry.until>now()&&!entry.removed;
  };
  function remove(entry){
    entry.removed=true;
    tickets.delete(entry.keyHash);
    peers.delete(peerKey(entry.client,entry.id));
    entry.socket?.terminate();
  }
  async function authorized(entry,token=entry.credential){
    if(!available(entry))return false;
    const identity=await authenticate(token);
    return available(entry)&&identity?.owner===entry.owner&&identity?.client===entry.client;
  }
  function sweep(){
    for(const entry of tickets.values()){
      if(!available(entry)){remove(entry);continue;}
      entry.queued=entry.queued.filter(item=>item.expires>now());
      if(entry.socket&&entry.heartbeat+60_000<=now())entry.socket.terminate();
    }
  }
  function rate(entry){
    const time=now();
    if(time-entry.window>=10_000){entry.window=time;entry.requests=0;}
    return ++entry.requests<=100;
  }
  async function sessions(req,res){
    if(!['POST','PUT','DELETE'].includes(req.method))return json(res,405,{error:'Method unavailable.'});
    const credential=bearer(req);
    const principal=credential&&await authenticate(credential);
    if(!principal)return json(res,401,{error:'Sign in with your registered app.'});
    const access=settings(principal.client);
    if(!access?.enabled)return json(res,403,{error:'Peer signaling is disabled for this app.'});
    let input;
    try{input=await readJson(req,1024);}catch{return json(res,422,{error:'Invalid PeerJS session request.'});}
    const confirmed=await authenticate(credential);
    if(confirmed?.client!==principal.client||confirmed?.owner!==principal.owner||
        settings(principal.client)?.generation!==access.generation||!settings(principal.client)?.enabled){
      return json(res,403,{error:'Peer authorization changed.'});
    }
    sweep();
    if(req.method!=='POST'){
      const entry=lookup(input?.key);
      if(!entry||entry.owner!==principal.owner||entry.client!==principal.client){
        return json(res,404,{error:'Peer session unavailable.'});
      }
      if(req.method==='DELETE'){
        remove(entry);
        return json(res,200,{ok:true});
      }
      entry.credential=credential;
      entry.until=now()+(entry.opened?600_000:60_000);
      return json(res,200,{ok:true});
    }
    if(typeof input?.discoverable!=='boolean'||(input.id!=null&&!validId(input.id))){
      return json(res,422,{error:'Choose visibility and a valid optional PeerJS ID.'});
    }
    const {client,owner}=principal;
    const id=input.id??randomBytes(18).toString('hex');
    const namespace=peerKey(client,id);
    if(peers.has(namespace))return json(res,409,{error:'This peer ID is already in use in your app.'});
    const appEntries=[...tickets.values()].filter(entry=>entry.client===client);
    if(tickets.size>=2048||appEntries.length>=256||appEntries.filter(entry=>entry.owner===owner).length>=8){
      return json(res,429,{error:'Too many peer sessions.'});
    }
    const key=random(), token=random(),keyHash=hash(key).toString('hex');
    const entry={keyHash,id,owner,client,proof:hash(token),credential,generation:access.generation,
      discoverable:input.discoverable,queued:[],until:now()+60_000,heartbeat:now(),window:now(),requests:0,origin:req.headers.origin};
    tickets.set(keyHash,entry);
    peers.set(namespace,entry);
    return json(res,201,{id,key,token,path:prefix,connectWithin:60});
  }

  async function handle(req,res,url){
    if(req.method==='OPTIONS'){
      res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':'Authorization, Content-Type'}).end();
      return;
    }
    if(url.pathname===sessionPath)return sessions(req,res);
    const route=/^\/peerjs\/([A-Za-z0-9_-]{43})\/(id|peers)$/.exec(url.pathname);
    if(!route||req.method!=='GET')return json(res,404,{error:'Peer route unavailable.'});
    const [,key,action]=route;
    const entry=lookup(key);
    if(!entry||!sameOrigin(entry,req)||!rate(entry)||!await authorized(entry)){
      return json(res,401,{error:'Peer session unavailable.'});
    }
    if(action==='id')return res.writeHead(200,{...headers,'Content-Type':'text/plain'}).end(entry.id);
    if(!policy(entry).discovery)return json(res,401,{error:'Peer discovery is disabled.'});
    sweep();
    const candidates=[...peers.values()].filter(candidate=>candidate!==entry&&candidate.client===entry.client&&
      candidate.discoverable&&candidate.socket?.readyState===WebSocket.OPEN);
    const result=await Promise.all(candidates.map(async candidate=>await authorized(candidate)?candidate.id:null));
    if(!available(entry)||!policy(entry).discovery)return json(res,401,{error:'Peer discovery is disabled.'});
    return json(res,200,result.filter(Boolean));
  }

  async function relay(entry,socket,raw,binary){
    if(entry.socket!==socket)return;
    if(binary||!rate(entry)){socket.close(1008);return;}
    let message;
    try{message=JSON.parse(raw.toString());}catch{socket.close(1007);return;}
    if(!await authorized(entry)||entry.socket!==socket){socket.close(1008);return;}
    entry.heartbeat=now();
    if(message?.type==='HEARTBEAT')return;
    if(!relayTypes.has(message?.type)||!validId(message.dst)||message.dst===entry.id)return;
    const destination=peers.get(peerKey(entry.client,message.dst));
    const envelope={type:message.type,src:entry.id,dst:message.dst,payload:message.payload};
    if(destination&&await authorized(destination)&&available(entry)&&entry.socket===socket){
      if(send(destination.socket,envelope))return;
      destination.queued=destination.queued.filter(item=>item.expires>now());
      if(['OFFER','ANSWER','CANDIDATE'].includes(message.type)&&destination.queued.length<16){
        destination.queued.push({envelope,source:entry,expires:now()+5000});
        return;
      }
    }
    if(message.type==='OFFER')send(socket,{type:'EXPIRE',src:message.dst});
  }
  function upgrade(req,socket,head){
    const deny=()=>{if(!socket.destroyed)socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');};
    let url;
    try{url=new URL(req.url,'http://localhost');}catch{return deny();}
    if(url.pathname!==prefix+'peerjs')return deny();
    const entry=lookup(url.searchParams.get('key'));
    const token=url.searchParams.get('token');
    if(!entry||url.searchParams.get('id')!==entry.id||!secret.test(token??'')||
      !sameOrigin(entry,req)||!timingSafeEqual(entry.proof,hash(token))||!rate(entry))return deny();
    const socketError=()=>socket.destroy();
    socket.on('error',socketError);
    void (async()=>{
      if(!await authorized(entry)||socket.destroyed)return deny();
      socket.removeListener('error',socketError);
      wss.handleUpgrade(req,socket,head,ws=>{
        const prior=entry.socket;
        entry.socket=ws;
        entry.heartbeat=now();
        if(!entry.opened){entry.opened=true;entry.until=now()+600_000;}
        prior?.terminate();
        ws.on('error',()=>ws.terminate());
        ws.on('close',()=>{if(entry.socket===ws)entry.socket=undefined;});
        let pending=0;
        let queue=Promise.resolve();
        ws.on('message',(raw,binary)=>{
          if(++pending>32){ws.close(1008);return;}
          queue=queue.then(()=>relay(entry,ws,raw,binary)).catch(()=>ws.close(1011)).finally(()=>{pending--;});
        });
        send(ws,{type:'OPEN'});
        const buffered=entry.queued.splice(0);
        void (async()=>{
          for(const item of buffered){
            if(entry.socket!==ws||!available(entry))break;
            if(item.expires>now()&&await authorized(item.source)&&entry.socket===ws&&available(entry)){
              send(ws,item.envelope);
            }
          }
        })().catch(()=>ws.close(1011));
      });
    })().catch(deny);
  }
  let sweeping;
  return {
    handle,
    attach(server){
      server.on('upgrade',upgrade);
      sweeping=setInterval(sweep,15_000);
      sweeping.unref();
      server.once('close',()=>clearInterval(sweeping));
    },
  };
}
