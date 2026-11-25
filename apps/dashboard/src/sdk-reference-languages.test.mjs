import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reference } from './sdk-reference.ts';
import { exampleFor, languages, parseLanguage } from './sdk-reference-languages.ts';

const byId = new Map(reference.map(entry=>[entry.id,entry]));

test('all SDK pages have an exact-language example or an explicit availability explanation', () => {
  for (const entry of reference) {
    let supported=0;
    for (const language of Object.keys(languages)) {
      const view=exampleFor(entry,language);
      if ('unavailable' in view) {
        assert.ok(view.unavailable.trim(),entry.id);
        assert.doesNotMatch(view.unavailable,/This platform uses a different/,entry.id+' '+language);
        continue;
      }
      supported++;
      assert.ok(view.signature.trim()&&view.example.trim(),entry.id);
      for(const arg of view.args)assert.ok(arg.every(text=>text.trim()),entry.id);
      assert.equal(new Set(view.args.map(([name])=>name)).size,view.args.length,entry.id);
      if(language==='swift'||language==='kotlin'||language==='dart')
        assert.doesNotMatch(view.example,/from ["']@xcenter-id\/|window\.location|=>\s*\{/,entry.id);
    }
    assert.ok(supported>0,entry.id);
  }
});

test('file writes switch both argument type and call syntax across every language', () => {
  const upload=byId.get('upload-file');
  assert.match(exampleFor(upload,'javascript').example,/user\.files\.upload\(/);
  assert.match(exampleFor(upload,'typescript').example,/user\.files\.upload\(/);
  assert.match(exampleFor(upload,'swift').signature,/content: Data/);
  assert.match(exampleFor(upload,'swift').example,/try await user\.uploadFile\(name:/);
  assert.match(exampleFor(upload,'kotlin').signature,/content: ByteArray/);
  assert.match(exampleFor(upload,'kotlin').example,/withContext\(Dispatchers\.IO\)/);
  assert.match(exampleFor(upload,'dart').signature,/Uint8List content/);
  assert.match(exampleFor(upload,'dart').example,/Uint8List\.fromList/);
});

test('language values are controlled and a platform-only guide never displays the wrong snippet', () => {
  assert.equal(parseLanguage('kotlin'),'kotlin');
  assert.equal(parseLanguage('toString'),undefined);
  assert.equal(parseLanguage('swift><'),undefined);
  const handoff=byId.get('native-backend-handoff');
  assert.match(exampleFor(handoff,'swift').example,/authorizeWithPickup/);
  assert.ok('unavailable' in exampleFor(handoff,'dart'));
  assert.match(exampleFor(byId.get('user-records-put'),'typescript').example,/RecordWrite<Note>/);
});
