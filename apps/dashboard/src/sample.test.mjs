import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sample } from './sample.ts';

test('sample records use unique identifiers and resolve both grant participants', () => {
  const records = Object.values(sample).flat();
  assert.equal(new Set(records.map(({ id }) => id)).size, records.length);
  assert.equal(sample.credentials.length, 2);
  for (const grant of sample.grants) {
    const [source, destination] = grant.title.split(' → ');
    assert.ok(sample.apps.some(({ title }) => title === source));
    assert.ok(sample.apps.some(({ title }) => title === destination));
  }
});
