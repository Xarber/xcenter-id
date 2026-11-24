import { BookOpen, Copy, HardDrive, KeyRound, Mail, ShieldCheck, Users, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import {currentRelease,releaseHistory,releaseOverview,releaseStatus,type Release} from './release-info';
import technicalNotes from './release-commits.json';

const icons={mail:Mail,people:Users,history:BookOpen,shield:ShieldCheck,key:KeyRound,storage:HardDrive};
const notes=technicalNotes as Record<string,{revision:string;commits:{id:string;title:string;detail:string}[]}>;

function Rows({rows}:{rows:string[][]}){
  return <ul className="xc-release-rows">{rows.map(([category,title,description])=>{
    const Icon=icons[category as keyof typeof icons]??BookOpen;
    return <li key={title+description}><Icon size={19} aria-hidden="true"/><div><strong>{title}</strong><p>{description}</p></div></li>;
  })}</ul>;
}

export function ReleaseArchive(){
  return <div className="xc-stack"><h1>Version history</h1>{releaseHistory.map(release=><article className="xc-card xc-pad xc-release-entry" key={release.version}>
    <h2>{release.version} · {release.title}</h2>
    <p>{releaseStatus(release)} · <time dateTime={release.date}>{release.date}</time></p>
    <Rows rows={releaseOverview(release)}/>
    <a href={'/changelog/'+release.version}>Full changelog</a>
  </article>)}</div>;
}

export function FullRelease({release}:{release:Release}){
  return <article className="xc-card xc-pad xc-release-entry">
    <a href="/changelog?from=settings">Version history</a>
    <h1>{release.version} · {release.title}</h1>
    <p>{releaseStatus(release)} · <time dateTime={release.date}>{release.date}</time></p>
    <Rows rows={release.features}/>
    {release.fixes.length>0&&<><h2>Fixes &amp; Improvements</h2><ul>{release.fixes.map(fix=><li key={fix}>{fix}</li>)}</ul></>}
  </article>;
}

export function DeveloperRelease({version}:{version:string}){
  const output=notes[version];
  const status=useRef<HTMLSpanElement>(null);
  if(!output)return null;
  async function copy(id:string){
    try{await navigator.clipboard.writeText(id);if(status.current)status.current.textContent='Copied commit ID';}
    catch{if(status.current)status.current.textContent='Could not copy commit ID';}
  }
  return <section className="xc-stack">
    <h3>Developer notes for {version}</h3>
    <p>Source commits, summaries and identifiers for this version.</p>
    <p>Recorded source revision <code>{output.revision}</code> <button className="xc-icon-link" aria-label="Copy source revision" onClick={()=>void copy(output.revision)}><Copy size={16}/></button></p>
    <span ref={status} role="status"/>
    {output.commits.map(commit=><article key={commit.id} className="xc-card xc-pad">
      <strong>{commit.title}</strong><p>{commit.detail}</p>
      <code>{commit.id}</code> <button className="xc-icon-link" aria-label={'Copy commit '+commit.id.slice(0,7)} onClick={()=>void copy(commit.id)}><Copy size={16}/></button>
    </article>)}
  </section>;
}

export default function ReleaseNotes({rows,close,openFull}:{rows:string[][];close:()=>void;openFull:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="xc-intro xc-release-dialog" aria-labelledby="release-heading" onCancel={event=>{event.preventDefault();close();}}>
    <button type="button" className="xc-close" aria-label="Close release notes" onClick={close}><X size={20}/></button>
    <img className="xc-intro-logo" src="/authnjs-icon.svg" alt="X-Center ID"/>
    <h2 id="release-heading">What’s new in {currentRelease.version}</h2>
    <Rows rows={rows}/>
    <div className="xc-actions"><button type="button" className="xc-button xc-secondary" onClick={openFull}>Full changelog</button>
      <button type="button" className="xc-button xc-primary" onClick={close}>Done</button></div>
  </dialog>;
}
