import TrustBadges from './TrustBadges.web';
import {useEffect,useState,type ReactNode} from 'react';
import {ArrowLeft,BadgeCheck,Check,Database,LockKeyhole,LogOut,Mail,Settings2,ShieldCheck,Trash2,Unlock,UserRound,X} from 'lucide-react';
import {api} from './web-account';
import {formatBytes} from './storage-summary';
import type {ManagedAccount} from './support-model';

export function IconAction({label,children,onClick,disabled=false,type='button'}:{
  label:string;children:ReactNode;onClick?:()=>void;disabled?:boolean;type?:'button'|'submit';
}){
  return <button type={type} className="xc-button xc-secondary xc-icon-action" aria-label={label} title={label}
    disabled={disabled} onClick={onClick}>{children}<span>{label}</span></button>;
}

export function AdminAvatar({username,hasPicture}:{username:string;hasPicture?:boolean}){
  const [failed,setFailed]=useState(false);
  return <span className="xc-avatar xc-admin-avatar">{hasPicture&&!failed?
    <img width={44} height={44} alt="" src={'/account/admin/accounts/'+username+'/avatar'} onError={()=>setFailed(true)}/>:
    <UserRound size={24} aria-hidden="true"/>}</span>;
}
type Details=ManagedAccount&{externalMailLimits?:{daily:number|null;monthly:number|null;usedToday:number;usedMonth:number};admin:boolean;rootAdmin:boolean;verified:boolean;name:string;created:number;devices:number;passkeys:number;apps:{client:string;label:string;verified?:boolean}[]};
type Registered={verified:boolean;id:string;name:string;status:string;restricted:boolean;callback:string};
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
  const [mailDaily,setMailDaily]=useState('');const [mailMonthly,setMailMonthly]=useState('');
  const [unit,setUnit]=useState(2);
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
  async function mutate(path:string,data:{action?:string}&Record<string,unknown>){
    await api(path,data);setAction('');setConfirmation('');setText('');await load();setStatus(data.action==='delete'?'App deleted.':'Saved.');
  }
  const user=details?.account;
  const registrations=details?.registered.filter(app=>app.status!=='revoked')??[];
  return <><section className="xc-card xc-pad xc-stack">
    {name?<><a className="xc-button xc-secondary xc-self-start" href="/admin" aria-label="All accounts" title="All accounts"><ArrowLeft size={20}/></a>
      {user&&<>
        <div className="xc-row-head"><AdminAvatar username={user.username} hasPicture={user.hasPicture}/><div><h2 className="xc-identity-label">{user.name}<TrustBadges verified={user.verified} admin={user.admin}/></h2><p>@{user.username} · {user.locked?'Locked':'Active'}</p></div></div>
        <p>{user.passkeys} passkeys · {user.devices} sessions · {formatBytes(user.capacity)} capacity</p>
        <p>Created {new Date(user.created).toLocaleDateString()}</p>
        <div className="xc-actions">
          <IconAction label={user.verified?'Remove user verification':'Verify user'} disabled={busy} onClick={()=>run(()=>mutate('admin/users/'+user.username,{action:'verify-user',enabled:!user.verified}))}><ShieldCheck size={20}/></IconAction>
          {!user.rootAdmin&&<IconAction label={user.admin?'Remove admin access':'Grant admin access'} disabled={busy} onClick={()=>setAction('admin')}><ShieldCheck size={20}/></IconAction>}
          {!user.protected&&<><IconAction label={user.locked?'Unlock account':'Lock account'} disabled={busy} onClick={()=>run(()=>mutate('admin/account-status',
            {username:user.username,action:user.locked?'unlock':'lock'}))}>{user.locked?<Unlock size={20}/>:<LockKeyhole size={20}/>}</IconAction>
            <IconAction label="Sign out all devices" disabled={busy} onClick={()=>setAction('logout')}><LogOut size={20}/></IconAction>
            <IconAction label="Delete account" disabled={busy} onClick={()=>{setAction('delete');setConfirmation('');}}><Trash2 size={20}/></IconAction></>}
          <IconAction label="External email limits" disabled={busy} onClick={()=>{setMailDaily(user.externalMailLimits?.daily==null?'':String(user.externalMailLimits.daily));setMailMonthly(user.externalMailLimits?.monthly==null?'':String(user.externalMailLimits.monthly));setAction('mail-limits');}}><Mail size={20}/></IconAction>
          <IconAction label="Send warning" disabled={busy} onClick={()=>{setAction('warn');setText('');}}><Mail size={20}/></IconAction>
          <IconAction label="Change storage" disabled={busy} onClick={()=>{setAction('capacity');setCapacity(String(user.capacity/1024**2));setUnit(2);}}><Settings2 size={20}/></IconAction>
          <IconAction label={user.premium?'Disable premium aliases':'Enable premium aliases'} disabled={busy} onClick={()=>run(()=>mutate('admin/premium',{username:user.username,enabled:!user.premium}))}><ShieldCheck size={20}/></IconAction>
        </div>
        {['delete','logout','capacity','warn','admin','mail-limits'].includes(action)&&<form className="xc-stack" onSubmit={event=>{
          event.preventDefault();
          run(async()=>{
            if(action==='delete'){await api('admin/account-status',{username:user.username,action:'delete',confirmation});window.location.assign('/admin');}
            else if(action==='logout')await mutate('admin/account-status',{username:user.username,action:'revoke-sessions'});
            else if(action==='mail-limits')await mutate('admin/users/'+user.username,{action:'external-mail-limits',daily:mailDaily.trim()?Number(mailDaily):null,monthly:mailMonthly.trim()?Number(mailMonthly):null});
            else if(action==='admin')await mutate('admin/users/'+user.username,{action:'set-admin',enabled:!user.admin});
            else if(action==='capacity')await mutate('admin/storage',{username:user.username,capacity:Number(capacity)*1024**unit});
            else await mutate('admin/users/'+user.username,{action:'warn',text});
          });
        }}>
          {action==='delete'&&<><p>Deleting removes the profile and credentials and signs out all devices. Type the username to confirm.</p>
            <label>Confirm username<input required value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label></>}
          {action==='logout'&&<p>Sign out every device for @{user.username}?</p>}
          {action==='warn'&&<label>Warning<textarea required maxLength={3000} value={text} onChange={event=>setText(event.target.value)}/></label>}
          {action==='mail-limits'&&<><p>External email only. Leave a limit blank to remove it for this user. The service free-plan ceiling remains.</p><label>Emails per day<input type="number" min={0} max={1000000} value={mailDaily} onChange={e=>setMailDaily(e.target.value)}/></label><label>Emails per month<input type="number" min={0} max={1000000} value={mailMonthly} onChange={e=>setMailMonthly(e.target.value)}/></label></>}
          {action==='admin'&&<p>{user.admin?'Remove administrator access from':'Grant administrator access to'} @{user.username}? Administrators can manage accounts, apps and support.</p>}
          {action==='capacity'&&<div className="xc-actions"><label>Storage capacity<input type="number" min={0.001} max={100*1024**4} step="any" required value={capacity} onChange={event=>setCapacity(event.target.value)}/></label><label>Unit<select aria-label="Unit" value={unit} onChange={event=>setUnit(Number(event.target.value))}>{['B','KB','MB','GB','TB'].map((u,i)=><option key={u} value={i}>{u}</option>)}</select></label></div>}
          <div className="xc-actions"><IconAction type="submit" label="Confirm action" disabled={busy||action==='delete'&&confirmation!==user.username}><Check size={20}/></IconAction>
            <IconAction label="Cancel action" disabled={busy} onClick={()=>setAction('')}><X size={20}/></IconAction></div>
        </form>}
        <details><summary>What these actions do</summary><p>Lock restricts account use while keeping sessions. Sign out all devices revokes sessions. Delete removes the identity and credentials after confirmation. Premium aliases enables named Hide My Email addresses. Verification and administrator access are separate privileges.</p></details>
        <h3>Connected apps</h3>
        {!user.apps.length&&<p>No connected apps.</p>}
        {user.apps.map(app=><div className="xc-identity-label" key={app.client}>{app.label}<TrustBadges kind="app" verified={app.verified}/></div>)}
        <section className="xc-stack"><div className="xc-row-head"><BadgeCheck size={21}/><h2>Registered apps</h2></div>
        {!registrations.length&&<p>No registered apps.</p>}
        {registrations.map(app=><div key={app.id} className="xc-list-row xc-permission-row">
          <div><strong className="xc-identity-label">{app.name}<TrustBadges kind="app" verified={app.verified}/></strong><p>{app.status}{app.restricted?' · Restricted':''}</p><p>{new URL(app.callback).hostname}</p></div>
          <div className="xc-actions"><IconAction label={app.verified?'Remove app verification':'Verify app'} disabled={busy} onClick={()=>run(()=>mutate('admin/apps',{type:'app',id:app.id,verified:!app.verified}))}><ShieldCheck size={20}/></IconAction>{app.status==='active'&&app.verified&&!app.restricted&&<a className="xc-button xc-secondary" href={'/developer/storage/'+app.id+'?account='+user.username}><Database size={17}/> Manage app storage</a>}</div>
          {<div className="xc-actions">
            {app.status==='active'&&<IconAction label={app.restricted?'Restore app':'Restrict app'} disabled={busy} onClick={()=>run(()=>mutate('admin/users/'+user.username,
              {action:app.restricted?'restore':'restrict',app:app.id}))}>{app.restricted?<Unlock size={20}/>:<LockKeyhole size={20}/>}</IconAction>}
            <IconAction label="Delete registered app" disabled={busy} onClick={()=>{setAction('app-'+app.id);setConfirmation('');}}><Trash2 size={20}/></IconAction>
          </div>}
          {action==='app-'+app.id&&<div className="xc-stack"><p>Delete this registration and stop its future sign-ins?</p>
            <IconAction label="Confirm app deletion" disabled={busy} onClick={()=>run(()=>mutate('admin/users/'+user.username,{action:'delete',app:app.id,confirmation:app.id}))}><Check size={20}/></IconAction>
            <IconAction label="Cancel app deletion" disabled={busy} onClick={()=>setAction('')}><X size={20}/></IconAction></div>}
        </div>)}</section>
      </>}
    </>:<><h2>Accounts</h2><label>Find an account<input type="search" value={filter} onChange={event=>setFilter(event.target.value)}/></label>
      {users.filter(user=>user.username.includes(filter.toLowerCase().trim())).map(user=>
        <a className="xc-list-row" key={user.username} href={'/admin/users/'+user.username}>
          <span className="xc-row-head"><AdminAvatar username={user.username} hasPicture={user.hasPicture}/><span className="xc-identity-label"><strong>@{user.username}</strong><TrustBadges verified={user.verified} admin={user.admin}/></span></span>
          {user.locked&&<LockKeyhole size={18} aria-label="Locked"/>}
        </a>)}</>}
    {status&&<p role="status">{status}</p>}
  </section></>;
}
