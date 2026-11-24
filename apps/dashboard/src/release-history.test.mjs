import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=await readFile(new URL('./release-info.ts',import.meta.url),'utf8');
const releases=JSON.parse(await readFile(new URL('./release-history.json',import.meta.url),'utf8'));
const moduleSource=stripTypeScriptTypes(source.replace(/^import .*?;\n/m,'').replace(/^export /gm,''));
const model=runInNewContext(moduleSource+'\n({releaseByVersion,releaseOverview,releaseAnnouncement})',{releases});

test('every legacy milestone has a full version entry and three or fewer archive highlights',()=>{
  assert.equal(new Set(releases.map(release=>release.version)).size,releases.length);
  for(const release of releases){
    assert.equal(model.releaseByVersion(release.version),release);
    assert.ok(model.releaseOverview(release).length<=3);
    assert.ok(release.features.every(row=>row.length===3&&row.every(Boolean)));
  }
  assert.ok(model.releaseByVersion('0.10.0').features.length>3);
});

test('same marketing version suppresses the announcement and skipped versions contribute highlights',()=>{
  assert.equal(model.releaseAnnouncement(releases[0].version).length,0);
  assert.equal(model.releaseAnnouncement('0.11.0').length,3);
  const freshOverview=model.releaseAnnouncement(null);
  assert.ok(freshOverview.length>=1&&freshOverview.length<=3);
  assert.equal(JSON.stringify(freshOverview),JSON.stringify(model.releaseOverview(releases[0])));
});
