import type { MailMessage } from './mail-message';
import { formatBytes, storageCategories } from './storage-summary';
import { BadgeCheck, Download, File, FileUp, Folder, FolderPlus, HardDrive, Laptop, Mail, MailPlus, Monitor, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api, fileAsBase64, type Account } from './web-account';

function notice(error:unknown) { return error instanceof Error ? error.message : 'Could not complete this action.'; }
const date = (value:number)=>new Date(value).toLocaleDateString(undefined,{dateStyle:'medium'});
const size = (value:number)=>value>1024*1024 ? (value/(1024*1024)).toFixed(1)+' MB' : Math.ceil(value/1024)+' KB';

type Session = { id:string;label:string;created:number;current:boolean };
type StoredFile = { id:string;name:string;size:number;created:number };
type FolderItem = {id:string;name:string};
type Files = { files:StoredFile[]; folders:FolderItem[]; breadcrumbs:FolderItem[]; categories:Record<string,number>; used:number; total:number; limit:number };

export function DevicesPage() {
  const [devices,setDevices]=useState<Session[]>([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState('');
  async function load(){setDevices((await api('devices')).devices);}
  useEffect(()=>{void load().catch(error=>setStatus(notice(error)));},[]);
  return <section className="xc-card xc-pad">
    <div className="xc-row-head"><span className="xc-symbol xc-sky"><Monitor size={21}/></span><div><h2>Signed-in devices</h2><p>Review and end active browser sessions.</p></div></div>
    {devices.map(device=><div className="xc-list-row" key={device.id}>
      <div className="xc-row-head"><Laptop size={20}/><div><strong>{device.label}</strong><p>Signed in {date(device.created)}</p></div></div>
      {device.current?<span className="xc-pill">This device</span>:<button type="button" className="xc-button xc-secondary" disabled={busy}
        onClick={()=>{if(confirm!==device.id){setConfirm(device.id);return;}setBusy(true);void api('devices/revoke',{id:device.id}).then(load)
          .then(()=>{setStatus('Device signed out.');setConfirm('');}).catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));}}>
        {confirm===device.id?'Confirm sign-out':'Sign out'}</button>}
    </div>)}
    {status && <p role="status">{status}</p>}
  </section>;
}

export function FilesPage({ summary=false }: { summary?:boolean }) {
  const [state,setState]=useState<Files|null>(null);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState('');
  const [creating,setCreating]=useState(false);
  const folder=summary?null:new URLSearchParams(window.location.search).get('folder');
  const folderPath=(id:string|null)=>id?'/files?folder='+encodeURIComponent(id):'/files';
  async function load(){setState(await api('files'+(folder?'?folder='+encodeURIComponent(folder):'')));}
  function change(operation:()=>Promise<unknown>, message:string){
    setBusy(true);
    setStatus('');
    void operation().then(load).then(()=>{setConfirm('');setCreating(false);setStatus(message);})
      .catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
  }
  useEffect(()=>{void load().catch(error=>setStatus(notice(error)));},[]);
  function upload(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(file.size<1||file.size>2*1024*1024){setStatus('Choose a file between 1 byte and 2 MB.');return;}
    change(async()=>api('files',{name:file.name,content:await fileAsBase64(file),folder}),'File uploaded.');
  }
  return <section className="xc-card xc-pad">
    <div className="xc-row-head"><span className="xc-symbol xc-lavender">{summary?<HardDrive size={21}/>:<File size={21}/>}</span>
      <div><h2>{summary?'Account file storage':'Your private files'}</h2><p>{summary?'Storage used by files in this account.':'Uploads are available only in your X-Center ID account.'}</p></div></div>
    {state && summary && <><div className="xc-storage"><strong>{formatBytes(state.used)}</strong><span> of {formatBytes(state.limit)} used</span></div>
      <div className="xc-storage-meter" role="meter" aria-label="Account storage" aria-valuemin={0} aria-valuemax={state.limit} aria-valuenow={Math.min(state.limit,state.used)}>
        {storageCategories.map(([id,,color])=><span aria-hidden="true" key={id} style={{backgroundColor:color,flex:state.categories[id]??0}}/>)}
        {state.limit>state.used&&<span style={{flex:state.limit-state.used}}/>}
      </div>
      <ul className="xc-storage-legend">{storageCategories.map(([id,label,color])=><li key={id}><span style={{backgroundColor:color}}/>{label}<strong>{formatBytes(state.categories[id]??0)}</strong></li>)}</ul>
      <a href="/files">Open file browser →</a></>}

    {!summary && <>
      <nav className="xc-actions xc-file-path" aria-label="Current folder">
        <a href={folderPath(null)} aria-current={folder?undefined:'page'}>Your files</a>
        {state?.breadcrumbs.map(item=><a key={item.id} href={folderPath(item.id)} aria-current={item.id===folder?'page':undefined}>{item.name}</a>)}
      </nav>
      <div className="xc-actions">
        <label className="xc-button xc-primary"><FileUp size={17}/> Upload file<input className="xc-sr" type="file" disabled={busy} onChange={upload}/></label>
        <button className="xc-button xc-secondary" type="button" onClick={()=>setCreating(!creating)} disabled={busy}><FolderPlus size={17}/> New folder</button>
      </div>
      {creating&&<form className="xc-inline-form" onSubmit={event=>{
        event.preventDefault();
        const name=new FormData(event.currentTarget).get('name');
        change(()=>api('files/folders',{name,folder}),'Folder created.');
      }}><label>Folder name<input name="name" maxLength={160} required/></label>
        <button className="xc-button xc-primary" disabled={busy}>Create folder</button>
      </form>}
      {state?.folders.map(item=><div className="xc-list-row" key={item.id}>
        <a className="xc-row-head" href={folderPath(item.id)}><Folder size={18}/><strong>{item.name}</strong></a>
        <button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>{
          if(confirm!==item.id){setConfirm(item.id);return;}
          change(()=>api('files/folders/'+item.id,{},'DELETE'),'Folder removed.');
        }} aria-label={confirm===item.id?'Confirm permanently removing '+item.name:'Remove folder '+item.name}><Trash2 size={16}/>{confirm===item.id?'Confirm removal':null}</button>
      </div>)}
      {state?.files.map(file=><div className="xc-list-row" key={file.id}>
        <div className="xc-file-meta"><a href={'/account/files/'+file.id}><strong>{file.name}</strong></a><p>{size(file.size)} · {date(file.created)}</p></div>
        <div className="xc-actions">
        <a className="xc-button xc-secondary" href={'/account/files/'+file.id} aria-label={'Download '+file.name}><Download size={16}/></a>
        <button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>{
          if(confirm!==file.id){setConfirm(file.id);return;}
          change(()=>api('files/'+file.id,{},'DELETE'),'File removed.');
        }} aria-label={confirm===file.id?'Confirm permanently removing '+file.name:'Remove '+file.name}><Trash2 size={16}/>{confirm===file.id?'Confirm removal':null}</button></div>
      </div>)}
      {state?.files.length===0 && state.folders.length===0 && <div className="xc-empty">This folder is empty.</div>}
    </>}
    {status && <p role="status">{status}</p>}
  </section>;
}

export function MailPage({ account }:{account:Account}) {
  const [messages,setMessages]=useState<{id:string;received:number;size:number}[]|null>(null);
  const [status,setStatus]=useState('');
  const [open,setOpen]=useState<{id:string;message:MailMessage}|null>(null);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [compose,setCompose]=useState(false);
  const [draft,setDraft]=useState({to:'',subject:'',text:''});
  const [busy,setBusy]=useState(false);
  const [formatted,setFormatted]=useState(false);
  const [attachment,setAttachment]=useState<{name:string;content:string}|undefined>();
  const [deliveryError,setDeliveryError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{void api('inbox').then(result=>setMessages(result.messages)).catch(error=>setStatus(notice(error)));},[]);
  useEffect(()=>{if(compose&&!dialog.current?.open)dialog.current?.showModal();},[compose]);
  return <section className={'xc-card xc-pad'+(account.canSendMail?' xc-inbox':'')}>
    <div className="xc-row-head"><span className="xc-symbol xc-sky"><Mail size={21}/></span><div><h2>{account.mailbox??'X-Center mailbox'}</h2>
    <p>{messages?'Your private mailbox.':'This address is reserved. Mailbox delivery is unavailable.'}</p></div></div>
    {messages&&!account.externalMail&&<p>This inbox can receive local X-Center mail. External delivery is unavailable.</p>}
    {messages?.length===0 && <div className="xc-empty">Your inbox is empty.</div>}
    {open ? <article className="xc-stack">
      <button className="xc-button xc-secondary xc-self-start" onClick={()=>{setOpen(null);setConfirmDelete(false);}}>Back to inbox</button>
      <h3>{open.message.subject || '(No subject)'}</h3>
      <p>{open.message.from}</p>
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{open.message.text}</p>
      {open.message.attachments.map(file=><a key={file.index} href={'/account/inbox/'+open.id+'/attachments/'+file.index}>{file.name} · {size(file.size)}</a>)}
      <a href={'/account/inbox/'+open.id}>Download original email</a>
      <div className="xc-row-head">
        <button type="button" disabled={busy} className="xc-button xc-secondary" onClick={()=>{
          if(!confirmDelete){setConfirmDelete(true);return;}
          const id=open.id;
          setBusy(true);
          void api('inbox/'+id,{},'DELETE').then(()=>{
            setMessages(previous=>previous?.filter(message=>message.id!==id)??null);
            setOpen(null);setConfirmDelete(false);setStatus('Email deleted.');
          }).catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
        }}><Trash2 size={18}/> {confirmDelete?'Confirm permanent deletion':'Delete email'}</button>
        {confirmDelete&&<button className="xc-button xc-secondary" disabled={busy} onClick={()=>setConfirmDelete(false)}>Cancel</button>}
      </div>
    </article> : messages?.map(message=><div className="xc-list-row" key={message.id}>
      <span>Received {date(message.received)} · {size(message.size)}</span>
      <button className="xc-button xc-secondary" disabled={busy} onClick={()=>{
        setBusy(true);setStatus('');
        void api('inbox/'+message.id+'/view').then(result=>setOpen({id:message.id,message:result}))
          .catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
      }}>Read email</button>
    </div>)}
    {account.canSendMail&&<div className="xc-mail-compose-action">
      <button type="button" className="xc-button xc-primary" onClick={()=>{setDeliveryError('');setCompose(true);}}><MailPlus size={18}/> New email</button>
    </div>}
    {compose&&<dialog ref={dialog} className="xc-compose-dialog" aria-labelledby="compose-title"
      onCancel={event=>{event.preventDefault();if(!busy)setCompose(false);}}>
      <div className="xc-compose-header"><h2 id="compose-title">New email</h2>
        <button type="button" className="xc-button xc-secondary" aria-label="Close compose" disabled={busy} onClick={()=>setCompose(false)}><X size={19}/></button>
      </div>
      <form className="xc-stack" onSubmit={event=>{
        event.preventDefault();setBusy(true);setDeliveryError('');
        void api('mail/send',{...draft,formatted,attachment}).then(()=>{
          setFormatted(false);setAttachment(undefined);
          setDraft({to:'',subject:'',text:''});setCompose(false);setStatus('Message accepted for delivery.');
        }).catch(error=>setDeliveryError(notice(error))).finally(()=>setBusy(false));
      }}>
        {!account.externalMailSubmission&&<p>Send to a X-Center mailbox.</p>}
        <label>Recipient<input type="email" autoFocus required value={draft.to} onChange={event=>setDraft({...draft,to:event.target.value})}/></label>
        <label>Subject<input required maxLength={120} value={draft.subject} onChange={event=>setDraft({...draft,subject:event.target.value})}/></label>
        <label>Message<textarea aria-label="Message" required rows={5} value={draft.text} onChange={event=>setDraft({...draft,text:event.target.value})}/></label>
        <label><input type="checkbox" checked={formatted} onChange={event=>setFormatted(event.target.checked)}/> Format message</label>
        {formatted&&<p>Use **bold** or _italics_ in your message.</p>}
        <label>Attachment (up to 256 KB)<input type="file" onChange={event=>{
          const file=event.target.files?.[0];event.target.value='';
          if(!file)return;
          if(file.size>256*1024 || !file.size){setDeliveryError('Choose a file between 1 byte and 256 KB.');return;}
          setBusy(true);
          void fileAsBase64(file).then(content=>{setAttachment({name:file.name,content});setDeliveryError('');})
            .catch(error=>setDeliveryError(notice(error))).finally(()=>setBusy(false));
        }}/></label>
        {attachment&&<button type="button" className="xc-button xc-secondary" onClick={()=>setAttachment(undefined)}>Remove {attachment.name}</button>}
        {deliveryError&&<p role="alert">{deliveryError}</p>}
        <button className="xc-button xc-primary xc-self-start" disabled={busy}>{busy?'Sending…':'Send email'}</button>
      </form>
    </dialog>}
    {status&&<p role="status">{status}</p>}
  </section>;
}

type AdminApp={id:string;name:string;status:string;callback:string;developerName?:string;repository?:string;verified:boolean};
type AdminDeveloper={owner:string;name:string;status:string;repository?:string};
type AdminUser={username:string;premium:boolean;capacity:number};
export function AdminPage() {
  const [users,setUsers]=useState<AdminUser[]>([]);
  const [apps,setApps]=useState<AdminApp[]>([]);
  const [developers,setDevelopers]=useState<AdminDeveloper[]>([]);
  const [filter,setFilter]=useState('');
  const [edit,setEdit]=useState<string|null>(null);
  const [capacity,setCapacity]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  async function refresh(){
    const [members,inventory]=await Promise.all([api('admin/accounts'),api('admin/apps')]);
    setUsers(members.accounts);setApps(inventory.apps);setDevelopers(inventory.developers);
  }
  useEffect(()=>{void refresh().catch(error=>setStatus(notice(error)));},[]);
  function save(path:string,value:object,success:string){
    setStatus('');setBusy(true);
    void api(path,value).then(refresh).then(()=>{setStatus(success);setEdit(null);})
      .catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
  }
  return <>
    <section className="xc-card xc-pad"><div className="xc-row-head"><span className="xc-symbol xc-lavender"><ShieldCheck size={21}/></span>
      <div><h2>Accounts</h2><p>Manage storage capacity and premium Hide My Email eligibility.</p></div></div>
      <label className="xc-admin-search">Find an account<input type="search" value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Username"/></label>
      {users.filter(user=>user.username.includes(filter.trim().toLowerCase())).map(user=><div className="xc-list-row xc-permission-row" key={user.username}>
        <div><strong>@{user.username}</strong><p>{formatBytes(user.capacity)} storage</p></div>
        {edit===user.username?<form className="xc-actions" onSubmit={event=>{
          event.preventDefault();save('admin/storage',{username:user.username,capacity:Number(capacity)*1024**2},'Storage capacity updated.');
        }}><label>Capacity in MB<input required type="number" min={1} max={1024} step={1} value={capacity} onChange={event=>setCapacity(event.target.value)}/></label>
          <button className="xc-button xc-primary" disabled={busy}>Save capacity</button>
          <button className="xc-button xc-secondary" type="button" onClick={()=>setEdit(null)} disabled={busy}>Cancel</button>
        </form>:<div className="xc-actions">
          <button className="xc-button xc-secondary" disabled={busy} onClick={()=>{setEdit(user.username);setCapacity(String(Math.round(user.capacity/1024**2)));}}>Change storage</button>
          <button className="xc-button xc-secondary" disabled={busy} onClick={()=>
            save('admin/premium',{username:user.username,enabled:!user.premium},'Eligibility updated.')}>
            {user.premium?'Disable premium aliases':'Enable premium aliases'}
          </button></div>}
      </div>)}
    </section>
    <section className="xc-card xc-pad"><div className="xc-row-head"><BadgeCheck size={21}/><h2>Developer verification</h2></div>
      {developers.length===0&&<p className="xc-empty">No developer reviews.</p>}
      {developers.map(developer=><div className="xc-list-row xc-permission-row" key={developer.owner}>
        <div><strong>{developer.name}</strong><p>{developer.status==='verified'?'Verified':'Review requested'}</p>
          {developer.repository&&<a href={developer.repository} target="_blank" rel="noreferrer">Review GitHub repository</a>}</div>
        <button className="xc-button xc-secondary" disabled={busy} onClick={()=>
          save('admin/apps',{type:'developer',id:developer.owner,verified:developer.status!=='verified'},'Developer verification updated.')}>
          {developer.status==='verified'?'Remove verification':'Verify developer'}
        </button>
      </div>)}
    </section>
    <section className="xc-card xc-pad"><div className="xc-row-head"><BadgeCheck size={21}/><h2>Registered apps</h2></div>
      {apps.length===0&&<p className="xc-empty">No registered developer apps.</p>}
      {apps.map(app=><div className="xc-list-row xc-permission-row" key={app.id}>
        <div><strong>{app.name}</strong><p>{app.developerName??'Developer'} · {app.status}</p>
          <p>{new URL(app.callback).hostname}</p>{app.repository&&<a href={app.repository} rel="noreferrer" target="_blank">Review repository</a>}</div>
        {app.status==='active'&&<button className="xc-button xc-secondary" disabled={busy}
          onClick={()=>save('admin/apps',{type:'app',id:app.id,verified:!app.verified},'App verification updated.')}>
          {app.verified?'Remove verification':'Verify app'}</button>}
      </div>)}
    </section>
    {status&&<p className="xc-notice" role="status">{status}</p>}
  </>;
}

export function ConnectedApps() {
  const [apps,setApps]=useState<{client:string;label:string;updated:number}[]|null>(null);
  const [status,setStatus]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{void api('connected-apps').then(data=>setApps(data.apps)).catch(error=>setStatus(notice(error)));},[]);
  return <div className="xc-pad">
    <h2>Authorized apps</h2>
    {apps?.length===0 && <div className="xc-empty">No apps have been authorized yet.</div>}
    {apps?.map(item=><div className="xc-list-row" key={item.client}><div><strong>{item.label}</strong><p>Last authorized {date(item.updated)}</p></div>
      <div className="xc-actions"><a href={'/permissions/'+encodeURIComponent(item.client)}>Manage data access</a>
        {confirm===item.client?<><span>This ends the app’s access.</span><button className="xc-button xc-secondary" disabled={busy} onClick={()=>{
          setBusy(true);
          void api('connected-apps/unlink',{client:item.client}).then(()=>{
            setApps(previous=>previous?.filter(app=>app.client!==item.client)??null);
            setConfirm('');setStatus('App unlinked.');
          }).catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
        }}>Confirm unlink</button><button className="xc-button xc-secondary" disabled={busy} onClick={()=>setConfirm('')}>Cancel</button></>
          :<button className="xc-button xc-secondary" disabled={busy} onClick={()=>setConfirm(item.client)}>Unlink app</button>}
      </div></div>)}
    {status&&<p role="status">{status}</p>}
  </div>;
}
