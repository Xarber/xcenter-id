import { formatBytes, storageCategories } from './storage-summary';
import { File, FileUp, Folder, FolderPlus, HardDrive, Laptop, Mail, Monitor, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
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
        }}>{confirm===item.id?'Confirm folder removal':'Remove folder'}</button>
      </div>)}
      {state?.files.map(file=><div className="xc-list-row" key={file.id}>
        <div className="xc-file-meta"><a href={'/account/files/'+file.id}><strong>{file.name}</strong></a><p>{size(file.size)} · {date(file.created)}</p></div>
        <button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>{
          if(confirm!==file.id){setConfirm(file.id);return;}
          change(()=>api('files/'+file.id,{},'DELETE'),'File removed.');
        }}><Trash2 size={15}/>{confirm===file.id?'Confirm removal':'Remove'}</button>
      </div>)}
      {state?.files.length===0 && state.folders.length===0 && <div className="xc-empty">This folder is empty.</div>}
    </>}
    {status && <p role="status">{status}</p>}
  </section>;
}

export function MailPage({ account }:{account:Account}) {
  const [messages,setMessages]=useState<{id:string;received:number;size:number}[]|null>(null);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{void api('inbox').then(result=>setMessages(result.messages)).catch(()=>{});},[]);
  return <section className="xc-card xc-pad">
    <div className="xc-row-head"><span className="xc-symbol xc-sky"><Mail size={21}/></span><div><h2>{account.mailbox??'X-Center mailbox'}</h2>
    <p>{messages?'Your private mailbox.':'This address is reserved. Mailbox delivery is unavailable.'}</p></div></div>
    {messages&&!account.externalMail&&<p>This inbox can receive local X-Center mail. External delivery is unavailable.</p>}
    {messages?.length===0 && <div className="xc-empty">Your inbox is empty.</div>}
    {messages?.map(message=><div className="xc-list-row" key={message.id}><span>Received {date(message.received)} · {size(message.size)}</span>
      <a href={'/account/inbox/'+message.id}>Download email</a></div>)}
    {account.canSendMail && <form className="xc-stack" onSubmit={event=>{
      event.preventDefault(); const values=Object.fromEntries(new FormData(event.currentTarget));setBusy(true);
      void api('mail/send',values).then(()=>setStatus('The mail provider accepted your message.')).catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
    }}>
      <h3>Compose email</h3>{!account.externalMailSubmission&&<p>You can send to X-Center mailboxes.</p>}<label>Recipient<input type="email" required name="to"/></label><label>Subject<input required name="subject"/></label>
      <label>Message<textarea required name="text" rows={4}/></label><button className="xc-button xc-primary" disabled={busy}>Send email</button>
    </form>}
    {status && <p role="status">{status}</p>}
  </section>;
}

export function AdminPage() {
  const [users,setUsers]=useState<{username:string;premium:boolean}[]>([]);
  const [status,setStatus]=useState('');
  async function refresh(){setUsers((await api('admin/accounts')).accounts);}
  useEffect(()=>{void refresh().catch(error=>setStatus(notice(error)));},[]);
  return <section className="xc-card xc-pad"><div className="xc-row-head"><span className="xc-symbol xc-lavender"><ShieldCheck size={21}/></span>
    <div><h2>Manage X-Center IDs</h2><p>Manage eligibility for premium Hide My Email addresses.</p></div></div>
    {users.map(user=><div className="xc-list-row" key={user.username}><strong>@{user.username}</strong><button className="xc-button xc-secondary"
      onClick={()=>{void api('admin/premium',{username:user.username,enabled:!user.premium}).then(refresh)
        .then(()=>setStatus('Eligibility updated.')).catch(error=>setStatus(notice(error)));}}>
      {user.premium?'Disable premium aliases':'Enable premium aliases'}</button></div>)}
    {status && <p role="status">{status}</p>}
  </section>;
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
      <div className="xc-actions"><a href="/permissions">Manage data access</a>
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
