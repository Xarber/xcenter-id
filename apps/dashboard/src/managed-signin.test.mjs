import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeIOSBackend} from '../../../packages/expo/backend-signin.ts';
import {matchesNativeCallback,webSignInUrl} from '../../../packages/expo/managed-signin-urls.ts';

test('managed web sign-in starts at a same-origin HTTPS backend route',()=>{
  const origin='https://app.example.test';
  assert.equal(webSignInUrl('/sign-in/xcenter?returnTo=%2Fsettings',origin),origin+'/sign-in/xcenter?returnTo=%2Fsettings');
  for(const bad of ['//other.example.test/start','/\\other.example.test/start','https://app.example.test/start','/start#state']){
    assert.throws(()=>webSignInUrl(bad,origin),/same-origin/);
  }
  assert.throws(()=>webSignInUrl('/sign-in','http://app.example.test'),/HTTPS/);
});

test('managed native browser must return to the exact registered callback',()=>{
  const redirect='https://app.example.test/oidc/callback';
  assert.equal(matchesNativeCallback(redirect+'?code=value&state=saved',redirect),true);
  assert.equal(matchesNativeCallback('https://other.example.test/oidc/callback?code=value',redirect),false);
  assert.equal(matchesNativeCallback('https://app.example.test/oidc/another?code=value',redirect),false);
  assert.equal(matchesNativeCallback('http://app.example.test/oidc/callback?code=value',redirect),false);
  assert.equal(matchesNativeCallback(redirect+'?code=value#fragment',redirect),false);
});

test('managed iOS backend handoff closes the sheet after session persistence',async()=>{
  const events=[];
  let resolveBrowser;
  await authorizeIOSBackend({
    begin:async()=>({
      url:'https://app.example.test/sign-in',
      complete:async signal=>{assert.equal(signal.aborted,false);events.push('saved');},
    }),
  },url=>{
    events.push(url);
    return new Promise(resolve=>{resolveBrowser=resolve;});
  },()=>{
    events.push('closed');
    resolveBrowser();
  });
  assert.deepEqual(events,['https://app.example.test/sign-in','saved','closed']);
});

test('closing the iOS sheet cancels product session polling',async()=>{
  let cancelled=false;
  await authorizeIOSBackend({
    begin:async()=>({
      url:'https://app.example.test/sign-in',
      complete:signal=>new Promise(resolve=>signal.addEventListener('abort',()=>{
        cancelled=true;
        resolve();
      },{once:true})),
    }),
  },async()=>{},()=>assert.fail('the system already closed the sheet'));
  assert.equal(cancelled,true);
});
