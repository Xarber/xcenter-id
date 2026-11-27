import assert from 'node:assert/strict';
import {test} from 'node:test';
import {groups, reference} from './sdk-reference.ts';

test('every SDK reference has a unique deep link, diagram, argument metadata and samples', () => {
  const ids = new Set(reference.map(entry => entry.id));
  assert.equal(ids.size, reference.length);
  assert.ok(reference.length >= 60);
  for (const group of Object.keys(groups)) assert.ok(reference.some(entry => entry.group === group), group);
  for (const entry of reference) {
    assert.match(entry.id, /^[a-z0-9-]{1,60}$/);
    assert.equal(entry.flow.length, 3);
    for (const text of [entry.title, entry.signature, entry.description, entry.example, entry.output, ...entry.flow]) assert.ok(text.trim(), entry.id);
    assert.equal(new Set(entry.args.map(([name]) => name)).size, entry.args.length, entry.id);
    for (const arg of entry.args) assert.ok(arg.every(text => text.trim()), entry.id);
    if (entry.related) assert.ok(ids.has(entry.related), entry.related);
  }
});

test('each records credential has a complete documented surface', () => {
  const index = new Map(reference.map(entry => [entry.id, entry]));
  for (const area of ['user', 'service', 'shared', 'public']) {
    for (const action of ['list', 'get', 'put', 'delete']) {
      const entry = index.get(area+'-records-'+action);
      if (area==='shared'||area==='public') assert.equal(Boolean(entry), action==='list'||action==='get');
      else assert.ok(entry);
      if (entry&&action==='list') assert.equal(JSON.parse(entry.output).nextCursor, null);
      if (entry&&action==='put') assert.ok(entry.args.some(([name])=>name==='options.revision'));
    }
  }
});

test('backup reference exposes IDs and manifest fingerprints without the old product dataset',()=>{
  const byId=new Map(reference.map(entry=>[entry.id,entry]));
  const created=JSON.parse(byId.get('create-app-backup').output);
  const listed=JSON.parse(byId.get('list-app-backups').output).snapshots[0];
  assert.match(created.id,/^[0-9a-f-]{36}$/);
  assert.match(created.sha256,/^[0-9a-f]{64}$/);
  assert.deepEqual(listed,created);
  assert.ok(byId.has('app-backup-management-url'));
  assert.ok(!reference.some(entry=>entry.id.startsWith('saved-places-')));
});
