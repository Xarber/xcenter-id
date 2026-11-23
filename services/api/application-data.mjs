import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes} from 'node:crypto';
import {statfsSync} from 'node:fs';
import {dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const hash=value=>createHash('sha256').update(value).digest('hex');
const name=/^[a-zA-Z0-9_-]{1,80}$/;
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function openApplicationData({path,key,registry,accounts,authenticate,otherUsage=()=>0,notify=()=>{}}){
  if(key?.length!==32)throw new Error('Application data requires a 256-bit storage key');
  const db=new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS app_records(client TEXT NOT NULL,owner TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,
      public_key TEXT NOT NULL,readers TEXT NOT NULL,public INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL,bytes INTEGER NOT NULL,envelope BLOB NOT NULL,
      PRIMARY KEY(client,owner,collection,id)) STRICT;
    CREATE INDEX IF NOT EXISTS app_records_owner ON app_records(owner,client);
    CREATE TABLE IF NOT EXISTS app_readers(client TEXT NOT NULL,owner TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,reader TEXT NOT NULL,PRIMARY KEY(client,owner,collection,id,reader)) STRICT;
    CREATE TABLE IF NOT EXISTS app_storage(client TEXT PRIMARY KEY,capacity INTEGER NOT NULL DEFAULT 10485760,
      secret TEXT,shared TEXT NOT NULL DEFAULT '[]',requests TEXT NOT NULL DEFAULT '[]') STRICT;
    CREATE TABLE IF NOT EXISTS app_file_visibility(client TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS app_data_grants(owner TEXT NOT NULL,source TEXT NOT NULL,destination TEXT NOT NULL,collection TEXT NOT NULL,
      PRIMARY KEY(owner,source,destination,collection)) STRICT;`);
  const setting=client=>db.prepare('SELECT * FROM app_storage WHERE client=?').get(client);
  const active=client=>registry.has(client)&&!!registry.brand(client)?.verified&&accounts.available(registry.brand(client)?.owner);
  const serviceUsage=db.prepare("SELECT coalesce(sum(bytes),0) AS used,count(*) AS records FROM app_records WHERE client=? AND owner='~app'");
  const accountUsage=db.prepare('SELECT coalesce(sum(bytes),0) AS used FROM app_records WHERE owner=?');
  const containers=db.prepare('SELECT client,sum(bytes) AS bytes,count(*) AS records FROM app_records WHERE owner=? GROUP BY client ORDER BY bytes DESC,client');
  const visible=db.prepare('SELECT 1 FROM app_file_visibility WHERE client=?');
  const ownerContainer=(owner,client)=>active(client)&&visible.get(client)&&sourceLinked(owner,client);
  const usage=client=>serviceUsage.get(client);
  const requested=client=>JSON.parse(setting(client)?.requests??'[]').filter(item=>active(item.source)&&registry.crossReadAllowed(item.source,client)&&JSON.parse(setting(item.source)?.shared??'[]').includes(item.collection));
  const sourceLinked=(owner,client)=>!!accounts.linkedGrant(owner,client)&&registry.access(owner,client).allowed;
  const requestsForOwner=(owner,client)=>requested(client).map(item=>({...item,linked:sourceLinked(owner,item.source)}));
  const aad=r=>Buffer.from(JSON.stringify(['xcenter.appdata.v1',r.client,r.owner,r.collection,r.id,r.revision,r.public,r.readers]));
  function decode(row){
    const encrypted=Buffer.from(row.envelope),cipher=createDecipheriv('aes-256-gcm',key,encrypted.subarray(0,12));
    cipher.setAAD(aad(row));cipher.setAuthTag(encrypted.subarray(12,28));
    return {id:row.id,revision:row.revision,public:!!row.public,data:JSON.parse(Buffer.concat([cipher.update(encrypted.subarray(28)),cipher.final()]))};
  }
  async function body(req){
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))fail(415,'JSON required.');
    const parts=[];let size=0;
    for await(const part of req.iterator({destroyOnReturn:false})){size+=part.length;if(size>65536){req.resume();fail(413,'Record exceeds 64 KB.');}parts.push(part);}
    try{const input=JSON.parse(Buffer.concat(parts));if(input&&typeof input==='object'&&!Array.isArray(input))return input;}catch{}
    fail(400,'Invalid JSON object.');
  }
  return {
    requested,
    requestsForOwner,
    accountUsage:owner=>accountUsage.get(owner).used,
    containers:owner=>containers.all(owner).map(row=>{
      const brand=registry.brand(row.client);
      const showInFiles=!!ownerContainer(owner,row.client);
      return {...row,name:brand?.name??'App storage',showInFiles,...(showInFiles?{icon:brand?.icon||null}:{})};
    }),
    revokeApp(owner,client){
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare('DELETE FROM app_data_grants WHERE owner=? AND (source=? OR destination=?)').run(owner,client,client);
        db.prepare('DELETE FROM app_readers WHERE client=? AND (owner=? OR reader=?)').run(client,owner,owner);
        db.prepare('DELETE FROM app_records WHERE client=? AND owner=?').run(client,owner);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    permissions(owner){return registry.published().filter(app=>accounts.linkedGrant(owner,app.client)&&registry.access(owner,app.client).allowed).flatMap(app=>requestsForOwner(owner,app.client).filter(item=>item.linked).map(item=>({...item,destination:app.client,destinationName:app.name,unsecure:!!registry.brand(app.client)?.local,sourceName:registry.publicDetails(item.source)?.name??item.source,
      enabled:!!db.prepare('SELECT 1 FROM app_data_grants WHERE owner=? AND source=? AND destination=? AND collection=?').get(owner,item.source,app.client,item.collection)})));},
    authorize(owner,client,selected){
      const allowed=new Set(selected);
      let changed=false;
      db.exec('BEGIN IMMEDIATE');
      try{
        for(const item of requestsForOwner(owner,client)){
          const id=item.source+'/'+item.collection;
          const update=item.linked&&allowed.has(id)
            ?db.prepare('INSERT OR IGNORE INTO app_data_grants VALUES(?,?,?,?)').run(owner,item.source,client,item.collection)
            :db.prepare('DELETE FROM app_data_grants WHERE owner=? AND source=? AND destination=? AND collection=?').run(owner,item.source,client,item.collection);
          changed=changed||update.changes>0;
        }
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return changed;
    },
    async handle(req,res,url){
      const answer=(code,data)=>res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type, If-Match','Access-Control-Allow-Methods':'GET, PUT, DELETE, OPTIONS'}).end(JSON.stringify(data));
      try{
        if(req.method==='OPTIONS')return answer(204,{});
        const container=/^\/account\/file-containers\/([A-Za-z0-9_-]{1,100})(?:\/([A-Za-z0-9_-]{1,80})(?:\/([A-Za-z0-9_-]{1,120}))?)?$/.exec(url.pathname);
        if(container){
          if(req.method!=='GET')fail(405,'App folders are read-only.');
          const session=accounts.current(req);
          if(!session)fail(401,'Sign in to open this folder.');
          const [,client,collection,id]=container;
          const owner=session.owner;
          if(!ownerContainer(owner,client))fail(404,'App folder unavailable.');
          if(!collection){
            const collections=db.prepare('SELECT collection,count(*) AS records FROM app_records WHERE owner=? AND client=? GROUP BY collection ORDER BY collection').all(owner,client);
            return answer(200,{collections});
          }
          if(id){
            const row=db.prepare('SELECT * FROM app_records WHERE client=? AND owner=? AND collection=? AND id=?').get(client,owner,collection,id);
            if(!row)fail(404,'Record unavailable.');
            return res.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="'+id+'.json"',
              'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(decode(row).data,null,2));
          }
          const cursor=url.searchParams.get('cursor')??'';
          if(cursor&&!/^[A-Za-z0-9_-]{1,120}$/.test(cursor))fail(422,'Invalid cursor.');
          const rows=db.prepare('SELECT id,bytes FROM app_records WHERE client=? AND owner=? AND collection=? AND id>? ORDER BY id LIMIT 101').all(client,owner,collection,cursor);
          return answer(200,{records:rows.slice(0,100),nextCursor:rows.length>100?rows[99].id:null});
        }
        if(url.pathname==='/account/app-data-permissions'){
          const session=accounts.current(req);if(!session)fail(401,'Sign in first.');
          const requestedForOwner=registry.published().filter(app=>accounts.linkedGrant(session.owner,app.client)&&registry.access(session.owner,app.client).allowed).flatMap(app=>requestsForOwner(session.owner,app.client).filter(item=>item.linked).map(item=>({...item,destination:app.client,destinationName:app.name,unsecure:!!registry.brand(app.client)?.local,sourceName:registry.publicDetails(item.source)?.name??item.source,
            enabled:!!db.prepare('SELECT 1 FROM app_data_grants WHERE owner=? AND source=? AND destination=? AND collection=?').get(session.owner,item.source,app.client,item.collection)})));
          if(req.method==='GET')return answer(200,{permissions:requestedForOwner});
          if(req.method!=='PUT'||!accounts.allowsMutation(req))fail(403,'Change permissions from your account.');
          const input=await body(req);const permission=requestedForOwner.find(p=>p.source===input.source&&p.destination===input.destination&&p.collection===input.collection);
          if(!permission||typeof input.enabled!=='boolean')fail(422,'Choose a requested app permission.');
          if(permission.unsecure&&input.confirmUnsecure!==true)fail(422,'Confirm that you want to edit permissions for this unsecure app.');
          const update=input.enabled
            ?db.prepare('INSERT OR IGNORE INTO app_data_grants VALUES(?,?,?,?)').run(session.owner,permission.source,permission.destination,permission.collection)
            :db.prepare('DELETE FROM app_data_grants WHERE owner=? AND source=? AND destination=? AND collection=?').run(session.owner,permission.source,permission.destination,permission.collection);
          if(update.changes)notify(session.owner,permission.destination,'permissions');
          return answer(200,{ok:true});
        }
        const management=/^\/account\/app-storage\/([0-9a-f-]{36})$/.exec(url.pathname)?.[1];
        if(management){
          const session=accounts.current(req);if(!session)fail(401,'Sign in first.');
          const all=registry.registration(management);
          const owned=registry.lookup(session.owner,management);
          const admin=accounts.adminStatus(req,req.method!=='GET')===200;
          if(!owned&&!admin)fail(403,'App management denied.');
          const app=owned??all;
          // A verification badge never substitutes for active callback ownership.
          const client=app?.client??(all&&registry.clientForId(management));
          if(!client||!registry.has(client))fail(409,'Activate this app first.');
          const verified=active(client);
          const unsecure=!!registry.brand(client)?.local;
          db.prepare('INSERT OR IGNORE INTO app_storage(client) VALUES(?)').run(client);
          if(req.method==='GET')return answer(200,{...usage(client),capacity:setting(client).capacity,hasKey:!!setting(client).secret,verified,unsecure,
            shared:JSON.parse(setting(client).shared),requests:JSON.parse(setting(client).requests),showInFiles:!!visible.get(client),canShowInFiles:!!(owned&&verified)});
          if(req.method!=='POST'||!accounts.allowsMutation(req)||!accounts.recentlyConfirmed(req))fail(403,'Confirm your identity before changing app storage.');
          const input=await body(req);
          if(!verified&&(input.action!=='sharing'||!Array.isArray(input.shared)||input.shared.length))fail(403,'Service storage requires a verified app.');
          if(unsecure&&input.confirmUnsecure!==true)fail(422,'Confirm editing sharing for an unsecure app.');
          if(input.action==='file-visibility'){
            if(!owned||!verified||typeof input.enabled!=='boolean')fail(403,'Only the developer of a verified app can change file browser visibility.');
            if(input.enabled)db.prepare('INSERT OR IGNORE INTO app_file_visibility VALUES(?)').run(client);
            else db.prepare('DELETE FROM app_file_visibility WHERE client=?').run(client);
            return answer(200,{ok:true});
          }
          if(input.action==='rotate-key'){
            const secret='xid-db-'+randomBytes(32).toString('base64url');
            db.prepare('UPDATE app_storage SET secret=? WHERE client=?').run(hash(secret),client);
            return answer(200,{secret});
          }
          if(input.action==='revoke-key')db.prepare('UPDATE app_storage SET secret=NULL WHERE client=?').run(client);
          else if(input.action==='capacity'){
            if(!admin)fail(403,'Only administrators can change app capacity.');
            if(!Number.isSafeInteger(input.capacity)||input.capacity<1024**2||input.capacity>100*1024**4||input.capacity<usage(client).used)fail(422,'Choose a capacity above current usage, from 1 MB to 100 TB.');
            db.prepare('UPDATE app_storage SET capacity=? WHERE client=?').run(input.capacity,client);
          }else if(input.action==='sharing'){
            if(!Array.isArray(input.shared)||input.shared.length>30||!input.shared.every(x=>typeof x==='string'&&name.test(x)))fail(422,'Choose valid shared collections.');
            const requests=input.requests??[];
            if(!Array.isArray(requests)||requests.length>30||!requests.every(x=>x&&typeof x==='object'&&typeof x.source==='string'&&x.source!==client&&name.test(x.collection)&&typeof x.label==='string'&&x.label.length>0&&x.label.length<=160&&!/[\p{Cc}\p{Cf}]/u.test(x.label)&&active(x.source)&&JSON.parse(setting(x.source)?.shared??'[]').includes(x.collection)))fail(422,'Requests must target collections published for sharing by verified apps.');
            const removed=JSON.parse(setting(client).shared).filter(collection=>!input.shared.includes(collection));
            for(const collection of removed)db.prepare('DELETE FROM app_data_grants WHERE source=? AND collection=?').run(client,collection);
            db.prepare('UPDATE app_storage SET shared=?,requests=? WHERE client=?').run(JSON.stringify([...new Set(input.shared)]),JSON.stringify([...new Map(requests.map(({source,collection,label})=>[source+'/'+collection,{source,collection,label:label.trim()}])).values()]),client);
          }else if(input.action!=='revoke-key')fail(422,'Choose a storage action.');
          if(admin)accounts.auditAdmin(req,client,'app-storage-'+input.action);
          return answer(200,{ok:true});
        }
        const match=/^\/(public|v1)\/apps\/([a-zA-Z0-9_-]{1,100})\/data\/([a-zA-Z0-9_-]{1,80})(?:\/([a-zA-Z0-9_-]{1,120}))?$/.exec(url.pathname);
        if(!match)fail(404,'Unknown data endpoint.');
        const [,mode,client,collection,id]=match;
        if(!active(client))fail(404,'Application unavailable.');
        const cursor=url.searchParams.get('cursor')??'';if(cursor&&!/^[a-zA-Z0-9_-]{1,120}$/.test(cursor))fail(422,'Invalid cursor.');
        if(mode==='public'){
          if(req.method!=='GET')fail(405,'Public endpoints are read-only.');
          const rows=id?db.prepare('SELECT * FROM app_records WHERE client=? AND collection=? AND public=1 AND public_key=?').all(client,collection,id):db.prepare('SELECT * FROM app_records WHERE client=? AND collection=? AND public=1 AND public_key>? ORDER BY public_key LIMIT 101').all(client,collection,cursor);
          const values=rows.filter(row=>row.owner==='~app'||accounts.available(row.owner)).map(row=>({...decode(row),id:row.public_key}));
          return answer(id&&!values.length?404:200,id?values[0]??{error:'Record unavailable.'}:{records:values.slice(0,100),nextCursor:rows.length>100?rows[99].public_key:null});
        }
        if(id&&!/^[a-zA-Z0-9_-]{1,120}$/.test(id))fail(422,'Invalid record ID.');
        const token=/^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(req.headers.authorization??'')?.[1];
        let principal;
        if(token?.startsWith('xid-db-')&&setting(client)?.secret===hash(token))principal={client,owner:'~app'};
        else if(token)principal=await authenticate(token);
        if(!principal?.owner||!registry.has(principal.client)||!accounts.available(registry.brand(principal.client)?.owner))fail(401,'A valid registered application credential is required.');
        const own=principal.client===client;
        if(!own){
          if(req.method!=='GET'||!registry.crossReadAllowed(client,principal.client)||!sourceLinked(principal.owner,client)||!JSON.parse(setting(client)?.shared??'[]').includes(collection)||!db.prepare('SELECT 1 FROM app_data_grants WHERE owner=? AND source=? AND destination=? AND collection=?').get(principal.owner,client,principal.client,collection))fail(403,'This data permission has not been granted.');
        }
        const params=[client,principal.owner,collection];
        if(req.method==='GET'){
          let rows;
          if(id){
            rows=db.prepare('SELECT * FROM app_records WHERE client=? AND owner=? AND collection=? AND id=?').all(...params,id);
            if(!rows.length&&own)rows=db.prepare(`SELECT r.* FROM app_records r JOIN app_readers a USING(client,owner,collection,id)
              WHERE r.client=? AND r.collection=? AND r.public_key=? AND a.reader=? LIMIT 1`).all(client,collection,id,principal.owner);
          }else rows=db.prepare(`SELECT r.* FROM app_records r WHERE r.client=? AND r.collection=? AND r.public_key>? AND
            (r.owner=? OR (?=1 AND EXISTS(SELECT 1 FROM app_readers a WHERE a.client=r.client AND a.owner=r.owner AND a.collection=r.collection AND a.id=r.id AND a.reader=?)))
            ORDER BY r.public_key LIMIT 101`).all(client,collection,cursor,principal.owner,Number(own),principal.owner);
          rows=rows.filter(row=>(row.owner==='~app'||accounts.available(row.owner))&&(row.owner===principal.owner||JSON.parse(row.readers).includes(principal.owner)));
          const view=row=>({...decode(row),id:row.owner===principal.owner?row.id:row.public_key,shared:row.owner!==principal.owner});
          if(id)return answer(rows.length?200:404,rows.length?view(rows[0]):{error:'Record unavailable.'});
          return answer(200,{records:rows.slice(0,100).map(view),nextCursor:rows.length>100?rows[99].public_key:null});
        }
        if(!own||!id||!name.test(id)||!['PUT','DELETE'].includes(req.method))fail(405,'Choose a record and supported method.');
        const previous=db.prepare('SELECT * FROM app_records WHERE client=? AND owner=? AND collection=? AND id=?').get(...params,id);
        const expected=req.headers['if-match'];
        if((previous&&expected!=='"'+previous.revision+'"')||(!previous&&expected!=='"0"'))fail(409,'Record changed. Read its revision before writing.');
        if(req.method==='DELETE'){
          if(!previous)fail(404,'Record unavailable.');
          db.exec('BEGIN IMMEDIATE');
          try{
            const removed=db.prepare('DELETE FROM app_records WHERE client=? AND owner=? AND collection=? AND id=? AND revision=?').run(...params,id,previous.revision);
            if(removed.changes!==1)fail(409,'Record changed.');
            db.prepare('DELETE FROM app_readers WHERE client=? AND owner=? AND collection=? AND id=?').run(...params,id);
            db.exec('COMMIT');return answer(200,{ok:true});
          }catch(error){db.exec('ROLLBACK');throw error;}
        }
        const input=await body(req);if(typeof input!=='object'||input===null||!Object.hasOwn(input,'data')||typeof input.public!=='boolean')fail(422,'Provide data and an explicit public flag.');
        const readers=input.readers??[];
        if(!Array.isArray(readers)||readers.length>50||!readers.every(value=>typeof value==='string'&&/^[a-z][a-z0-9]{2,23}$/.test(value)))fail(422,'Choose up to 50 recipient usernames.');
        const readerOwners=[...new Set(readers.map(username=>accounts.ownerForUsername?.(username)))];
        if(readerOwners.some(owner=>!owner||!accounts.available(owner)||!accounts.linkedGrant(owner,client)))fail(422,'Recipients must have linked this app.');
        const currentIdentity=token?.startsWith('xid-db-')&&setting(client)?.secret===hash(token)?{client,owner:'~app'}:await authenticate(token);
        if(!currentIdentity||currentIdentity.owner!==principal.owner||currentIdentity.client!==principal.client||!active(client)||!active(principal.client))fail(401,'Application access changed.');
        const raw=Buffer.from(JSON.stringify(input.data));if(raw.length>60000)fail(413,'Record too large.');
        const charged=raw.length+1024+readerOwners.length*256;
        if(path!==':memory:'){const space=statfsSync(dirname(path));if(Number(space.bavail)*Number(space.bsize)<256*1024**2)fail(503,'Storage is temporarily unavailable.');}
        const row={client,owner:principal.owner,collection,id,readers:JSON.stringify(readerOwners.sort()),public:Number(input.public),revision:(previous?.revision??0)+1};
        const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(aad(row));
        const ciphertext=Buffer.concat([cipher.update(raw),cipher.final()]);
        db.exec('BEGIN IMMEDIATE');
        try{
          const current=db.prepare('SELECT revision FROM app_records WHERE client=? AND owner=? AND collection=? AND id=?').get(...params,id);
          if((current?.revision??0)!==(previous?.revision??0))fail(409,'Record changed.');
          const delta=charged-(previous?.bytes??0);
          if(row.owner==='~app'){
            if(delta>0&&usage(client).used+delta>(setting(client)?.capacity??10485760))fail(409,'App storage quota exceeded.');
          }else if(delta>0&&accountUsage.get(row.owner).used+otherUsage(row.owner)+delta>(accounts.storageCapacity?.(row.owner)??10485760)){
            fail(409,'Account storage quota exceeded.');
          }
          db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(client,owner,collection,id) DO UPDATE SET readers=excluded.readers,public=excluded.public,revision=excluded.revision,bytes=excluded.bytes,envelope=excluded.envelope').run(...params,id,createHmac('sha256',key).update(JSON.stringify([client,row.owner])).digest('hex').slice(0,24)+'_'+id,row.readers,row.public,row.revision,charged,Buffer.concat([nonce,cipher.getAuthTag(),ciphertext]));
          db.prepare('DELETE FROM app_readers WHERE client=? AND owner=? AND collection=? AND id=?').run(...params,id);
          for(const reader of readerOwners)db.prepare('INSERT INTO app_readers VALUES(?,?,?,?,?)').run(...params,id,reader);
          db.exec('COMMIT');
        }catch(error){db.exec('ROLLBACK');throw error;}
        return answer(200,{id,revision:row.revision,public:!!row.public});
      }catch(error){return answer(error.status??500,{error:error.status?error.message:'Application data unavailable.'});}
    },
    close(){db.close();},
  };
}
