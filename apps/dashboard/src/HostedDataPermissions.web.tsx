import {useEffect,useState} from 'react';import {api} from './web-account';
type Permission={source:string;destination:string;collection:string;label:string;sourceName:string;destinationName:string;enabled:boolean;unsecure?:boolean};
export default function HostedDataPermissions({client}:{client?:string}){
 const [items,setItems]=useState<Permission[]>([]),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const load=()=>api('app-data-permissions').then(r=>setItems(r.permissions));useEffect(()=>{void load().catch(e=>setStatus(e.message));},[]);
 return <section className="xc-card xc-pad xc-stack"><h2>App-to-app data permissions</h2>
 {items.filter(item=>!client||item.destination===client||item.source===client).map(item=><label className="xc-list-row" key={item.source+item.destination+item.collection}><span><strong>{item.label}</strong><p>{item.destinationName} can read your {item.collection} from {item.sourceName}</p></span><input type="checkbox" role="switch" aria-label={item.label} checked={item.enabled} disabled={busy} onChange={event=>{if(item.unsecure&&!window.confirm('Edit data permissions for this unsecure app? Its hosting domain has not been verified.'))return;setBusy(true);void api('app-data-permissions',{source:item.source,destination:item.destination,collection:item.collection,enabled:event.target.checked,confirmUnsecure:item.unsecure},'PUT').then(load).catch(e=>setStatus(e.message)).finally(()=>setBusy(false));}}/></label>)}
 {!items.length&&<p>No linked apps have requested access to another app's collections.</p>}{status&&<p role="status">{status}</p>}</section>;
}
