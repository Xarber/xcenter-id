import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import {openFileDigests} from './file-digests.mjs';

test('file digests coalesce streamed reads, survive reopening and are encrypted at rest',async t=>{
  const db=new DatabaseSync(':memory:');
  t.after(()=>db.close());
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE user_files(id TEXT PRIMARY KEY); INSERT INTO user_files VALUES ('old-file')");
  const key=randomBytes(32);
  const digests=openFileDigests(db,key,'user_files');
  const block=Buffer.alloc(512*1024,9);
  const row={id:'old-file',owner:'fixture',size:block.length*18};
  const hash=createHash('sha256');
  for(let i=0;i<18;i++)hash.update(block);
  const expected=hash.digest('hex');
  let runs=0;
  function* chunks(){
    runs++;
    for(let i=0;i<18;i++)yield block;
  }
  assert.deepEqual(await Promise.all([
    digests.get(row,chunks,()=>true),
    digests.get(row,chunks,()=>true),
  ]),[expected,expected]);
  assert.equal(runs,1);
  const envelope=Buffer.from(db.prepare('SELECT envelope FROM file_content_digests').get().envelope);
  assert.equal(envelope.length,60);
  assert.equal(envelope.includes(Buffer.from(expected,'hex')),false);
  assert.equal(await openFileDigests(db,key,'user_files').get(row,chunks,()=>true),expected);
  assert.equal(runs,1);
  await assert.rejects(digests.get({...row,owner:'another'},chunks,()=>true));
  db.prepare('DELETE FROM user_files WHERE id=?').run(row.id);
  assert.equal(db.prepare('SELECT count(*) AS total FROM file_content_digests').get().total,0);
});
