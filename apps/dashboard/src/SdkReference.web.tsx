import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, Code2, Copy, Database, FolderOpen, Globe2, KeyRound, Search, Settings2, UserRound, Workflow } from 'lucide-react';
import { groups, reference, sdkSource, type Reference } from './sdk-reference';
import './sdk-docs.css';

const root = '/docs/sdk';
const href = (entry: Reference) => root+'/'+entry.id;
const icons = {setup:Settings2, identity:KeyRound, profile:UserRound, data:Database, files:FolderOpen, components:Globe2, migration:Database, advanced:Code2};
const collections = Object.entries(groups).map(([group, label])=>({
  group:group as keyof typeof groups, label, entries:reference.filter(entry=>entry.group===group),
}));
const highlights = ['install', 'begin-sign-in', 'user-records-put', 'account-overview'];

export function SdkReferenceLink() {
  return <a className="xc-button xc-primary xc-self-start" href={root}><BookOpen size={17} aria-hidden="true"/> Browse SDK reference <ArrowRight size={16} aria-hidden="true"/></a>;
}

function CodeBlock({label, value, copy=false}:{label:string;value:string;copy?:boolean}) {
  const [status,setStatus]=useState('');
  async function copyExample(){
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Copied');
    } catch {
      setStatus('Select the code to copy it.');
    }
  }
  return <section className="xid-code">
    <div className="xid-code-head"><h2>{label}</h2>
      {copy&&<div><span aria-live="polite">{status}</span><button type="button" className="xc-button xc-secondary" onClick={()=>void copyExample()} aria-label={'Copy '+label.toLowerCase()} title="Copy example"><Copy size={16} aria-hidden="true"/></button></div>}
    </div>
    <pre tabIndex={0} aria-label={label}><code>{value}</code></pre>
  </section>;
}

function FlowDiagram({entry}:{entry:Reference}){
  const FeatureIcon=icons[entry.group];
  const steps=[{label:'Input',Icon:FeatureIcon},{label:'Operation',Icon:Workflow},{label:'Result',Icon:ArrowRight}];
  return <figure className="xid-flow">
    <figcaption>How it works</figcaption>
    <ol>{entry.flow.map((step,index)=>{
      const {label,Icon}=steps[index];
      return <li key={label}>
        <div className="xid-step"><span className={'xc-symbol xc-small '+(['xc-sky','xc-lavender','xc-mint'][index])}><Icon size={17} aria-hidden="true"/></span><small>{label}</small><strong>{step}</strong></div>
        {index<2&&<span className="xid-flow-arrow" aria-hidden="true"><ArrowRight className="xid-horizontal" size={18}/><ArrowDown className="xid-vertical" size={18}/></span>}
      </li>;
    })}</ol>
  </figure>;
}

function ReferenceArticle({entry}:{entry:Reference}){
  const related=reference.find(item=>item.id===entry.related);
  return <article className="xid-article" aria-labelledby="sdk-heading">
    <div className="xid-crumb"><a href={root}>SDK reference</a><span aria-hidden="true">/</span><a href={root+'#'+entry.group}>{groups[entry.group]}</a></div>
    <header className="xc-page-title"><h1 id="sdk-heading">{entry.title}</h1><code className="xid-signature">{entry.signature}</code><p>{entry.description}</p></header>
    {entry.access&&<div className="xid-access"><KeyRound size={16} aria-hidden="true"/><strong>Access</strong><span>{entry.access}</span></div>}
    <FlowDiagram entry={entry}/>
    <section aria-labelledby="sdk-arguments"><h2 id="sdk-arguments">Arguments and options</h2>
      {entry.args.length?<dl className="xid-args">{entry.args.map(([name,type,description])=><div key={name}>
        <dt><code>{name}</code><span>{type}</span></dt><dd>{description}</dd>
      </div>)}</dl>:<p>This call takes no arguments.</p>}
    </section>
    <CodeBlock label="Example" value={entry.example} copy/>
    <CodeBlock label="Sample output" value={entry.output}/>
    {entry.variants&&<section><h2>Platform notes</h2><p>{entry.variants}</p><a href={sdkSource+'/docs/CONFIGURATION.md'}>Platform configuration and package links</a></section>}
    {related&&<a className="xid-related" href={href(related)}><span><small>Related guide</small><strong>{related.title}</strong></span><ArrowRight size={19} aria-hidden="true"/></a>}
  </article>;
}

export default function SdkReference({slug}:{slug?:string}){
  const [query,setQuery]=useState('');
  const current=reference.find(entry=>entry.id===slug);
  const search=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching=collections.map(group=>({...group,entries:group.entries.filter(entry=>{
    const text=[group.label,entry.title,entry.signature,entry.description,entry.variants,entry.access].join(' ').toLowerCase();
    return search.every(word=>text.includes(word));
  })})).filter(group=>group.entries.length);
  return <div className="xid-doc-shell">
    <header className="xid-doc-header">
      <a className="xc-brand" href="/"><img src="/authnjs-icon.svg" alt=""/>X-Center <b>ID</b></a>
      <div><a href="/docs">Developer guides</a><a href="/developer">Developer portal <ArrowRight size={15} aria-hidden="true"/></a></div>
    </header>
    <div className="xid-doc-grid">
      <aside className="xid-doc-sidebar">
        <nav aria-label="SDK topics">
          <a className="xid-doc-index" href={root}><BookOpen size={17} aria-hidden="true"/> SDK reference</a>
          {collections.map(({group,label,entries})=>{
            const Icon=icons[group];
            return <details key={group} open={group===current?.group||undefined}>
              <summary><Icon size={16} aria-hidden="true"/>{label}</summary>
              <ul>{entries.map(entry=><li key={entry.id}><a href={href(entry)} aria-current={current?.id===entry.id?'page':undefined}>{entry.title}</a></li>)}</ul>
            </details>;
          })}
        </nav>
      </aside>
      <main className="xid-doc-main">
        {current?<ReferenceArticle key={current.id} entry={current}/>:slug?<div className="xc-page-title">
          <h1>Guide unavailable</h1><a className="xc-button xc-secondary" href={root}><ArrowLeft size={17} aria-hidden="true"/> SDK reference</a>
        </div>:<>
          <div className="xid-doc-hero">
            <div className="xc-page-title"><h1>X-Center ID SDK</h1><p>Install the SDK, sign users in, and work with their consented data. Every operation includes a flow diagram, arguments, an example, and sample output.</p></div>
            <Code2 className="xid-doc-hero-icon" size={68} strokeWidth={1.15} aria-hidden="true"/>
          </div>
          <label className="xid-doc-search"><Search size={20} aria-hidden="true"/><span className="xc-sr">Search SDK guides</span>
            <input type="search" placeholder="Search functions and guides" value={query} onChange={event=>setQuery(event.target.value)}/>
          </label>
          {!search.length&&<div className="xid-feature-links">
            {highlights.map(id=>reference.find(entry=>entry.id===id)!).map(entry=>{
              const Icon=icons[entry.group];
              return <a key={entry.id} href={href(entry)}><span className="xc-symbol xc-small xc-sky"><Icon size={17} aria-hidden="true"/></span>{entry.title}<ArrowRight size={16} aria-hidden="true"/></a>;
            })}
          </div>}
          <div className="xid-doc-results" aria-live="polite">
            {!matching.length&&<p>No guides match “{query.trim()}”.</p>}
            {matching.map(({group,label,entries})=>{
              const Icon=icons[group];
              return <section key={group} id={group}><h2><Icon size={20} aria-hidden="true"/>{label}</h2>
                <ul>{entries.map(entry=><li key={entry.id}><a href={href(entry)}><strong>{entry.title}</strong><code>{entry.signature}</code><ArrowRight size={16} aria-hidden="true"/></a></li>)}</ul>
              </section>;
            })}
          </div>
        </>}
        <footer className="xid-doc-footer"><a href={sdkSource}>SDK source · 0a03c74</a><a href="/docs#manual">Manual OpenID Connect guide</a></footer>
      </main>
    </div>
  </div>;
}
