import { IconAction } from './AdminUsers.web';
import { Check, RefreshCw, X } from 'lucide-react';
import {confirmIdentity} from './Reauthenticate.web';
import { useEffect, useState } from 'react';
import { api } from './web-account';
import type { UsernameRequest } from './support-model';

export function UsernameChange() {
  const [request,setRequest]=useState<UsernameRequest|null>(null);
  const [name,setName]=useState('');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  async function load(){setRequest((await api('username-change')).request);}
  function change(action:string){
    setBusy(true);setStatus('');
    void (async()=>{if(action==='confirm'&&!(await api('session/access')).confirmed)await confirmIdentity();
      await api('username-change',{action,id:request?.id,username:name});await load();})()
      .catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
  }
  useEffect(()=>{void load().catch(error=>setStatus(error.message));},[]);
  return <section className="xc-card xc-pad xc-stack">
    <h2>Username change</h2>
    <p>Confirm the request here, then wait for an administrator to approve it. Approval changes your X-Center mailbox address.</p>
    {request?<div className="xc-stack"><strong>@{request.proposed}</strong>
      <p>{request.confirmed?'Waiting for administrator approval.':'Waiting for your confirmation.'}</p>
      <div className="xc-actions">{!request.confirmed&&<button className="xc-button xc-primary" disabled={busy} onClick={()=>change('confirm')}>Confirm request</button>}
        <button className="xc-button xc-secondary" disabled={busy} onClick={()=>change('cancel')}>Cancel request</button></div>
    </div>:<form className="xc-inline-form" onSubmit={event=>{event.preventDefault();change('request');}}>
      <label>New username<input required pattern="[A-Za-z][A-Za-z0-9]{2,23}" maxLength={24} autoComplete="off"
        value={name} onChange={event=>setName(event.target.value)}/></label>
      <button className="xc-button xc-secondary" disabled={busy}>Request change</button>
    </form>}
    {status&&<p role="status">{status}</p>}
  </section>;
}

export function AdminUsernameChanges({refreshAccounts}:{refreshAccounts:()=>Promise<void>}) {
  const [requests,setRequests]=useState<UsernameRequest[]>([]);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  async function load(){setRequests((await api('admin/username-changes')).requests);}
  function run(work:()=>Promise<void>){
    setBusy(true);setStatus('');
    void work().catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
  }
  useEffect(()=>{run(load);},[]);
  return <section className="xc-card xc-pad xc-stack">
    <h2>Username requests</h2>
    <IconAction label="Refresh username requests" disabled={busy} onClick={()=>run(load)}><RefreshCw size={20}/></IconAction>
    {!requests.length&&!busy&&<p>No confirmed requests.</p>}
    {requests.map(request=><div key={request.id} className="xc-list-row">
      <strong>@{request.previous} → @{request.proposed}</strong>
      <div className="xc-actions">{(['approve','reject'] as const).map(action=><IconAction label={action==='approve'?'Approve change':'Decline request'}
        key={action} disabled={busy} onClick={()=>run(async()=>{
          await api('admin/username-changes',{id:request.id,action});await Promise.all([load(),refreshAccounts()]);
          setStatus(action==='approve'?'Username changed.':'Request declined.');
        })}>{action==='approve'?<Check size={20}/>:<X size={20}/>}</IconAction>)}</div>
    </div>)}
    {status&&<p role="status">{status}</p>}
  </section>;
}
