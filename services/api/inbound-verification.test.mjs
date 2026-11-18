import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {dkimSign} from 'mailauth/lib/dkim/sign';
import nodemailer from 'nodemailer';
import {once} from 'node:events';
import {createInboundServer} from './smtp-inbound.mjs';
import {createAccounts} from './accounts.mjs';
import {openInboundVerification} from './inbound-verification.mjs';

test('inbound verification authenticates signed sender, code, full body and single use',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'xcenter-inbound-'));
  const path=join(directory,'accounts.sqlite');
  createAccounts({database:path,origin:'https://id.example.test'});
  const db=new DatabaseSync(path);
  db.exec("INSERT INTO accounts VALUES('owner','Fixture',0),('other','Other',0)");
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const key=publicKey.export({type:'spki',format:'der'}).toString('base64');
  const resolve=async(name,type)=>{
    if(type==='TXT'&&name==='fixture._domainkey.example.net')return [['v=DKIM1; k=rsa; p='+key]];
    if(type==='TXT'&&name==='_dmarc.example.net')return [['v=DMARC1; p=reject']];
    if(type==='TXT'&&name==='example.net')return [['v=spf1 ip4:203.0.113.10 -all']];
    throw Object.assign(new Error('No record'),{code:'ENOTFOUND'});
  };
  const inbox=openInboundVerification(path,{enabled:true,resolver:resolve});
  const disabled=openInboundVerification(path);
  const transport=nodemailer.createTransport({streamTransport:true,buffer:true});
  const peer={ip:'203.0.113.10',helo:'smtp.example.net',sender:'sender@example.net'};
  try{
    assert.equal(disabled.start('owner','sender@example.net').status,503);
    const proposal=inbox.start('owner','sender@example.net');
    assert.equal(proposal.ok,true);
    const draft=new URL(proposal.mailto);
    assert.equal(draft.pathname,'verify@mail.xcenter.it');
    const {message}=await transport.sendMail({from:'sender@example.net',to:draft.pathname,
      subject:draft.searchParams.get('subject'),text:draft.searchParams.get('body')});
    const signed=async(raw,options={})=>{
      const {signatures}=await dkimSign(raw,{signatureData:[{signingDomain:'example.net',selector:'fixture',
        privateKey:privateKey.export({type:'pkcs8',format:'pem'}),...options}]});
      return Buffer.concat([Buffer.from(signatures),raw]);
    };
    assert.equal(await inbox.receive(message,peer),false);
    assert.equal(await inbox.receive(Buffer.concat([Buffer.from('Authentication-Results: mail.xcenter.it; dmarc=pass; dkim=pass\r\n'),message]),peer),false);
    const good=await signed(message);
    assert.equal(await inbox.receive(Buffer.from(good.toString().replace('sender@example.net','other@example.net')),peer),false);
    assert.equal(await inbox.receive(Buffer.from(good.toString().replace('Verification code:','Tampered code:')),peer),false);
    const expiration=db.prepare('SELECT expires FROM inbound_verifications WHERE owner=?').get('owner').expires;
    db.prepare('UPDATE inbound_verifications SET expires=0 WHERE owner=?').run('owner');
    assert.equal(await inbox.receive(good,peer),false);
    db.prepare('UPDATE inbound_verifications SET expires=? WHERE owner=?').run(expiration,'owner');
    assert.equal(db.prepare('SELECT count(*) AS n FROM verified_emails').get().n,0);
    assert.equal(await inbox.receive(good,peer),true);
    assert.equal(db.prepare('SELECT owner FROM verified_emails WHERE address=?').get('sender@example.net').owner,'owner');
    assert.equal(await inbox.receive(good,peer),false);
    assert.equal(inbox.pending('owner'),null);
    assert.equal(inbox.start('other','sender@example.net').status,409);
    const second=new URL(inbox.start('other','other@example.net').mailto);
    const {message:raw}=await transport.sendMail({from:'other@example.net',to:second.pathname,
      subject:second.searchParams.get('subject'),text:second.searchParams.get('body')});
    const server=createInboundServer({name:'fixture.test',store:{resolveRecipient:()=>null,receive:()=>false},
      verification:inbox,tls:{disabledCommands:['STARTTLS','AUTH']}});
    server.listen(0,'127.0.0.1');await once(server.server,'listening');
    try{
      const smtp=nodemailer.createTransport({host:'127.0.0.1',port:server.server.address().port,ignoreTLS:true});
      await smtp.sendMail({envelope:{from:'other@example.net',to:['verify@mail.xcenter.it']},raw:await signed(raw)});
      assert.equal(db.prepare('SELECT owner FROM verified_emails WHERE address=?').get('other@example.net').owner,'other');
    }finally{await new Promise(resolve=>server.close(resolve));}
  }finally{inbox.close();disabled.close();db.close();rmSync(directory,{recursive:true,force:true});}
});
