import ListPages from './ListPages.web';
import {useListPage} from './list-page';
import AppConfiguration from './AppConfiguration.web';
import {useConfirmDialog} from './dialog-model';
import CopyButton from './CopyButton.web';
import DeveloperAppAccess from './DeveloperAppAccess.web';
import {confirmIdentity} from './Reauthenticate.web';
import {api} from './web-account';
import TrustBadges from './TrustBadges.web';
import { ArrowLeft, Braces, ChevronRight, Database, Grid2X2, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { developerApi, optionalClaims, readAppIcon, type AppRegistration } from './developer-web';

type Draft=Pick<AppRegistration,'name'|'description'|'repository'|'icon'|'callbacks'|'native'|'local'>;
const blank=():Draft=>({name:'',description:'',repository:'',icon:null,callbacks:[''],native:false});

function PeerSettings({registration}:{registration:string}){
  const [policy,setPolicy]=useState<{enabled:boolean;discovery:boolean}|null>(null);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('');
  const path='apps/'+registration+'/peers';
  const requests=useRef<AbortController|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    requests.current=controller;
    void developerApi(path,undefined,'GET',controller.signal).then(value=>{if(!controller.signal.aborted)setPolicy(value);})
      .catch(error=>{if(!controller.signal.aborted)setFeedback(error.message);});
    return ()=>{controller.abort();};
  },[path]);
  async function save(change:{enabled:boolean;discovery:boolean}){
    setBusy(true);setFeedback('');
    const signal=requests.current?.signal;
    try{const saved=await developerApi(path,change,'POST',signal);if(!signal?.aborted)setPolicy(saved);}
    catch(error){if(!signal?.aborted)setFeedback(error instanceof Error?error.message:'Could not save peer settings.');}
    finally{if(!signal?.aborted)setBusy(false);}
  }
  return <section className="xc-card xc-pad xc-stack">
    <h2>Peer connections</h2>
    <p>Use shared WebRTC signaling for this app. Other apps cannot see or contact these peers.</p>
    {policy&&<>
      <label className="xc-list-row"><span>Enable peer signaling</span><input type="checkbox" role="switch"
        checked={policy.enabled} disabled={busy} onChange={event=>void save({...policy,enabled:event.target.checked})}/></label>
      <label className="xc-list-row"><span>List discoverable peers in this app</span><input type="checkbox" role="switch"
        checked={policy.discovery} disabled={busy||!policy.enabled} onChange={event=>void save({...policy,discovery:event.target.checked})}/></label>
      <p>Only peers using this registration can list peers that opt in to discovery.</p>
      <a href="/docs/sdk/list-peers">Peer discovery reference</a>
    </>}
    {feedback&&<p role="alert">{feedback}</p>}
  </section>;
}

function SandboxAppEvents({id}:{id:string}){
  const [events,setEvents]=useState<{event:string;created:number}[]|null>(null);
  const [status,setStatus]=useState('');
  const [sandbox,setSandbox]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/account/environment',{signal:controller.signal}).then(result=>result.json())
      .then(result=>setSandbox(result.sandbox===true)).catch(()=>{});
    return ()=>controller.abort();
  },[]);
  if(!sandbox)return null;
  return <section className="xc-card xc-pad xc-stack"><h3>Test requests</h3>
    <button type="button" className="xc-button xc-secondary xc-self-start" onClick={()=>{
      setStatus('');
      void fetch('/account/developer/apps/'+encodeURIComponent(id)+'/sandbox-events',{cache:'no-store'}).then(async response=>{
        if(!response.ok)throw new Error('Could not load test requests.');
        setEvents((await response.json()).events);
      }).catch(error=>setStatus(error.message));
    }}>{events?'Refresh requests':'Show requests'}</button>
    {events?.length===0&&<p>No recent test requests.</p>}
    {!!events?.length&&<ul>{events.map((item,index)=><li key={item.created+'-'+index}>{item.event} · {new Date(item.created).toLocaleString()}</li>)}</ul>}
    {status&&<p role="alert">{status}</p>}
  </section>;
}

export default function DeveloperPortal({back}:{back:()=>void}){
  const confirmAction=useConfirmDialog();
  const [apps,setApps]=useState<AppRegistration[]|null>(null);
  const page=useListPage(apps?.length??0);
  const [selection,setSelection]=useState<AppRegistration|'create'|null>(null);
  const [draft,setDraft]=useState<Draft>(blank);
  const [requirements,setRequirements]=useState(optionalClaims);
  const [deleteConfirm,setDeleteConfirm]=useState(false);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [showConfiguration,setShowConfiguration]=useState(false);
  const [secret,setSecret]=useState<{clientId:string;clientSecret?:string}|null>(null);
  async function load(){
    const result=await developerApi('apps');
    const available:AppRegistration[]=result.apps.filter((app:AppRegistration)=>app.status!=='revoked');
    setApps(available);
    return available;
  }
  useEffect(()=>{void load().then(available=>{
    const id=new URLSearchParams(location.search).get('app');
    const restored=available.find(app=>app.id===id);
    if(restored)edit(restored);
  }).catch(error=>setNotice(error.message));},[]);
  function edit(item:AppRegistration|'create'|null){
    setSelection(item);setShowConfiguration(false);setDeleteConfirm(false);setNotice('');setSecret(null);
    setRequirements(item&&item!=='create'?(item.requirements??optionalClaims):optionalClaims);
    setDraft(item&&item!=='create'?{...item,callbacks:item.callbacks??[item.callback]}:blank());
  }
  function work(job:()=>Promise<void>){
    setBusy(true);setNotice('');
    void job().catch(error=>setNotice(error instanceof Error?error.message:'Could not complete this action.')).finally(()=>setBusy(false));
  }
  function save(){
    work(async()=>{
      const result=selection==='create'?await developerApi('apps',draft):
        await developerApi('apps/'+selection?.id+'/profile',draft,'PUT');
      setSelection(result);setDraft({...result,callbacks:result.callbacks??[result.callback]});
      await load();setNotice(selection==='create'?'App registered. Verify the callback domain to activate sign-in.':'App profile saved.');
    });
  }

  if(!selection)return <div key="registered-apps" className="xc-stack">
    <div className="xc-portal-toolbar"><h2>Registered apps</h2>
      <button className="xc-button xc-primary" onClick={()=>edit('create')} disabled={!apps}><Plus size={18}/> Register an app</button></div>
    <a href="/profile/developer">Manage your developer profile</a>
    {apps?.slice(page.start,page.end).map(item=><button type="button" className="xc-card xc-permission-link xc-portal-app" onClick={()=>edit(item)} key={item.id}>
      <span className="xc-symbol xc-lavender">{item.icon?<img src={'data:image/png;base64,'+item.icon} alt=""/>:<Grid2X2 size={20}/>}</span>
      <span className="xc-permission-name"><strong className="xc-identity-label">{item.name}<TrustBadges compact kind="app" verified={item.verified}/></strong><span>{item.local?'Unsecure local app':item.native?'Native app':'Website'} · {item.status}</span></span>
      <ChevronRight className="xc-permission-chevron" size={20}/>
    </button>)}
    <ListPages state={page} label="Registered apps"/>
    {apps?.length===0&&<p className="xc-empty">You haven’t registered any apps yet.</p>}
    {!apps&&!notice&&<p role="status">Loading apps…</p>}
    {notice&&<p role="alert">{notice}</p>}
    <button type="button" className="xc-button xc-secondary xc-self-start" onClick={back}>Back to Apps</button>
  </div>;

  const existing=selection==='create'?null:selection;
  if(existing&&showConfiguration)return <AppConfiguration key={existing.id} id={existing.id} back={()=>{
    setShowConfiguration(false);
    void load().then(items=>{const app=items.find(item=>item.id===existing.id);if(app)edit(app);}).catch(error=>setNotice(error.message));
  }}/>;
  return <div key={existing?.id??'create-app'} className="xc-stack">
    <button type="button" className="xc-button xc-secondary xc-self-start" onClick={()=>{history.replaceState(history.state,'','/developer');edit(null);}} disabled={busy}><ArrowLeft size={16}/> Registered apps</button>
    {existing?.status==='active'&&<a className="xc-button xc-secondary xc-self-start" href={'/developer/storage/'+existing.id}><Database size={17}/> {existing.verified?'Manage app storage':'Manage sharing requests'}</a>}
    {existing&&<button type="button" className="xc-button xc-secondary xc-self-start" onClick={()=>setShowConfiguration(true)}><Braces size={17}/> App configuration</button>}
    {existing?.status==='active'&&<SandboxAppEvents key={existing.id} id={existing.id}/>}
    {existing?.status==='active'&&existing.verified&&<PeerSettings key={existing.id} registration={existing.id}/>}
    <div><h2>{existing?.name??'Register an app'}</h2><TrustBadges kind="app" verified={existing?.verified}/></div>
    <form className="xc-stack" onSubmit={event=>{event.preventDefault();save();}}>
      <div className="xc-profile-head xc-portal-profile">
        <span className="xc-symbol xc-lavender">{draft.icon?<img alt="" src={'data:image/png;base64,'+draft.icon}/>:<Grid2X2 size={22}/>}</span>
        <label className="xc-button xc-secondary"><ImagePlus size={16}/> Choose app icon
          <input className="xc-sr" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
            onChange={event=>{const image=event.target.files?.[0];if(image)work(async()=>{const icon=await readAppIcon(image);setDraft(current=>({...current,icon}));});}}/>
        </label>
        {draft.icon&&<button className="xc-button xc-secondary" type="button" onClick={()=>setDraft({...draft,icon:null})}>Remove icon</button>}
      </div>
      <div className="xc-form-grid">
        <label>App name<input required value={draft.name} maxLength={80} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
        <label>GitHub repository<input type="url" value={draft.repository} placeholder="https://github.com/owner/project"
          onChange={event=>setDraft({...draft,repository:event.target.value})}/></label>
      </div>
      <label>Description<textarea aria-label="Description" value={draft.description} maxLength={500} rows={3}
        onChange={event=>setDraft({...draft,description:event.target.value})}/></label>
      {!existing&&<label>App type<select value={draft.local?'local':draft.native?'native':'web'} onChange={event=>setDraft({...draft,native:event.target.value==='native',local:event.target.value==='local',callbacks:['']})}>
        <option value="web">Website backend</option><option value="native">Native app with a verified HTTPS link</option><option value="local">Local or custom hosted without DNS</option></select></label>}
      <fieldset className="xc-callbacks">
        <legend>Callback addresses</legend>
        <p>{draft.local?'Unsecure app. Use a loopback callback such as http://127.0.0.1:8080/callback. Remote installations can use device sign-in.':'Use exact HTTPS paths on one verified origin.'}</p>
        {draft.callbacks.map((callback,index)=><div className="xc-callback-row" key={index}>
          <label>Callback {index+1}<input type="url" required maxLength={512} value={callback}
            placeholder="https://your-app.example/callback"
            onChange={event=>setDraft({...draft,callbacks:draft.callbacks.map((value,i)=>i===index?event.target.value:value)})}/></label>
          {draft.callbacks.length>1&&<button type="button" className="xc-button xc-secondary" aria-label={'Remove callback '+(index+1)}
            onClick={()=>setDraft({...draft,callbacks:draft.callbacks.filter((_,i)=>i!==index)})}><X size={17}/></button>}
        </div>)}
        {draft.callbacks.length<8&&<button type="button" className="xc-button xc-secondary" onClick={()=>setDraft({...draft,callbacks:[...draft.callbacks,'']})}>
          <Plus size={17}/> Add callback address</button>}
      </fieldset>
      <button className="xc-button xc-primary xc-self-start" disabled={busy}>{existing?'Save app profile':'Register app'}</button>
    </form>
    {existing&&<form onSubmit={event=>{
      event.preventDefault();work(async()=>{
        const result=await developerApi('apps/'+existing.id+'/permissions',requirements,'PUT');
        setSelection({...existing,requirements:result.requirements});setRequirements(result.requirements);
        await load();setNotice('App permissions saved.');
      });
    }}>
      <fieldset className="xc-callbacks xc-claim-settings">
        <legend>Permissions</legend>
        <p>Require only the profile information this app needs to work. The app must request these scopes during sign-in.</p>
        <label><input type="checkbox" checked={requirements.email} onChange={event=>setRequirements({...requirements,email:event.target.checked})}/> Require a verified email address</label>
        <label><input type="checkbox" checked={requirements.age_range} onChange={event=>setRequirements({...requirements,age_range:event.target.checked})}/> Require age range</label>
        <button className="xc-button xc-secondary" disabled={busy||(requirements.email===!!existing.requirements?.email&&requirements.age_range===!!existing.requirements?.age_range)}>Save permissions</button>
      </fieldset>
    </form>}
    {existing?.status==='pending'&&<div className="xc-info"><strong>{existing.callbackApproved?'An administrator approved your callback URLs':existing.local?'Activate unsecure app':'Verify your callback domain'}</strong>
      {existing.callbackApproved&&<p>You can now activate this app and get its sign-in credentials.</p>}
      {!existing.local&&!existing.callbackApproved&&<><div className="xc-code-row"><code>{'_xcenter-id.'+new URL(existing.callback).hostname}</code><CopyButton value={'_xcenter-id.'+new URL(existing.callback).hostname} label="Copy DNS record name"/></div><div className="xc-code-row"><code>{'xcenter-id='+existing.id}</code><CopyButton value={'xcenter-id='+existing.id} label="Copy DNS verification code"/></div></>}
      <button className="xc-button xc-secondary" disabled={busy} onClick={()=>work(async()=>{
        if((existing.local||existing.callbackApproved)&&!(await api('session/access')).confirmed)await confirmIdentity();
        const result=await developerApi('apps/'+existing.id+'/verify',{});
        setSecret(result);
        setSelection({...existing,status:'active',client:result.clientId});await load();setNotice('App activated.');
      })}>{existing.callbackApproved?(existing.native?'Get client ID':'Get client ID and secret'):existing.local?'Activate local registration':'Verify domain and activate'}</button>
    </div>}
    {secret&&<div className="xc-info" role="status"><strong>Save the credentials securely</strong><div className="xc-code-row"><code>{secret.clientId}</code><CopyButton value={secret.clientId} label="Copy client ID"/></div>
      {secret.clientSecret&&<div className="xc-code-row"><code>{secret.clientSecret}</code><CopyButton value={secret.clientSecret} label="Copy client secret"/></div>}<button className="xc-button xc-secondary" onClick={()=>setSecret(null)}>Hide credentials</button></div>}
    {existing&&existing.status!=='revoked'&&<DeveloperAppAccess key={existing.id} id={existing.id}/>}
    {existing&&existing.status!=='revoked'&&<div className="xc-stack">
      {existing.client&&<div className="xc-code-row"><small>Client ID <code>{existing.client}</code></small><CopyButton value={existing.client} label="Copy client ID"/></div>}
      {existing.status==='active'&&existing.client&&!existing.native&&<div className="xc-actions">
        {(['rotate','revoke'] as const).map(action=><button type="button" key={action} className="xc-button xc-secondary" disabled={busy}
          onClick={async()=>{if(!await confirmAction('Change OAuth client secret?',action==='rotate'?'Generate new secret':'Revoke secret','The current secret will stop working immediately.'))return;
            work(async()=>{
              if(!(await api('session/access')).confirmed)await confirmIdentity();
              const credential=await developerApi('apps/'+existing.id+'/client-secret',{action});
              setSecret(action==='rotate'?credential:null);
              setNotice(action==='rotate'?'New secret created. Copy it before leaving.':'Client secret revoked.');
            });
          }}>{action==='rotate'?'Generate new client secret':'Revoke client secret'}</button>)}
      </div>}

      {deleteConfirm?<><p>Delete {existing.name}? This ends X-Center ID sign-in and API access for this registration. Stored records are retained.</p>
        <div className="xc-actions"><button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>work(async()=>{
          await developerApi('apps/'+existing.id+'/revoke',{});
          setApps(current=>current?.filter(app=>app.id!==existing.id)??null);
          edit(null);setNotice('App deleted.');
        })}><Trash2 size={17}/> Confirm app deletion</button>
        <button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>setDeleteConfirm(false)}>Cancel</button></div></>:
        <button type="button" className="xc-button xc-secondary xc-self-start" disabled={busy} onClick={()=>setDeleteConfirm(true)}><Trash2 size={17}/> Delete app</button>}
    </div>}
    {notice&&<p role="status">{notice}</p>}
  </div>;
}
