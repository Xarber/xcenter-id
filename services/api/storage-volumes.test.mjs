import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseStorageVolumes,storageVolumeStatus} from './storage-volumes.mjs';

test('an unmounted or wrong replacement directory cannot be counted as its configured volume',()=>{
  const root=mkdtempSync(join(tmpdir(),'xcenter-volume-'));
  const [volume]=parseStorageVolumes(JSON.stringify([{id:'xhdd',label:'External disk',root}]));
  try{
    assert.equal(storageVolumeStatus(root,[volume])[1].status,'unavailable');
    writeFileSync(join(root,'.xcenter-volume-id'),'wrong-disk');
    assert.equal(storageVolumeStatus(root,[volume])[1].status,'unavailable');
    writeFileSync(join(root,'.xcenter-volume-id'),'xhdd');
    const status=storageVolumeStatus(root,[volume])[1];
    assert.ok(status.total>0);
    assert.equal('root' in status,false);
    assert.throws(()=>parseStorageVolumes(JSON.stringify([volume,volume])));
  }finally{rmSync(root,{recursive:true,force:true});}
});
