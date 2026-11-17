import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { handleInbox } from './mail-routes.mjs';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import nodemailer from 'nodemailer';
import { openMailStore } from './mail-store.mjs';
import { openEmailVerification } from './email-verification.mjs';
import { createInboundServer } from './smtp-inbound.mjs';

test('SMTP accepts registered destinations and aliases, rejects relay and isolates inboxes', async () => {
  const dir = mkdtempSync(join(tmpdir(),'authnjs-mail-'));
  const accountsPath = join(dir,'accounts.sqlite');
  const mailPath = join(dir,'mail.sqlite');
  const accounts = new DatabaseSync(accountsPath);
  accounts.exec("CREATE TABLE identity_profiles(owner TEXT,username TEXT); INSERT INTO identity_profiles VALUES ('alex-owner','alex');");
  accounts.close();
  const store = openMailStore({ accountsPath, mailPath, configuration:{
    inboundDomains:['mail.xcenter.it','hme.xcenter.it'], supportAddresses:['support@id.xcenter.it','support@xcenter.it'],
    storageKey:randomBytes(32).toString('hex'),
  } });
  // TLS is deliberately disabled for this local synthetic test.
  const server = createInboundServer({ store,name:'mail.test',tls:{ disabledCommands:['STARTTLS','AUTH'] } });
  server.listen(0,'127.0.0.1');
  await once(server.server,'listening');
  const transport = nodemailer.createTransport({ host:'127.0.0.1',port:server.server.address().port,ignoreTLS:true });
  const send = (to) => transport.sendMail({from:'synthetic@example.test',to,subject:'Local test',text:'ciphertext check'});
  try {
    const alias = store.alias('alex-owner','test-client');
    assert.match(alias,/^[a-f0-9]{8}-[a-f0-9-]{27}@hme\.xcenter\.it$/);
    assert.equal(alias,store.alias('alex-owner','test-client'));
    await send('alex@mail.xcenter.it');
    await send(alias);
    const premium=store.premiumAlias('alex-owner','test-client');
    assert.match(premium,/^[a-z]+\.[a-z]+\.[a-f0-9]{6}@mail\.xcenter\.it$/);
    await send(premium);
    await assert.rejects(send('nobody@mail.xcenter.it'),{responseCode:550});
    await assert.rejects(send('someone@example.test'),{responseCode:550});
    const {messages} = store.page('alex-owner');
    assert.equal(messages.length,3);
    assert.ok(store.retrieve('alex-owner',messages[0].id).includes(Buffer.from('ciphertext check')));
    assert.equal(store.retrieve('different-owner',messages[0].id),null);
    assert.equal(store.remove('different-owner',messages[0].id),false);
    assert.equal(store.remove('alex-owner',messages[0].id),true);
    assert.equal(store.remove('alex-owner',messages[0].id),false);
    assert.equal(store.retrieve('alex-owner',messages[0].id),null);
    assert.equal(store.page('alex-owner').messages.length,2);
    assert.equal(store.aliases('alex-owner').length,2);
    assert.equal(store.aliases('different-owner').length,0);
    assert.equal(store.revokeAlias('different-owner',alias),false);
    assert.equal(store.resolveRecipient(alias),'alex-owner');
    assert.equal(store.revokeAlias('alex-owner',alias),true);
    assert.equal(store.resolveRecipient(alias),null);
    assert.equal(store.alias('alex-owner','test-client'),null);
    assert.equal(store.revokeAlias('alex-owner',premium),true);
    assert.equal(store.resolveRecipient(premium),null);
    await send('support@id.xcenter.it');
    await send('support@xcenter.it');
    await assert.rejects(send('alex@id.xcenter.it'),{responseCode:550});
    await assert.rejects(send('alex@xcenter.it'),{responseCode:550});
    assert.equal(store.listSupport().length,2);
    assert.ok(store.listSupport().every(item=>item.external));
    assert.equal((await store.readSupport(store.listSupport()[0].id)).canReply,false);
    assert.ok(!readFileSync(mailPath).includes(Buffer.from('ciphertext check')));
    for (let i=0;i<100;i++) assert.equal(store.receive(['alex@mail.xcenter.it'],Buffer.from('fixture')),true);
    const timestamps = new DatabaseSync(mailPath);
    timestamps.exec('UPDATE inbox SET received=1');
    timestamps.close();
    const first = store.page('alex-owner');
    assert.equal(first.messages.length,100);
    const [received,id] = first.nextCursor.split(':');
    assert.equal(store.remove('alex-owner',id),true);
    const next = store.page('alex-owner',{received:Number(received),id});
    assert.equal(next.messages.length,2);
    assert.equal(next.nextCursor,null);
    assert.ok(next.messages.every(row=>row.id>id));
    assert.deepEqual(store.page('different-owner',{received:Number(received),id}).messages,[]);
    const selected=next.messages.map(row=>row.id);
    assert.equal(store.removeMany('different-owner',selected),0);
    assert.equal(store.removeMany('alex-owner',selected),2);
    assert.equal(store.removeMany('alex-owner',selected),0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('email remains pending until the matching account uses its one-time verification link', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE verified_emails (owner TEXT,address TEXT PRIMARY KEY,verified INTEGER)');
  let sent;
  const service = openEmailVerification(db,{
    origin:'https://identity.example.test',
    send(message) { sent = message; },
  });
  try {
    assert.deepEqual(await service.start('first','valid@example.test'),{ok:true});
    assert.equal(db.prepare('SELECT count(*) AS n FROM verified_emails').get().n,0);
    const token = new URLSearchParams(new URL(sent.link).hash.slice(1)).get('verify-email');
    assert.equal(service.confirm('second',token),false);
    assert.equal(service.confirm('first',token),true);
    assert.equal(service.confirm('first',token),false);
    assert.equal(db.prepare('SELECT address FROM verified_emails').get().address,'valid@example.test');
  } finally { db.close(); }
});

test('inbox routes expose text and attachments to their owner and protect deletion', async (t) => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const transport = nodemailer.createTransport({streamTransport:true, buffer:true});
  let {message} = await transport.sendMail({
    from:'sender@example.test',to:'reader@example.test',subject:'A document',
    html:'<p>Message text</p><img src="https://example.test/image.png" alt="">',
    attachments:[{filename:'report.txt',content:'document bytes'}],
  });
  const accounts = {
    current:req=>req.headers['x-test-account']?{owner:req.headers['x-test-account']}:null,
    allowsMutation:req=>req.headers.origin==='https://identity.example.test',
  };
  const mail = {
    page:(owner,cursor)=>({messages:[],nextCursor:owner==='reader'&&cursor?.id===id?'verified':null}),
    retrieve:owner=>owner==='reader'?message:null,
    remove:owner=>{if(owner==='reader')message=null;},
    removeMany:(owner,ids)=>{assert.deepEqual(ids,[id]);return owner==='reader'?1:0;},
  };
  const server = createServer((req,res)=>void handleInbox(req,res,new URL(req.url,'http://localhost').pathname,accounts,mail));
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const root = 'http://127.0.0.1:'+server.address().port+'/account/inbox/'+id;
  const reader = {'X-Test-Account':'reader'};
  const list = root.slice(0,-id.length-1);
  const bulk=(owner,ids,origin='https://identity.example.test')=>fetch(list,{method:'DELETE',headers:{
    'X-Test-Account':owner,origin,'X-AuthNJS-Request':'account-consent','Content-Type':'application/json',
  },body:JSON.stringify({ids})});
  assert.equal((await bulk('reader',[id],'https://other.test')).status,403);
  assert.equal((await bulk('reader',Array(101).fill(id))).status,422);
  assert.equal((await bulk('reader',['malformed'])).status,422);
  assert.deepEqual(await (await bulk('reader',[id,id])).json(),{deleted:1});
  assert.deepEqual(await (await bulk('someone-else',[id])).json(),{deleted:0});
  assert.equal((await fetch(list+'?cursor=invalid',{headers:reader})).status,400);
  assert.deepEqual(await (await fetch(list+'?cursor=1:'+id,{headers:reader})).json(),{messages:[],nextCursor:'verified'});
  assert.equal((await fetch(root+'/view')).status,401);
  assert.equal((await fetch(root+'/view',{headers:{'X-Test-Account':'other'}})).status,404);
  const response = await fetch(root+'/view',{headers:reader});
  assert.equal(response.headers.get('cache-control'),'no-store');
  const view = await response.json();
  assert.match(view.text,/Message text/);
  assert.equal(view.html,undefined);
  assert.equal(view.attachments[0].name,'report.txt');
  const attachment = await fetch(root+'/attachments/0',{headers:reader});
  assert.equal(attachment.headers.get('content-disposition'),'attachment; filename="attachment-1"');
  assert.equal(await attachment.text(),'document bytes');
  assert.equal((await fetch(root,{method:'DELETE',headers:reader})).status,403);
  assert.equal((await fetch(root,{method:'DELETE',headers:{
    ...reader,Origin:'https://identity.example.test','X-AuthNJS-Request':'account-consent',
  }})).status,200);
  assert.equal((await fetch(root+'/view',{headers:reader})).status,404);
});

test('outgoing formatting escapes markup and attachments use verified bytes', async () => {
  const { composeContent } = await import('./mail-compose.mjs');
  const text = '<strong>literal</strong> **bold** _italic_';
  const mail = composeContent(text,{formatted:true,attachment:{name:'example.txt',content:'YWJj'}});
  assert.equal(mail.text,text);
  assert.equal(mail.html,'&lt;strong&gt;literal&lt;/strong&gt; <strong>bold</strong> <em>italic</em>');
  assert.equal(mail.attachments[0].content.toString(),'abc');
  assert.equal(composeContent(text,{attachment:{name:'example.txt',content:'YWJj==='}}),null);
  assert.equal(composeContent(text,{attachment:{name:'unsafe/name',content:'YWJj'}}),null);
});
