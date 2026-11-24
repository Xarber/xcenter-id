import { File, Folder, Pencil, Plus } from 'lucide-react';
import { useAppFileContainer, useAppRecordEditor, type AppFileContainer as Container } from './account-file-containers';
import AppIcon from './AppIcon.web';
import { formatBytes } from './storage-summary';
import { api } from './web-account';

export default function AppFileContainer({ app }: { app: Container }) {
  const { collection, setCollection, folder, loading, error, more, path, refresh } = useAppFileContainer(app.client, api);
  const editor = useAppRecordEditor(app.client,api,refresh);
  const {draft,setDraft,busy} = editor;
  return <section className="xc-card xc-pad xc-stack">
    <nav className="xc-actions xc-file-path" aria-label="Current folder">
      <a href="/files">Your files</a>
      {collection && <button className="xc-button xc-secondary" type="button" disabled={loading} onClick={() => setCollection('')}>{app.name}</button>}
    </nav>
    <div className="xc-row-head"><AppIcon icon={app.icon}/><h2>{collection || app.name}</h2></div>
    <p>Records in your account · {formatBytes(app.bytes)}</p>

    {draft&&<form className="xc-stack" onSubmit={event=>{event.preventDefault();void editor.submit();}}>
      {!draft.revision&&<>
        <label>Collection<input value={draft.collection} onChange={event=>setDraft({...draft,collection:event.currentTarget.value})} required maxLength={80}/></label>
        <label>Record ID<input value={draft.id} onChange={event=>setDraft({...draft,id:event.currentTarget.value})} required maxLength={80}/></label>
      </>}
      <label>JSON data<textarea rows={8} value={draft.json} onChange={event=>setDraft({...draft,json:event.currentTarget.value})}/></label>
      <div className="xc-actions">
        <button className="xc-button xc-primary" disabled={busy}>Save record</button>
        <button className="xc-button xc-secondary" type="button" disabled={busy} onClick={()=>setDraft(undefined)}>Cancel</button>
        {!!draft.revision&&<button className="xc-button xc-secondary" type="button" disabled={busy} onClick={()=>{
          if(window.confirm('Permanently remove this record?'))void editor.submit(true);
        }}>Remove record</button>}
      </div>
    </form>}
    {editor.message&&<p role="status">{editor.message}</p>}
    <table className="xc-file-table"><thead><tr><th scope="col">Name</th><th scope="col">Size</th><th scope="col"><span className="xc-sr">Actions</span></th></tr></thead>
      <tbody>
        <tr><td colSpan={3}><button className="xc-file-new" type="button" disabled={busy} onClick={()=>editor.create(collection)}><Plus size={18}/> New record</button></td></tr>
        {folder?.collections.map(item=><tr key={item.collection}><td>
          <button className="xc-file-new" type="button" onClick={()=>setCollection(item.collection)}><Folder size={18}/>{item.collection}</button>
        </td><td>{item.records} records</td><td/></tr>)}
        {folder?.records.map(record=><tr key={record.id}>
          <td><a className="xc-file-name" href={'/account/'+path+'/'+encodeURIComponent(record.id)}><File size={18}/><strong>{record.id}.json</strong></a></td>
          <td>{formatBytes(record.bytes)}</td><td><div className="xc-file-actions">
            <button className="xc-file-icon" type="button" disabled={busy} aria-label={'Edit '+record.id} onClick={()=>void editor.edit(collection,record.id)}><Pencil size={16}/></button>
          </div></td>
        </tr>)}
      </tbody>
    </table>
    {folder?.nextCursor && <button className="xc-button xc-secondary" disabled={loading} onClick={() => void more()}>Load more</button>}
    {folder && !loading && !folder.collections.length && !folder.records.length && <p>This folder is empty.</p>}
    {loading && <p role="status">Loading folder…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
