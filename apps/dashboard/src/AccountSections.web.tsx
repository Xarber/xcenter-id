import AdminSearch from './AdminSearch.web';
import ListPages from './ListPages.web';
import {useListPage} from './list-page';
import CallbackApproval,{type ReviewedRegistration} from './CallbackApproval.web';
import {useConfirmDialog} from './dialog-model';
import {useFileTransfers} from './file-transfers';
import {destinationLabels,type FolderDestination} from './file-destinations';
import AppFileContainer from './AppFileContainer.web';
import type { AppFileContainer as Container } from './account-file-containers';
import TrustBadges from './TrustBadges.web';
import AdminStorageVolumes from './AdminStorageVolumes.web';
import AppIcon from './AppIcon.web';
import Reauthenticate,{confirmIdentity} from './Reauthenticate.web';
import { AdminAccounts, IconAction } from './AdminUsers.web';
import { AdminUsernameChanges } from './UsernameChange.web';
import { AdminSupport } from './Support.web';
import { accountMessage } from './account-locale';
import type { Friend } from './friends-model';
import type { MailMessage, PrivateAddress } from './mail-message';
import { formatBytes, storageCategories } from './storage-summary';
import { Database, Bold, Italic, Paperclip, UserRound, Grid2X2, BadgeCheck, File, FileUp, Folder, FolderInput, FolderPlus, Pencil, Check, HardDrive, Laptop, Mail, MailPlus, Monitor, Shield, ShieldCheck, Trash2, X } from 'lucide-react';
import { Fragment as FileTableRows, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { api, fileAsBase64, type Account } from './web-account';

function notice(error:unknown) { return error instanceof Error ? error.message : 'Could not complete this action.'; }
const date = (value:number)=>new Date(value).toLocaleDateString(undefined,{dateStyle:'medium'});
const size = (value:number)=>value>1024*1024 ? (value/(1024*1024)).toFixed(1)+' MB' : Math.ceil(value/1024)+' KB';

type Session = { id:string;label:string;created:number;current:boolean };
type StoredFile = { id:string;name:string;size:number;created:number };
type FolderItem = {id:string;name:string;size?:number};
type Files = { appContainers?:Container[]; files:StoredFile[]; folders:FolderItem[]; breadcrumbs:FolderItem[]; categories:Record<string,number>; used:number; total:number; limit:number };

export function DevicesPage() {
  const [devices,setDevices]=useState<Session[]>([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState('');
  const page=useListPage(devices.length);
  async function load(){setDevices((await api('devices')).devices);}
  useEffect(()=>{void load().catch(error=>setStatus(notice(error)));},[]);
  return <section className="xc-card xc-pad">
    <div className="xc-row-head"><span className="xc-symbol xc-sky"><Monitor size={21}/></span><div><h2>Signed-in devices</h2><p>Review and end active browser sessions.</p></div></div>
    <p><a className="xc-button xc-secondary" href="/device">Enter a device code</a></p>
    {devices.slice(page.start,page.end).map(device=><div className="xc-list-row" key={device.id}>
      <div className="xc-row-head"><Laptop size={20}/><div><strong>{device.label}</strong><p>Signed in {date(device.created)}</p></div></div>
      {device.current?<span className="xc-pill">This device</span>:<button type="button" className="xc-button xc-secondary" disabled={busy}
        onClick={()=>{if(confirm!==device.id){setConfirm(device.id);return;}setBusy(true);void api('devices/revoke',{id:device.id}).then(load)
          .then(()=>{setStatus('Device signed out.');setConfirm('');}).catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));}}>
        {confirm===device.id?'Confirm sign-out':'Sign out'}</button>}
    </div>)}
    {status && <p role="status">{status}</p>}
    <ListPages state={page} label="Devices"/>
  </section>;
}

export function FilesPage({ summary=false }: { summary?:boolean }) {
  const confirmAction=useConfirmDialog();
  const [state,setState]=useState<Files|null>(null);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState('');
  const [creating,setCreating]=useState(false);
  const [renaming,setRenaming]=useState<{id:string;name:string}|null>(null);
  const [sharing,setSharing]=useState('');
  const [friends,setFriends]=useState<Friend[]>([]);
  const [query,setQuery]=useState(()=>new URLSearchParams(window.location.search));
  const container=summary?null:query.get('app');
  const folder=summary||container?null:query.get('folder');
  const currentFolder=useRef(folder);
  currentFolder.current=folder;
  const transfers=useFileTransfers();
  const [moving,setMoving]=useState<{id:string;name:string;folder:boolean}|null>(null);
  const [destinations,setDestinations]=useState<FolderDestination[]>([]);
  const [dragging,setDragging]=useState(false);
  const [dropTarget,setDropTarget]=useState<string|null>(null);
  const dragged=useRef<typeof moving>(null);
  const moveDialog=useRef<HTMLDialogElement>(null);
  const folderPath=(id:string|null)=>id?'/files?folder='+encodeURIComponent(id):'/files';
  async function load(){
    const target=currentFolder.current;
    const next=await api('files'+(target?'?folder='+encodeURIComponent(target):''));
    if(currentFolder.current===target)setState(next);
  }
  function goTo(target:string|null){
    history.pushState(null,'',folderPath(target));
    setQuery(new URLSearchParams(window.location.search));
  }
  function change(operation:()=>Promise<unknown>, message:string){
    setBusy(true);
    setStatus('');
    void operation().then(load).then(()=>{setConfirm('');setCreating(false);setRenaming(null);setStatus(message);})
      .catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
  }
  useEffect(()=>{
    const sync=()=>setQuery(new URLSearchParams(window.location.search));
    window.addEventListener('popstate',sync);
    return ()=>window.removeEventListener('popstate',sync);
  },[]);
  useEffect(()=>{void load().catch(error=>setStatus(notice(error)));},[folder]);
  useEffect(()=>{if(moving)moveDialog.current?.showModal();},[moving]);
  function add(files:FileList|File[]){
    if(!files.length)return;
    setStatus('');
    transfers.add(Array.from(files,file=>({name:file.name,size:file.size,read:(offset,size)=>fileAsBase64(file.slice(offset,offset+size))})),
      folder,api,()=>void load().catch(error=>setStatus(notice(error))),error=>setStatus(notice(error)));
  }
  function upload(event:ChangeEvent<HTMLInputElement>){
    if(event.target.files)add(event.target.files);
    event.target.value='';
  }
  function move(entry:NonNullable<typeof moving>,target:string|null){
    if(target===folder)return;
    change(()=>api('files/'+(entry.folder?'folders/':'')+entry.id,{folder:target},'PATCH'),entry.name+' moved.');
  }
  function chooseMove(entry:NonNullable<typeof moving>){
    void api('files/destinations').then(result=>{setDestinations(result.folders);setMoving(entry);}).catch(error=>setStatus(notice(error)));
  }
  function startDrag(event:DragEvent,entry:NonNullable<typeof moving>){
    if(busy){event.preventDefault();return;}
    dragged.current=entry;
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('application/x-xcenter-file',entry.id);
  }
  function drop(event:DragEvent,target=folder){
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    setDropTarget(null);
    if(event.dataTransfer.files.length){
      if(target===folder)add(event.dataTransfer.files);
      else transfers.add(Array.from(event.dataTransfer.files,file=>({name:file.name,size:file.size,read:(offset,size)=>fileAsBase64(file.slice(offset,offset+size))})),
        target,api,()=>void load().catch(error=>setStatus(notice(error))),error=>setStatus(notice(error)));
    }else if(dragged.current&&!busy&&dragged.current.id!==target&&event.dataTransfer.getData('application/x-xcenter-file')===dragged.current.id){
      move(dragged.current,target);
    }
    dragged.current=null;
  }
  function folderTarget(target:string|null){
    return {
      onDragOver:(event:DragEvent)=>{event.preventDefault();event.stopPropagation();setDropTarget(target??'root');},
      onDragLeave:()=>setDropTarget(null),
      onDrop:(event:DragEvent)=>drop(event,target),
    };
  }
  function nameField(label:string,value:string,submit:(name:string)=>void,cancel:()=>void){
    return <form className="xc-file-name-form" onSubmit={event=>{
      event.preventDefault();
      const name=String(new FormData(event.currentTarget).get('name')??'').trim();
      if(name)submit(name);
    }} onKeyDown={event=>{if(event.key==='Escape')cancel();}}>
      <input name="name" autoFocus aria-label={label} defaultValue={value} maxLength={160} required/>
      <button type="submit" className="xc-file-icon" aria-label="Save name" disabled={busy}><Check size={17}/></button>
      <button type="button" className="xc-file-icon" aria-label="Cancel" onClick={cancel}><X size={17}/></button>
    </form>;
  }
  if(container){
    const app=state?.appContainers?.find(item=>item.client===container&&(item.canBrowse??item.canManage));
    if(app)return <AppFileContainer app={app}/>;
    return <section className="xc-card xc-pad"><a href="/files">Back to your files</a><p role="status">{status||(state?'App folder unavailable.':'Loading folder…')}</p></section>;
  }
  return <section className="xc-card xc-pad" data-file-drop={dragging||undefined}
    onDragOver={summary?undefined:event=>{
      if(event.dataTransfer.types.includes('Files')){event.preventDefault();setDragging(true);}
    }}
    onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDragging(false);}}
    onDrop={summary?undefined:event=>drop(event)}>
    <div className="xc-row-head"><span className="xc-symbol xc-lavender">{summary?<HardDrive size={21}/>:<File size={21}/>}</span>
      <div><h2>{summary?'Account storage':'Your private files'}</h2><p>{summary?'Files, app containers and other data in this account.':'Uploads are available only in your X-Center ID account.'}</p></div></div>
    {state && summary && <><div className="xc-storage"><strong>{formatBytes(state.used)}</strong><span> of {formatBytes(state.limit)} used</span></div>
      <div className="xc-storage-meter" role="meter" aria-label="Account storage" aria-valuemin={0} aria-valuemax={state.limit} aria-valuenow={Math.min(state.limit,state.used)}>
        {storageCategories.map(([id,,color])=><span aria-hidden="true" key={id} style={{backgroundColor:color,flex:state.categories[id]??0}}/>)}
        {state.limit>state.used&&<span style={{flex:state.limit-state.used}}/>}
      </div>
      <ul className="xc-storage-legend">{storageCategories.map(([id,label,color])=><li key={id}><span style={{backgroundColor:color}}/>{label}<strong>{formatBytes(state.categories[id]??0)}</strong></li>)}</ul>
      {!!state.appContainers?.length&&<div className="xc-stack"><h3>App containers in your account</h3>
        {state.appContainers.map(app=><div className="xc-list-row" key={app.client}><div className="xc-row-head"><AppIcon icon={app.icon}/><span>{app.name}</span></div><strong>{formatBytes(app.bytes)}</strong></div>)}</div>}
      </>}

    {!summary && <>
      <div className="xc-file-toolbar">
        <nav className="xc-actions xc-file-path" aria-label="Current folder">
          <a href={folderPath(null)} {...folderTarget(null)} data-file-target={dropTarget==='root'||undefined} onClick={event=>{event.preventDefault();goTo(null);}} aria-current={folder?undefined:'page'}>Your files</a>
          {state?.breadcrumbs.map(item=><a key={item.id} href={folderPath(item.id)} {...folderTarget(item.id)} data-file-target={dropTarget===item.id||undefined} onClick={event=>{event.preventDefault();goTo(item.id);}} aria-current={item.id===folder?'page':undefined}>{item.name}</a>)}
        </nav>
        <label className="xc-file-icon" title="Upload files"><FileUp size={19} aria-hidden="true"/>
          <input className="xc-sr" type="file" multiple aria-label="Upload files" disabled={busy} onChange={upload}/>
        </label>
      </div>
      <table className="xc-file-table">
        <thead><tr><th scope="col">Name</th><th scope="col">Size</th><th scope="col" className="xc-file-date">Added</th><th scope="col"><span className="xc-sr">Actions</span></th></tr></thead>
        <tbody>
        <tr><td colSpan={4}>{creating?<div className="xc-file-name"><Folder size={18}/>
          {nameField('New folder name','',name=>change(()=>api('files/folders',{name,folder}),'Folder created.'),()=>setCreating(false))}
          </div>:<button type="button" className="xc-file-new" onClick={()=>{setCreating(true);setRenaming(null);}} disabled={busy}><FolderPlus size={18}/> New folder</button>}</td></tr>
        {!folder&&state?.appContainers?.filter(app=>app.showInFiles).map(app=><tr key={app.client}>
          <td>{(app.canBrowse??app.canManage)?<a className="xc-file-name" href={'/files?app='+encodeURIComponent(app.client)}><AppIcon icon={app.icon} compact/><strong>{app.name}</strong></a>
            :<div className="xc-file-name"><AppIcon icon={app.icon} compact/><strong>{app.name}</strong></div>}</td>
          <td>{formatBytes(app.bytes)}</td><td className="xc-file-date">—</td><td/>
        </tr>)}
        {state?.folders.map(item=><tr key={item.id} draggable={!renaming&&!busy} {...folderTarget(item.id)}
          data-file-target={dropTarget===item.id||undefined} onDragStart={event=>startDrag(event,{...item,folder:true})} onDragEnd={()=>{dragged.current=null;setDropTarget(null);}}>
          <td>{renaming?.id===item.id?<div className="xc-file-name"><Folder size={18}/>
            {nameField('Folder name',renaming.name,name=>change(()=>api('files/folders/'+item.id,{name},'PATCH'),'Folder renamed.'),()=>setRenaming(null))}
          </div>:<a className="xc-file-name" href={folderPath(item.id)} onClick={event=>{event.preventDefault();goTo(item.id);}}><Folder size={18}/><strong>{item.name}</strong></a>}</td>
          <td>{formatBytes(item.size??0)}</td><td className="xc-file-date">—</td><td><div className="xc-file-actions">
            <button className="xc-file-icon" aria-label={'Rename '+item.name} onClick={()=>{setCreating(false);setRenaming(item);}} disabled={busy}><Pencil size={16}/></button>
            <button type="button" className="xc-file-icon" aria-label={'Move '+item.name} disabled={busy} onClick={()=>chooseMove({...item,folder:true})}><FolderInput size={16}/></button>
            <button type="button" className="xc-file-icon" disabled={busy} onClick={async()=>{
              if(!await confirmAction('Permanently remove '+item.name+' and everything inside it?'))return;
              change(()=>api('files/folders/'+item.id+'?recursive=1',{},'DELETE'),'Folder and contents removed.');
            }} aria-label={'Remove folder '+item.name}><Trash2 size={16}/></button>
          </div></td>
        </tr>)}
        {transfers.rows.filter(row=>row.folder===folder).map(row=><tr key={'upload-'+row.key}>
          <td><div className="xc-file-name"><File size={18}/><strong>{row.name}</strong></div></td><td>{formatBytes(row.size)}</td>
          <td className="xc-file-date">—</td><td><div className="xc-file-actions xc-transfer">
            <div><progress aria-label={'Upload progress for '+row.name} max={Math.max(row.size,1)} value={row.sent}/>
              <small>{row.size?Math.floor(row.sent/row.size*100):0}% ({formatBytes(row.sent)} / {formatBytes(row.size)})</small></div>
            <button type="button" className="xc-file-icon" disabled={row.finishing} aria-label={'Cancel upload of '+row.name} onClick={()=>transfers.cancel(row.key)}><X size={16}/></button>
          </div></td>
        </tr>)}
        {state?.files.map(file=><FileTableRows key={file.id}>
          <tr draggable={!renaming&&!busy} onDragStart={event=>startDrag(event,{...file,folder:false})} onDragEnd={()=>{dragged.current=null;setDropTarget(null);}}>
            <td>{renaming?.id===file.id?<div className="xc-file-name"><File size={18}/>
              {nameField('File name',renaming.name,name=>change(()=>api('files/'+file.id,{name},'PATCH'),'File renamed.'),()=>setRenaming(null))}
            </div>:<a className="xc-file-name" href={'/account/files/'+file.id}><File size={18}/><strong>{file.name}</strong></a>}</td>
            <td>{formatBytes(file.size)}</td><td className="xc-file-date">{date(file.created)}</td>
            <td><div className="xc-file-actions">
              <button className="xc-file-icon" aria-label={'Rename '+file.name} onClick={()=>{setCreating(false);setRenaming(file);}} disabled={busy}><Pencil size={16}/></button>
              <button type="button" className="xc-file-icon" aria-label={'Share '+file.name} disabled={busy} onClick={()=>{
                if(sharing===file.id){setSharing('');return;}
                setSharing(file.id);setFriends([]);
                void api('friends').then(result=>setFriends(result.friends)).catch(error=>setStatus(notice(error)));
              }}><UserRound size={16}/></button>
              <button type="button" className="xc-file-icon" aria-label={'Move '+file.name} disabled={busy} onClick={()=>chooseMove({...file,folder:false})}><FolderInput size={16}/></button>
              <button type="button" className="xc-file-icon" disabled={busy} onClick={()=>{
                if(confirm!==file.id){setConfirm(file.id);return;}
                change(()=>api('files/'+file.id,{},'DELETE'),'File removed.');
              }} aria-label={confirm===file.id?'Confirm permanently removing '+file.name:'Remove '+file.name}>{confirm===file.id?<Check size={16}/>:<Trash2 size={16}/>}</button>
            </div></td>
          </tr>
          {sharing===file.id&&<tr><td colSpan={4}><div className="xc-stack">
            {!friends.length&&<p>Find or invite a friend from Friends.</p>}
            {friends.map(friend=><button type="button" className="xc-button xc-secondary" key={friend.id} disabled={busy}
              onClick={()=>change(async()=>{await api('files/shared',{file:file.id,friend:friend.id});setSharing('');},'Access granted.')}>Share with @{friend.username}</button>)}
          </div></td></tr>}
        </FileTableRows>)}
        </tbody>
      </table>
      {transfers.rows.every(row=>row.folder!==folder)&&state?.files.length===0 && state.folders.length===0 && (folder||!state.appContainers?.some(app=>app.showInFiles)) && <div className="xc-empty">This folder is empty.</div>}
    </>}
    {moving&&<dialog className="xc-intro xc-release-dialog" ref={moveDialog} aria-labelledby="move-heading" onCancel={event=>{event.preventDefault();setMoving(null);}}>
      <h2 id="move-heading">Move {moving.name}</h2>
      <form className="xc-stack" onSubmit={event=>{
        event.preventDefault();
        const target=String(new FormData(event.currentTarget).get('destination')??'');
        move(moving,target||null);setMoving(null);
      }}><label>Destination <select name="destination" defaultValue={folder??''}>
        <option value="">Your files</option>
        {destinationLabels(destinations,moving.folder?moving.id:undefined).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label><div className="xc-actions"><button type="button" className="xc-button xc-secondary" onClick={()=>setMoving(null)}>Cancel</button>
        <button className="xc-button xc-primary" type="submit">Move</button></div></form>
    </dialog>}
    {status && <p role="status">{status}</p>}
  </section>;
}

const mailLocation=()=>/^\/mail\/([0-9a-f-]{36})$/.exec(window.location.pathname)?.[1]??null;

export function MailPage({ account }:{account:Account}) {
  const confirmAction=useConfirmDialog();
  const [messages,setMessages]=useState<{id:string;received:number;size:number;subject?:string;from?:string;preview?:string}[]|null>(null);
  const [inboxCursor,setInboxCursor]=useState<string|null>(null);
  const [selecting,setSelecting]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const [confirmSelection,setConfirmSelection]=useState(false);
  const [status,setStatus]=useState('');
  const [messageId,setMessageId]=useState(mailLocation);
  const [loaded,setLoaded]=useState<{id:string;message:MailMessage}|null>(null);
  const open=loaded?.id===messageId?loaded:null;
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [premiumAliases,setPremiumAliases]=useState(false);const [aliasName,setAliasName]=useState('');const [creatingAlias,setCreatingAlias]=useState(false);
  const [aliases,setAliases]=useState<PrivateAddress[]>([]);
  const [confirmAlias,setConfirmAlias]=useState('');
  const [compose,setCompose]=useState(false);
  const [draft,setDraft]=useState({to:'',subject:'',text:''});
  const [sender,setSender]=useState('');
  const [busy,setBusy]=useState(false);
  const [formatted,setFormatted]=useState(false);
  const [attachment,setAttachment]=useState<{name:string;content:string}|undefined>();
  const [deliveryError,setDeliveryError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  const editor=useRef<HTMLTextAreaElement>(null);
  const filePicker=useRef<HTMLInputElement>(null);
  function wrapSelection(marker:string){
    const field=editor.current;
    if(!field)return;
    const {selectionStart:start,selectionEnd:end}=field;
    setFormatted(true);
    setDraft(value=>({...value,text:value.text.slice(0,start)+marker+value.text.slice(start,end)+marker+value.text.slice(end)}));
    requestAnimationFrame(()=>{field.focus();field.setSelectionRange(start+marker.length,end+marker.length);});
  }
  useEffect(()=>{void api('inbox').then(result=>{
    setMessages(result.messages);setInboxCursor(result.nextCursor??null);
  }).catch(error=>setStatus(notice(error)));},[]);
  useEffect(()=>{
    if(account.canReceiveMail)void api('mail/aliases').then(result=>{setAliases(result.aliases);setPremiumAliases(result.premium);}).catch(()=>{});
  },[account.canReceiveMail]);
  useEffect(()=>{if(compose&&!dialog.current?.open)dialog.current?.showModal();},[compose]);
  useEffect(()=>{
    const sync=()=>{setStatus('');setConfirmDelete(false);setMessageId(mailLocation());};
    window.addEventListener('popstate',sync);
    return ()=>window.removeEventListener('popstate',sync);
  },[]);
  useEffect(()=>{
    if(!messageId)return;
    let current=true;
    void api('inbox/'+messageId+'/view').then(message=>{
      if(current)setLoaded({id:messageId,message});
    }).catch(error=>{if(current)setStatus(notice(error));});
    return ()=>{current=false;};
  },[messageId]);

  function returnToInbox() {
    if(window.history.state?.inboxNavigation) window.history.back();
    else {
      window.history.replaceState(null,'','/mail');
      setMessageId(null);setConfirmDelete(false);
    }
  }

  return <section className={'xc-card xc-pad xc-mailbox'+(account.canSendMail?' xc-inbox':'')}>
    <div className="xc-row-head"><span className="xc-symbol xc-sky"><Mail size={21}/></span><div><h2>{account.mailbox??'X-Center mailbox'}</h2>
    <p>{messages?'Your private mailbox.':'This address is reserved. Mailbox delivery is unavailable.'}</p></div></div>
    {messages&&!account.externalMail&&<p>This inbox can receive local X-Center mail. External delivery is unavailable.</p>}
    {!messageId&&messages?.length===0 && <div className="xc-empty">{accountMessage('inboxEmpty','Your inbox is empty.')}</div>}
    {messageId&&<button className="xc-button xc-secondary xc-self-start" onClick={()=>{
      setStatus('');returnToInbox();
    }}>{accountMessage('backToInbox','Back to inbox')}</button>}
    {!messageId&&!!messages?.length&&<div className="xc-actions">
      <button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>{
        setSelecting(!selecting);setSelected([]);setConfirmSelection(false);
      }}>{selecting?'Cancel selection':'Select messages'}</button>
      {selecting&&<button type="button" className="xc-button xc-secondary" disabled={busy||!selected.length} onClick={()=>{
        if(!confirmSelection){setConfirmSelection(true);return;}
        setBusy(true);setStatus('');
        void api('inbox',{ids:selected},'DELETE').then(({deleted})=>{
          const ids=new Set(selected);
          setMessages(previous=>previous?.filter(message=>!ids.has(message.id))??null);
          setSelecting(false);setSelected([]);setConfirmSelection(false);
          setStatus(deleted+' messages deleted.');
        }).catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
      }}>{confirmSelection?'Confirm permanent deletion':'Delete selected ('+selected.length+')'}</button>}
    </div>}
    {open ? <article className="xc-stack">
      <h3>{open.message.subject || accountMessage('noSubject','(No subject)')}</h3>
      <p>{open.message.from}</p>{open.message.badges?.verified&&<span className="xc-pill"><BadgeCheck size={16}/> Verified sender</span>}{open.message.badges?.admin&&<span className="xc-pill"><ShieldCheck size={16}/> Administrator</span>}
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{open.message.text}</p>
      {open.message.attachments.map(file=><a key={file.index} href={'/account/inbox/'+open.id+'/attachments/'+file.index}>{file.name} · {size(file.size)}</a>)}
      <a href={'/account/inbox/'+open.id}>{accountMessage('downloadEmail','Download original email')}</a>
      <div className="xc-row-head">
        <button type="button" disabled={busy} className="xc-button xc-secondary" onClick={()=>{
          if(!confirmDelete){setConfirmDelete(true);return;}
          const id=open.id;
          setBusy(true);
          void api('inbox/'+id,{},'DELETE').then(()=>{
            setMessages(previous=>previous?.filter(message=>message.id!==id)??null);
            window.history.replaceState(null,'','/mail');
            setMessageId(null);setLoaded(null);setConfirmDelete(false);setStatus(accountMessage('emailDeleted','Email deleted.'));
          }).catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
        }}><Trash2 size={18}/> {confirmDelete?accountMessage('confirmEmailDeletion','Confirm permanent deletion'):accountMessage('deleteEmail','Delete email')}</button>
        {confirmDelete&&<button className="xc-button xc-secondary" disabled={busy} onClick={()=>setConfirmDelete(false)}>{accountMessage('cancel','Cancel')}</button>}
      </div>
    </article> : !messageId&&messages?.map(message=><div className="xc-list-row" key={message.id}>
      <span className="xc-avatar"><UserRound size={18}/></span><div className="xc-mail-preview"><strong>{message.subject||'(No subject)'}</strong><span>{message.from||'Unknown sender'}</span>{message.preview&&<p>{message.preview}</p>}<small>{date(message.received)}</small></div>
      {selecting?<label><input type="checkbox" checked={selected.includes(message.id)}
        disabled={busy||(!selected.includes(message.id)&&selected.length>=100)} onChange={event=>{
          const checked=event.target.checked;
          setSelected(previous=>checked?[...previous,message.id]:previous.filter(id=>id!==message.id));setConfirmSelection(false);
        }}/> Select message</label>:
      <button className="xc-button xc-secondary" disabled={busy} onClick={()=>{
        setStatus('');
        window.history.pushState({inboxNavigation:true},'','/mail/'+message.id);
        setMessageId(message.id);
      }}>{accountMessage('readEmail','Read email')}</button>}
    </div>)}
    {!messageId&&inboxCursor&&<button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>{
      setBusy(true);setStatus('');
      void api('inbox?cursor='+encodeURIComponent(inboxCursor)).then(result=>{
        setMessages(previous=>[...(previous??[]),...result.messages]);setInboxCursor(result.nextCursor);
      }).catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
    }}>{accountMessage('olderEmail','Load older email')}</button>}
    {!messageId&&account.externalMailLimits&&<p>External email allowance: {account.externalMailLimits.usedToday} / {account.externalMailLimits.daily??'unlimited'} today · {account.externalMailLimits.usedMonth} / {account.externalMailLimits.monthly??'unlimited'} this month.</p>}
    {!messageId&&account.canReceiveMail&&<section className="xc-mail-tools"><div className="xc-actions"><button className="xc-button xc-secondary" onClick={()=>setCreatingAlias(!creatingAlias)}>Create private email address</button><a className="xc-button xc-secondary" href="/mail-clients">Mail clients</a></div>{creatingAlias&&<form className="xc-stack" onSubmit={event=>{event.preventDefault();setBusy(true);void api('mail/aliases',{name:aliasName||undefined}).then(()=>api('mail/aliases')).then(result=>{setAliases(result.aliases);setAliasName('');setCreatingAlias(false);setStatus('Private address created.');}).catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));}}>{account.admin&&premiumAliases&&<label>Address name (optional)<input value={aliasName} maxLength={24} pattern="[a-zA-Z][a-zA-Z0-9]{2,23}" onChange={e=>setAliasName(e.target.value)}/></label>}<p>Generate a separate address that delivers to this inbox.</p><button className="xc-button xc-primary" disabled={busy}>Create address</button></form>}</section>}
    {!messageId&&aliases.length>0&&<section id="private-addresses" className="xc-stack">
      <h3>{accountMessage('privateAddresses','Hide My Email addresses')} · {aliases.filter(item=>item.active).length} On / {aliases.filter(item=>!item.active).length} Off</h3><p>On forwards incoming mail to your inbox. Off stops new deliveries to that address.</p>
      {aliases.map(item=><div className="xc-list-row" key={item.address}>
        <div><strong>{item.address}</strong><p>{item.active?'On · '+(item.premium?'Premium address':'Private address'):'Off · Not receiving mail'}</p><small>{item.clientLabel??(item.client.startsWith('dashboard')?'Created by you':item.client)}</small></div>
        {!item.active&&<button type="button" className="xc-button xc-secondary" onClick={async()=>{if(!await confirmAction('Permanently delete '+item.address+'?','Delete address'))return;void api('mail/aliases/'+item.address+'?permanent=true',{},'DELETE').then(()=>setAliases(items=>items.filter(alias=>alias.address!==item.address))).catch(error=>setStatus(notice(error)));}}>Delete address</button>}
        {!item.active&&<button className="xc-button xc-secondary" disabled={busy} onClick={()=>{setBusy(true);void api('mail/aliases/'+item.address,{active:true},'PUT').then(()=>api('mail/aliases')).then(r=>{setAliases(r.aliases);setStatus('Private address enabled.');}).catch(e=>setStatus(notice(e))).finally(()=>setBusy(false));}}>Turn on</button>}
        {item.active&&<button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>{
          if(confirmAlias!==item.address){setConfirmAlias(item.address);return;}
          setBusy(true);
          void api('mail/aliases/'+item.address,{},'DELETE').then(()=>api('mail/aliases'))
            .then(result=>{setAliases(result.aliases);setConfirmAlias('');setStatus('Private address disabled.');})
            .catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
        }}>{confirmAlias===item.address?'Confirm stopping delivery':accountMessage('disableAddress','Disable address')}</button>}
        {confirmAlias===item.address&&<button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>setConfirmAlias('')}>{accountMessage('cancel','Cancel')}</button>}
      </div>)}
    </section>}
    {account.canSendMail&&<div className="xc-mail-compose-action">
      <button type="button" className="xc-button xc-primary" onClick={()=>{setDeliveryError('');setCompose(true);}}><MailPlus size={18}/> {accountMessage('newEmail','New email')}</button>
    </div>}
    {compose&&<dialog ref={dialog} className="xc-compose-dialog" aria-labelledby="compose-title"
      onCancel={event=>{event.preventDefault();if(!busy)setCompose(false);}}>
      <div className="xc-compose-header"><h2 id="compose-title">{accountMessage('newEmail','New email')}</h2>
        <button type="button" className="xc-button xc-secondary" aria-label="Close compose" disabled={busy} onClick={()=>setCompose(false)}><X size={19}/></button>
      </div>
      <form className="xc-stack" onSubmit={event=>{
        event.preventDefault();setBusy(true);setDeliveryError('');
        void api('mail/send',{...draft,from:sender||undefined,formatted,attachment}).then(()=>{
          setFormatted(false);setAttachment(undefined);
          setDraft({to:'',subject:'',text:''});setCompose(false);setStatus('Message accepted for delivery.');
        }).catch(error=>setDeliveryError(notice(error))).finally(()=>setBusy(false));
      }}>
        {!account.externalMailSubmission&&<p>Send to a X-Center mailbox.</p>}
        <label>From<select value={sender} onChange={event=>setSender(event.target.value)}><option value="">{account.mailbox}</option>{aliases.filter(item=>item.active&&item.premium).map(item=><option key={item.address} value={item.address}>{item.address}</option>)}</select></label>
        <label>{accountMessage('recipient','Recipient')}<input type="email" autoFocus required value={draft.to} onChange={event=>setDraft({...draft,to:event.target.value})}/></label>
        <label>{accountMessage('subject','Subject')}<input required maxLength={120} value={draft.subject} onChange={event=>setDraft({...draft,subject:event.target.value})}/></label>
        <label>{accountMessage('message','Message')}<textarea ref={editor} aria-label={accountMessage('message','Message')} required rows={5} value={draft.text} onChange={event=>setDraft({...draft,text:event.target.value})}/></label>
        <div className="xc-compose-tools" role="group" aria-label="Message tools">
          <button type="button" className="xc-button xc-secondary" aria-label="Bold selected text" onClick={()=>wrapSelection('**')}><Bold size={18}/></button>
          <button type="button" className="xc-button xc-secondary" aria-label="Italicize selected text" onClick={()=>wrapSelection('_')}><Italic size={18}/></button>
          <button type="button" className="xc-button xc-secondary" aria-label="Attach a file up to 256 KB" onClick={()=>filePicker.current?.click()}><Paperclip size={18}/></button>
        </div>
        <input hidden ref={filePicker} type="file" onChange={event=>{
          const file=event.target.files?.[0];event.target.value='';
          if(!file)return;
          if(file.size>256*1024 || !file.size){setDeliveryError('Choose a file between 1 byte and 256 KB.');return;}
          setBusy(true);
          void fileAsBase64(file).then(content=>{setAttachment({name:file.name,content});setDeliveryError('');})
            .catch(error=>setDeliveryError(notice(error))).finally(()=>setBusy(false));
        }}/>
        {attachment&&<button type="button" className="xc-button xc-secondary" onClick={()=>setAttachment(undefined)}>Remove {attachment.name}</button>}
        {deliveryError&&<p role="alert">{deliveryError}</p>}
        <button className="xc-button xc-primary xc-self-start" disabled={busy}>{busy?'Sending…':accountMessage('sendEmail','Send email')}</button>
      </form>
    </dialog>}
    {status&&<p role="status">{status}</p>}
  </section>;
}

type AdminApp=ReviewedRegistration&{icon?:string|null;id:string;name:string;status:string;callback:string;developerName?:string;repository?:string;verified:boolean;administration?:boolean};
type AdminDeveloper={owner:string;name:string;status:string;githubProfile?:string};
function AdminContent() {
  const confirm=useConfirmDialog();
  const [apps,setApps]=useState<AdminApp[]>([]);
  const [developers,setDevelopers]=useState<AdminDeveloper[]>([]);
  const registered=apps.filter(app=>app.status!=='revoked');
  const appPage=useListPage(registered.length);
  const developerPage=useListPage(developers.length);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  async function refresh(){
    const inventory=await api('admin/apps');setApps(inventory.apps);setDevelopers(inventory.developers);
  }
  useEffect(()=>{void refresh().catch(error=>setStatus(notice(error)));},[]);
  function save(path:string,value:object,success:string){
    setStatus('');setBusy(true);
    void api(path,value).then(refresh).then(()=>{setStatus(success);})
      .catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
  }
  return <>
    <AdminSearch/>
    <AdminAccounts/>
    <AdminUsernameChanges refreshAccounts={refresh}/>
    <AdminSupport/>
    <AdminStorageVolumes/>
    <section className="xc-card xc-pad"><div className="xc-row-head"><BadgeCheck size={21}/><h2>Developer verification</h2></div>
      {developers.length===0&&<p className="xc-empty">No developer reviews.</p>}
      {developers.slice(developerPage.start,developerPage.end).map(developer=><div className="xc-list-row xc-permission-row" key={developer.owner}>
        <div><strong>{developer.name}</strong><p>{developer.status==='verified'?'Verified':developer.status==='requested'?'Review requested':'Unverified'}</p>
          {developer.githubProfile&&<a href={developer.githubProfile} target="_blank" rel="noreferrer">Review GitHub profile</a>}</div>
        <IconAction label={developer.status==='verified'?'Remove verification':'Verify developer'} disabled={busy} onClick={()=>
          save('admin/apps',{type:'developer',id:developer.owner,verified:developer.status!=='verified'},'Developer verification updated.')}><BadgeCheck size={20}/></IconAction>
      </div>)}
      <ListPages state={developerPage} label="Developers"/>
    </section>
    <section className="xc-card xc-pad"><div className="xc-row-head"><BadgeCheck size={21}/><h2>Registered apps</h2></div>
      {apps.length===0&&<p className="xc-empty">No registered developer apps.</p>}
      {registered.slice(appPage.start,appPage.end).map(app=><div className="xc-list-row xc-permission-row" key={app.id}>
        <div className="xc-row-head"><AppIcon icon={app.icon}/><div><strong className="xc-identity-label">{app.name}<TrustBadges compact kind="app" verified={app.verified}/></strong><p>{app.developerName??'Developer'} · {app.status}</p>
          <p>{new URL(app.callback).hostname}</p>{app.repository&&<a href={app.repository} rel="noreferrer" target="_blank">Review repository</a>}</div></div>
        <div className="xc-actions xc-registration-actions">{app.status==='active'&&app.verified&&<a className="xc-button xc-secondary" href={'/developer/storage/'+app.id+'?from=admin'}><Database size={17}/> Manage app storage</a>}
        {!app.local&&app.status==='active'&&(app.verified||app.administration)&&<IconAction
          label={app.administration?'Remove Administration app trust':'Enable Administration app'} disabled={busy}
          onClick={async()=>{
            const label=app.administration?'Remove Administration app trust':'Enable Administration app';
            if(await confirm(label+'?',label,'Users must separately approve account access. Trusted apps can request storage totals and manage public profile visibility and optional linked permissions.',!!app.administration)){
              save('admin/apps',{type:'administration',id:app.id,verified:!app.administration},'Administration app trust updated.');
            }
          }}><Shield size={20}/></IconAction>}
        <CallbackApproval app={app} disabled={busy} save={body=>save('admin/apps',body,'Callback approval updated.')}/>
        {app.status!=='revoked'&&<IconAction label={app.verified?'Remove verification':'Verify app'} disabled={busy}
          onClick={()=>save('admin/apps',{type:'app',id:app.id,verified:!app.verified},'App verification updated.')}><BadgeCheck size={20}/></IconAction>}</div>
      </div>)}
      <ListPages state={appPage} label="Registered apps"/>
    </section>
    {status&&<p className="xc-notice" role="status">{status}</p>}
  </>;
}

export function ConnectedApps() {
  const confirmAction=useConfirmDialog();
  const [apps,setApps]=useState<{client:string;label:string;updated:number;icon?:string;verified?:boolean}[]|null>(null);
  const page=useListPage(apps?.length??0);
  const [status,setStatus]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{void api('connected-apps').then(data=>setApps(data.apps)).catch(error=>setStatus(notice(error)));},[]);
  return <div className="xc-pad">
    <h2>Authorized apps</h2>
    {apps?.length===0 && <div className="xc-empty">No apps have been authorized yet.</div>}
    {apps?.slice(page.start,page.end).map(item=><div className="xc-list-row" key={item.client}><div className="xc-row-head"><AppIcon key={item.icon} icon={item.icon}/><div><strong className="xc-identity-label">{item.label}<TrustBadges compact kind="app" verified={item.verified}/></strong><p>Last authorized {date(item.updated)}</p></div></div>
      <div className="xc-actions"><a href={'/permissions/'+encodeURIComponent(item.client)}>Manage data access</a>
        {confirm===item.client?<><span>This ends the app’s access and permanently deletes the copies it saved in your X-Center ID account.</span><button className="xc-button xc-secondary" disabled={busy} onClick={()=>{
          setBusy(true);
          void api('connected-apps/unlink',{client:item.client}).then(()=>{
            setApps(previous=>previous?.filter(app=>app.client!==item.client)??null);
            setConfirm('');setStatus('App unlinked.');
          }).catch(error=>setStatus(notice(error))).finally(()=>setBusy(false));
        }}>Confirm unlink</button><button className="xc-button xc-secondary" disabled={busy} onClick={()=>setConfirm('')}>Cancel</button></>
          :<button className="xc-button xc-secondary" disabled={busy} onClick={()=>setConfirm(item.client)}>Unlink app</button>}
      </div></div>)}
    <ListPages state={page} label="Authorized apps"/>
    {!!apps?.length&&<button type="button" className="xc-button xc-secondary" disabled={busy} onClick={async()=>{
      if(busy||!await confirmAction('Sign out of all connected apps?','Sign out','Your links, permissions and stored data are kept. Apps may ask you to sign in again.',false))return;
      setBusy(true);
      setStatus('');
      try{
        if(!(await api('session/access')).confirmed)await confirmIdentity();
        await api('connected-apps/sign-out',{});
        setStatus('Connected app access ended.');
      }catch(error){setStatus(notice(error));}
      finally{setBusy(false);}
    }}>Sign out of connected apps</button>}
    {status&&<p role="status">{status}</p>}
  </div>;
}

export function AdminPage(){
  const [authorized,setAuthorized]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{void api('admin/access').then(result=>setAuthorized(result.authorized)).catch(error=>setError(error.message)).finally(()=>setLoading(false));},[]);
  if(loading)return <p role="status">Checking administrator access…</p>;
  return authorized?(/^\/admin\/users\//.test(location.pathname)?<AdminAccounts/>:<AdminContent/>):<><Reauthenticate complete={()=>setAuthorized(true)}/>{error&&<p role="alert">{error}</p>}</>;
}
