import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash,randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {DatabaseSync} from 'node:sqlite';import {once} from 'node:events';
import {createAccounts} from './accounts.mjs';import {openMailCredentials} from './mail-credentials.mjs';import {openMailStore} from './mail-store.mjs';
import {createMailSubmission} from './mail-submission.mjs';import nodemailer from 'nodemailer';

test('premium aliases reserve regular usernames and mail client credentials revoke independently',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'xcenter-mailclients-')),database=join(dir,'accounts.sqlite');
 const accounts=createAccounts({database,origin:'https://id.example.test',profileKey:Buffer.alloc(32,71)}),db=new DatabaseSync(database);
 db.exec("INSERT INTO accounts VALUES('alice','Alice',0),('bob','Bob',0);INSERT INTO identity_profiles VALUES('alice','alice','Alice','User','adult'),('bob','bobby','Bob','User','adult');INSERT INTO account_entitlements VALUES('alice',1)");
 const credentials=openMailCredentials(database),mail=openMailStore({accountsPath:database,mailPath:join(dir,'mail.sqlite'),configuration:{storageKey:randomBytes(32).toString('hex'),inboundDomains:['mail.xcenter.it','hme.xcenter.it']},accountService:accounts});
 try{
  assert.throws(()=>accounts.createMailboxAlias('bob','newalias'));assert.throws(()=>accounts.createMailboxAlias('alice','bobby'));assert.throws(()=>accounts.createMailboxAlias('alice','support'));
  const address=accounts.createMailboxAlias('alice','quietuser');assert.equal(address,'quietuser@mail.xcenter.it');assert.equal(mail.resolveRecipient(address),'alice');
  assert.equal(accounts.mailboxSender('bob',address),false);assert.equal(accounts.mailboxSender('alice',address),true);
  assert.equal(accounts.renameStoredUsername('bob','bobby','quietuser'),false);
  assert.equal(mail.setAlias('alice',address,false),true);assert.equal(mail.resolveRecipient(address),null);assert.throws(()=>accounts.createMailboxAlias('alice','quietuser'));
  assert.equal(mail.setAlias('alice',address,true),true);assert.equal(mail.resolveRecipient(address),'alice');
  const credential=credentials.create('alice','Desktop mail');assert.ok(credentials.authenticate('alice@mail.xcenter.it',credential.password,'test'));
  assert.equal(credentials.authenticate('bobby',credential.password,'test'),null);assert.equal(credentials.authenticate('alice','wrong','test'),null);
  credentials.revoke('alice',credential.id);assert.equal(credentials.authenticate('alice',credential.password,'test'),null);
  const fresh=credentials.create('alice','Phone mail');db.exec("INSERT INTO account_restrictions VALUES('alice','locked')");assert.equal(credentials.authenticate('alice',fresh.password,'test'),null);db.exec("DELETE FROM account_restrictions");
  const smtp=createMailSubmission({tls:{disabledCommands:['STARTTLS'],secure:false,allowInsecureAuth:true},credentials,accounts,outbound:{send:async(owner,user,input)=>({ok:owner==='alice'&&input.from===address})}});
  // Transport-only TLS bypass is explicitly limited to this loopback fixture.
  smtp.options.allowInsecureAuth=true;smtp.listen(0,'127.0.0.1');await once(smtp.server,'listening');
  try{
   const client=nodemailer.createTransport({host:'127.0.0.1',port:smtp.server.address().port,ignoreTLS:true,auth:{user:'alice',pass:fresh.password}});
   await client.sendMail({from:address,to:'recipient@example.net',subject:'Fixture',text:'Authenticated test'});
   await assert.rejects(client.sendMail({from:'bobby@mail.xcenter.it',to:'recipient@example.net',subject:'Fixture',text:'Forged'}));
   credentials.revoke('alice',fresh.id);await assert.rejects(client.sendMail({from:address,to:'recipient@example.net',subject:'Fixture',text:'Revoked'}));
  }finally{await new Promise(resolve=>smtp.close(resolve));}
 }finally{mail.close();credentials.close();db.close();rmSync(dir,{recursive:true,force:true});}
});

test('TLS IMAP serves only authenticated owner mail and supports flags, folders, append and deletion',async()=>{
 const {execFileSync}=await import('node:child_process'),{connect}=await import('node:tls'),{createImapServer}=await import('./imap-server.mjs');
 const dir=mkdtempSync(join(tmpdir(),'xcenter-imap-')),database=join(dir,'accounts.sqlite');createAccounts({database,origin:'https://id.example.test'});
 const db=new DatabaseSync(database);db.exec("INSERT INTO accounts VALUES('alice','Alice',0),('bob','Bob',0);INSERT INTO identity_profiles VALUES('alice','alice','Alice','User','adult'),('bob','bobby','Bob','User','adult')");
 const credentials=openMailCredentials(database),mail=openMailStore({accountsPath:database,mailPath:join(dir,'mail.sqlite'),configuration:{storageKey:randomBytes(32).toString('hex'),inboundDomains:['mail.xcenter.it']}}),credential=credentials.create('alice','Fixture');
 const raw=Buffer.from('From: sender@example.net\r\nTo: alice@mail.xcenter.it\r\nSubject: Visible fixture\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello IMAP\r\n');mail.receive(['alice@mail.xcenter.it'],raw);mail.receive(['bobby@mail.xcenter.it'],Buffer.from('Subject: Never leak Bob\r\n\r\nPrivate Bob body'));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-subj','/CN=localhost','-days','1'],{stdio:'ignore'});
 const server=createImapServer({tls:{key:readFileSync(join(dir,'key.pem')),cert:readFileSync(join(dir,'cert.pem'))},credentials,store:mail}).listen(0,'127.0.0.1');await once(server,'listening');
 const socket=connect({host:'127.0.0.1',port:server.address().port,rejectUnauthorized:false});let buffer='';socket.on('data',data=>buffer+=data.toString('latin1'));await once(socket,'secureConnect');
 let counter=0;
 async function command(text,sendLiteral){const tag='T'+(++counter);buffer='';socket.write(tag+' '+text+'\r\n');if(sendLiteral){for(let i=0;i<100&&!buffer.includes('+ Send message');i++)await new Promise(r=>setTimeout(r,10));assert.ok(buffer.includes('+ Send message'));socket.write(sendLiteral);socket.write('\r\n');}for(let i=0;i<150&&!new RegExp('(?:^|\\r\\n)'+tag+' (OK|NO|BAD)').test(buffer);i++)await new Promise(r=>setTimeout(r,10));return buffer;}
 try{
  assert.match(await command('SELECT INBOX'),/NO Authenticate/);
  assert.match(await command('LOGIN alice '+credential.password),/OK Authenticated/);
  assert.match(await command('SELECT INBOX'),/\* 1 EXISTS/);
  assert.match(await command('UID FETCH 1:* (UID FLAGS RFC822.SIZE ENVELOPE BODYSTRUCTURE BODY.PEEK[])'),/Hello IMAP/);assert.doesNotMatch(buffer,/Bob/);
  assert.match(await command('UID STORE 1:* +FLAGS (\\Seen)'),/\\Seen/);
  assert.match(await command('UID SEARCH UNSEEN'),/\* SEARCH \r\n/);
  assert.match(await command('UID MOVE 1:* Archive'),/OK MOVE/);assert.match(await command('SELECT Archive'),/\* 1 EXISTS/);
  assert.match(await command('APPEND Sent {'+raw.length+'}',raw),/OK APPEND/);assert.match(await command('SELECT Sent'),/\* 1 EXISTS/);
  assert.match(await command('UID STORE 1:* +FLAGS (\\Deleted)'),/OK STORE/);assert.match(await command('EXPUNGE'),/EXPUNGE/);assert.equal(mail.imapList('alice','Sent').length,0);
  credentials.revoke('alice',credential.id);assert.match(await command('UID FETCH 1:* (BODY[])'),/NO Authenticate/);
 }finally{socket.destroy();await new Promise(resolve=>server.close(resolve));mail.close();credentials.close();db.close();rmSync(dir,{recursive:true,force:true});}
});
