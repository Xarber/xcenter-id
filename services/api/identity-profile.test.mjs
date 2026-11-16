import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ageRangeFromBirthday, validateProfile } from './identity-profile.mjs';

test('uses UTC calendar birthdays for age bands, rejects impossible and future dates', () => {
  const today = new Date('2026-11-16T00:00:00Z');
  assert.equal(ageRangeFromBirthday('2013-11-17',today),'child');
  assert.equal(ageRangeFromBirthday('2013-11-16',today),'teen');
  assert.equal(ageRangeFromBirthday('2008-11-17',today),'teen');
  assert.equal(ageRangeFromBirthday('2008-11-16',today),'adult');
  assert.equal(ageRangeFromBirthday('2026-11-17',today),null);
  assert.equal(ageRangeFromBirthday('2007-02-29',today),null);
});

test('reserves service and operator-owned usernames and ignores caller-supplied age band', () => {
  const input = { username:'TheExample',givenName:'Ada',surname:'Rossi',birthday:'1989-04-08',ageRange:'child' };
  assert.deepEqual(validateProfile(input),{...input,username:'theexample',ageRange:'adult'});
  for (const username of ['SUPPORT','xarber','schoolmanager','postmaster','pathway','echo','harmony','openrecode']) {
    assert.equal(validateProfile({...input,username}).error,'This username is unavailable.');
  }
  assert.equal(validateProfile(input,['theexample']).error,'This username is unavailable.');
});
