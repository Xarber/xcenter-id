import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { openNativeSession } from './native-session.mjs';
import { openEmailSignIn } from './email-signin.mjs';

const key=()=>randomBytes(32).toString('base64url');
const challenge=(value)=>createHash('sha256').update(value).digest('base64url');
function database(){
  const db=new DatabaseSync(':memory:');
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE accounts(id TEXT PRIMARY KEY); INSERT INTO accounts VALUES ('account'); CREATE TABLE account_sessions(hash TEXT PRIMARY KEY); INSERT INTO account_sessions VALUES ('browser');");
  return db;
}

test('app handoff requires the exact verifier and state, and can only be redeemed once',()=>{
  const db=database();
  const sessions=openNativeSession(db);
  const verifier=key(), state=key();
  const redirect=new URL(sessions.issue('browser',challenge(verifier),state));
  const code=redirect.searchParams.get('code');
  assert.equal(redirect.protocol,'authnjs-dashboard:');
  assert.equal(sessions.exchange({code,verifier:key(),state}),null);
  assert.equal(sessions.exchange({code,verifier,state:key()}),null);
  assert.equal(sessions.exchange({code,verifier,state}),'browser');
  assert.equal(sessions.exchange({code,verifier,state}),null);
  assert.equal(sessions.accepts('browser'),false);
  sessions.bind('browser');
  assert.equal(sessions.accepts('browser'),true);
  db.close();
});

test('email sign-in is delivery-dependent, rate-limited, channel-bound and single-use',async()=>{
  const db=database();
  const sent=[];
  const email=openEmailSignIn(db,{send:async item=>sent.push(item),secret:randomBytes(32)});
  const {ticket}=await email.start('account','qa@example.test','native');
  assert.equal((await email.start('account','qa@example.test','native')).status,429);
  const {code}=sent[0];
  assert.match(code,/^\d{6}$/);
  assert.equal(email.finish(ticket,code,'web'),null);
  assert.equal(email.finish(ticket,code,'native'),'account');
  assert.equal(email.finish(ticket,code,'native'),null);
  assert.equal((await openEmailSignIn(db,{secret:randomBytes(32)}).start('account','qa@example.test','web')).status,503);
  db.close();
});

test('native device browser handoff is single use, expires and depends on the upstream session',async()=>{
  const {openNativeDeviceHandoff}=await import('./native-device.mjs');
  const db=database();
  let time=1000;
  const flow=openNativeDeviceHandoff(db,()=>time);
  try{
    assert.equal(flow.issue('browser','INVALID'),null);
    const revoked=flow.issue('browser','ABCD23');
    assert.equal(flow.exchange(revoked,()=>false),null);
    assert.equal(flow.exchange(revoked,()=>true),null);
    const proof=flow.issue('browser','ABCD23');
    assert.equal(flow.exchange('invalid',()=>true),null);
    const session=flow.exchange(proof,hash=>hash==='browser');
    assert.equal(session.code,'ABCD23');
    assert.equal(flow.browserSession(session.key),'browser');
    assert.equal(flow.exchange(proof,()=>true),null);
    time+=61_000;
    assert.equal(flow.browserSession(session.key),'browser');
    const next=flow.issue('browser','ABCD23');
    time+=61_000;
    assert.equal(flow.exchange(next,()=>true),null);
    db.prepare('DELETE FROM account_sessions WHERE hash=?').run('browser');
    assert.equal(flow.browserSession(session.key),null);
  }finally{db.close();}
});

test('native app approvals retain the signed-in account only for the exact review URL',async()=>{
  const {openNativeDeviceHandoff}=await import('./native-device.mjs');
  const db=new DatabaseSync(':memory:');
  try{
    db.exec("PRAGMA foreign_keys=ON; CREATE TABLE account_sessions(hash TEXT PRIMARY KEY); INSERT INTO account_sessions VALUES ('signed-in')");
    const store=openNativeDeviceHandoff(db);
    const target='/app-approval/'+'a'.repeat(43);
    const ticket=store.issue('signed-in',target);
    const exchanged=store.exchange(ticket,()=>true);
    assert.equal(exchanged.code,target);
    assert.equal(store.browserSession(exchanged.key,target),'signed-in');
    assert.equal(store.browserSession(exchanged.key,'/app-approval/'+'b'.repeat(43)),null);
    assert.equal(store.browserSession(exchanged.key),null);
    assert.equal(store.exchange(ticket,()=>true),null);
  }finally{db.close();}
});
