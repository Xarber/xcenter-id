import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadFileBatch} from './file-upload-batch.ts';

test('a file upload batch continues after an individual failure and disposes each selection',async()=>{
  const disposed=[];
  const sent=[];
  const files=['first','failed','last'].map(name=>({name,read:async()=>name,dispose:()=>disposed.push(name)}));
  const status=await uploadFileBatch(files,async(name,content)=>{
    if(name==='failed')throw new Error('Quota unavailable for this file.');
    sent.push([name,content]);
  });
  assert.deepEqual(sent,[['first','first'],['last','last']]);
  assert.deepEqual(disposed,['first','failed','last']);
  assert.equal(status,'Uploaded 2 of 3. Could not upload failed.');
});
