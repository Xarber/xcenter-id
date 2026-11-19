import CopyButton from './CopyButton.web';
import {mailClientSettings} from './mail-client-settings';
import {useEffect,useState} from 'react';import {api} from './web-account';import {confirmIdentity} from './Reauthenticate.web';
type Client={id:string;label:string;created:number;lastUsed:number|null};
export default function MailClients({username}:{username?:string}){
 const [clients,setClients]=useState<Client[]>([]),[label,setLabel]=useState(''),[secret,setSecret]=useState(''),[editing,setEditing]=useState(false),[status,setStatus]=useState('');
 const [profile,setProfile]=useState<{name:string;username:string;hasPicture:boolean}|null>(null);
 const load=()=>api('mail/clients').then(r=>{setClients(r.clients);setProfile(r.profile);});useEffect(()=>{void load().catch(e=>setStatus(e.message));},[]);
 function act(body:object){setStatus('');void (async()=>{if(!(await api('session/access')).confirmed)await confirmIdentity();return api('mail/clients',body);})().then(async result=>{if(result.password)setSecret(result.password);setEditing(false);setLabel('');await load();}).catch(e=>setStatus(e.message));}
 return <section className="xc-card xc-pad xc-stack"><h2>Mail clients</h2><p>Use a separate credential for each mail app. Revoking it does not sign out your dashboard.</p>
 <button className="xc-button xc-secondary" onClick={()=>{setEditing(!editing);setSecret('');}}>Add mail client</button>
 {editing&&<form onSubmit={event=>{event.preventDefault();act({action:'create',label});}}><label>Client name<input value={label} maxLength={64} required onChange={e=>setLabel(e.target.value)}/></label><button className="xc-button xc-primary">Create client credential</button></form>}
 {secret&&<div className="xc-info"><p>Save this password in your mail client now. It is shown once.</p>
   <div className="xc-code-row"><code>{secret}</code><CopyButton value={secret} label="Copy mail password"/></div><button className="xc-button xc-secondary" onClick={()=>setSecret('')}>Hide credential</button></div>}
 {clients.map(client=><div key={client.id} className="xc-list-row"><div><strong>{client.label}</strong><p>{client.lastUsed?'Last used '+new Date(client.lastUsed).toLocaleString():'Not used yet'}</p></div><button className="xc-button xc-secondary" onClick={()=>{if(window.confirm('Revoke access for '+client.label+'?'))act({action:'revoke',id:client.id});}}>Revoke client</button></div>)}
 <section className="xc-stack"><h3>Mail app connection settings</h3>
 {profile&&<div className="xc-row-head">{profile.hasPicture&&<img className="xc-avatar" src="/account/avatar" alt=""/>}<strong>{profile.name}</strong></div>}
 <dl className="xc-mail-connection">{mailClientSettings(profile?.username??username).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 <p>Use the same server, username and password for both connections.</p></section>{status&&<p role="status">{status}</p>}</section>;
}
