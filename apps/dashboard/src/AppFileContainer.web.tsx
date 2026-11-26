import {useConfirmDialog} from './dialog-model';
import { File, Folder, Pencil, Plus } from 'lucide-react';
import { useAppFileContainer, useAppRecordEditor, useContainerFiles, type AppFileContainer as Container } from './account-file-containers';
import AppIcon from './AppIcon.web';
import { formatBytes } from './storage-summary';
import { api } from './web-account';

export default function AppFileContainer({ app, service, back }: { app: Container; service?:string; back?:()=>void }) {
  const confirmAction=useConfirmDialog();
  const root=service?'app-storage/'+service+'/browse':'file-containers/'+encodeURIComponent(app.client);
  const filePath=service?'app-storage/'+service+'/files':'app-files/'+encodeURIComponent(app.client);
  const { collection, setCollection, folder, loading, error, more, path, refresh } = useAppFileContainer(root, !!(service||app.canManage), api);
  const {page:files,failure,moreFiles}=useContainerFiles(filePath,!collection,api);
  const editor = useAppRecordEditor(app.client,api,refresh);
  const {draft,setDraft,busy} = editor;
  return <section className="xc-card xc-pad xc-stack">
    <nav className="xc-actions xc-file-path" aria-label="Current folder">
      {back?<button className="xc-button xc-secondary" type="button" onClick={back}>Back to storage</button>:<a href="/files">Your files</a>}
      {collection && <button className="xc-button xc-secondary" type="button" disabled={loading} onClick={() => setCollection('')}>{app.name}</button>}
    </nav>
    <div className="xc-row-head"><AppIcon icon={app.icon}/><h2>{collection || app.name}</h2></div>
    <p>{service?'Service storage':'App folder'} · {formatBytes(service?app.bytes:app.visibleBytes??app.bytes)}</p>

    {app.canManage&&!service&&draft&&<form className="xc-stack" onSubmit={event=>{event.preventDefault();void editor.submit();}}>
      {!draft.revision&&<>
        <label>Collection<input value={draft.collection} onChange={event=>setDraft({...draft,collection:event.currentTarget.value})} required maxLength={80}/></label>
        <label>Record ID<input value={draft.id} onChange={event=>setDraft({...draft,id:event.currentTarget.value})} required maxLength={80}/></label>
      </>}
      <label>JSON data<textarea rows={8} value={draft.json} onChange={event=>setDraft({...draft,json:event.currentTarget.value})}/></label>
      <div className="xc-actions">
        <button className="xc-button xc-primary" disabled={busy}>Save record</button>
        <button className="xc-button xc-secondary" type="button" disabled={busy} onClick={()=>setDraft(undefined)}>Cancel</button>
        {!!draft.revision&&<button className="xc-button xc-secondary" type="button" disabled={busy} onClick={async()=>{
          if(await confirmAction('Permanently remove this record?'))void editor.submit(true);
        }}>Remove record</button>}
      </div>
    </form>}
    {editor.message&&<p role="status">{editor.message}</p>}
    <table className="xc-file-table"><thead><tr><th scope="col">Name</th><th scope="col">Size</th><th scope="col"><span className="xc-sr">Actions</span></th></tr></thead>
      <tbody>
        {app.canManage&&!service&&<tr><td colSpan={3}><button className="xc-file-new" type="button" disabled={busy} onClick={()=>editor.create(collection)}><Plus size={18}/> New record</button></td></tr>}
        {!collection&&files?.files.map(file=><tr key={file.id}><td>
          <a className="xc-file-name" href={'/account/'+filePath+'/'+file.id}><File size={18}/><strong>{file.name}</strong></a>
        </td><td>{formatBytes(file.size)}</td><td/></tr>)}
        {folder?.collections.map(item=><tr key={item.collection}><td>
          <button className="xc-file-new" type="button" onClick={()=>setCollection(item.collection)}><Folder size={18}/>{item.collection}</button>
        </td><td>{formatBytes(item.bytes)}</td><td/></tr>)}
        {folder?.records.map(record=><tr key={record.id}>
          <td><a className="xc-file-name" href={'/account/'+path+'/'+encodeURIComponent(record.id)}><File size={18}/><strong>{record.id}.json</strong></a></td>
          <td>{formatBytes(record.bytes)}</td><td><div className="xc-file-actions">
            {app.canManage&&!service&&<button className="xc-file-icon" type="button" disabled={busy} aria-label={'Edit '+record.id} onClick={()=>void editor.edit(collection,record.id)}><Pencil size={16}/></button>}
          </div></td>
        </tr>)}
      </tbody>
    </table>
    {folder?.nextCursor && <button className="xc-button xc-secondary" disabled={loading} onClick={() => void more()}>Load more</button>}
    {!collection&&files?.nextCursor&&<button className="xc-button xc-secondary" onClick={()=>void moreFiles()}>Load more files</button>}
    {!loading&&!folder?.collections.length&&!folder?.records.length&&(collection||files&&!files.files.length)&&<p>This folder is empty.</p>}
    {loading && <p role="status">Loading folder…</p>}
    {(error||failure) && <p role="alert">{error||failure}</p>}
  </section>;
}
