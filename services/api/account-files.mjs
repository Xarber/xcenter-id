import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const fileLimit = 2 * 1024 * 1024;
const storageLimit = 10 * 1024 * 1024;
const fileId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/;

export function createAccountFiles({ database, key, accounts, origin }) {
  if (!key || key.length !== 32) return null;
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS user_files(id TEXT PRIMARY KEY,owner TEXT NOT NULL,created INTEGER NOT NULL,
        size INTEGER NOT NULL,envelope BLOB NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS user_files_owner ON user_files(owner,created);
  `);
  const forUser = db.prepare('SELECT * FROM user_files WHERE owner=? ORDER BY created DESC,id');
  const select = db.prepare('SELECT * FROM user_files WHERE owner=? AND id=?');
  const count = db.prepare('SELECT total(size) AS bytes,count(*) AS total FROM user_files WHERE owner=?');
  const insert = db.prepare('INSERT INTO user_files VALUES (?,?,?,?,?)');
  const remove = db.prepare('DELETE FROM user_files WHERE owner=? AND id=?');
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
  function json(res,status,result) {
    res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(result));
  }

  return async (req,res,path)=>{
    const identity=accounts.current(req);
    if(!identity) return json(res,401,{error:'Sign in to manage your files.'});
    const owner=identity.owner;
    const id=path.slice('/account/files/'.length);
    const individual=fileId.test(id);
    if(req.method==='GET'){
      if(path==='/account/files')return json(res,200,{files:forUser.all(owner).map(row=>unpack(row,false)),
        used:count.get(owner).bytes,limit:storageLimit});
      const row=individual&&select.get(owner,id);
      if(!row)return json(res,404,{error:'File unavailable.'});
      const file=unpack(row,true);
      const name=encodeURIComponent(file.name).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16));
      res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Content-Disposition':"attachment; filename*=UTF-8''"+name});
      res.end(file.data);return;
    }
    if(req.headers.origin!==origin||req.headers['x-authnjs-request']!=='account-consent'){
      return json(res,403,{error:'Only the account manager can change your files.'});
    }
    if(req.method==='DELETE'&&individual){
      return remove.run(owner,id).changes===1 ? json(res,200,{ok:true}):json(res,404,{error:'File unavailable.'});
    }
    if(req.method!=='POST'||path!=='/account/files'||!req.headers['content-type']?.startsWith('application/json')){
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
    if (!name||name.length>160||/[\\/\p{Cc}\p{Cf}]/u.test(name)||!/^[-A-Za-z0-9+/]+={0,2}$/.test(input?.content??'')){
      return json(res,422,{error:'Choose a valid filename and file.'});
    }
    const bytes=Buffer.from(input.content,'base64');
    if(!bytes.length||bytes.length>fileLimit||bytes.toString('base64')!==input.content){
      return json(res,413,{error:'File exceeds 2 MB or is invalid.'});
    }
    db.exec('BEGIN IMMEDIATE');
    try{
      const used=count.get(owner);
      if(used.bytes+bytes.length>storageLimit||used.total>=100){db.exec('ROLLBACK');return json(res,409,{error:'Account file storage is full.'});}
      const next=randomUUID();
      const filename=Buffer.from(name);
      const length=Buffer.alloc(2);length.writeUInt16BE(filename.length);
      const nonce=randomBytes(12);
      const cipher=createCipheriv('aes-256-gcm',key,nonce);
      cipher.setAAD(aad(owner,next,bytes.length));
      const crypt=Buffer.concat([cipher.update(Buffer.concat([length,filename,bytes])),cipher.final()]);
      insert.run(next,owner,Date.now(),bytes.length,Buffer.concat([nonce,cipher.getAuthTag(),crypt]));
      db.exec('COMMIT');
      return json(res,201,{id:next});
    } catch(error){db.exec('ROLLBACK');throw error;}
  };
}
