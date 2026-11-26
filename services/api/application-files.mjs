import {createCipheriv, createDecipheriv, randomBytes, randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {appendTransferChunk, openFileTransfers, uploadChunkSize, uploadIdleMs} from './file-transfers.mjs';
import {fileName, readFileInput, fileDownloadHeaders} from './file-input.mjs';

export const appFileRoute = '(?:/(uploads)(?:/([0-9a-f-]{36}))?|/([0-9a-f-]{36}))?$';
export const serviceOwner = '~app';

export function openApplicationFiles({db,key,hasDiskRoom,remaining}) {
  db.exec('PRAGMA foreign_keys=ON');
  const transfers=openFileTransfers(db,key);
  db.exec(`CREATE TABLE IF NOT EXISTS app_files(
    id TEXT PRIMARY KEY REFERENCES file_transfers(id) ON DELETE CASCADE,
    client TEXT NOT NULL,owner TEXT NOT NULL,size INTEGER NOT NULL,created INTEGER NOT NULL,
    browseable INTEGER NOT NULL DEFAULT 0
  ) STRICT;
  CREATE INDEX IF NOT EXISTS app_files_scope ON app_files(owner,client,id);`);
  const file=db.prepare('SELECT * FROM app_files WHERE owner=? AND client=? AND id=? AND (browseable=1 OR ?=0)');
  const list=db.prepare('SELECT * FROM app_files WHERE owner=? AND client=? AND id>? AND (browseable=1 OR ?=0) ORDER BY id LIMIT 101');
  const aggregate=db.prepare(`SELECT client,count(*) AS files,sum(max(size,1)) AS bytes,
    sum(browseable) AS browseable, sum(CASE WHEN browseable=1 THEN size ELSE 0 END) AS visibleBytes FROM app_files WHERE owner=? GROUP BY client`);
  const used=db.prepare('SELECT total(max(1,size)) AS bytes FROM app_files WHERE owner=? AND (? IS NULL OR client=?)');
  const materialize=db.prepare('INSERT INTO app_files VALUES(?,?,?,?,?,?)');
  const setBrowseable=db.prepare('UPDATE app_files SET browseable=? WHERE id=?');
  const reserve=db.prepare('SELECT total(max(1,size)) AS bytes FROM file_transfers WHERE owner=? AND committed=0 AND updated>=? AND (? IS NULL OR client=?)');
  const metadataContext=(owner,client,id,size)=>Buffer.from(JSON.stringify(['xcenter.appfile.v1',owner,client,id,size]));
  function seal(owner,client,id,size,metadata){
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
    cipher.setAAD(metadataContext(owner,client,id,size));
    const bytes=Buffer.concat([cipher.update(JSON.stringify(metadata)),cipher.final()]);
    return Buffer.concat([nonce,cipher.getAuthTag(),bytes]);
  }
  function open(row){
    const bytes=Buffer.from(row.metadata);
    const cipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
    cipher.setAAD(metadataContext(row.owner,row.client,row.id,row.size));
    cipher.setAuthTag(bytes.subarray(12,28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]));
  }
  function transaction(work){
    db.exec('BEGIN IMMEDIATE');
    try{const result=work();db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }
  const hidden={error:'File unavailable.'};
  const view=row=>({id:row.id,size:row.size,created:row.created,browseable:!!row.browseable,
    name:open(transfers.byId.get(row.owner,row.id)).name});

  return {
    totals:owner=>aggregate.all(owner),
    bytes:(owner,client=null)=>used.get(owner,client,client).bytes+reserve.get(owner,Date.now()-uploadIdleMs,client,client).bytes,
    removeAccount:owner=>transfers.removeOwner.run(owner),
    removeApp:(owner,client)=>db.prepare('DELETE FROM file_transfers WHERE owner=? AND client=?').run(owner,client),
    async handle(req,res,url,{owner,client,readOnly=false,browseableOnly=false,live},route,headers) {
      const respond=(status,value)=>res.writeHead(status,{...headers,'Content-Type':'application/json'}).end(JSON.stringify(value));
      const [uploading,uploadId,fileId]=route;
      if(readOnly&&req.method!=='GET')return respond(405,{error:'This view is read-only.'});
      if(!uploading&&req.method==='GET'){
        if(!fileId){
          const cursor=url.searchParams.get('cursor')??'';
          if(cursor&&!/^[0-9a-f-]{36}$/.test(cursor))return respond(422,{error:'Invalid cursor.'});
          const rows=list.all(owner,client,cursor,Number(browseableOnly));
          return respond(200,{files:rows.slice(0,100).map(view),nextCursor:rows.length>100?rows[99].id:null});
        }
        const row=file.get(owner,client,fileId,Number(browseableOnly));
        if(!row)return respond(404,hidden);
        const transfer=transfers.byId.get(owner,fileId);
        res.writeHead(200,{...headers,...fileDownloadHeaders(open(transfer).name,row.size)});
        try{await pipeline(Readable.from(transfers.read(transfer)),res);}
        catch{res.destroy();}
        return;
      }
      function pending(){
        const row=uploadId&&transfers.byId.get(owner,uploadId);
        return row?.client===client&&!transfers.isExpired(row)?row:null;
      }
      if(uploading&&uploadId&&req.method==='GET'){
        const row=pending();
        return row?respond(200,{id:row.id,size:row.size,received:row.received,chunkSize:uploadChunkSize,committed:!!row.committed}):respond(404,hidden);
      }
      if(readOnly)return respond(405,{error:'Upload operations are unavailable in this view.'});
      if(req.method==='DELETE'&&(fileId||uploadId)){
        if(uploading){
          if(!pending())return respond(404,hidden);
          transfers.cancel.run(owner,uploadId);
        }else{
          if(!file.get(owner,client,fileId,0))return respond(404,hidden);
          transfers.remove.run(owner,fileId);
        }
        return respond(200,{ok:true});
      }
      if(!(uploading&&(req.method==='POST'||(uploadId&&req.method==='PUT'))||
        fileId&&req.method==='PUT'&&owner!==serviceOwner))return respond(405,{error:'Method unavailable.'});
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return respond(415,{error:'JSON required.'});
      let input;
      try{input=await readFileInput(req,uploading&&req.method==='PUT'?Math.ceil(uploadChunkSize/3)*4+1024:4096);}
      catch{return respond(422,{error:'Invalid file request.'});}
      if(!await live())return respond(403,{error:'File authorization changed.'});
      const [status,value]=transaction(()=>{
        if(fileId){
          if(!file.get(owner,client,fileId,0))return [404,hidden];
          if(typeof input?.browseable!=='boolean')return [422,{error:'Choose whether the file is Browseable.'}];
          setBrowseable.run(Number(input.browseable),fileId);
          return [200,{ok:true}];
        }
        if(!uploadId){
          transfers.purge();
          const name=fileName(input?.name), size=input?.size, browseable=input?.browseable??false;
          if(!name||!Number.isSafeInteger(size)||size<0||typeof browseable!=='boolean'||(owner===serviceOwner&&browseable)||input.folder!=null){
            return [422,{error:'Provide a file name, size, and valid visibility.'}];
          }
          if(Math.max(1,size)>remaining(owner,client))return [409,{error:'Storage quota exceeded.'}];
          if(!hasDiskRoom())return [503,{error:'File storage temporarily unavailable.'}];
          const id=randomUUID();
          transfers.begin.run(id,owner,null,Date.now(),size,seal(owner,client,id,size,{name,browseable}),client);
          return [201,{id,chunkSize:uploadChunkSize}];
        }
        const row=pending();
        if(!row)return [404,hidden];
        if(req.method==='PUT')return appendTransferChunk(transfers,row,input,hasDiskRoom);
        if(row.committed)return [200,{id:uploadId}];
        if(row.received!==row.size)return [409,{error:'Upload is incomplete.'}];
        if(remaining(owner,client)<0)return [409,{error:'Storage quota exceeded.'}];
        materialize.run(uploadId,client,owner,row.size,Date.now(),Number(open(row).browseable));
        transfers.complete.run(uploadId);
        return [201,{id:uploadId}];
      });
      return respond(status,value);
    },
  };
}
