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
    issuer+'/device?code=ABC123',
    issuer+'/devices?code=BCDFGH',
    issuer+'/device?code=BCDFGH#extra',
  ])assert.equal(deviceSignInUrl(url,issuer),null);
});
