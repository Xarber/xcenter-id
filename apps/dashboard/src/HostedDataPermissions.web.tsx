import {ArrowDownLeft,ArrowUpRight,LockKeyhole} from 'lucide-react';
import {groupHostedPermissions,permissionDirections,type HostedPermission} from './hosted-permission-groups';
import {useEffect,useState} from 'react';
import AppIcon from './AppIcon.web';
import {api} from './web-account';

export default function HostedDataPermissions({client}:{client:string}){
  const [items,setItems]=useState<HostedPermission[]>([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const load=()=>api('app-data-permissions').then(result=>setItems(result.permissions));
  useEffect(()=>{void load().catch(error=>setStatus(error.message));},[]);
  function change(item:HostedPermission,enabled:boolean){
    if(item.unsecure&&!window.confirm('Edit data permissions for this app? Its hosting domain has not been verified.'))return;
    setBusy(true);
    void api('app-data-permissions',{source:item.source,destination:item.destination,collection:item.collection,enabled,confirmUnsecure:item.unsecure},'PUT')
      .then(load).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
  }
  return <>
    {permissionDirections.map(([direction,title,empty])=>{
      const groups=groupHostedPermissions(items,client,direction);
      const DirectionIcon=direction==='destination'?ArrowDownLeft:ArrowUpRight;
      return <section className="xc-card xc-pad xc-hosted-permissions" key={direction}>
        <div className="xc-row-head"><DirectionIcon size={20} aria-hidden="true"/><h2>{title}</h2></div>
        {groups.map(group=><section className="xc-permission-group" key={group.id}>
          <div className="xc-row-head"><AppIcon icon={group.icon}/><h3>{group.name}</h3></div>
          {group.permissions.map(item=><div className="xc-list-row" key={item.collection}>
            <span>{item.label}</span>
            <button type="button" role="switch" aria-checked={item.enabled} aria-label={item.label+' · '+group.name}
              className="xc-permission-switch" disabled={busy} onClick={()=>change(item,!item.enabled)}><span aria-hidden="true"/></button>
          </div>)}
        </section>)}
        {!groups.length&&<div className="xc-empty"><LockKeyhole size={17} aria-hidden="true"/> {empty}</div>}
      </section>;
    })}
    {status&&<p role="alert">{status}</p>}
  </>;
}
