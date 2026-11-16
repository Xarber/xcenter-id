import { ArrowRight, FolderKey, Layers3, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { useEffect,useState } from 'react';
import { api } from './web-account';

type App = { client:string; name:string };
type Grant = { source:string; destination:string; expires:number; dataset:string };
type SamplePermission = { source:string;destination:string;sourceName:string;app:string;shared:boolean;expires:number|null };

export default function PermissionsPage() {
  const [apps,setApps]=useState<App[]>([]);
  const [grants,setGrants]=useState<Grant[]>([]);
  const [samples,setSamples]=useState<SamplePermission[]>([]);
  const [source,setSource]=useState('');
  const [destination,setDestination]=useState('');
  const [notice,setNotice]=useState('');
  const [persistent,setPersistent]=useState(false);
  const [busy,setBusy]=useState(false);

  async function load() {
    const [registered,assigned,example] = await Promise.all([api('apps'),api('data-grants'),api('sample-grants')]);
    setApps(registered.apps);setGrants(assigned.grants.filter((grant:Grant)=>grant.dataset==='saved-place.v1'));
    setSamples(example.permissions);
  }
  useEffect(()=>{void load().catch(()=>setNotice('Permissions are temporarily unavailable.'));},[]);
  async function change(path:string,method:'PUT'|'DELETE',from:string,to:string,keep=false) {
    setBusy(true);setNotice('');
    try {
      await api(path,{source:from,destination:to,expires:Date.now()+86400_000,persistent:keep},method);
      await load();setNotice(method==='DELETE'?'Access revoked.':'Permission granted.');
    } catch(error){setNotice(error instanceof Error?error.message:'Could not update this permission.');}
    finally{setBusy(false);}
  }
  const duration = (expiry:number) => expiry===Number.MAX_SAFE_INTEGER?'Until revoked':'Expires '+new Date(expiry).toLocaleString();
  const appName = (id:string) => apps.find(app=>app.client===id)?.name ?? id;
  return <>
    <section className="xc-card xc-pad">
      <div className="xc-row-head"><span className="xc-symbol xc-mint"><LockKeyhole size={21}/></span>
        <div><h2>Connected app access</h2><p>Only you can change which apps can read your data.</p></div></div>
      {grants.length ? grants.map(grant=><div className="xc-list-row" key={grant.source+grant.destination}>
        <div><strong>{appName(grant.source)} <ArrowRight size={14}/> {appName(grant.destination)}</strong>
        <p>Saved places · Read access · {duration(grant.expires)}</p></div>
        <button className="xc-button xc-secondary" disabled={busy} onClick={()=>void change('data-grants','DELETE',grant.source,grant.destination)}><X size={15}/> Revoke</button>
      </div>) : <div className="xc-empty">No cross-app access is currently granted.</div>}
      {apps.length>1 && <form className="xc-inline-form" onSubmit={event=>{event.preventDefault();void change('data-grants','PUT',source,destination,persistent);}}>
        <label>Source app<select value={source} onChange={e=>{setSource(e.target.value);setDestination('');}}><option value="">Choose app</option>{apps.map(app=><option key={app.client} value={app.client}>{app.name}</option>)}</select></label>
        <label>Allow access for<select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Choose app</option>{apps.filter(app=>app.client!==source).map(app=><option key={app.client} value={app.client}>{app.name}</option>)}</select></label>
        <label>Duration<select value={persistent?'persistent':'day'} onChange={event=>setPersistent(event.target.value==='persistent')}><option value="day">One day</option><option value="persistent">Until revoked</option></select></label>
        <button className="xc-button xc-primary" disabled={busy || !source || !destination}><ShieldCheck size={16}/> Allow access</button>
      </form>}
    </section>
    {!!samples.length && <section className="xc-card xc-pad">
      <div className="xc-row-head"><span className="xc-symbol xc-lavender"><Layers3 size={21}/></span><div><h2>Sample app permissions</h2><p>Permissions apply to the sample apps and their separate data.</p></div></div>
      {samples.map(item=><div className="xc-list-row" key={item.source+item.destination}>
        <div className="xc-row-head"><span className="xc-symbol xc-small xc-sky">{item.shared?<FolderKey size={17}/>:<ArrowRight size={17}/>}</span>
          <div><strong>{item.app} · {item.sourceName}</strong><p>{item.shared?'Read and write':'Read only'}{item.expires?' · '+duration(item.expires):''}</p></div></div>
        <div className="xc-actions"><button className="xc-button xc-secondary" disabled={busy}
          onClick={()=>void change('sample-grants',item.expires?'DELETE':'PUT',item.source,item.destination)}>
          {item.expires?'Revoke':'Allow for one hour'}
        </button>{!item.expires&&<button className="xc-button xc-secondary" disabled={busy}
          onClick={()=>void change('sample-grants','PUT',item.source,item.destination,true)}>Allow until revoked</button>}</div>
      </div>)}
    </section>}
    {notice && <div className="xc-notice" role="status">{notice}</div>}
  </>;
}
