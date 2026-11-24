import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deviceSignInUrl} from './device-link.ts';

test('device QR scanner accepts only a complete HTTPS issuer link and one valid code',()=>{
  const issuer='https://id.xcenter.it';
  assert.equal(deviceSignInUrl(issuer+'/device?code=bcdfgh',issuer),issuer+'/device?code=BCDFGH');
  for(const url of [
    'https://id.xcenter.it.example.com/device?code=BCDFGH',
    'https://id.xcenter.it@malicious.test/device?code=BCDFGH',
    issuer+'/device?code=BCDFGH&code=BCDFGH',
    issuer+'/device?code=ABC12!',
    issuer+'/devices?code=BCDFGH',
    issuer+'/device?code=BCDFGH#extra',
  ])assert.equal(deviceSignInUrl(url,issuer),null);
});

test('manual device input accepts a pasted code and rejects incomplete codes', async()=>{
  const {normalizeDeviceCode,isDeviceCode}=await import('./device-link.ts');
  assert.equal(normalizeDeviceCode('bc-df gh'),'BCDFGH');
  assert.equal(normalizeDeviceCode('bcdfghj'),'BCDFGH');
  assert.equal(isDeviceCode(normalizeDeviceCode('AB12')),false);
  assert.equal(normalizeDeviceCode('eI3-yuo'),'EI3YUO');
  assert.equal(normalizeDeviceCode('a01239'),'A01239');
  assert.equal(deviceSignInUrl('https://id.xcenter.it/device?code=ei3yuo','https://id.xcenter.it'),'https://id.xcenter.it/device?code=EI3YUO');
});
