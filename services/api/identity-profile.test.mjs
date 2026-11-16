import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateProfile } from './identity-profile.mjs';

test('identity validates age bands and reserves service and operator-owned usernames', () => {
  const input = { username: 'TheExample', givenName: 'Ada', surname: 'Rossi', ageRange: 'adult' };
  assert.deepEqual(validateProfile(input), { ...input, username: 'theexample' });
  for (const username of ['SUPPORT', 'xarber', 'schoolmanager', 'postmaster', 'pathway', 'echo']) {
    assert.equal(validateProfile({ ...input, username }).error, 'This username is unavailable.');
  }
  assert.equal(validateProfile(input, ['theexample']).error, 'This username is unavailable.');
  assert.ok(validateProfile({ ...input, ageRange: 'unknown' }).error);
});
