import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simpleParser} from 'mailparser';
import {accountMessage,localAccountMessage} from './account-mail.mjs';

test('account email is multipart, escapes app names, and validates action URLs',async()=>{
  const subject='App permissions updated';
  const body='Example <img src=x> changed.';
  const message=await localAccountMessage({
    from:'X-Center ID Security <security@id.xcenter.it>',to:'fixture@mail.xcenter.it',
    subject,paragraphs:[body],action:{url:'https://id.xcenter.it/apps',label:'Review linked apps'},
  });
  const result=await simpleParser(message);
  assert.equal(result.subject,subject);
  assert.ok(result.text.includes(body));
  assert.match(result.html,/Example &lt;img src=x&gt; changed/);
  assert.match(result.html,/href="https:\/\/id\.xcenter\.it\/apps"/);
  assert.throws(()=>accountMessage({title:subject,paragraphs:[body],action:{url:'javascript:void(0)',label:'Example'}}),/Invalid account message link/);
});
