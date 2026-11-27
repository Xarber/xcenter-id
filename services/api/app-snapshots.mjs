import {createHash,randomUUID} from 'node:crypto';

const recordSelector=/^[A-Za-z0-9_-]{1,80}(?:\/[A-Za-z0-9_-]{1,80})?$/;
const fileModes=new Set(['none','all','browseable','editable']);
const defaultSelection={records:null,files:'all'};

export function normalizeSnapshotSelection(value=defaultSelection){
  if(!value||!fileModes.has(value.files))return null;
  const {records}=value;
  if(records!==null&&(!Array.isArray(records)||records.length>1000||
    !records.every(selector=>typeof selector==='string'&&recordSelector.test(selector))))return null;
  return {records:records===null?null:[...new Set(records)].sort(),files:value.files};
}

export function openAppSnapshots(db,{editable}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_snapshot_policies(
      client TEXT PRIMARY KEY, version INTEGER NOT NULL, restore INTEGER NOT NULL, selection TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS app_snapshot_permissions(
      owner TEXT NOT NULL, client TEXT NOT NULL, PRIMARY KEY(owner,client)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS app_snapshots(
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, client TEXT NOT NULL, version INTEGER NOT NULL,
      created INTEGER NOT NULL, bytes INTEGER NOT NULL, records INTEGER NOT NULL, files INTEGER NOT NULL, app_created INTEGER NOT NULL, selection TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS app_snapshot_hashes(
      snapshot TEXT PRIMARY KEY REFERENCES app_snapshots(id) ON DELETE CASCADE,
      sha256 TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS app_snapshot_requests(
      snapshot TEXT PRIMARY KEY REFERENCES app_snapshots(id) ON DELETE CASCADE,
      requested INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS app_snapshots_owner ON app_snapshots(owner,client,created);
    CREATE TABLE IF NOT EXISTS app_snapshot_record_versions(
      version TEXT PRIMARY KEY, owner TEXT NOT NULL, client TEXT NOT NULL,
      collection TEXT NOT NULL, id TEXT NOT NULL, public_key TEXT NOT NULL, readers TEXT NOT NULL,
      public INTEGER NOT NULL, revision INTEGER NOT NULL, bytes INTEGER NOT NULL, envelope BLOB NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS app_snapshot_version_scope ON app_snapshot_record_versions(owner,client);
    CREATE TABLE IF NOT EXISTS app_snapshot_records(
      snapshot TEXT NOT NULL REFERENCES app_snapshots(id) ON DELETE CASCADE,
      version TEXT NOT NULL REFERENCES app_snapshot_record_versions(version),
      PRIMARY KEY(snapshot,version)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS app_snapshot_record_reference ON app_snapshot_records(version);
    CREATE TABLE IF NOT EXISTS app_snapshot_files(
      snapshot TEXT NOT NULL REFERENCES app_snapshots(id) ON DELETE CASCADE,
      id TEXT NOT NULL REFERENCES file_transfers(id), content TEXT NOT NULL REFERENCES file_transfers(id),
      size INTEGER NOT NULL, created INTEGER NOT NULL, browseable INTEGER NOT NULL, metadata BLOB NOT NULL,
      PRIMARY KEY(snapshot,id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS app_snapshot_files_anchor ON app_snapshot_files(id);
    CREATE INDEX IF NOT EXISTS app_snapshot_files_content ON app_snapshot_files(content);
  `);
  const policy=db.prepare('SELECT version,restore,selection FROM app_snapshot_policies WHERE client=?');
  const enable=db.prepare(`INSERT INTO app_snapshot_policies VALUES(?,?,?,?)
    ON CONFLICT(client) DO UPDATE SET version=excluded.version,restore=excluded.restore,selection=excluded.selection`);
  const disable=db.prepare('DELETE FROM app_snapshot_policies WHERE client=?');
  const list=db.prepare(`SELECT s.id,s.version,s.created,s.bytes,s.records,s.files,s.app_created AS appCreated,s.selection,r.requested,h.sha256
    FROM app_snapshots s LEFT JOIN app_snapshot_requests r ON r.snapshot=s.id
    LEFT JOIN app_snapshot_hashes h ON h.snapshot=s.id
    WHERE s.owner=? AND s.client=? ORDER BY s.created DESC,s.id`);
  const count=db.prepare('SELECT count(*) AS total FROM app_snapshots WHERE owner=? AND client=?');
  const find=db.prepare('SELECT * FROM app_snapshots WHERE owner=? AND client=? AND id=?');
  const charged=db.prepare(`SELECT
    (SELECT count(*)*512 FROM app_snapshots WHERE owner=$owner)+
    (SELECT coalesce(sum(bytes),0) FROM app_snapshot_record_versions WHERE owner=$owner)+
    (SELECT count(*)*512 FROM app_snapshot_files JOIN app_snapshots ON app_snapshots.id=snapshot WHERE owner=$owner)+
    (SELECT coalesce(sum(size),0) FROM (
      SELECT max(max(f.size,1)) AS size FROM app_snapshot_files f JOIN app_snapshots s ON s.id=f.snapshot
      WHERE s.owner=$owner AND NOT EXISTS(SELECT 1 FROM app_files a WHERE a.owner=s.owner AND a.client=s.client AND coalesce(a.content_id,a.id)=f.content) GROUP BY f.content
    )) AS bytes`);
  const remove=db.prepare('DELETE FROM app_snapshots WHERE owner=? AND (? IS NULL OR client=?) AND (? IS NULL OR id=?)');
  const insert=db.prepare('INSERT INTO app_snapshots VALUES(?,?,?,?,?,?,?,?,?,?)');
  const liveRecords=db.prepare('SELECT * FROM app_records WHERE owner=? AND client=?');
  const addVersion=db.prepare('INSERT OR IGNORE INTO app_snapshot_record_versions VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  const recordRef=db.prepare('INSERT INTO app_snapshot_records VALUES(?,?)');
  const discardVersions=db.prepare(`DELETE FROM app_snapshot_record_versions WHERE owner=? AND (? IS NULL OR client=?)
    AND NOT EXISTS(SELECT 1 FROM app_snapshot_records WHERE version=app_snapshot_record_versions.version)`);
  const liveFiles=db.prepare(`SELECT f.*,t.id AS content,t.metadata
    FROM app_files f LEFT JOIN file_transfers t ON t.id=coalesce(f.content_id,f.id)
    AND t.committed=1 AND t.owner=f.owner AND t.client=f.client AND t.size=f.size
    WHERE f.owner=? AND f.client=?`);
  const fileRef=db.prepare('INSERT INTO app_snapshot_files VALUES(?,?,?,?,?,?,?)');
  const fingerprintRecords=db.prepare('SELECT version FROM app_snapshot_records WHERE snapshot=? ORDER BY version');
  const fingerprintFiles=db.prepare('SELECT id,content,size,created,browseable,metadata FROM app_snapshot_files WHERE snapshot=? ORDER BY id');
  const saveFingerprint=db.prepare('INSERT OR IGNORE INTO app_snapshot_hashes SELECT id,? FROM app_snapshots WHERE id=?');
  function fingerprint(id,version,selection){
    const digest=createHash('sha256');
    const item=value=>digest.update(JSON.stringify(value)+'\n');
    item(['xcenter-app-snapshot-v1',version,JSON.parse(selection)]);
    for(const row of fingerprintRecords.iterate(id))item(['record',row.version]);
    for(const row of fingerprintFiles.iterate(id)){
      item(['file',row.id,row.content,row.size,row.created,row.browseable,Buffer.from(row.metadata).toString('base64')]);
    }
    const sha256=digest.digest('hex');
    saveFingerprint.run(sha256,id);
    return sha256;
  }
  const setTotals=db.prepare('UPDATE app_snapshots SET bytes=?,records=?,files=? WHERE id=?');
  const discardUnreferenced=db.prepare(`DELETE FROM file_transfers WHERE owner=? AND (? IS NULL OR client=?) AND committed=1
    AND NOT EXISTS(SELECT 1 FROM app_files WHERE id=file_transfers.id OR content_id=file_transfers.id)
    AND NOT EXISTS(SELECT 1 FROM app_snapshot_files WHERE id=file_transfers.id OR content=file_transfers.id)`);
  const restoreFiles=db.prepare(`INSERT INTO app_files(id,client,owner,size,created,browseable,content_id)
    SELECT id,?,?,size,created,browseable,nullif(content,id) FROM app_snapshot_files WHERE snapshot=?`);
  const restoreMetadata=db.prepare(`UPDATE file_transfers SET metadata=(SELECT metadata FROM app_snapshot_files WHERE snapshot=? AND content=file_transfers.id)
    WHERE owner=? AND client=? AND id IN (SELECT content FROM app_snapshot_files WHERE snapshot=?)`);
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try{const value=fn();db.exec('COMMIT');return value;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }
  function includesFile(mode,row){
    return mode==='all'||mode!=='none'&&!!row.browseable&&(mode!=='editable'||editable(row));
  }
  function capture(owner,client,settings,remaining,fail,appCreated=false,allowEmpty=false){
    if(count.get(owner,client).total>=100)fail(409,'Remove an old backup before creating another.');
    const {version,selection}=settings;
    const selected=JSON.parse(selection);
    const selectors=selected.records===null?null:new Set(selected.records);
    const id=randomUUID(),created=Date.now();
    let bytes=512,records=0,files=0;
    insert.run(id,owner,client,version,created,bytes,records,files,Number(appCreated),selection);
    if(selectors===null||selectors.size)for(const row of liveRecords.iterate(owner,client)){
      if(selectors&&!selectors.has(row.collection)&&!selectors.has(row.collection+'/'+row.id))continue;
      const context=JSON.stringify([owner,client,row.collection,row.id,row.revision,row.public,row.readers]);
      const version=createHash('sha256').update(context).update(row.envelope).digest('hex');
      addVersion.run(version,owner,client,row.collection,row.id,row.public_key,row.readers,row.public,row.revision,row.bytes,row.envelope);
      recordRef.run(id,version);
      records++;
      bytes+=row.bytes;
    }
    if(selected.files!=='none')for(const row of liveFiles.iterate(owner,client)){
      if(!includesFile(selected.files,row))continue;
      if(!row.content)fail(503,'Some files are unavailable.');
      fileRef.run(id,row.id,row.content,row.size,row.created,row.browseable,row.metadata);
      files++;
      bytes+=Math.max(row.size,1)+512;
    }
    if(!records&&!files){
      if(!allowEmpty)fail(409,'There is no eligible app data to back up.');
      remove.run(owner,client,client,id,id);
      return null;
    }
    if(remaining()<0)fail(409,'There is not enough account storage for this backup.');
    setTotals.run(bytes,records,files,id);
    return {id,sha256:fingerprint(id,version,selection),version,created,bytes,records,files,appCreated,requested:null,selection:selected};
  }
  return {
    policy:client=>policy.get(client),
    set(client,value){if(value)enable.run(client,value.version,Number(value.restore),JSON.stringify(value.selection));else disable.run(client);},
    allowed:(owner,client)=>!!db.prepare('SELECT 1 FROM app_snapshot_permissions WHERE owner=? AND client=?').get(owner,client),
    allow(owner,client,enabled){
      if(enabled)db.prepare('INSERT OR IGNORE INTO app_snapshot_permissions VALUES(?,?)').run(owner,client);
      else db.prepare('DELETE FROM app_snapshot_permissions WHERE owner=? AND client=?').run(owner,client);
    },
    list:(owner,client)=>list.all(owner,client).map(item=>({...item,
      sha256:item.sha256??fingerprint(item.id,item.version,item.selection),
      appCreated:!!item.appCreated,selection:JSON.parse(item.selection),
    })),
    requestRestore(owner,client,id,fail){
      const snapshot=find.get(owner,client,id);
      if(!snapshot)fail(404,'Backup unavailable.');
      const settings=policy.get(client);
      if(!settings?.restore||settings.version!==snapshot.version||settings.selection!==snapshot.selection)fail(409,'The app has not enabled restore for this backup version.');
      db.prepare('INSERT OR IGNORE INTO app_snapshot_requests VALUES(?,?)').run(id,Date.now());
    },
    dismissRequest(owner,client,id){
      if(!find.get(owner,client,id))return false;
      db.prepare('DELETE FROM app_snapshot_requests WHERE snapshot=?').run(id);
      return true;
    },
    bytes:owner=>charged.get({owner}).bytes,
    removeOwner(owner,client=null){
      remove.run(owner,client,client,null,null);
      discardVersions.run(owner,client,client);
      db.prepare('DELETE FROM app_snapshot_permissions WHERE owner=? AND (? IS NULL OR client=?)').run(owner,client,client);
    },
    delete(owner,client,id,appOnly=false){
      return transaction(()=>{
        const snapshot=find.get(owner,client,id);
        if(!snapshot||appOnly&&!snapshot.app_created)return false;
        const changed=remove.run(owner,client,client,id,id).changes===1;
        if(changed){
          discardVersions.run(owner,client,client);
          discardUnreferenced.run(owner,client,client);
        }
        return changed;
      });
    },
    create(owner,client,remaining,fail,appCreated=false){
      return transaction(()=>{
        const settings=policy.get(client);
        if(!settings)fail(403,'The app has not enabled backups.');
        return capture(owner,client,settings,remaining,fail,appCreated);
      });
    },
    restore(owner,client,id,remaining,restoreRecords,fail){
      return transaction(()=>{
        const snapshot=find.get(owner,client,id);
        if(!snapshot)fail(404,'Backup unavailable.');
        const settings=policy.get(client);
        if(!settings?.restore||settings.version!==snapshot.version||settings.selection!==snapshot.selection)fail(409,'This app has not enabled restore for this backup version.');
        const selection=JSON.parse(snapshot.selection);
        if(selection.files==='editable'||selection.files==='browseable'){
          const inSnapshot=db.prepare('SELECT 1 FROM app_snapshot_files WHERE snapshot=? AND id=?');
          for(const row of liveFiles.iterate(owner,client)){
            if(inSnapshot.get(id,row.id)&&!includesFile(selection.files,row)){
              fail(409,'A file is no longer eligible for this restore.');
            }
          }
        }
        capture(owner,client,settings,remaining,fail,false,true);
        if(selection.files==='all'){
          db.prepare('DELETE FROM app_files WHERE owner=? AND client=?').run(owner,client);
          db.prepare('DELETE FROM file_transfers WHERE owner=? AND client=? AND committed=0').run(owner,client);
        }else if(selection.files!=='none'){
          db.prepare('DELETE FROM app_files WHERE owner=? AND client=? AND id IN (SELECT id FROM app_snapshot_files WHERE snapshot=?)').run(owner,client,id);
          db.prepare('DELETE FROM file_transfers WHERE owner=? AND client=? AND committed=0 AND folder IN (SELECT id FROM app_snapshot_files WHERE snapshot=?)').run(owner,client,id);
        }
        restoreMetadata.run(id,owner,client,id);
        restoreFiles.run(client,owner,id);
        restoreRecords(snapshot);
        db.prepare('DELETE FROM app_snapshot_requests WHERE snapshot=?').run(id);
        discardUnreferenced.run(owner,client,client);
      });
    },
  };
}
