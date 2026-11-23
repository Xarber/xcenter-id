import { useEffect, useState } from 'react';

export type AppFileContainer = {
  client: string;
  name: string;
  bytes: number;
  icon?: string | null;
  showInFiles?: boolean;
};
type Collection = { collection: string; records: number };
type RecordEntry = { id: string; bytes: number };
type Folder = { collections: Collection[]; records: RecordEntry[]; nextCursor: string | null };

export function useAppFileContainer(client: string, request: (path: string) => Promise<Partial<Folder>>) {
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
  }, [path, request]);

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

  return { collection, setCollection, folder, loading, error, more, path };
}
