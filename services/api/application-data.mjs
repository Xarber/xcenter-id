import {appFileRoute, openApplicationFiles, serviceOwner} from './application-files.mjs';
import {validateSharing,writeSharing} from './application-sharing.mjs';
import {isUsername} from './identity-profile.mjs';
import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes} from 'node:crypto';
import {statfsSync} from 'node:fs';
import {dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const hash=value=>createHash('sha256').update(value).digest('hex');
const name=/^[a-zA-Z0-9_-]{1,80}$/;
const clientPattern='([A-Za-z0-9_-]{1,100})';
const registrationPattern='([0-9a-f-]{36})';
const delegatedFiles=new RegExp('^/v1/apps/'+clientPattern+'/files'+appFileRoute);
const accountBinaryFiles=new RegExp('^/account/app-files/'+clientPattern+appFileRoute);
const serviceBinaryFiles=new RegExp('^/account/app-storage/'+registrationPattern+'/files'+appFileRoute);
const serviceRecords=/^\/account\/app-storage\/([0-9a-f-]{36})\/browse(?:\/([A-Za-z0-9_-]{1,80})(?:\/([A-Za-z0-9_-]{1,120}))?)?$/;
const accountToken=req=>/^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(req.headers.authorization??'')?.[1];
const responseHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type, If-Match',
  'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS'};
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
  const registered=client=>registry.has(client)&&accounts.available(registry.brand(client)?.owner);
  const verified=client=>registered(client)&&!!registry.brand(client)?.verified;
  const serviceUsage=db.prepare("SELECT coalesce(sum(bytes),0) AS used,count(*) AS records FROM app_records WHERE client=? AND owner='~app'");
  const accountUsage=db.prepare('SELECT coalesce(sum(bytes),0) AS used FROM app_records WHERE owner=?');
  const containers=db.prepare('SELECT client,sum(bytes) AS bytes,count(*) AS records FROM app_records WHERE owner=? GROUP BY client ORDER BY bytes DESC,client');
  const visible=db.prepare('SELECT 1 FROM app_file_visibility WHERE client=?');
  const ownerContainer=(owner,client)=>verified(client)&&visible.get(client)&&sourceLinked(owner,client);
  const developerContainer=(owner,client)=>ownerContainer(owner,client)&&registry.brand(client)?.owner===owner;
  const usage=client=>{
    const records=serviceUsage.get(client);
    return {...records,used:records.used+binary.bytes(serviceOwner,client)};
  };
  const accountBytes=owner=>accountUsage.get(owner).used+binary.bytes(owner);
  const hasDiskRoom=()=>{
    if(path===':memory:')return true;
    const space=statfsSync(dirname(path));
    return Number(space.bavail)*Number(space.bsize)>=256*1024**2;
  };
  const binary=openApplicationFiles({db,key,hasDiskRoom,remaining:(owner,client)=>owner===serviceOwner
    ?(setting(client)?.capacity??10485760)-usage(client).used
    :(accounts.storageCapacity?.(owner)??10485760)-accountBytes(owner)-otherUsage(owner)});
  const dashboardServiceClient=(req,id)=>{
    const owner=accounts.current(req)?.owner;
    const client=owner&&registry.lookup(owner,id)?.client;
    return client&&verified(client)&&registry.brand(client)?.owner===owner?client:null;
  };
  const authenticateFiles=async (req,client)=>{
    const token=accountToken(req);
    if(!token||!registered(client))return null;
    if(token.startsWith('xid-db-'))return verified(client)&&setting(client)?.secret===hash(token)?serviceOwner:null;
    const principal=await authenticate(token);
    return principal?.client===client&&principal.owner!==serviceOwner&&sourceLinked(principal.owner,client)?principal.owner:null;
  };
  function browseRecords(res,answer,url,owner,client,collection,id){
    if(!collection){
      const collections=db.prepare('SELECT collection,count(*) AS records,sum(bytes) AS bytes FROM app_records WHERE owner=? AND client=? GROUP BY collection ORDER BY collection').all(owner,client);
      return answer(200,{collections});
    }
    if(id){
      const row=db.prepare('SELECT * FROM app_records WHERE client=? AND owner=? AND collection=? AND id=?').get(client,owner,collection,id);
      if(!row)fail(404,'Record unavailable.');
      if(url.searchParams.get('edit')==='1')return answer(200,{revision:row.revision,data:decode(row).data});
      return res.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="'+id+'.json"',
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(decode(row).data,null,2));
    }
    const cursor=url.searchParams.get('cursor')??'';
    if(cursor&&!/^[A-Za-z0-9_-]{1,120}$/.test(cursor))fail(422,'Invalid cursor.');
    const rows=db.prepare('SELECT id,bytes FROM app_records WHERE client=? AND owner=? AND collection=? AND id>? ORDER BY id LIMIT 101').all(client,owner,collection,cursor);
    return answer(200,{records:rows.slice(0,100),nextCursor:rows.length>100?rows[99].id:null});
  }
  const sharing=client=>({shared:JSON.parse(setting(client)?.shared??'[]'),requests:JSON.parse(setting(client)?.requests??'[]')});
  const prepareSharing=(client,input)=>validateSharing(input,{
    client,verified,existing:sharing(client).requests,
    published:(source,collection)=>verified(source)&&sharing(source).shared.includes(collection),
  });
  const requested=client=>JSON.parse(setting(client)?.requests??'[]').filter(item=>verified(item.source)&&registry.crossReadAllowed(item.source,client)&&JSON.parse(setting(item.source)?.shared??'[]').includes(item.collection));
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
    removeAccount(owner){
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare('DELETE FROM app_data_grants WHERE owner=?').run(owner);
        db.prepare('DELETE FROM app_readers WHERE owner=? OR reader=?').run(owner,owner);
        db.prepare('DELETE FROM app_records WHERE owner=?').run(owner);
        binary.removeAccount(owner);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    requested,
    sharing,
    prepareSharing,
    fileVisibility:client=>!!visible.get(client),
    sharingSources(client,owner){
      return registry.published().filter(app=>app.client!==client&&verified(app.client)&&registry.access(owner,app.client).allowed&&registry.crossReadAllowed(app.client,client))
        .map(app=>({client:app.client,name:app.name,collections:sharing(app.client).shared})).filter(app=>app.collections.length);
    },
    requestsForOwner,
    accountUsage:accountBytes,
    containers:owner=>{
      const rows=new Map(containers.all(owner).map(row=>[row.client,row]));
      const fileTotals=new Map(binary.totals(owner).map(row=>[row.client,row]));
      for(const client of fileTotals.keys()){
        if(!rows.has(client))rows.set(client,{client,bytes:0,records:0});
      }
      for(const {client} of db.prepare('SELECT client FROM app_file_visibility ORDER BY client').all()){
        if(!rows.has(client)&&ownerContainer(owner,client))rows.set(client,{client,bytes:0,records:0});
      }
      return [...rows.values()].map(row=>{
        const brand=registry.brand(row.client);
        const files=fileTotals.get(row.client);
        const canManage=!!developerContainer(owner,row.client);
        const browseFiles=!!(sourceLinked(owner,row.client)&&registered(row.client)&&files?.browseable);
        return {...row,bytes:row.bytes+(files?.bytes??0),name:brand?.name??'App storage',
          showInFiles:!!ownerContainer(owner,row.client)||browseFiles,canManage,canBrowse:canManage||browseFiles,visibleBytes:canManage?row.bytes+(files?.bytes??0):files?.visibleBytes??0,
          icon:brand?.iconUrl??brand?.icon??null};
      });
    },
    revokeApp(owner,client){
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare('DELETE FROM app_data_grants WHERE owner=? AND (source=? OR destination=?)').run(owner,client,client);
        db.prepare('DELETE FROM app_readers WHERE client=? AND (owner=? OR reader=?)').run(client,owner,owner);
        db.prepare('DELETE FROM app_records WHERE client=? AND owner=?').run(client,owner);
        binary.removeApp(owner,client);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    permissions(owner){return registry.published().filter(app=>accounts.linkedGrant(owner,app.client)&&registry.access(owner,app.client).allowed).flatMap(app=>requestsForOwner(owner,app.client).filter(item=>item.linked).map(item=>({...item,destination:app.client,destinationName:app.name,unsecure:!!registry.brand(app.client)?.local,sourceName:registry.publicDetails(item.source)?.name??item.source,sourceIcon:registry.brand(item.source)?.iconUrl??null,destinationIcon:registry.brand(app.client)?.iconUrl??null,
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
      const answer=(code,data)=>res.writeHead(code,{...responseHeaders,'Content-Type':'application/json'}).end(JSON.stringify(data));
      try{
        if(req.method==='OPTIONS')return answer(204,{});
        const appFiles=delegatedFiles.exec(url.pathname);
        if(appFiles){
          const [,client,...route]=appFiles;
          const owner=await authenticateFiles(req,client);
          if(!owner)fail(403,'Application file access is not granted.');
          return await binary.handle(req,res,url,{owner,client,live:async()=>await authenticateFiles(req,client)===owner},route,responseHeaders);
        }
        const accountFiles=accountBinaryFiles.exec(url.pathname);
        if(accountFiles){
          const owner=accounts.current(req)?.owner;
          if(!owner)fail(401,'Sign in to open this folder.');
          const [,client,...route]=accountFiles;
          if(!registered(client)||!sourceLinked(owner,client))fail(404,'App folder unavailable.');
          const canManage=!!developerContainer(owner,client);
          const live=()=>accounts.current(req)?.owner===owner&&registered(client)&&sourceLinked(owner,client);
          if(req.method!=='GET'&&(!accounts.allowsMutation(req)||req.headers['x-authnjs-request']!=='account-consent')){
            fail(403,'Change files from your account.');
          }
          return await binary.handle(req,res,url,{owner,client,dashboard:true,browseableOnly:!canManage,live,canReadPrivate:()=>!!developerContainer(owner,client)},route,responseHeaders);
        }
        const serviceFiles=serviceBinaryFiles.exec(url.pathname);
        if(serviceFiles){
          const [,id,...route]=serviceFiles;
          const client=dashboardServiceClient(req,id);
          if(!client)fail(404,'Service storage unavailable.');
          return await binary.handle(req,res,url,{owner:serviceOwner,client,readOnly:true,live:()=>dashboardServiceClient(req,id)===client},route,responseHeaders);
        }
        const browseService=serviceRecords.exec(url.pathname);
        if(browseService){
          const [,registration,collection,id]=browseService;
          const client=dashboardServiceClient(req,registration);
          if(!client)fail(404,'Service storage unavailable.');
          if(req.method!=='GET')fail(405,'This view is read-only.');
          return browseRecords(res,answer,url,serviceOwner,client,collection,id);
        }
        const container=/^\/account\/file-containers\/([A-Za-z0-9_-]{1,100})(?:\/([A-Za-z0-9_-]{1,80})(?:\/([A-Za-z0-9_-]{1,120}))?)?$/.exec(url.pathname);
        const fileOwner=container&&(()=>{
          const owner=accounts.current(req)?.owner;
          if(!owner)fail(401,'Sign in to open this folder.');
          if(!developerContainer(owner,container[1]))fail(404,'App folder unavailable.');
          if(req.method!=='GET'&&(!accounts.allowsMutation(req)||req.headers['x-authnjs-request']!=='account-consent'))fail(403,'Change app records from your account.');
          return owner;
        })();
        if(container&&req.method==='GET')return browseRecords(res,answer,url,fileOwner,...container.slice(1));
        if(url.pathname==='/account/app-data-permissions'){
          const session=accounts.current(req);if(!session)fail(401,'Sign in first.');
          const requestedForOwner=this.permissions(session.owner);
          if(req.method==='GET')return answer(200,{permissions:requestedForOwner});
          if(req.method!=='PUT'||!accounts.allowsMutation(req)||(req.headers.origin&&req.headers['x-authnjs-request']!=='account-consent'))fail(403,'Change permissions from your account.');
          const input=await body(req);if(accounts.current(req)?.owner!==session.owner)fail(401,'Sign in again.');
          const permission=this.permissions(session.owner).find(p=>p.source===input.source&&p.destination===input.destination&&p.collection===input.collection);
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
          const serviceEnabled=verified(client);
          const unsecure=!!registry.brand(client)?.local;
          db.prepare('INSERT OR IGNORE INTO app_storage(client) VALUES(?)').run(client);
          if(req.method==='GET')return answer(200,{name:registry.brand(client)?.name??'App storage',icon:registry.brand(client)?.iconUrl??registry.brand(client)?.icon??null,...usage(client),capacity:setting(client).capacity,hasKey:!!setting(client).secret,verified:serviceEnabled,unsecure,
            ...sharing(client),sources:this.sharingSources(client,session.owner),showInFiles:!!visible.get(client),canShowInFiles:!!(owned&&serviceEnabled),canBrowseService:!!(owned&&serviceEnabled)});
          if(req.method!=='POST'||!accounts.allowsMutation(req)||!accounts.recentlyConfirmed(req))fail(403,'Confirm your identity before changing app storage.');
          const input=await body(req);
          if(!serviceEnabled&&(input.action!=='sharing'||!Array.isArray(input.shared)||input.shared.length))fail(403,'Service storage requires a verified app.');
          if(unsecure&&input.confirmUnsecure!==true)fail(422,'Confirm editing sharing for an unsecure app.');
          if(input.action==='file-visibility'){
            if(!owned||!serviceEnabled||typeof input.enabled!=='boolean')fail(403,'Only the developer of a verified app can change file browser visibility.');
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
            let plan;
            try{plan=prepareSharing(client,{...input,requests:input.requests??[]});}catch(error){fail(422,error.message);}
            db.exec('BEGIN IMMEDIATE');
            try{
              writeSharing(db,'main',client,plan);
              db.exec('COMMIT');
            }catch(error){db.exec('ROLLBACK');throw error;}
          }else if(input.action!=='revoke-key')fail(422,'Choose a storage action.');
          if(admin)accounts.auditAdmin(req,client,'app-storage-'+input.action);
          return answer(200,{ok:true});
        }
        const match=container?[null,'account',...container.slice(1)]:/^\/(public|v1)\/apps\/([a-zA-Z0-9_-]{1,100})\/data\/([a-zA-Z0-9_-]{1,80})(?:\/([a-zA-Z0-9_-]{1,120}))?$/.exec(url.pathname);
        if(!match)fail(404,'Unknown data endpoint.');
        const [,mode,client,collection,id]=match;
        if(!registered(client))fail(404,'Application unavailable.');
        const cursor=url.searchParams.get('cursor')??'';if(cursor&&!/^[a-zA-Z0-9_-]{1,120}$/.test(cursor))fail(422,'Invalid cursor.');
        if(mode==='public'){
          if(!verified(client))fail(404,'Application unavailable.');
          if(req.method!=='GET')fail(405,'Public endpoints are read-only.');
          const rows=id?db.prepare('SELECT * FROM app_records WHERE client=? AND collection=? AND public=1 AND public_key=?').all(client,collection,id):db.prepare('SELECT * FROM app_records WHERE client=? AND collection=? AND public=1 AND public_key>? ORDER BY public_key LIMIT 101').all(client,collection,cursor);
          const values=rows.filter(row=>row.owner==='~app'||accounts.available(row.owner)).map(row=>({...decode(row),id:row.public_key}));
          return answer(id&&!values.length?404:200,id?values[0]??{error:'Record unavailable.'}:{records:values.slice(0,100),nextCursor:rows.length>100?rows[99].public_key:null});
        }
        if(id&&!/^[a-zA-Z0-9_-]{1,120}$/.test(id))fail(422,'Invalid record ID.');
        const token=/^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(req.headers.authorization??'')?.[1];
        const authenticateRequest=()=>{
          if(container)return accounts.current(req)?.owner===fileOwner&&developerContainer(fileOwner,client)&&accounts.allowsMutation(req)?{client,owner:fileOwner}:null;
          return token?.startsWith('xid-db-')
          ? (verified(client)&&setting(client)?.secret===hash(token)?{client,owner:'~app'}:null)
          : (token?authenticate(token):null);
        };
        const principal=await authenticateRequest();
        if(!principal?.owner||!registered(principal.client))fail(401,'A valid registered application credential is required.');
        const own=principal.client===client;
        if(!own){
          if(req.method!=='GET'||!verified(client)||!registry.crossReadAllowed(client,principal.client)|| !sourceLinked(principal.owner,client)||!requested(principal.client).some(permission=>permission.source===client&&permission.collection===collection)||!db.prepare('SELECT 1 FROM app_data_grants WHERE owner=? AND source=? AND destination=? AND collection=?').get(principal.owner,client,principal.client,collection))fail(403,'This data permission has not been granted.');
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
        const containerInput=container?await body(req):null;
        if(container&&(await authenticateRequest())?.owner!==fileOwner)fail(403,'App folder access changed.');
        const expected=container&&Number.isSafeInteger(containerInput.revision)?JSON.stringify(String(containerInput.revision)):req.headers['if-match'];
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
        const input=containerInput??await body(req);
        if(!Object.hasOwn(input,'data')||(!container&&typeof input.public!=='boolean'))fail(422,'Provide data and an explicit public flag.');
        if(container)input.public=!!previous?.public;
        const readers=input.readers??[];
        if(!Array.isArray(readers)||readers.length>50||!readers.every(value=>typeof value==='string'&&isUsername(value)))fail(422,'Choose up to 50 recipient usernames.');
        const readerOwners=container?JSON.parse(previous?.readers??'[]'):[...new Set(readers.map(username=>accounts.ownerForUsername?.(username)))];
        if(!container&&readerOwners.some(owner=>!owner||!accounts.available(owner)||!accounts.linkedGrant(owner,client)))fail(422,'Recipients must have linked this app.');
        const currentIdentity=await authenticateRequest();
        if(!currentIdentity||currentIdentity.owner!==principal.owner||currentIdentity.client!==principal.client||!registered(client))fail(401,'Application access changed.');
        if(input.public&&!verified(client))fail(403,'Public records require a verified application.');
        const raw=Buffer.from(JSON.stringify(input.data));if(raw.length>60000)fail(413,'Record too large.');
        const charged=raw.length+1024+readerOwners.length*256;
        if(!hasDiskRoom())fail(503,'Storage is temporarily unavailable.');
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
          }else if(delta>0&&accountBytes(row.owner)+otherUsage(row.owner)+delta>(accounts.storageCapacity?.(row.owner)??10485760)){
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
