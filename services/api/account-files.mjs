import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const fileLimit = 2 * 1024 * 1024;
const storageLimit = 10 * 1024 * 1024;
const fileId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/;

export function createAccountFiles({ database, key, accounts, origin, friends, usage = () => ({}), appContainers = () => [] }) {
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
    CREATE TABLE IF NOT EXISTS user_file_shares (
      id TEXT PRIMARY KEY, file TEXT NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
      owner TEXT NOT NULL, recipient TEXT NOT NULL, friendship TEXT NOT NULL,
      UNIQUE(file,recipient,friendship)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS file_shares_recipient ON user_file_shares(recipient);
  `);
  const forFolder = db.prepare('SELECT f.* FROM user_files f LEFT JOIN user_file_folders link ON link.file=f.id WHERE f.owner=? AND link.folder IS ? ORDER BY f.created DESC,f.id');
  const children = db.prepare('SELECT * FROM user_folders WHERE owner=? AND parent IS ? ORDER BY created,id');
  const folderById = db.prepare('SELECT * FROM user_folders WHERE owner=? AND id=?');
  const folderCount = db.prepare('SELECT count(*) AS total FROM user_folders WHERE owner=?');
  const fileTotal = db.prepare('SELECT 1 FROM user_file_folders JOIN user_files ON user_files.id=file WHERE folder=? LIMIT 1');
  const folderInsert = db.prepare('INSERT INTO user_folders(id,owner,parent,created,envelope) VALUES (?,?,?,?,?)');
  const folderRemove = db.prepare('DELETE FROM user_folders WHERE owner=? AND id=?');
  const clearOrphans = db.prepare('DELETE FROM user_file_folders WHERE folder=? AND NOT EXISTS(SELECT 1 FROM user_files WHERE id=file)');
  const linkFile = db.prepare('INSERT INTO user_file_folders VALUES (?,?)');
  const select = db.prepare('SELECT * FROM user_files WHERE owner=? AND id=?');
  const count = db.prepare('SELECT total(size) AS bytes,count(*) AS total FROM user_files WHERE owner=?');
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
  function pack(owner,id,name,bytes) {
    const filename=Buffer.from(name);
    const length=Buffer.alloc(2);
    length.writeUInt16BE(filename.length);
    const nonce=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',key,nonce);
    cipher.setAAD(aad(owner,id,bytes.length));
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

  function download(res,file) {
    const name=encodeURIComponent(file.name).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16));
    res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Content-Disposition':"attachment; filename*=UTF-8''"+name});
    res.end(file.data);
  }

  const handle=async (req,res,path)=>{
    const identity=accounts.current(req);
    if(!identity) return json(res,401,{error:'Sign in to manage your files.'});
    const owner=identity.owner;
    const shareId=/^\/account\/files\/shared\/([0-9a-f-]{36})$/.exec(path)?.[1];
    if (friends && (path==='/account/files/shared'||shareId)) {
      if (req.method==='GET'&&!shareId) {
        const incoming=incomingShares.all(owner).filter(activeShare).flatMap(share=>{
          const row=select.get(share.owner,share.file);
          return row?[{...unpack(row,false),id:share.id,from:accounts.username(share.owner)}]:[];
        });
        const outgoing=outgoingShares.all(owner).filter(activeShare).flatMap(share=>{
          const row=select.get(owner,share.file);
          return row?[{...unpack(row,false),id:share.id,to:accounts.username(share.recipient)}]:[];
        });
        return json(res,200,{incoming,outgoing});
      }
      if (req.method==='GET'&&shareId) {
        const share=shareById.get(owner,shareId);
        const row=share&&activeShare(share)&&select.get(share.owner,share.file);
        return row?download(res,unpack(row,true)):json(res,404,{error:'Shared file unavailable.'});
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
        const location=new URL(req.url,origin).searchParams.get('folder');
        const breadcrumbs=trail(owner,location);
        if(!breadcrumbs)return json(res,404,{error:'Folder unavailable.'});
        const stats=count.get(owner);
        const categories={files:stats.bytes,...usage(owner)};
        const folder=location||null;
        return json(res,200,{files:forFolder.all(owner,folder).map(row=>unpack(row,false)),
          folders:children.all(owner,folder).map(({id,envelope,size,created})=>unpack({id,owner,envelope,size,created},false)),
          breadcrumbs,categories,appContainers:appContainers(owner),used:Object.values(categories).reduce((total,value)=>total+value,0),total:stats.total,limit:capacity});
      }
      const row=individual&&select.get(owner,id);
      if(!row)return json(res,404,{error:'File unavailable.'});
      return download(res,unpack(row,true));
    }
    if(!(accounts.allowsMutation?.(req) ?? req.headers.origin===origin)||req.headers['x-authnjs-request']!=='account-consent'){
      return json(res,403,{error:'Only the account manager can change your files.'});
    }
    if(req.method==='DELETE'&&individual&&folderItem){
      db.exec('BEGIN IMMEDIATE');
      try {
        const row=folderById.get(owner,id);
        if(!row)return json(res,404,{error:'Folder unavailable.'});
        if(children.get(owner,id)||fileTotal.get(id))return json(res,409,{error:'Empty the folder before removing it.'});
        clearOrphans.run(id);
        folderRemove.run(owner,id);
        return json(res,200,{ok:true});
      } finally { db.exec('COMMIT'); }
    }
    if(req.method==='DELETE'&&individual){
      return remove.run(owner,id).changes===1 ? json(res,200,{ok:true}):json(res,404,{error:'File unavailable.'});
    }
    if(req.method!=='POST'||(path!=='/account/files'&&!foldersRoute)||!req.headers['content-type']?.startsWith('application/json')){
      return json(res,405,{error:'Method unavailable.'});
    }
    let input;
    try {
      let size=0;
      const chunks=[];
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        size+=chunk.length;
        if(size>3*1024*1024){req.resume();return json(res,413,{error:'File exceeds 2 MB.'});}
        chunks.push(chunk);
      }
      input=JSON.parse(Buffer.concat(chunks).toString());
    } catch {return json(res,422,{error:'Invalid upload.'});}
    const name=typeof input?.name==='string'?input.name.trim().normalize('NFC'):'';
    if(!name||name==='.'||name==='..'||name.length>160||/[\\/\p{Cc}\p{Cf}]/u.test(name)){
      return json(res,422,{error:'Choose a valid name.'});
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
        const used=count.get(owner);
        if(used.bytes+bytes.length+Object.values(usage(owner)).reduce((sum,value)=>sum+value,0)>capacity||used.total>=100){
          db.exec('ROLLBACK');return json(res,409,{error:'Account file storage is full.'});
        }
        insert.run(next,owner,Date.now(),bytes.length,pack(owner,next,name,bytes));
        if(folder) linkFile.run(next,folder);
      }
      db.exec('COMMIT');
      return json(res,201,{id:next});
    } catch(error){db.exec('ROLLBACK');throw error;}
  };
  return Object.assign(handle,{fileBytes:owner=>count.get(owner).bytes});
}
