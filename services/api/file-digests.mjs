import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';

export function openFileDigests(db,key,parent) {
  db.exec(`CREATE TABLE IF NOT EXISTS file_content_digests(
    id TEXT PRIMARY KEY REFERENCES ${parent}(id) ON DELETE CASCADE,
    envelope BLOB NOT NULL
  ) STRICT`);
  const read=db.prepare('SELECT envelope FROM file_content_digests WHERE id=?');
  const save=db.prepare(`INSERT OR IGNORE INTO file_content_digests
    SELECT id,? FROM ${parent} WHERE id=?`);
  const remove=db.prepare('DELETE FROM file_content_digests WHERE id=?');
  const pending=new Map();

  async function calculate(row,chunks,isCurrent) {
    const hash=createHash('sha256');
    let batch=0;
    for(const bytes of chunks()){
      hash.update(bytes);
      batch+=bytes.length;
      if(batch>=8*1024*1024){
        batch=0;
        await setImmediate();
        if(!isCurrent())return null;
      }
    }
    const digest=hash.digest();
    const nonce=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',key,nonce);
    cipher.setAAD(context(row));
    const ciphertext=Buffer.concat([cipher.update(digest),cipher.final()]);
    save.run(Buffer.concat([nonce,cipher.getAuthTag(),ciphertext]),row.id);
    return digest.toString('hex');
  }

  function context(row){
    return Buffer.from(JSON.stringify(['xcenter.file.sha256.v1',parent,row.owner,row.client??null,row.id,row.size]));
  }

  return {
    remove:id=>remove.run(id),
    async get(row,chunks,isCurrent){
      const cached=read.get(row.id);
      if(cached){
        const envelope=Buffer.from(cached.envelope);
        const decipher=createDecipheriv('aes-256-gcm',key,envelope.subarray(0,12));
        decipher.setAAD(context(row));
        decipher.setAuthTag(envelope.subarray(12,28));
        return Buffer.concat([decipher.update(envelope.subarray(28)),decipher.final()]).toString('hex');
      }
      if(pending.has(row.id))return pending.get(row.id);
      const result=calculate(row,chunks,isCurrent);
      pending.set(row.id,result);
      try{return await result;}
      finally{pending.delete(row.id);}
    },
  };
}
