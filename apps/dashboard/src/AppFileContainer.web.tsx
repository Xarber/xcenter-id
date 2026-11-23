import { Download, Folder, Pencil } from 'lucide-react';
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
    <button className="xc-button xc-secondary xc-self-start" type="button" disabled={busy} onClick={()=>editor.create(collection)}>New record</button>
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
    {folder?.collections.map(item => <div className="xc-list-row" key={item.collection}>
      <button className="xc-button xc-secondary" type="button" onClick={() => setCollection(item.collection)}>
        <Folder size={18}/>{item.collection}
      </button><span>{item.records} records</span>
    </div>)}
    {folder?.records.map(record => <div className="xc-list-row" key={record.id}>
      <div className="xc-file-meta"><strong>{record.id}.json</strong><p>{formatBytes(record.bytes)}</p></div>
      <div className="xc-actions"><button className="xc-button xc-secondary" type="button" disabled={busy} aria-label={'Edit '+record.id}
        onClick={()=>void editor.edit(collection,record.id)}><Pencil size={16}/></button>
      <a className="xc-button xc-secondary" href={'/account/' + path + '/' + encodeURIComponent(record.id)} aria-label={'Download ' + record.id}><Download size={18}/></a></div>
    </div>)}
    {folder?.nextCursor && <button className="xc-button xc-secondary" disabled={loading} onClick={() => void more()}>Load more</button>}
    {folder && !loading && !folder.collections.length && !folder.records.length && <p>This folder is empty.</p>}
    {loading && <p role="status">Loading folder…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
