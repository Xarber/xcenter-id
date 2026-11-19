import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

const root = new URL('../', import.meta.url);
const releases = JSON.parse(readFileSync(new URL('apps/dashboard/src/release-history.json', root), 'utf8'));
const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8'}).trim();
const heading = [
  '# X-Center ID changelog',
  '',
  'This history covers the original AuthNJS source and the X-Center ID rewrite. X-Center ID uses its own 0.x series.',
  'Versions were assigned retrospectively to source milestones. Deployment and native publication are tracked separately.',
  'Each entry below includes the actual commits in its range. The current version includes the work under this release entry.',
  '',
].join('\n');
const sections = releases.map((release, index) => {
  const previous = releases[index+1];
  const range = previous ? previous.revision+'..'+release.revision : release.revision;
  const changes = git('log', '--reverse', '--format=%h %s', ...(previous ? [] : ['-1']), range)
    .split('\n').filter(Boolean).map(line => '- `'+line.slice(0,7)+'` '+line.slice(8));
  return [
    '## '+(release.legacy?'AuthNJS ':'')+release.version+' · '+release.date,
    '', '### '+release.title, '',
    ...release.features.map(([, item])=>'- '+item),
    '', ...(release.fixes.length ? ['### Fixes & improvements','', ...release.fixes.map(item=>'- '+item),''] : []),
    '<details>', '<summary>Source changes</summary>', '', ...changes, '', '</details>', '',
  ].join('\n');
});
writeFileSync(new URL('CHANGELOG.md', root), heading+'\n'+sections.join('\n'));
