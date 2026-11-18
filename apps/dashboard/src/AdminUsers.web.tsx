import {useEffect,useState,type ReactNode} from 'react';
import {ArrowLeft,Check,LockKeyhole,LogOut,Mail,Settings2,ShieldCheck,Trash2,Unlock,UserRound,X} from 'lucide-react';
import {api} from './web-account';
import {formatBytes} from './storage-summary';
import type {ManagedAccount} from './support-model';

export function IconAction({label,children,onClick,disabled=false,type='button'}:{
  label:string;children:ReactNode;onClick?:()=>void;disabled?:boolean;type?:'button'|'submit';
}){
  return <button type={type} className="xc-button xc-secondary xc-icon-action" aria-label={label} title={label}
    disabled={disabled} onClick={onClick}>{children}</button>;
}

export function AdminAvatar({username,hasPicture}:{username:string;hasPicture?:boolean}){
  const [failed,setFailed]=useState(false);
  return <span className="xc-avatar xc-admin-avatar">{hasPicture&&!failed?
    <img width={44} height={44} alt="" src={'/account/admin/accounts/'+username+'/avatar'} onError={()=>setFailed(true)}/>:
    <UserRound size={24} aria-hidden="true"/>}</span>;
}
type Details=ManagedAccount&{name:string;created:number;devices:number;passkeys:number;apps:{client:string;label:string}[]};
type Registered={id:string;name:string;status:string;restricted:boolean;callback:string};
export function AdminAccounts(){
  const [users,setUsers]=useState<ManagedAccount[]>([]);
  const [details,setDetails]=useState<{account:Details;registered:Registered[]}|null>(null);
  const [filter,setFilter]=useState('');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [action,setAction]=useState('');
  const [text,setText]=useState('');
  const [capacity,setCapacity]=useState('');
  const name=/^\/admin\/users\/([a-z][a-z0-9]{2,23})$/.exec(window.location.pathname)?.[1];
  async function load(){
    if(name){setDetails(await api('admin/users/'+name));}
    else setUsers((await api('admin/accounts')).accounts);
  }
  function run(work:()=>Promise<void>){
    setBusy(true);setStatus('');
    void work().catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
  }
  useEffect(()=>{run(load);},[name]);
  async function mutate(path:string,data:object){
    await api(path,data);setAction('');setConfirmation('');setText('');await load();setStatus('Saved.');
  }
  const user=details?.account;
  return <section className="xc-card xc-pad xc-stack">
    {name?<><a className="xc-button xc-secondary xc-self-start" href="/admin" aria-label="All accounts" title="All accounts"><ArrowLeft size={20}/></a>
      {user&&<>
        <div className="xc-row-head"><AdminAvatar username={user.username} hasPicture={user.hasPicture}/><div><h2>{user.name}</h2><p>@{user.username} · {user.locked?'Locked':'Active'}</p></div></div>
        <p>{user.passkeys} passkeys · {user.devices} sessions · {formatBytes(user.capacity)} capacity</p>
        <p>Created {new Date(user.created).toLocaleDateString()}</p>
        <div className="xc-actions">
          {!user.protected&&<><IconAction label={user.locked?'Unlock account':'Lock account'} disabled={busy} onClick={()=>run(()=>mutate('admin/account-status',
            {username:user.username,action:user.locked?'unlock':'lock'}))}>{user.locked?<Unlock size={20}/>:<LockKeyhole size={20}/>}</IconAction>
            <IconAction label="Sign out all devices" disabled={busy} onClick={()=>setAction('logout')}><LogOut size={20}/></IconAction>
            <IconAction label="Delete account" disabled={busy} onClick={()=>{setAction('delete');setConfirmation('');}}><Trash2 size={20}/></IconAction></>}
          <IconAction label="Send warning" disabled={busy} onClick={()=>{setAction('warn');setText('');}}><Mail size={20}/></IconAction>
          <IconAction label="Change storage" disabled={busy} onClick={()=>{setAction('capacity');setCapacity(String(user.capacity/1024**2));}}><Settings2 size={20}/></IconAction>
          <IconAction label={user.premium?'Disable premium aliases':'Enable premium aliases'} disabled={busy} onClick={()=>run(()=>mutate('admin/premium',{username:user.username,enabled:!user.premium}))}><ShieldCheck size={20}/></IconAction>
        </div>
        {['delete','logout','capacity','warn'].includes(action)&&<form className="xc-stack" onSubmit={event=>{
          event.preventDefault();
          run(async()=>{
            if(action==='delete'){await api('admin/account-status',{username:user.username,action:'delete',confirmation});window.location.assign('/admin');}
            else if(action==='logout')await mutate('admin/account-status',{username:user.username,action:'revoke-sessions'});
            else if(action==='capacity')await mutate('admin/storage',{username:user.username,capacity:Number(capacity)*1024**2});
            else await mutate('admin/users/'+user.username,{action:'warn',text});
          });
        }}>
          {action==='delete'&&<><p>Deleting removes the profile and credentials and signs out all devices. Type the username to confirm.</p>
            <label>Confirm username<input required value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label></>}
          {action==='logout'&&<p>Sign out every device for @{user.username}?</p>}
          {action==='warn'&&<label>Warning<textarea required maxLength={3000} value={text} onChange={event=>setText(event.target.value)}/></label>}
          {action==='capacity'&&<label>Capacity in MB<input type="number" min={1} max={1024} required value={capacity} onChange={event=>setCapacity(event.target.value)}/></label>}
          <div className="xc-actions"><IconAction type="submit" label="Confirm action" disabled={busy||action==='delete'&&confirmation!==user.username}><Check size={20}/></IconAction>
            <IconAction label="Cancel action" disabled={busy} onClick={()=>setAction('')}><X size={20}/></IconAction></div>
        </form>}
        <h3>Connected apps</h3>
        {!user.apps.length&&<p>No connected apps.</p>}
        {user.apps.map(app=><p key={app.client}>{app.label}</p>)}
        <h3>Registered apps</h3>
        {!details.registered.length&&<p>No registered apps.</p>}
        {details.registered.map(app=><div key={app.id} className="xc-list-row">
          <div><strong>{app.name}</strong><p>{app.status}{app.restricted?' · Restricted':''}</p><p>{new URL(app.callback).hostname}</p></div>
          {app.status==='active'&&<div className="xc-actions">
            <IconAction label={app.restricted?'Restore app':'Restrict app'} disabled={busy} onClick={()=>run(()=>mutate('admin/users/'+user.username,
              {action:app.restricted?'restore':'restrict',app:app.id}))}>{app.restricted?<Unlock size={20}/>:<LockKeyhole size={20}/>}</IconAction>
            <IconAction label="Delete registered app" disabled={busy} onClick={()=>{setAction('app-'+app.id);setConfirmation('');}}><Trash2 size={20}/></IconAction>
          </div>}
          {action==='app-'+app.id&&<div className="xc-stack"><p>Delete this registration and stop its future sign-ins?</p>
            <IconAction label="Confirm app deletion" disabled={busy} onClick={()=>run(()=>mutate('admin/users/'+user.username,{action:'delete',app:app.id,confirmation:app.id}))}><Check size={20}/></IconAction>
            <IconAction label="Cancel app deletion" disabled={busy} onClick={()=>setAction('')}><X size={20}/></IconAction></div>}
        </div>)}
      </>}
    </>:<><h2>Accounts</h2><label>Find an account<input type="search" value={filter} onChange={event=>setFilter(event.target.value)}/></label>
      {users.filter(user=>user.username.includes(filter.toLowerCase().trim())).map(user=>
        <a className="xc-list-row" key={user.username} href={'/admin/users/'+user.username}>
          <span className="xc-row-head"><AdminAvatar username={user.username} hasPicture={user.hasPicture}/><strong>@{user.username}</strong></span>
          {user.locked&&<LockKeyhole size={18} aria-label="Locked"/>}
        </a>)}</>}
    {status&&<p role="status">{status}</p>}
  </section>;
}
