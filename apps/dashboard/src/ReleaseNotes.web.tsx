import { BookOpen, HardDrive, KeyRound, Mail, ShieldCheck, Users, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import {currentRelease,releaseHistory} from './release-info';

const icons={mail:Mail,people:Users,history:BookOpen,shield:ShieldCheck,key:KeyRound,storage:HardDrive};

export default function ReleaseNotes({mode,close,openHistory}:{mode:'latest'|'history';close:()=>void;openHistory:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  const latest=mode==='latest';
  return <dialog ref={dialog} className="xc-intro xc-release-dialog" aria-labelledby="release-heading" onCancel={event=>{event.preventDefault();close();}}>
    <button type="button" className="xc-close" aria-label="Close release notes" onClick={close}><X size={20}/></button>
    <h2 id="release-heading">{latest?'What’s new in '+currentRelease.version:'Version history'}</h2>
    {(latest?[currentRelease]:releaseHistory).map(release=><section key={release.version} className="xc-release-entry">
      {!latest&&<p>{'legacy' in release?'AuthNJS ':''}{release.version} · <time dateTime={release.date}>{release.date}</time></p>}
      <h3>{release.title}</h3>
      <ul>{release.features.map(([category,line])=>{
        const Icon=icons[category as keyof typeof icons]??BookOpen;
        return <li key={line}><Icon size={18} aria-hidden="true"/><span>{line}</span></li>;
      })}</ul>
      {release.fixes.length>0&&<><h4>Fixes &amp; improvements</h4>
        <ul>{release.fixes.map(line=><li key={line}><span>{line}</span></li>)}</ul></>}
    </section>)}
    {latest&&<div className="xc-actions"><button type="button" className="xc-button xc-secondary" onClick={openHistory}>View changelog</button>
      <button type="button" className="xc-button xc-primary" onClick={close}>Done</button></div>}
  </dialog>;
}
