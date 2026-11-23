import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

const root = new URL('../', import.meta.url);
const releases = JSON.parse(readFileSync(new URL('apps/dashboard/src/release-history.json', root), 'utf8'));
const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8'}).trim();
const revisions = releases.map(release=>git('rev-parse','--verify',release.revision+'^{commit}'));
const technicalNotes = {};
const heading = [
  '# X-Center ID changelog',
  '',
  'This archive covers the original AuthNJS source and the X-Center ID rewrite. Earlier entries reconstruct source milestones. Development entries identify unreleased work. There are no published GitHub releases in this history.',
  'Deployment and native build evidence are recorded in [release documentation](docs/RELEASES.md).',
  '',
].join('\n');

const sections = releases.map((release, index) => {
  const previous = revisions[index+1];
  const revision = revisions[index];
  if(previous)git('merge-base','--is-ancestor',previous,revision);
  const ids = git('rev-list','--reverse',previous?previous+'..'+revision:revision).split('\n').filter(Boolean);
  technicalNotes[release.version] = {
    revision,
    commits:ids.map(id=>{
      const [title,body] = git('show','-s','--format=%s%x00%b',id).split('\0');
      const paths = body?[]:git('diff-tree','--root','--no-commit-id','--name-only','-r',id).split('\n').filter(Boolean);
      const areas = [...new Set(paths.map(path=>path.split('/').slice(0,2).join('/')))];
      const detail = body || (areas.length?'Changed areas: '+areas.slice(0,6).join(', ')+(areas.length>6?' and '+(areas.length-6)+' more':'')+'.':'');
      return {id,title,detail};
    }),
  };
  return [
    '## '+(release.legacy?'AuthNJS ':'')+release.version+' · '+release.date,
    '', release.status, '', '### '+release.title, '',
    ...release.features.map(([, title, item])=>'- **'+title+'**. '+item),
    '', ...(release.fixes.length ? ['### Fixes & Improvements','', ...release.fixes.map(item=>'- '+item),''] : []),
  ].join('\n');
});
for(const [path,data] of [
  ['CHANGELOG.md',heading+'\n'+sections.join('\n')],
  ['apps/dashboard/src/release-commits.json',JSON.stringify(technicalNotes,null,2)+'\n'],
]){
  const target=new URL(path,root);
  if(process.argv.includes('--check')){
    if(readFileSync(target,'utf8')!==data)throw new Error(path+' is stale');
  }else writeFileSync(target,data);
}
