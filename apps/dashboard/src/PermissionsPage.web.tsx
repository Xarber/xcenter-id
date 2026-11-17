import { ArrowDownLeft, ArrowLeft, ArrowUpRight, ChevronRight, FolderKey, Grid2X2, LockKeyhole, MapPin, NotebookPen, ShieldCheck, X } from 'lucide-react';
import { useEffect,useState } from 'react';
import { api } from './web-account';

type App = { client:string; name:string };
type Grant = { source:string; destination:string; expires:number; dataset:string };
type SamplePermission = { source:string;destination:string;sourceName:string;app:string;shared:boolean;expires:number|null };
type Permissions = {apps:App[];linked:App[];grants:Grant[];samples:SamplePermission[]};
const duration=(expiry:number)=>expiry===Number.MAX_SAFE_INTEGER?'Until revoked':'Expires '+new Date(expiry).toLocaleString();
const appPath=(client:string)=>'/permissions/'+encodeURIComponent(client);
const appIcon=(client:string)=>/trips|places/.test(client)?MapPin:/notes/.test(client)?NotebookPen:Grid2X2;

export default function PermissionsPage({client}: {client?:string}) {
  const [state,setState]=useState<Permissions|null>(null);
  const [source,setSource]=useState('');
  const [persistent,setPersistent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');

  async function load(){
    const [registered,linked,assigned,example]=await Promise.all([api('apps'),api('connected-apps'),api('data-grants'),api('sample-grants')]);
    setState({
      apps:registered.apps,
      linked:linked.apps.map((app:{client:string;label:string})=>({client:app.client,name:app.label})),
      grants:assigned.grants.filter((grant:Grant)=>grant.dataset==='saved-place.v1'),
      samples:example.permissions,
    });
  }

  function refresh(){
    setError('');
    void load().catch(()=>setError('Permissions are temporarily unavailable.'));
  }
  useEffect(refresh,[]);

  async function change(path:string,method:'PUT'|'DELETE',from:string,to:string,keep=false){
    setBusy(true);setError('');setStatus('');
    try{
      await api(path,{source:from,destination:to,expires:Date.now()+86400_000,persistent:keep},method);
      await load();
      setStatus(method==='DELETE'?'Access revoked.':'Permission granted.');
    }catch(failure){setError(failure instanceof Error?failure.message:'Could not update this permission.');}
    finally{setBusy(false);}
  }

  if(!state)return <section className="xc-card xc-pad" aria-label="Permissions status">
    {error?<><p role="alert">{error}</p><button className="xc-button xc-secondary" onClick={refresh}>Try again</button></>:<p role="status">Loading apps…</p>}
  </section>;

  const directory=new Map([...state.apps,...state.samples.map(item=>({client:item.destination,name:item.app})),...state.linked].map(app=>[app.client,app]));
  const appName=(id:string)=>directory.get(id)?.name??id;
  const linked=new Set(state.linked.map(app=>app.client));
  const byName=(a:App,b:App)=>Number(linked.has(b.client))-Number(linked.has(a.client))||a.name.localeCompare(b.name);

  if(!client)return <section className="xc-permission-directory" aria-label="Apps">
    {[...directory.values()].sort(byName).map(app=>{
      const Icon=appIcon(app.client);
      const sample=state.samples.some(item=>item.destination===app.client);
      const allowed=state.grants.filter(item=>item.destination===app.client).length
        +state.samples.filter(item=>item.destination===app.client&&item.expires).length;
      return <a className="xc-card xc-permission-link" key={app.client} href={appPath(app.client)}>
        <span className="xc-symbol xc-lavender"><Icon size={21}/></span>
        <span className="xc-permission-name"><strong>{app.name}</strong>
          <span>{allowed?allowed+' active '+(allowed===1?'permission':'permissions'):linked.has(app.client)?'Linked':sample?'Test app':'Registered app'}</span>
        </span><ChevronRight className="xc-permission-chevron" size={20} aria-hidden="true"/>
      </a>;
    })}
    {directory.size===0&&<div className="xc-empty">No apps are available to manage.</div>}
  </section>;

  const selected=directory.get(client);
  const back=<a className="xc-permission-back" href="/permissions"><ArrowLeft size={16} aria-hidden="true"/> All apps</a>;
  if(!selected)return <>{back}<section className="xc-card xc-pad"><h2>App unavailable</h2><p>Choose an app from the permissions list.</p></section></>;
  const Icon=appIcon(client);
  const incoming=state.grants.filter(item=>item.destination===client);
  const outgoing=state.grants.filter(item=>item.source===client);
  const incomingSamples=state.samples.filter(item=>item.destination===client);
  const outgoingSamples=state.samples.filter(item=>item.source===client);
  const sources=state.apps.filter(app=>app.client!==client&&!incoming.some(item=>item.source===app.client));
  function savedPlaces(grant:Grant,other:string){
    return <div className="xc-list-row xc-permission-row" key={grant.source+grant.destination}>
      <div className="xc-row-head"><MapPin size={18} aria-hidden="true"/><div><strong>{appName(other)}</strong>
        <p>Saved places · Read only · {duration(grant.expires)}</p></div></div>
      <button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>void change('data-grants','DELETE',grant.source,grant.destination)}>
        <X size={15} aria-hidden="true"/> Revoke access
      </button>
    </div>;
  }
  function sampleAccess(item:SamplePermission,out=false){
    return <div className="xc-list-row xc-permission-row" key={item.source+item.destination}>
      <div className="xc-row-head"><span className="xc-symbol xc-small xc-sky">
        {item.shared?<FolderKey size={17} aria-hidden="true"/>:<NotebookPen size={17} aria-hidden="true"/>}</span>
        <div><strong>{out?item.app:item.sourceName}</strong><p>{item.shared?'Shared folder · Read and write':'Notes · Read only'}
          {item.expires?' · '+duration(item.expires):' · No access'}</p></div>
      </div>
      <div className="xc-actions">
        <button type="button" className="xc-button xc-secondary" disabled={busy}
          onClick={()=>void change('sample-grants',item.expires?'DELETE':'PUT',item.source,item.destination)}>
          {item.expires?'Revoke access':'Allow for one hour'}
        </button>
        {!item.expires&&<button type="button" className="xc-button xc-primary" disabled={busy}
          onClick={()=>void change('sample-grants','PUT',item.source,item.destination,true)}>Allow until revoked</button>}
      </div>
    </div>;
  }

  return <>
    {back}
    <section className="xc-card xc-pad xc-permission-heading">
      <span className="xc-symbol xc-lavender"><Icon size={24} aria-hidden="true"/></span>
      <div><h2>{selected.name}</h2><p>{linked.has(client)?'Linked to your X-Center ID':'Manage what this app can share or access.'}</p></div>
    </section>
    <section className="xc-card xc-pad">
      <div className="xc-row-head"><ArrowDownLeft size={20} aria-hidden="true"/><h2>Data this app can access</h2></div>
      {incoming.map(grant=>savedPlaces(grant,grant.source))}
      {incomingSamples.map(item=>sampleAccess(item))}
      {incoming.length===0&&incomingSamples.length===0&&<div className="xc-empty"><LockKeyhole size={17} aria-hidden="true"/> No incoming data access.</div>}
      {state.apps.some(app=>app.client===client)&&sources.length>0&&<form className="xc-inline-form" onSubmit={event=>{
        event.preventDefault();
        if(source)void change('data-grants','PUT',source,client,persistent);
      }}>
        <label>Share saved places from<select value={source} onChange={event=>setSource(event.target.value)}>
          <option value="">Choose app</option>{sources.map(app=><option key={app.client} value={app.client}>{app.name}</option>)}</select></label>
        <label>Duration<select value={persistent?'persistent':'day'} onChange={event=>setPersistent(event.target.value==='persistent')}>
          <option value="day">One day</option><option value="persistent">Until revoked</option></select></label>
        <button className="xc-button xc-primary" disabled={busy||!source||!sources.some(app=>app.client===source)}>
          <ShieldCheck size={16} aria-hidden="true"/> Allow access</button>
      </form>}
    </section>
    <section className="xc-card xc-pad">
      <div className="xc-row-head"><ArrowUpRight size={20} aria-hidden="true"/><h2>Data shared from this app</h2></div>
      {outgoing.map(grant=>savedPlaces(grant,grant.destination))}
      {outgoingSamples.map(item=>sampleAccess(item,true))}
      {outgoing.length===0&&outgoingSamples.length===0&&<div className="xc-empty">No outgoing data access.</div>}
    </section>
    <div role="status">{status&&<p className="xc-notice">{status}</p>}</div>
    {error&&<p className="xc-notice" role="alert">{error}</p>}
  </>;
}
