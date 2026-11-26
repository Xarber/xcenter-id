import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';

export const uploadChunkSize=512*1024;
const abandonedAfter=60*60*1000;

export function openFileTransfers(db,key) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_transfers(
      id TEXT PRIMARY KEY,owner TEXT NOT NULL,folder TEXT,updated INTEGER NOT NULL,
      size INTEGER NOT NULL,received INTEGER NOT NULL DEFAULT 0,metadata BLOB NOT NULL,
      committed INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE INDEX IF NOT EXISTS file_transfers_owner ON file_transfers(owner,committed);
    CREATE TABLE IF NOT EXISTS file_transfer_chunks(
      id TEXT NOT NULL REFERENCES file_transfers(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,content BLOB NOT NULL,PRIMARY KEY(id,position)
    ) STRICT;
  `);
  if(!db.prepare("PRAGMA table_info(file_transfers)").all().some(column=>column.name==='client')){
    db.exec('ALTER TABLE file_transfers ADD COLUMN client TEXT');
  }
  const begin=db.prepare('INSERT INTO file_transfers(id,owner,folder,updated,size,metadata,client) VALUES(?,?,?,?,?,?,?)');
  const byId=db.prepare('SELECT * FROM file_transfers WHERE owner=? AND id=?');
  const pending=db.prepare('SELECT total(max(1,size)) AS bytes FROM file_transfers WHERE owner=? AND committed=0 AND updated>=?');
  const purge=db.prepare('DELETE FROM file_transfers WHERE committed=0 AND updated<?');
  const save=db.prepare('INSERT INTO file_transfer_chunks VALUES(?,?,?)');
  const load=db.prepare('SELECT content FROM file_transfer_chunks WHERE id=? AND position=?');
  const advance=db.prepare('UPDATE file_transfers SET received=?,updated=? WHERE id=?');
  const complete=db.prepare('UPDATE file_transfers SET committed=1 WHERE id=?');
  const cancel=db.prepare('DELETE FROM file_transfers WHERE owner=? AND id=? AND committed=0');
  const remove=db.prepare('DELETE FROM file_transfers WHERE owner=? AND id=?');
  const removeOwner=db.prepare('DELETE FROM file_transfers WHERE owner=?');
  function binding(row,position) {
    return Buffer.from(JSON.stringify(['authnjs.file.chunk.v1',row.owner,row.id,row.size,position]));
  }
  function encrypt(row,position,bytes) {
    const nonce=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',key,nonce);
    cipher.setAAD(binding(row,position));
    const body=Buffer.concat([cipher.update(bytes),cipher.final()]);
    return Buffer.concat([nonce,cipher.getAuthTag(),body]);
  }
  function decrypt(row,position) {
    const payload=load.get(row.id,position);
    if(!payload)throw new Error('File content unavailable.');
    const bytes=Buffer.from(payload.content);
    const cipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
    cipher.setAAD(binding(row,position));
    cipher.setAuthTag(bytes.subarray(12,28));
    return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]);
  }
  return {
    begin,byId,complete,cancel,remove,removeOwner,
    isExpired:row=>!row.committed&&row.updated<Date.now()-abandonedAfter,
    purge:()=>purge.run(Date.now()-abandonedAfter),
    reserved:owner=>pending.get(owner,Date.now()-abandonedAfter).bytes,
    decrypt,
    append(row,position,bytes){
      save.run(row.id,position,encrypt(row,position,bytes));
      advance.run(position+bytes.length,Date.now(),row.id);
    },
    *read(row){
      for(let position=0;position<row.size;position+=uploadChunkSize)yield decrypt(row,position);
    },
  };
}
