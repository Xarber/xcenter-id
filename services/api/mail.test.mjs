import assert from 'node:assert/strict';
import { once } from 'node:events';
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
    inboundDomains:['mail.xcenter.it','hme.xcenter.it'], storageKey:randomBytes(32).toString('hex'),
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
    const messages = store.list('alex-owner');
    assert.equal(messages.length,3);
    assert.ok(store.retrieve('alex-owner',messages[0].id).includes(Buffer.from('ciphertext check')));
    assert.equal(store.retrieve('different-owner',messages[0].id),null);
    assert.ok(!readFileSync(mailPath).includes(Buffer.from('ciphertext check')));
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
