import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasPendingDelivery } from './email-verification-status.ts';

test('Check delivery needs an unexpired incoming message or outgoing link', () => {
  const address='pending@example.test';
  const initial={enabled:true,canSendLink:true,pending:null,outgoing:null,result:null,emails:[{address,verified:0}]};
  assert.equal(hasPendingDelivery(null,100),false);
  assert.equal(hasPendingDelivery(initial,100),false);
  assert.equal(hasPendingDelivery({...initial,result:{address,status:'superseded'}},100),false);
  assert.equal(hasPendingDelivery({...initial,pending:{address,expires:100}},100),false);
  assert.equal(hasPendingDelivery({...initial,pending:{address,expires:101}},100),true);
  assert.equal(hasPendingDelivery({...initial,outgoing:{address,expires:101}},100),true);
});
