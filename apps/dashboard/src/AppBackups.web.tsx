import {useEffect,useState} from 'react';
import {ArchiveRestore,Archive,Trash2} from 'lucide-react';
import {canRestore,type Backups} from './app-backups';
import {api} from './web-account';
import {formatBytes} from './storage-summary';
import {useConfirmDialog} from './dialog-model';
import {confirmIdentity} from './Reauthenticate.web';

export default function AppBackups({client,back}:{client:string;back?:()=>void}){
  const [data,setData]=useState<Backups|null>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const confirm=useConfirmDialog();
  const path='app-backups/'+encodeURIComponent(client);
  const load=async()=>{setData(await api(path));};
  useEffect(()=>{void load().catch(error=>setStatus(error.message));},[client]);
  async function run(work:()=>Promise<unknown>,success:string){
    if(busy)return;
    setBusy(true);
    setStatus('');
    try{await work();await load();setStatus(success);}
    catch(error){setStatus(error instanceof Error?error.message:'Backup unavailable.');}
    finally{setBusy(false);}
  }
  return <section className="xc-pad xc-stack">
    {back?<button type="button" className="xc-button xc-secondary xc-self-start" onClick={back}>Back to apps</button>:<a href="/apps">Back to apps</a>}
    <div className="xc-row-head"><Archive size={20} aria-hidden/><h2>App backups</h2></div>
    {!data&&!status&&<p role="status">Loading backups…</p>}
    {data&&!data.policy&&<p>This app has not enabled backups.</p>}
    {data?.policy&&<>
      <button type="button" className="xc-button xc-primary xc-self-start" disabled={busy} onClick={()=>void run(()=>api(path,{}),'Backup created.')}>Create backup</button>
      <label><input type="checkbox" role="switch" checked={data.allowApp} disabled={busy}
        onChange={event=>void run(()=>api(path+'/permission',{enabled:event.currentTarget.checked},'PUT'),'Backup permission saved.')}/>
        Allow this app to request backups</label>
    </>}
    {data?.snapshots.map(item=>{
      const when=new Date(item.created).toLocaleString();
      return <div className="xc-list-row" key={item.id}>
        <div><strong>{when}</strong>{item.requested&&<p>Restore requested by app</p>}<p>{(item.selection.records!==null||item.selection.files!=='all')&&'Partial · '}{item.records} records · {item.files} files · {formatBytes(item.bytes)} · Version {item.version}</p></div>
        <div className="xc-actions">
          {item.requested&&<button type="button" className="xc-button xc-secondary" disabled={busy}
            onClick={()=>void run(()=>api(path+'/'+item.id+'/dismiss',{}),'Restore request dismissed.')}>Dismiss request</button>}
          {canRestore(data.policy,item)&&<button type="button" className="xc-file-icon" disabled={busy}
            aria-label={'Restore backup from '+when} onClick={async()=>{
              if(!await confirm('Restore this backup?','Restore','This restores the included records and files. Data outside the backup scope stays in place.'))return;
              await run(async()=>{
                if(!(await api('session/access')).confirmed)await confirmIdentity();
                await api(path+'/'+item.id+'/restore',{});
              },'Backup restored.');
            }}><ArchiveRestore size={18} aria-hidden/></button>}
          <button type="button" className="xc-file-icon" disabled={busy} aria-label={'Delete backup from '+when} onClick={async()=>{
            if(await confirm('Permanently delete this backup?','Delete backup'))void run(()=>api(path+'/'+item.id,{},'DELETE'),'Backup deleted.');
          }}><Trash2 size={18} aria-hidden/></button>
        </div>
      </div>;
    })}
    {data&&!data.snapshots.length&&<p>No backups yet.</p>}
    {status&&<p role="status">{status}</p>}
  </section>;
}
