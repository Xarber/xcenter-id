import LinkedAppPermissions from './LinkedAppPermissions.web';
import AppIcon from './AppIcon.web';
import TrustBadges from './TrustBadges.web';
import HostedDataPermissions from './HostedDataPermissions.web';
import {ArrowLeft,ChevronRight} from 'lucide-react';
import {useEffect,useState} from 'react';
import {api} from './web-account';

type App={client:string;label:string;icon?:string|null;verified?:boolean;description?:string};
type Grant={source:string;destination:string;dataset:string};
export default function PermissionsPage({client}:{client?:string}){
  const [apps,setApps]=useState<App[]|null>(null);
  const [legacy,setLegacy]=useState<Grant[]>([]);
  const [error,setError]=useState('');
  function load(){
    void api('connected-apps').then(({apps})=>{setApps(apps);setError('');}).catch(error=>setError(error.message));
    if(client)void api('data-grants').then(({grants})=>setLegacy(grants.filter((grant:Grant)=>grant.source===client||grant.destination===client))).catch(()=>{});
  }
  useEffect(()=>{
    load();window.addEventListener('focus',load);
    return ()=>window.removeEventListener('focus',load);
  },[client]);
  if(!apps)return <section className="xc-card xc-pad"><p role="status">{error||'Loading linked apps…'}</p></section>;
  if(!client)return <section className="xc-permission-directory" aria-label="Linked apps">
    {apps.map(app=><a className="xc-card xc-permission-link" key={app.client} href={'/permissions/'+encodeURIComponent(app.client)}>
      <AppIcon icon={app.icon}/>
      <span className="xc-permission-name"><strong className="xc-identity-label">{app.label}<TrustBadges compact kind="app" verified={app.verified}/></strong>
        <span>Linked to your X-Center ID</span></span><ChevronRight size={20} aria-hidden="true"/>
    </a>)}
    {!apps.length&&<p className="xc-empty">No linked apps.</p>}
  </section>;
  const selected=apps.find(app=>app.client===client);
  return <>
    <a className="xc-permission-back" href="/permissions"><ArrowLeft size={16} aria-hidden="true"/> All linked apps</a>
    {!selected?<section className="xc-card xc-pad"><h2>App unavailable</h2><p>Choose an app linked to your account.</p></section>:<>
      <section className="xc-card xc-pad xc-permission-heading">
        <AppIcon icon={selected.icon}/><div><h2 className="xc-identity-label">{selected.label}<TrustBadges compact kind="app" verified={selected.verified}/></h2>
        {selected.description&&<p>{selected.description}</p>}</div>
      </section>
      <LinkedAppPermissions key={client} client={client}/>
      <HostedDataPermissions client={client}/>
      {legacy.length>0&&<section className="xc-card xc-pad"><h2>Previously shared data</h2>
        {legacy.map(grant=>{
          const other=grant.source===client?grant.destination:grant.source;
          return <div className="xc-list-row" key={grant.source+':'+grant.destination+':'+grant.dataset}>
            <span>{apps.find(app=>app.client===other)?.label??'Another app'}</span>
            <button type="button" className="xc-button xc-secondary" onClick={()=>void api('data-grants',grant,'DELETE').then(load).catch(error=>setError(error.message))}>Revoke access</button>
          </div>;
        })}
      </section>}
    </>}
    {error&&<p role="alert">{error}</p>}
  </>;
}
