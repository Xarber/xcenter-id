import { Download, Folder } from 'lucide-react';
import { useAppFileContainer, type AppFileContainer as Container } from './account-file-containers';
import AppIcon from './AppIcon.web';
import { formatBytes } from './storage-summary';
import { api } from './web-account';

export default function AppFileContainer({ app }: { app: Container }) {
  const { collection, setCollection, folder, loading, error, more, path } = useAppFileContainer(app.client, api);
  return <section className="xc-card xc-pad xc-stack">
    <nav className="xc-actions xc-file-path" aria-label="Current folder">
      <a href="/files">Your files</a>
      {collection && <button className="xc-button xc-secondary" type="button" disabled={loading} onClick={() => setCollection('')}>{app.name}</button>}
    </nav>
    <div className="xc-row-head"><AppIcon icon={app.icon}/><h2>{collection || app.name}</h2></div>
    <p>Read-only app data</p>
    {folder?.collections.map(item => <div className="xc-list-row" key={item.collection}>
      <button className="xc-button xc-secondary" type="button" onClick={() => setCollection(item.collection)}>
        <Folder size={18}/>{item.collection}
      </button><span>{item.records} records</span>
    </div>)}
    {folder?.records.map(record => <div className="xc-list-row" key={record.id}>
      <div className="xc-file-meta"><strong>{record.id}.json</strong><p>{formatBytes(record.bytes)}</p></div>
      <a className="xc-button xc-secondary" href={'/account/' + path + '/' + encodeURIComponent(record.id)} aria-label={'Download ' + record.id}><Download size={18}/></a>
    </div>)}
    {folder?.nextCursor && <button className="xc-button xc-secondary" disabled={loading} onClick={() => void more()}>Load more</button>}
    {folder && !loading && !folder.collections.length && !folder.records.length && <p>This folder is empty.</p>}
    {loading && <p role="status">Loading folder…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
