import {useEffect,useState} from 'react';
import {api} from './web-account';
import {formatBytes} from './storage-summary';
import {confirmIdentity} from './Reauthenticate.web';
export default function ApplicationStorage({id,admin=false}:{id:string;admin?:boolean}){
 const [state,setState]=useState<{used:number;records:number;capacity:number;hasKey:boolean;shared:string[];requests:{source:string;collection:string;label:string}[]}|null>(null);
 const [edit,setEdit]=useState(false),[status,setStatus]=useState(''),[secret,setSecret]=useState(''),[busy,setBusy]=useState(false);
 const [shared,setShared]=useState(''),[requests,setRequests]=useState('[]'),[capacity,setCapacity]=useState('10'),[unit,setUnit]=useState(2);
 async function load(){const data=await api('app-storage/'+id);setState(data);setShared(data.shared.join('\n'));setRequests(JSON.stringify(data.requests,null,2));setCapacity(String(data.capacity/1024**2));}
 useEffect(()=>{void load().catch(error=>setStatus(error.message));return ()=>setSecret('');},[id]);
 function act(data:object){setBusy(true);setStatus('');void (async()=>{if(!(await api('session/access')).confirmed)await confirmIdentity();return api('app-storage/'+id,data);})().then(async result=>{if(result.secret)setSecret(result.secret);await load();setStatus('Saved.');}).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));}
 const query=new URLSearchParams(location.search);
 const account=query.get('account');
 const fromAdmin=admin&&query.get('from')==='admin';
 const back=fromAdmin?(account&&/^[a-z][a-z0-9]{2,23}$/.test(account)?'/admin/users/'+account:'/admin'):'/developer?app='+encodeURIComponent(id);
 return <section className="xc-card xc-pad xc-stack"><a href={back}>{fromAdmin?'Back to administration':'Back to registered app'}</a><h2>Application database</h2>
 <p>This quota covers the app’s service database. User records use the storage of the account that owns them. Public records can be read by anyone.</p>
 {state&&<><p>{formatBytes(state.used)} of {formatBytes(state.capacity)} · {state.records} records</p>
 <button className="xc-button xc-secondary" onClick={()=>setEdit(!edit)}>{edit?'Close settings':'Edit database settings'}</button>
 {edit&&<><label>Collections available for user-approved sharing<textarea value={shared} onChange={e=>setShared(e.target.value)} placeholder="One collection name per line"/></label>
 <label>Permissions requested from other apps<textarea value={requests} onChange={e=>setRequests(e.target.value)}/></label>
 <p>Requests use source client ID, collection and label. The source publisher must enable collection sharing first. Users approve each request while linking.</p>
 <button className="xc-button xc-primary" disabled={busy} onClick={()=>{try{act({action:'sharing',shared:shared.split(/\s+/).filter(Boolean),requests:JSON.parse(requests)});}catch{setStatus('Check the permission request JSON.');}}}>Save sharing settings</button>
 {fromAdmin&&<><label>App storage capacity<input type="number" step="any" min={0.001} value={capacity} onChange={e=>setCapacity(e.target.value)}/></label><label>Unit<select aria-label="Unit" value={unit} onChange={e=>setUnit(Number(e.target.value))}>{['B','KB','MB','GB','TB'].map((u,i)=><option key={u} value={i}>{u}</option>)}</select></label>
 <button className="xc-button xc-primary" disabled={busy} onClick={()=>act({action:'capacity',capacity:Number(capacity)*1024**unit})}>Save app capacity</button></>}
 <h3>Private backend credential</h3><p>Keep this credential on your backend. Never bundle it in a mobile app or website. Native apps use each user's OAuth access token.</p>
 <button className="xc-button xc-secondary" disabled={busy} onClick={()=>{if(window.confirm('Create a new backend key? The previous key will stop working.'))act({action:'rotate-key'});}}>{state.hasKey?'Replace backend key':'Create backend key'}</button>
 {state.hasKey&&<button className="xc-button xc-secondary" disabled={busy} onClick={()=>act({action:'revoke-key'})}>Revoke backend key</button>}
 {secret&&<div role="status"><p>Copy this key now. It will not be shown again.</p><code style={{overflowWrap:'anywhere'}}>{secret}</code><button className="xc-button xc-secondary" onClick={()=>setSecret('')}>Hide key</button></div>}</>}
 <a href="/docs#hosted-data">Hosted data API documentation</a></>}{status&&<p role="status">{status}</p>}</section>;
}
