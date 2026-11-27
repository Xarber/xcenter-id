import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initializeSandbox,validateSandbox} from './sandbox-config.mjs';

test('sandbox rejects production origins, state, credentials and integrated services',t=>{
  const root=mkdtempSync(join(tmpdir(),'xid-sandbox-fixture-'));
  t.after(()=>rmSync(root,{force:true,recursive:true}));
  const first={state:join(root,'data-a'),output:join(root,'secrets-a','oidc.json'),origin:'https://localhost:3443'};
  const second={state:join(root,'data-b'),output:join(root,'secrets-b','oidc.json'),origin:'https://id-sandbox.xcenter.it'};
  initializeSandbox(first);
  initializeSandbox(second);
  const read=paths=>JSON.parse(readFileSync(paths.output,'utf8'));
  const config=read(first),other=read(second);
  const env={AUTHNJS_SANDBOX:'1',AUTHNJS_ACCOUNT_ORIGIN:first.origin,AUTHNJS_DATA_DIR:first.state};
  assert.equal(validateSandbox(config,env),true);
  assert.notEqual(config.storageKey,other.storageKey);
  assert.notEqual(config.jwks.keys[0].n,other.jwks.keys[0].n);
  assert.throws(()=>validateSandbox(config,{}),/for the sandbox/);
  assert.throws(()=>validateSandbox(config,{...env,AUTHNJS_DATA_DIR:second.state}),/do not match/);
  assert.throws(()=>validateSandbox(config,{...env,AUTHNJS_MAIL_CONFIG:'configured'}),/production integrations/);
  assert.throws(()=>validateSandbox({environment:'production'},env),/independently generated/);
  assert.throws(()=>initializeSandbox({...second,origin:'https://id.xcenter.it'}),/dedicated sandbox/);
  writeFileSync(join(first.state,'accounts.sqlite'),'old state fixture');
  assert.throws(()=>initializeSandbox(first),/empty state/);
});
