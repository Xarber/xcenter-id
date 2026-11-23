import { useEffect, useState } from 'react';

export type AppFileContainer = {
  client: string;
  name: string;
  bytes: number;
  icon?: string | null;
  showInFiles?: boolean;
  canManage?: boolean;
};
type Collection = { collection: string; records: number };
type RecordEntry = { id: string; bytes: number };
type Folder = { collections: Collection[]; records: RecordEntry[]; nextCursor: string | null };

export function useAppFileContainer(client: string, request: (path: string) => Promise<Partial<Folder>>) {
  const [revision,refresh] = useState(0);
  const [collection, setCollection] = useState('');
  const [folder, setFolder] = useState<Folder>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const path = 'file-containers/' + encodeURIComponent(client) + (collection ? '/' + encodeURIComponent(collection) : '');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFolder(undefined);
    setError('');
    void request(path).then(result => {
      if (active) setFolder({
        collections: result.collections ?? [], records: result.records ?? [], nextCursor: result.nextCursor ?? null,
      });
    }).catch(() => { if (active) setError('Could not open this app folder.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, request,revision]);

  async function more() {
    if (!folder?.nextCursor || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await request(path + '?cursor=' + encodeURIComponent(folder.nextCursor));
      setFolder({ ...folder, records: [...folder.records, ...(result.records ?? [])], nextCursor: result.nextCursor ?? null });
    } catch { setError('Could not load more records.'); }
    finally { setLoading(false); }
  }

  return { collection, setCollection, folder, loading, error, more, path, refresh:()=>refresh(value=>value+1) };
}

type RecordDraft = { collection: string; id: string; revision: number; json: string };
type Request = (path: string, data?: object, method?: string) => Promise<unknown>;

export function useAppRecordEditor(client: string, request: Request, refresh: () => void) {
  const [draft, setDraft] = useState<RecordDraft>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const entryPath = ({collection,id}:Pick<RecordDraft,'collection'|'id'>) =>
    'file-containers/' + encodeURIComponent(client) + '/' + encodeURIComponent(collection) + '/' + encodeURIComponent(id);

  async function edit(collection: string, id: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const record = await request(entryPath({collection,id}) + '?edit=1') as { revision: number; data: unknown };
      setDraft({collection,id,revision:record.revision,json:JSON.stringify(record.data,null,2)});
    } catch { setMessage('Could not read this record.'); }
    finally { setBusy(false); }
  }

  function create(collection: string) {
    setMessage('');
    setDraft({collection,id:'',revision:0,json:'{}'});
  }

  async function submit(remove = false) {
    if (busy || !draft) return;
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(draft.collection) || !/^[A-Za-z0-9_-]{1,80}$/.test(draft.id)) {
      setMessage('Use 1–80 letters, numbers, hyphens or underscores for the collection and record ID.');
      return;
    }
    let data: unknown;
    if (!remove) {
      try { data = JSON.parse(draft.json); }
      catch { setMessage('Enter valid JSON.'); return; }
    }
    setBusy(true);
    setMessage('');
    try {
      await request(entryPath(draft), remove ? {revision:draft.revision} : {revision:draft.revision,data}, remove ? 'DELETE' : 'PUT');
      setDraft(undefined);
      setMessage(remove ? 'Record removed.' : 'Record saved.');
      refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save the record.'); }
    finally { setBusy(false); }
  }

  return { draft, setDraft, busy, message, edit, create, submit };
}
