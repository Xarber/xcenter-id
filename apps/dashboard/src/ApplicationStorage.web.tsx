import AppFileContainer from './AppFileContainer.web';
import SharingEditor from './SharingEditor.web';
import {cleanSharing,type SharingConfig,type SharingSource,type SharingRequest} from './sharing-config';
import {useConfirmDialog} from './dialog-model';
import AppIcon from './AppIcon.web';
import CopyButton from './CopyButton.web';
import {useEffect,useState} from 'react';
import {api} from './web-account';
import {formatBytes} from './storage-summary';
import {confirmIdentity} from './Reauthenticate.web';
export default function ApplicationStorage({id,admin=false}:{id:string;admin?:boolean}){
  const confirmAction=useConfirmDialog();
 const [state,setState]=useState<{name?:string;icon?:string|null;used:number;records:number;capacity:number;hasKey:boolean;showInFiles:boolean;canShowInFiles:boolean;canBrowseService?:boolean;verified:boolean;unsecure:boolean;shared:string[];requests:SharingRequest[];sources:SharingSource[]}|null>(null);
 const [edit,setEdit]=useState(false),[status,setStatus]=useState(''),[secret,setSecret]=useState(''),[busy,setBusy]=useState(false);
 const [browsing,setBrowsing]=useState(false);
 const [sharing,setSharing]=useState<SharingConfig>({shared:[],requests:[]});
 const [capacity,setCapacity]=useState('10'),[unit,setUnit]=useState(2);
 async function load(){const data=await api('app-storage/'+id);setState(data);setSharing({shared:data.shared,requests:data.requests});setCapacity(String(data.capacity/1024**2));}
 useEffect(()=>{void load().catch(error=>setStatus(error.message));return ()=>setSecret('');},[id]);
 function act(data:object){setBusy(true);setStatus('');void (async()=>{if(!(await api('session/access')).confirmed)await confirmIdentity();return api('app-storage/'+id,data);})().then(async result=>{if(result.secret)setSecret(result.secret);await load();setStatus('Saved.');}).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));}
 const query=new URLSearchParams(location.search);
 const account=query.get('account');
 const fromAdmin=admin&&query.get('from')==='admin';
 const back=fromAdmin?(account&&/^[a-z0-9._-]{3,24}$/.test(account)?'/admin/users/'+account:'/admin'):'/developer?app='+encodeURIComponent(id);
 if(browsing&&state?.canBrowseService)return <AppFileContainer app={{client:id,name:state.name??'Service storage',bytes:state.used,icon:state.icon}} service={id} back={()=>setBrowsing(false)}/>;
 return <section className="xc-card xc-pad xc-stack"><a href={back}>{fromAdmin?'Back to administration':'Back to registered app'}</a><div className="xc-row-head"><AppIcon icon={state?.icon}/><h2>{state?.name??(state&&!state.verified?'Sharing requests':'Application database')}</h2></div>
 {state?.verified&&<p>This quota covers the app’s service database. User records use the storage of the account that owns them. Public records can be read by anyone.</p>}
 {state&&<>{state.verified&&<p>{formatBytes(state.used)} of {formatBytes(state.capacity)} · {state.records} records</p>}
 {state.canBrowseService&&<button className="xc-button xc-secondary" type="button" onClick={()=>setBrowsing(true)}>Browse service storage</button>}
 <button className="xc-button xc-secondary" onClick={()=>setEdit(!edit)}>{edit?'Close settings':'Edit database settings'}</button>
 {edit&&<><SharingEditor value={sharing} onChange={setSharing} sources={state.sources??[]} canPublish={state.verified}/>
 <button className="xc-button xc-primary" disabled={busy} onClick={async()=>{
   if(state.unsecure&&!await confirmAction('Edit permissions for this unsecure app?','Save sharing','Its hosting domain has not been verified.',false))return;
   act({action:'sharing',confirmUnsecure:state.unsecure,...cleanSharing(sharing)});
 }}>Save sharing settings</button>
 {state.canShowInFiles&&<label>Show this app’s record container in Files<input type="checkbox" role="switch" checked={state.showInFiles} disabled={busy}
   onChange={event=>act({action:'file-visibility',enabled:event.currentTarget.checked})}/><small>You can manage records in your own linked account. Browseable files appear in account Files independently.</small></label>}
 {fromAdmin&&state.verified&&<><label>App storage capacity<input type="number" step="any" min={0.001} value={capacity} onChange={e=>setCapacity(e.target.value)}/></label><label>Unit<select aria-label="Unit" value={unit} onChange={e=>setUnit(Number(e.target.value))}>{['B','KB','MB','GB','TB'].map((u,i)=><option key={u} value={i}>{u}</option>)}</select></label>
 <button className="xc-button xc-primary" disabled={busy} onClick={()=>act({action:'capacity',capacity:Number(capacity)*1024**unit})}>Save app capacity</button></>}
 {state.verified&&<><h3>Private backend credential</h3><p>Keep this credential on your backend. Never bundle it in a mobile app or website. Native apps use each user's OAuth access token.</p>
 <button className="xc-button xc-secondary" disabled={busy} onClick={async()=>{if(await confirmAction('Create a new backend key? The previous key will stop working.'))act({action:'rotate-key'});}}>{state.hasKey?'Replace backend key':'Create backend key'}</button>
 {state.hasKey&&<button className="xc-button xc-secondary" disabled={busy} onClick={()=>act({action:'revoke-key'})}>Revoke backend key</button>}
 {secret&&<div role="status"><p>Copy this key now. It will not be shown again.</p><div className="xc-code-row"><code>{secret}</code><CopyButton value={secret} label="Copy database key"/></div><button className="xc-button xc-secondary" onClick={()=>setSecret('')}>Hide key</button></div>}</>}</>}
 <a href="/docs#hosted-data">Hosted data API documentation</a></>}{status&&<p role="status">{status}</p>}</section>;
}
