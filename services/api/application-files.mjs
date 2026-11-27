import {createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {appendTransferChunk, openFileTransfers, uploadChunkSize, uploadIdleMs} from './file-transfers.mjs';
import {fileName, readFileInput, fileDownloadHeaders} from './file-input.mjs';
import {openFileDigests} from './file-digests.mjs';

export const appFileRoute = '(?:/(uploads)(?:/([0-9a-f-]{36}))?|/([0-9a-f-]{36}))?$';
export const serviceOwner = '~app';

export function openApplicationFiles({db,key,hasDiskRoom,remaining}) {
  db.exec('PRAGMA foreign_keys=ON');
  const transfers=openFileTransfers(db,key);
  const digests=openFileDigests(db,key,'file_transfers');
  db.exec(`CREATE TABLE IF NOT EXISTS app_files(
    id TEXT PRIMARY KEY REFERENCES file_transfers(id) ON DELETE CASCADE,
    client TEXT NOT NULL,owner TEXT NOT NULL,size INTEGER NOT NULL,created INTEGER NOT NULL,
    browseable INTEGER NOT NULL DEFAULT 0
  ) STRICT;
  CREATE INDEX IF NOT EXISTS app_files_scope ON app_files(owner,client,id);`);
  if(!db.prepare('PRAGMA table_info(app_files)').all().some(field=>field.name==='content_id')){
    db.exec('ALTER TABLE app_files ADD COLUMN content_id TEXT');
  }
  const file=db.prepare('SELECT * FROM app_files WHERE owner=? AND client=? AND id=? AND (browseable=1 OR ?=0)');
  const list=db.prepare('SELECT * FROM app_files WHERE owner=? AND client=? AND id>? AND (browseable=1 OR ?=0) ORDER BY id LIMIT 101');
  const aggregate=db.prepare(`SELECT client,count(*) AS files,sum(max(size,1)) AS bytes,
    sum(browseable) AS browseable, sum(CASE WHEN browseable=1 THEN size ELSE 0 END) AS visibleBytes FROM app_files WHERE owner=? GROUP BY client`);
  const used=db.prepare('SELECT total(max(1,size)) AS bytes FROM app_files WHERE owner=? AND (? IS NULL OR client=?)');
  const materialize=db.prepare('INSERT INTO app_files(id,client,owner,size,created,browseable) VALUES(?,?,?,?,?,?)');
  const swap=db.prepare('UPDATE app_files SET content_id=?,size=? WHERE id=?');
  const retained=id=>!!db.prepare('SELECT 1 FROM app_snapshot_files WHERE id=? OR content=? LIMIT 1').get(id,id);
  const clearChunks=db.prepare('DELETE FROM file_transfer_chunks WHERE id=?');
  const unlink=db.prepare('DELETE FROM app_files WHERE id=?');
  const replacement=db.prepare('SELECT 1 FROM file_transfers WHERE owner=? AND client=? AND folder=? AND committed=0 AND updated>=?');
  const clearDrafts=db.prepare('DELETE FROM file_transfers WHERE owner=? AND client=? AND folder=? AND committed=0');
  const setBrowseable=db.prepare('UPDATE app_files SET browseable=? WHERE id=?');
  const updateMetadata=db.prepare('UPDATE file_transfers SET metadata=? WHERE owner=? AND id=?');
  const reserve=db.prepare(`SELECT total(max(0,max(1,t.size)-coalesce(max(1,f.size),0))) AS bytes
    FROM file_transfers t LEFT JOIN app_files f ON f.id=t.folder AND f.owner=t.owner AND f.client=t.client
    WHERE t.owner=? AND t.committed=0 AND t.updated>=? AND (? IS NULL OR t.client=?)`);
  const fingerprint=transfer=>createHash('sha256').update(transfer.metadata).digest('hex');
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
  function committed(row){
    const transfer=transfers.byId.get(row.owner,row.content_id??row.id);
    if(!transfer?.committed||transfer.client!==row.client||transfer.size!==row.size)throw new Error('Invalid file metadata.');
    const metadata=open(transfer);
    if(metadata.browseable!==!!row.browseable|| (metadata.target??transfer.id)!==row.id ||
        (metadata.editable===true&&(!metadata.browseable||row.owner===serviceOwner)))throw new Error('Invalid file visibility.');
    return {transfer,metadata};
  }
  async function view(row,browseableOnly){
    const {transfer}=committed(row);
    const getCurrent=()=>file.get(row.owner,row.client,row.id,0);
    const sameContent=()=> {
      const current=getCurrent();
      return current&&(current.content_id??current.id)===transfer.id?current:null;
    };
    const sha256=await digests.get(transfer,()=>transfers.read(transfer),sameContent);
    const current=sameContent();
    if(!current||!sha256||(browseableOnly&&!current.browseable))return null;
    const {metadata}=committed(current);
    return {contentId:transfer.id,id:current.id,size:current.size,created:current.created,browseable:!!current.browseable,
      editable:metadata.editable===true,name:metadata.name,sha256};
  }
  function editTarget(owner,client,id){
    const row=file.get(owner,client,id,1);
    if(!row)return [404,hidden];
    const content=committed(row);
    return content.metadata.editable===true?{row,...content}:[405,{error:'This app file is read-only.'}];
  }
  function removeFile(row){
    unlink.run(row.id);
    if(row.content_id&&!retained(row.content_id))transfers.remove.run(row.owner,row.content_id);
    clearDrafts.run(row.owner,row.client,row.id);
    if(!retained(row.id))transfers.remove.run(row.owner,row.id);
  }

  return {
    editable:row=>committed(row).metadata.editable===true,
    totals:owner=>aggregate.all(owner),
    bytes:(owner,client=null)=>used.get(owner,client,client).bytes+reserve.get(owner,Date.now()-uploadIdleMs,client,client).bytes,
    removeAccount:owner=>transfers.removeOwner.run(owner),
    removeApp:(owner,client)=>db.prepare('DELETE FROM file_transfers WHERE owner=? AND client=?').run(owner,client),
    async handle(req,res,url,{owner,client,readOnly=false,dashboard=false,browseableOnly=false,live,canReadPrivate},route,headers) {
      const respond=(status,value)=>res.writeHead(status,{...headers,'Content-Type':'application/json'}).end(JSON.stringify(value));
      const [uploading,uploadId,fileId]=route;
      if(readOnly&&req.method!=='GET')return respond(405,{error:'This view is read-only.'});
      if(!uploading&&req.method==='GET'){
        if(!fileId){
          const cursor=url.searchParams.get('cursor')??'';
          if(cursor&&!/^[0-9a-f-]{36}$/.test(cursor))return respond(422,{error:'Invalid cursor.'});
          const rows=list.all(owner,client,cursor,Number(browseableOnly));
          const files=[];
          for(const original of rows.slice(0,100)){
            const row=file.get(owner,client,original.id,Number(browseableOnly));
            const entry=row&&await view(row,browseableOnly);
            if(entry)files.push(entry);
          }
          if(!await live())return respond(403,{error:'File authorization changed.'});
          const visible=files.flatMap(({contentId,...entry})=>{
            const current=file.get(owner,client,entry.id,Number(browseableOnly||canReadPrivate?.()===false));
            return current&&(current.content_id??current.id)===contentId&&current.browseable===Number(entry.browseable)?[entry]:[];
          });
          return respond(200,{files:visible,nextCursor:rows.length>100?rows[99].id:null});
        }
        const row=file.get(owner,client,fileId,Number(browseableOnly));
        if(!row)return respond(404,hidden);
        if(url.searchParams.get('metadata')==='1'){
          const entry=await view(row,browseableOnly);
          if(!await live())return respond(403,{error:'File authorization changed.'});
          const current=file.get(owner,client,fileId,Number(browseableOnly||canReadPrivate?.()===false));
          if(!entry||!current)return respond(404,hidden);
          const {contentId,...descriptor}=entry;
          if((current.content_id??current.id)!==contentId||current.browseable!==Number(descriptor.browseable)){
            return respond(409,{error:'The file changed. Try again.'});
          }
          return respond(200,descriptor);
        }
        const {transfer,metadata}=committed(row);
        res.writeHead(200,{...headers,...fileDownloadHeaders(metadata.name,row.size)});
        try{await pipeline(Readable.from(transfers.read(transfer)),res);}
        catch{res.destroy();}
        return;
      }
      function pending(){
        const row=uploadId&&transfers.byId.get(owner,uploadId);
        if(row?.client!==client||!!row.folder!==dashboard||transfers.isExpired(row))return null;
        if(row.committed&&(file.get(owner,client,row.folder??row.id,0)?.content_id??row.folder??row.id)!==row.id)return null;
        if(row.committed&&!file.get(owner,client,row.folder??row.id,0))return null;
        return row;
      }
      if(uploading&&uploadId&&req.method==='GET'){
        const row=pending();
        if(dashboard&&row){
          const target=editTarget(owner,client,open(row).target);
          if(Array.isArray(target))return respond(...target);
        }
        return row?respond(200,{id:row.id,size:row.size,received:row.received,chunkSize:uploadChunkSize,committed:!!row.committed}):respond(404,hidden);
      }
      if(readOnly)return respond(405,{error:'Upload operations are unavailable in this view.'});
      if(req.method==='DELETE'&&(fileId||uploadId)){
        if(uploading){
          if(!pending())return respond(404,hidden);
          transfers.cancel.run(owner,uploadId);
        }else{
          const [status,result]=transaction(()=>{
            const target=dashboard?editTarget(owner,client,fileId):{row:file.get(owner,client,fileId,0)};
            if(Array.isArray(target))return target;
            if(!target.row)return [404,hidden];
            removeFile(target.row);
            return [200,{ok:true}];
          });
          return respond(status,result);
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
          if(dashboard){
            const target=editTarget(owner,client,fileId);
            if(Array.isArray(target))return target;
            const name=fileName(input?.name);
            if(!name)return [422,{error:'Choose a valid file name.'}];
            const {row,transfer,metadata}=target;
            updateMetadata.run(seal(owner,client,transfer.id,row.size,{...metadata,name}),owner,transfer.id);
            return [200,{ok:true}];
          }
          const row=file.get(owner,client,fileId,0);
          if(!row)return [404,hidden];
          const {transfer,metadata}=committed(row);
          const browseable=input?.browseable;
          const editable=input?.editable===undefined?(browseable&&metadata.editable===true):input.editable;
          if(typeof browseable!=='boolean'||typeof editable!=='boolean'||(editable&&!browseable)){
            return [422,{error:'Editable files must also be Browseable.'}];
          }
          updateMetadata.run(seal(owner,client,transfer.id,row.size,{...metadata,browseable,editable}),owner,transfer.id);
          setBrowseable.run(Number(browseable),fileId);
          return [200,{ok:true}];
        }
        if(!uploadId){
          transfers.purge();
          if(dashboard){
            const targetId=input?.replace;
            if(typeof targetId!=='string'||!/^[0-9a-f-]{36}$/.test(targetId)||!Number.isSafeInteger(input.size)||input.size<0){
              return [422,{error:'Choose an existing file and replacement size.'}];
            }
            const target=editTarget(owner,client,targetId);
            if(Array.isArray(target))return target;
            if(replacement.get(owner,client,targetId,Date.now()-uploadIdleMs))return [409,{error:'A replacement is already in progress.'}];
            if(Math.max(0,Math.max(1,input.size)-Math.max(1,target.row.size))>remaining(owner,client)){
              return [409,{error:'Storage quota exceeded.'}];
            }
            if(!hasDiskRoom())return [503,{error:'File storage temporarily unavailable.'}];
            const id=randomUUID();
            const metadata={...target.metadata,target:targetId,base:fingerprint(target.transfer)};
            transfers.begin.run(id,owner,targetId,Date.now(),input.size,seal(owner,client,id,input.size,metadata),client);
            return [201,{id,chunkSize:uploadChunkSize}];
          }
          const name=fileName(input?.name), size=input?.size, browseable=input?.browseable??false, editable=input?.editable===undefined?false:input.editable;
          if(!name||!Number.isSafeInteger(size)||size<0||typeof browseable!=='boolean'||typeof editable!=='boolean'||editable&&!browseable||(owner===serviceOwner&&browseable)||input.folder!=null){
            return [422,{error:'Provide a file name, size, and valid visibility.'}];
          }
          if(Math.max(1,size)>remaining(owner,client))return [409,{error:'Storage quota exceeded.'}];
          if(!hasDiskRoom())return [503,{error:'File storage temporarily unavailable.'}];
          const id=randomUUID();
          transfers.begin.run(id,owner,null,Date.now(),size,seal(owner,client,id,size,{name,browseable,editable}),client);
          return [201,{id,chunkSize:uploadChunkSize}];
        }
        const row=pending();
        if(!row)return [404,hidden];
        if(dashboard){
          const metadata=open(row);
          const target=editTarget(owner,client,metadata.target);
          if(Array.isArray(target))return target;
          if(row.committed)return req.method==='POST'?[200,{id:target.row.id}]:[409,{error:'The replacement is already finished.'}];
          if(metadata.target!==row.folder||metadata.base!==fingerprint(target.transfer)){
            return [409,{error:'The original file changed. Start the replacement again.'}];
          }
          if(req.method==='PUT')return appendTransferChunk(transfers,row,input,hasDiskRoom);
          if(row.received!==row.size)return [409,{error:'Upload is incomplete.'}];
          if(remaining(owner,client)<0)return [409,{error:'Storage quota exceeded.'}];
          swap.run(row.id,row.size,target.row.id);
          transfers.complete.run(row.id);
          if(target.row.content_id){
            if(!retained(target.row.content_id))transfers.remove.run(owner,target.row.content_id);
          }else if(!retained(target.row.id)){
            clearChunks.run(target.row.id);
            digests.remove(target.row.id);
          }
          return [201,{id:target.row.id}];
        }
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
