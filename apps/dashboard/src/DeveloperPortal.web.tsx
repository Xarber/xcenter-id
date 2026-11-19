import TrustBadges from './TrustBadges.web';
import { ArrowLeft, ChevronRight, Database, Grid2X2, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { developerApi, readAppIcon, type AppRegistration } from './developer-web';

type Draft=Pick<AppRegistration,'name'|'description'|'repository'|'icon'|'callbacks'|'native'>;
const blank=():Draft=>({name:'',description:'',repository:'',icon:null,callbacks:[''],native:false});

export default function DeveloperPortal({back}:{back:()=>void}){
  const [apps,setApps]=useState<AppRegistration[]|null>(null);
  const [selection,setSelection]=useState<AppRegistration|'create'|null>(null);
  const [draft,setDraft]=useState<Draft>(blank);
  const [deleteConfirm,setDeleteConfirm]=useState(false);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [secret,setSecret]=useState<{clientId:string;clientSecret?:string}|null>(null);
  async function load(){
    const result=await developerApi('apps');
    setApps(result.apps.filter((app:AppRegistration)=>app.status!=='revoked'));
  }
  useEffect(()=>{void load().catch(error=>setNotice(error.message));},[]);
  function edit(item:AppRegistration|'create'|null){
    setSelection(item);setDeleteConfirm(false);setNotice('');setSecret(null);
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

  if(!selection)return <div className="xc-stack">
    <div className="xc-portal-toolbar"><h2>Registered apps</h2>
      <button className="xc-button xc-primary" onClick={()=>edit('create')} disabled={!apps}><Plus size={18}/> Register an app</button></div>
    <a href="/profile/developer">Manage your developer profile</a>
    {apps?.map(item=><button type="button" className="xc-card xc-permission-link xc-portal-app" onClick={()=>edit(item)} key={item.id}>
      <span className="xc-symbol xc-lavender">{item.icon?<img src={'data:image/png;base64,'+item.icon} alt=""/>:<Grid2X2 size={20}/>}</span>
      <span className="xc-permission-name"><strong className="xc-identity-label">{item.name}<TrustBadges kind="app" verified={item.verified}/></strong><span>{item.native?'Native app':'Website'} · {item.status}</span></span>
      <ChevronRight className="xc-permission-chevron" size={20}/>
    </button>)}
    {apps?.length===0&&<p className="xc-empty">You haven’t registered any apps yet.</p>}
    {!apps&&!notice&&<p role="status">Loading apps…</p>}
    {notice&&<p role="alert">{notice}</p>}
    <button type="button" className="xc-button xc-secondary xc-self-start" onClick={back}>Back to Apps</button>
  </div>;

  const existing=selection==='create'?null:selection;
  return <div className="xc-stack">
    {existing?.status==='active'&&existing.verified&&<a className="xc-button xc-secondary xc-self-start" href={'/developer/storage/'+existing.id}><Database size={17}/> Manage app storage</a>}
    <button type="button" className="xc-button xc-secondary xc-self-start" onClick={()=>edit(null)} disabled={busy}><ArrowLeft size={16}/> Registered apps</button>
    <div className="xc-row-head"><h2>{existing?.name??'Register an app'}</h2>
      <TrustBadges kind="app" verified={existing?.verified}/></div>
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
      {!existing&&<label>App type<select value={draft.native?'native':'web'} onChange={event=>setDraft({...draft,native:event.target.value==='native'})}>
        <option value="web">Website backend</option><option value="native">Native app with a verified HTTPS link</option></select></label>}
      <fieldset className="xc-callbacks">
        <legend>Callback addresses</legend>
        <p>Use exact HTTPS paths on one verified origin.</p>
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
    {existing?.status==='pending'&&<div className="xc-info"><strong>Verify your callback domain</strong>
      <code>{'_xcenter-id.'+new URL(existing.callback).hostname}</code><code>{'xcenter-id='+existing.id}</code>
      <button className="xc-button xc-secondary" disabled={busy} onClick={()=>work(async()=>{
        const result=await developerApi('apps/'+existing.id+'/verify',{});
        setSecret(result);
        setSelection({...existing,status:'active',client:result.clientId});await load();setNotice('App activated.');
      })}>Verify domain and activate</button>
    </div>}
    {secret&&<div className="xc-info" role="status"><strong>Save the credentials securely</strong><code>{secret.clientId}</code>
      {secret.clientSecret&&<code>{secret.clientSecret}</code>}<button className="xc-button xc-secondary" onClick={()=>setSecret(null)}>Hide credentials</button></div>}
    {existing&&existing.status!=='revoked'&&<div className="xc-stack">
      {existing.client&&<small>Client ID <code>{existing.client}</code></small>}
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
