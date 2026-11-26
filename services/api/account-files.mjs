import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { statfsSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {fileName as nameOf, readFileInput as readInput, fileDownloadHeaders} from './file-input.mjs';
import {appendTransferChunk, openFileTransfers,uploadChunkSize } from './file-transfers.mjs';
import {openFileDigests} from './file-digests.mjs';

const fileLimit = 2 * 1024 * 1024;
const storageLimit = 10 * 1024 * 1024;
const fileId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/;
export function createAccountFiles({ database, key, accounts, origin, friends, usage = () => ({}), appContainers = () => [], fileAccess }) {
  if (!key || key.length !== 32) return null;
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA busy_timeout = 3000; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS user_files(id TEXT PRIMARY KEY,owner TEXT NOT NULL,created INTEGER NOT NULL,
        size INTEGER NOT NULL,envelope BLOB NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS user_files_owner ON user_files(owner,created);
    CREATE TABLE IF NOT EXISTS user_folders(
      id TEXT PRIMARY KEY,owner TEXT NOT NULL,parent TEXT REFERENCES user_folders(id),
      created INTEGER NOT NULL,size INTEGER NOT NULL DEFAULT 0,envelope BLOB NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS user_folders_children ON user_folders(owner,parent);
    CREATE TABLE IF NOT EXISTS user_file_folders(
      file TEXT PRIMARY KEY REFERENCES user_files(id) ON DELETE CASCADE,
      folder TEXT NOT NULL REFERENCES user_folders(id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS user_files_by_folder ON user_file_folders(folder);
    CREATE TABLE IF NOT EXISTS user_file_shares (
      id TEXT PRIMARY KEY, file TEXT NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
      owner TEXT NOT NULL, recipient TEXT NOT NULL, friendship TEXT NOT NULL,
      UNIQUE(file,recipient,friendship)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS file_shares_recipient ON user_file_shares(recipient);
  `);
  const transfers=openFileTransfers(db,key);
  const digests=openFileDigests(db,key,'user_files');
  const hasDiskRoom=()=>{
    if(database===':memory:')return true;
    try{const status=statfsSync(dirname(database));return status.bavail*status.bsize>=256*1024**2;}
    catch{return false;}
  };
  const subtree=db.prepare(`WITH RECURSIVE tree(id,depth) AS (
    SELECT id,1 FROM user_folders WHERE owner=? AND id=? UNION ALL
    SELECT f.id,t.depth+1 FROM user_folders f JOIN tree t ON f.parent=t.id WHERE f.owner=? AND t.depth<8
  ) SELECT id FROM tree ORDER BY depth DESC`);
  const folderSizes=db.prepare(`WITH RECURSIVE tree(root,id,depth) AS (
    SELECT id,id,1 FROM user_folders WHERE owner=? AND parent IS ? UNION ALL
    SELECT t.root,f.id,t.depth+1 FROM tree t JOIN user_folders f ON f.parent=t.id WHERE f.owner=? AND t.depth<8
  ) SELECT tree.root,total(files.size) AS size FROM tree
    LEFT JOIN user_file_folders link ON link.folder=tree.id
    LEFT JOIN user_files files ON files.id=link.file AND files.owner=? GROUP BY tree.root`);
  const subtreeTransfers=db.prepare(`DELETE FROM file_transfers WHERE owner=? AND (
    (committed=0 AND folder IN (SELECT value FROM json_each(?))) OR
    id IN (SELECT file FROM user_file_folders WHERE folder IN (SELECT value FROM json_each(?)))
  )`);
  const subtreeFiles=db.prepare(`DELETE FROM user_files WHERE owner=? AND id IN
    (SELECT file FROM user_file_folders WHERE folder IN (SELECT value FROM json_each(?)))`);
  const folderHeight=db.prepare(`WITH RECURSIVE tree(id,depth) AS (
    SELECT id,1 FROM user_folders WHERE owner=? AND id=? UNION ALL
    SELECT f.id,t.depth+1 FROM user_folders f JOIN tree t ON f.parent=t.id WHERE f.owner=? AND t.depth<=8
  ) SELECT max(depth) AS depth FROM tree`);
  const directory=db.prepare('SELECT * FROM user_folders WHERE owner=? ORDER BY created,id');
  const moveFolder=db.prepare('UPDATE user_folders SET parent=? WHERE owner=? AND id=?');
  const unlinkFile=db.prepare('DELETE FROM user_file_folders WHERE file=?');
  const removeOwnedFiles=db.prepare('DELETE FROM user_files WHERE owner=?');
  const removeOwnedShares=db.prepare('DELETE FROM user_file_shares WHERE owner=? OR recipient=?');
  const detachOwnedFolders=db.prepare('UPDATE user_folders SET parent=NULL WHERE owner=?');
  const removeOwnedFolders=db.prepare('DELETE FROM user_folders WHERE owner=?');
  const forFolder = db.prepare('SELECT f.id FROM user_files f LEFT JOIN user_file_folders link ON link.file=f.id WHERE f.owner=? AND link.folder IS ? ORDER BY f.created DESC,f.id');
  const children = db.prepare('SELECT * FROM user_folders WHERE owner=? AND parent IS ? ORDER BY created,id');
  const folderById = db.prepare('SELECT * FROM user_folders WHERE owner=? AND id=?');
  const folderCount = db.prepare('SELECT count(*) AS total FROM user_folders WHERE owner=?');
  const fileTotal = db.prepare('SELECT 1 FROM user_file_folders JOIN user_files ON user_files.id=file WHERE folder=? LIMIT 1');
  const folderInsert = db.prepare('INSERT INTO user_folders(id,owner,parent,created,envelope) VALUES (?,?,?,?,?)');
  const folderRemove = db.prepare('DELETE FROM user_folders WHERE owner=? AND id=?');
  const clearOrphans = db.prepare('DELETE FROM user_file_folders WHERE folder=? AND NOT EXISTS(SELECT 1 FROM user_files WHERE id=file)');
  const linkFile = db.prepare('INSERT INTO user_file_folders VALUES (?,?)');
  const select = db.prepare('SELECT * FROM user_files WHERE owner=? AND id=?');
  const count = db.prepare('SELECT total(max(1,size)) AS bytes,count(*) AS total FROM user_files WHERE owner=?');
  const insert = db.prepare('INSERT INTO user_files VALUES (?,?,?,?,?)');
  const remove = db.prepare('DELETE FROM user_files WHERE owner=? AND id=?');
  const incomingShares=db.prepare('SELECT * FROM user_file_shares WHERE recipient=?');
  const outgoingShares=db.prepare('SELECT * FROM user_file_shares WHERE owner=?');
  const shareById=db.prepare('SELECT * FROM user_file_shares WHERE recipient=? AND id=?');
  const saveShare=db.prepare('INSERT OR IGNORE INTO user_file_shares VALUES(?,?,?,?,?)');
  const removeShare=db.prepare('DELETE FROM user_file_shares WHERE owner=? AND id=?');
  const activeShare=share=>friends?.linked(share.owner,share.recipient)===share.friendship;
  const aad = (owner,id,size) => Buffer.from(JSON.stringify(['authnjs.file.v1',owner,id,size]));
  function unpack(row, includeFile) {
    const envelope = Buffer.from(row.envelope);
    const cipher = createDecipheriv('aes-256-gcm',key,envelope.subarray(0,12));
    cipher.setAAD(aad(row.owner,row.id,row.size));
    cipher.setAuthTag(envelope.subarray(12,28));
    const plain=Buffer.concat([cipher.update(envelope.subarray(28)),cipher.final()]);
    const nameLength=plain.readUInt16BE(0);
    return {id:row.id,created:row.created,size:row.size,name:plain.subarray(2,2+nameLength).toString(),
      ...(includeFile?{data:plain.subarray(2+nameLength)}:{})};
  }
  function pack(owner,id,name,bytes,size=bytes.length) {
    const filename=Buffer.from(name);
    const length=Buffer.alloc(2);
    length.writeUInt16BE(filename.length);
    const nonce=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',key,nonce);
    cipher.setAAD(aad(owner,id,size));
    const crypt=Buffer.concat([cipher.update(Buffer.concat([length,filename,bytes])),cipher.final()]);
    return Buffer.concat([nonce,cipher.getAuthTag(),crypt]);
  }
  function trail(owner,id) {
    const ancestors=[];
    while(id) {
      const row=folderById.get(owner,id);
      if(!row || ancestors.length>=8) return null;
      const {name}=unpack(row,false);
      ancestors.unshift({id,name});
      id=row.parent;
    }
    return ancestors;
  }
  function json(res,status,result) {
    res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(result));
  }

  async function describe(owner,id) {
    const row=select.get(owner,id);
    if(!row)return null;
    const transfer=transfers.byId.get(owner,id);
    const getCurrent=()=>select.get(owner,id);
    const sha256=await digests.get(row,()=>transfer?.committed?transfers.read(transfer):[unpack(row,true).data],getCurrent);
    const current=getCurrent();
    return current&&sha256?{...unpack(current,false),sha256}:null;
  }

  async function describeShares(shares,direction){
    const result=[];
    for(const share of shares){
      if(!activeShare(share))continue;
      const entry=await describe(share.owner,share.file);
      if(entry&&activeShare(share)&&shareById.get(share.recipient,share.id)){
        result.push({share,entry:{...entry,id:share.id,[direction]:accounts.username(direction==='from'?share.owner:share.recipient)}});
      }
    }
    return result;
  }

  function visibleShares(entries){
    return entries.filter(({share})=>activeShare(share)&&shareById.get(share.recipient,share.id)).map(({entry})=>entry);
  }

  async function download(res,row) {
    const transfer=transfers.byId.get(row.owner,row.id);
    const file=unpack(row,!transfer?.committed);
    res.writeHead(200,fileDownloadHeaders(file.name,row.size));
    if(transfer?.committed){
      try{await pipeline(Readable.from(transfers.read(transfer)),res);}
      catch{res.destroy();}
    }else res.end(file.data);
  }

  function transaction(work){
    db.exec('BEGIN IMMEDIATE');
    try{
      const result=work();
      db.exec('COMMIT');
      return result;
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  const remaining=owner=>Math.max(0,(accounts.storageCapacity?.(owner)??storageLimit)
    -count.get(owner).bytes-transfers.reserved(owner)-Object.values(usage(owner)).reduce((sum,value)=>sum+value,0));
  function destination(owner,folder){
    return folder===null?[]:typeof folder==='string'&&fileId.test(folder)?trail(owner,folder):null;
  }
  async function upload(req,res,owner,id,client,authorized){
    if(id&&['GET','DELETE'].includes(req.method)){
      const row=transfers.byId.get(owner,id);
      if(!row||row.client!==client||transfers.isExpired(row))return json(res,404,{error:'Upload unavailable.'});
      if(req.method==='GET')return json(res,200,{id,size:row.size,received:row.received,chunkSize:uploadChunkSize,committed:!!row.committed});
      transfers.cancel.run(owner,id);
      return json(res,200,{ok:true});
    }
    if(!['POST','PUT'].includes(req.method)||!req.headers['content-type']?.startsWith('application/json')){
      return json(res,405,{error:'Method unavailable.'});
    }
    let input;
    try{input=await readInput(req,req.method==='PUT'?Math.ceil(uploadChunkSize/3)*4+1024:4096);}
    catch{return json(res,422,{error:'Invalid upload request.'});}
    if(!await authorized())return json(res,403,{error:'Your upload authorization is no longer active.'});
    const [status,result]=transaction(()=>{
      if(!id&&req.method==='POST'){
        transfers.purge();
        const name=nameOf(input?.name);
        const size=input?.size;
        const folder=input?.folder??null;
        if(!name||!Number.isSafeInteger(size)||size<0)return [422,{error:'Choose a valid file.'}];
        if(!destination(owner,folder))return [404,{error:'Folder unavailable.'}];
        if(Math.max(1,size)>remaining(owner))return [409,{error:'Account storage is full.'}];
        if(!hasDiskRoom())return [503,{error:'File storage is temporarily unavailable.'}];
        const next=randomUUID();
        transfers.begin.run(next,owner,folder,Date.now(),size,pack(owner,next,name,Buffer.alloc(0),size),client);
        return [201,{id:next,chunkSize:uploadChunkSize}];
      }
      const row=id&&transfers.byId.get(owner,id);
      if(!row||row.client!==client||transfers.isExpired(row))return [404,{error:'Upload unavailable.'}];
      if(req.method==='POST'){
        if(row.committed)return [200,{id}];
        if(row.received!==row.size)return [409,{error:'Upload is incomplete.'}];
        if(!destination(owner,row.folder))return [404,{error:'Folder unavailable.'}];
        if(count.get(owner).bytes+transfers.reserved(owner)+Object.values(usage(owner)).reduce((sum,value)=>sum+value,0)>
          (accounts.storageCapacity?.(owner)??storageLimit)){
          return [409,{error:'Account storage is full.'}];
        }
        insert.run(id,owner,Date.now(),row.size,row.metadata);
        if(row.folder)linkFile.run(id,row.folder);
        transfers.complete.run(id);
        return [201,{id}];
      }
      return appendTransferChunk(transfers,row,input,hasDiskRoom);
    });
    return json(res,status,result);
  }

  const handle=async (req,res,path)=>{
    const delegated=path.startsWith('/v1/');
    const shared=path==='/v1/files/shared'||path.startsWith('/v1/files/shared/');
    if(delegated&&shared&&req.method!=='GET')return json(res,405,{error:'Shared files are read-only.'});
    const uploading=path.startsWith('/v1/files/uploads');
    const scopes=uploading?['files_write']:shared?['shared_files_read']:req.method==='GET'?['files_read','files_write']:['files_write'];
    const token=delegated&&/^Bearer (\S+)$/i.exec(req.headers.authorization??'')?.[1];
    const identity=delegated?(token&&await fileAccess?.(token,scopes)):accounts.current(req);
    if(!identity) return json(res,401,{error:delegated?'An access token with the matching file permission is required.':'Sign in to manage your files.'});
    const owner=identity.owner;
    const query=new URL(req.url,origin).searchParams;
    const metadata=query.get('metadata')==='1';
    async function stillAuthorized(){
      const live=delegated?await fileAccess(token,scopes):accounts.current(req);
      return live?.owner===owner&&(!delegated||live.client===identity.client);
    }
    if(delegated)path='/account'+path.slice('/v1'.length);
    if(delegated&&shared&&!friends)return json(res,404,{error:'Shared files unavailable.'});
    const shareId=/^\/account\/files\/shared\/([0-9a-f-]{36})$/.exec(path)?.[1];
    const uploadRoute=/^\/account\/files\/uploads(?:\/([0-9a-f-]{36}))?$/.exec(path);
    if(uploadRoute){
      if(!delegated&&req.method!=='GET'&&(!(accounts.allowsMutation?.(req)??req.headers.origin===origin)||
        req.headers['x-authnjs-request']!=='account-consent'))return json(res,403,{error:'Only the account manager can change your files.'});
      const client=delegated?identity.client:null;
      if(delegated&&!client)return json(res,403,{error:'Application unavailable.'});
      const authorized=async()=>{
        const live=delegated?await fileAccess(token,['files_write']):accounts.current(req);
        return live?.owner===owner&&(!delegated||live.client===client);
      };
      return upload(req,res,owner,uploadRoute[1],client,authorized);
    }
    if (friends && (path==='/account/files/shared'||shareId)) {
      if (req.method==='GET'&&!shareId) {
        const incoming=await describeShares(incomingShares.all(owner),'from');
        const outgoing=delegated?undefined:await describeShares(outgoingShares.all(owner),'to');
        if(!await stillAuthorized())return json(res,403,{error:'File access was revoked.'});
        return json(res,200,{incoming:visibleShares(incoming),outgoing:outgoing&&visibleShares(outgoing)});
      }
      if (req.method==='GET'&&shareId) {
        const share=shareById.get(owner,shareId);
        const row=share&&activeShare(share)&&select.get(share.owner,share.file);
        if(!row)return json(res,404,{error:'Shared file unavailable.'});
        if(!metadata)return download(res,row);
        const entry=await describe(share.owner,share.file);
        if(!await stillAuthorized())return json(res,403,{error:'File access was revoked.'});
        if(!entry||!activeShare(share)||!shareById.get(owner,shareId))return json(res,404,{error:'Shared file unavailable.'});
        return json(res,200,{...entry,id:share.id,from:accounts.username(share.owner)});
      }
      if (!accounts.allowsMutation(req)||req.headers['x-authnjs-request']!=='account-consent') {
        return json(res,403,{error:'Only the account manager can change file access.'});
      }
      if (req.method==='DELETE'&&shareId) {
        removeShare.run(owner,shareId);
        return json(res,200,{ok:true});
      }
      if (req.method!=='POST'||shareId) return json(res,405,{error:'Method unavailable.'});
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{error:'JSON required.'});
      const chunks=[];
      let size=0;
      for await (const chunk of req.iterator({destroyOnReturn:false})) {
        size+=chunk.length;
        if (size>1024) {req.resume();return json(res,413,{error:'Request too large.'});}
        chunks.push(chunk);
      }
      let input;
      try { input=JSON.parse(Buffer.concat(chunks).toString()); }
      catch { return json(res,422,{error:'Invalid share.'}); }
      const friend=friends.list(owner).find(({id})=>id===input?.friend);
      if (!friend||typeof input.file!=='string'||!fileId.test(input.file)||!select.get(owner,input.file)) {
        return json(res,404,{error:'File or friend unavailable.'});
      }
      const previous=outgoingShares.all(owner);
      if (previous.length>=1000) {
        for (const share of previous) if (!activeShare(share)) removeShare.run(owner,share.id);
        if (outgoingShares.all(owner).length>=1000) return json(res,409,{error:'Sharing limit reached.'});
      }
      saveShare.run(randomUUID(),input.file,owner,friend.owner,friend.id);
      return json(res,200,{ok:true});
    }
    const capacity=accounts.storageCapacity?.(owner)??storageLimit;
    const foldersRoute=path==='/account/files/folders';
    const folderItem=path.startsWith('/account/files/folders/');
    const id=path.slice(folderItem?'/account/files/folders/'.length:'/account/files/'.length);
    const individual=fileId.test(id);
    if(req.method==='GET'){
      if(path==='/account/files'){
        const location=query.get('folder');
        const breadcrumbs=trail(owner,location);
        if(!breadcrumbs)return json(res,404,{error:'Folder unavailable.'});
        const folder=location||null;
        const sizes=new Map(folderSizes.all(owner,folder,owner,owner).map(row=>[row.root,row.size]));
        const files=[];
        for(const {id} of forFolder.all(owner,folder)){
          const entry=await describe(owner,id);
          if(entry)files.push(entry);
        }
        if(!await stillAuthorized())return json(res,403,{error:'File access was revoked.'});
        const listing={
          files,
          folders:children.all(owner,folder).map(row=>({...unpack(row,false),size:sizes.get(row.id)??0})),
          breadcrumbs,
        };
        if(delegated)return json(res,200,listing);
        const stats=count.get(owner);
        const categories={files:stats.bytes,...usage(owner)};
        return json(res,200,{...listing,categories,appContainers:appContainers(owner),
          used:Object.values(categories).reduce((total,value)=>total+value,0),total:stats.total,limit:capacity});
      }
      if(!delegated&&path==='/account/files/destinations')return json(res,200,{folders:directory.all(owner).map(row=>({...unpack(row,false),parent:row.parent}))});
      const row=individual&&select.get(owner,id);
      if(!row)return json(res,404,{error:'File unavailable.'});
      if(!metadata)return download(res,row);
      const entry=await describe(owner,id);
      if(!await stillAuthorized())return json(res,403,{error:'File access was revoked.'});
      return entry?json(res,200,entry):json(res,404,{error:'File unavailable.'});
    }
    if(!delegated&&(!(accounts.allowsMutation?.(req) ?? req.headers.origin===origin)||req.headers['x-authnjs-request']!=='account-consent')){
      return json(res,403,{error:'Only the account manager can change your files.'});
    }
    if(req.method==='DELETE'&&individual&&folderItem){
      const recursive=!delegated&&new URL(req.url,origin).searchParams.get('recursive')==='1';
      const result=transaction(()=>{
        if(!folderById.get(owner,id))return 404;
        if(!recursive&&(children.get(owner,id)||fileTotal.get(id)))return 409;
        const folders=recursive?subtree.all(owner,id,owner).map(row=>row.id):[id];
        if(recursive){
          const selected=JSON.stringify(folders);
          subtreeTransfers.run(owner,selected,selected);
          subtreeFiles.run(owner,selected);
        }
        for(const selected of folders){clearOrphans.run(selected);folderRemove.run(owner,selected);}
        return 200;
      });
      return json(res,result,result===200?{ok:true}:result===404?{error:'Folder unavailable.'}:{error:'Use the dashboard to remove the folder and its contents.'});
    }
    if(req.method==='DELETE'&&individual){
      const deleted=transaction(()=>{
        if(remove.run(owner,id).changes!==1)return false;
        transfers.remove.run(owner,id);
        return true;
      });
      return deleted?json(res,200,{ok:true}):json(res,404,{error:'File unavailable.'});
    }
    const rename=req.method==='PATCH'&&individual;
    const create=req.method==='POST'&&(path==='/account/files'||foldersRoute);
    if((!rename&&!create)||!req.headers['content-type']?.startsWith('application/json')){
      return json(res,405,{error:'Method unavailable.'});
    }
    let input;
    try{input=await readInput(req,rename?4096:3*1024*1024);}
    catch{return json(res,422,{error:'Invalid file request.'});}
    if(delegated&&(await fileAccess(token,scopes))?.owner!==owner)return json(res,403,{error:'File access was revoked.'});
    const name=nameOf(input?.name);
    const moving=rename&&input&&Object.hasOwn(input,'folder');
    if((!moving||Object.hasOwn(input,'name'))&&!name)return json(res,422,{error:'Choose a valid name.'});
    if(rename){
      return transaction(()=>{
        const row=folderItem?folderById.get(owner,id):select.get(owner,id);
        if(!row)return json(res,404,{error:'File or folder unavailable.'});
        if(moving){
          const trail=destination(owner,input.folder);
          if(!trail)return json(res,404,{error:'Folder unavailable.'});
          if(folderItem&&(trail.some(folder=>folder.id===id)||trail.length+folderHeight.get(owner,id,owner).depth>8)){
            return json(res,409,{error:'This folder can’t be moved there.'});
          }
          if(folderItem)moveFolder.run(input.folder,owner,id);
          else{
            unlinkFile.run(id);
            if(input.folder)linkFile.run(id,input.folder);
          }
        }
        if(name){
          const data=folderItem||transfers.byId.get(owner,id)?.committed?Buffer.alloc(0):unpack(row,true).data;
          const table=folderItem?'user_folders':'user_files';
          db.prepare('UPDATE '+table+' SET envelope=? WHERE owner=? AND id=?').run(pack(owner,id,name,data,row.size),owner,id);
        }
        return json(res,200,{ok:true});
      });
    }
    const folder=input?.folder??null;
    const bytes=foldersRoute?Buffer.alloc(0):Buffer.from(typeof input.content==='string'?input.content:'','base64');
    if(!foldersRoute&&(!bytes.length||bytes.length>fileLimit||bytes.toString('base64')!==input.content)){
      return json(res,413,{error:'File exceeds 2 MB or is invalid.'});
    }
    db.exec('BEGIN IMMEDIATE');
    try{
      const breadcrumbs=folder===null?[]:typeof folder==='string'&&fileId.test(folder)?trail(owner,folder):null;
      if(!breadcrumbs){db.exec('ROLLBACK');return json(res,404,{error:'Folder unavailable.'});}
      const next=randomUUID();
      if(foldersRoute){
        if(breadcrumbs.length>=8||folderCount.get(owner).total>=100){
          db.exec('ROLLBACK');return json(res,409,{error:'Folder limit reached.'});
        }
        folderInsert.run(next,owner,folder,Date.now(),pack(owner,next,name,bytes));
      } else {
        if(bytes.length>remaining(owner)){
          db.exec('ROLLBACK');return json(res,409,{error:'Account file storage is full.'});
        }
        insert.run(next,owner,Date.now(),bytes.length,pack(owner,next,name,bytes));
        if(folder) linkFile.run(next,folder);
      }
      db.exec('COMMIT');
      return json(res,201,{id:next});
    } catch(error){db.exec('ROLLBACK');throw error;}
  };
  return Object.assign(handle,{
    fileBytes:owner=>count.get(owner).bytes+transfers.reserved(owner),
    removeAccount:owner=>transaction(()=>{
      removeOwnedShares.run(owner,owner);
      removeOwnedFiles.run(owner);
      detachOwnedFolders.run(owner);
      removeOwnedFolders.run(owner);
      transfers.removeOwner.run(owner);
    }),
  });
}
