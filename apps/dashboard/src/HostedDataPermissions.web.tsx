import {useEffect,useState} from 'react';
import AppIcon from './AppIcon.web';
import {api} from './web-account';

type Permission={source:string;destination:string;collection:string;label:string;sourceName:string;destinationName:string;sourceIcon?:string;destinationIcon?:string;enabled:boolean;unsecure?:boolean};
export default function HostedDataPermissions({client}:{client:string}){
  const [items,setItems]=useState<Permission[]>([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const load=()=>api('app-data-permissions').then(result=>setItems(result.permissions));
  useEffect(()=>{void load().catch(error=>setStatus(error.message));},[]);
  function change(item:Permission,enabled:boolean){
    if(item.unsecure&&!window.confirm('Edit data permissions for this app? Its hosting domain has not been verified.'))return;
    setBusy(true);
    void api('app-data-permissions',{source:item.source,destination:item.destination,collection:item.collection,enabled,confirmUnsecure:item.unsecure},'PUT')
      .then(load).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
  }
  return <>
    {([['destination','Data this app can access'],['source','Data shared from this app']] as const).map(([direction,title])=>{
      const permissions=items.filter(item=>item[direction]===client);
      const incoming=direction==='destination';
      return <section className="xc-card xc-pad" key={direction}><h2>{title}</h2>
        {permissions.map(item=><label className="xc-list-row" key={item.source+':'+item.destination+':'+item.collection}>
          <span className="xc-row-head"><AppIcon icon={incoming?item.sourceIcon:item.destinationIcon}/>
            <span><strong>{item.label}</strong><p>{incoming?item.sourceName:item.destinationName}</p></span>
          </span>
          <input type="checkbox" role="switch" aria-label={item.label+' · '+(incoming?item.sourceName:item.destinationName)} checked={item.enabled} disabled={busy}
            onChange={event=>change(item,event.target.checked)}/>
        </label>)}
        {!permissions.length&&<p>No requested data access.</p>}
      </section>;
    })}
    {status&&<p role="alert">{status}</p>}
  </>;
}
