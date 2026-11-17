import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const idPattern = /^[0-9a-f-]{36}$/;
const dataset = 'saved-place.v1';

export function openFriendRecords({ database, store, friends, publishers, allowed }) {
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS friend_records (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, recipient TEXT NOT NULL, friendship TEXT NOT NULL,
      source TEXT NOT NULL, record TEXT NOT NULL, UNIQUE(owner,recipient,friendship,source,record)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS friend_records_recipient ON friend_records(recipient);
    CREATE INDEX IF NOT EXISTS friend_records_owner ON friend_records(owner);
  `);
  const incoming = db.prepare('SELECT * FROM friend_records WHERE recipient=? LIMIT 500');
  const outgoing = db.prepare('SELECT * FROM friend_records WHERE owner=? LIMIT 500');
  const count = db.prepare('SELECT count(*) AS total FROM friend_records WHERE owner=?');
  const add = db.prepare('INSERT OR IGNORE INTO friend_records VALUES (?,?,?,?,?,?)');
  const remove = db.prepare('DELETE FROM friend_records WHERE id=? AND owner=?');
  function record(owner, source, id) {
    if (!publishers.has(source) || !allowed(owner,source)) return null;
    return store.readOne(owner,source,dataset,id);
  }
  function visible(rows) {
    return rows.flatMap(row => {
      if (friends.linked(row.owner,row.recipient) !== row.friendship) return [];
      const value = record(row.owner,row.source,row.record);
      return value ? [{ id:row.id, owner:row.owner, recipient:row.recipient, source:row.source, value }] : [];
    });
  }
  return {
    sources(owner) {
      return [...publishers].flatMap(([id,name]) => allowed(owner,id) ? [{id,name}] : []);
    },
    records(owner, source, cursor) {
      return publishers.has(source) && allowed(owner,source) ? store.read(owner,source,source,dataset,cursor) : null;
    },
    list(owner) { return { incoming:visible(incoming.all(owner)), outgoing:visible(outgoing.all(owner)) }; },
    share(owner, {friend,source,id}) {
      if (typeof id !== 'string' || !idPattern.test(id) || !record(owner,source,id)) return false;
      const target=friends.list(owner).find(item=>item.id===friend);
      if (!target || count.get(owner).total >= 500) return false;
      add.run(randomUUID(),owner,target.owner,target.id,source,id);
      return true;
    },
    revoke(owner,id) { remove.run(id,owner); },
    close() { db.close(); },
  };
}

export function createFriendRecordRoutes({accounts,records}) {
  const send=(res,status,body)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(body));
  return async (req,res,path,url) => {
    const active=accounts.current(req);
    if (!active || !accounts.username(active.owner)) return send(res,401,{error:'Sign in with a completed profile.'});
    const owner=active.owner;
    if(req.method==='GET'){
      const source=url.searchParams.get('source');
      if(source){
        const cursor=url.searchParams.get('cursor')??'';
        const data=(!cursor || idPattern.test(cursor)) && records.records(owner,source,cursor);
        return data?send(res,200,data):send(res,404,{error:'This dataset is unavailable.'});
      }
      const list=records.list(owner);
      function present(entry,peer) {
        return {id:entry.id,source:entry.source,value:entry.value,username:accounts.username(peer)};
      }
      return send(res,200,{sources:records.sources(owner),incoming:list.incoming.map(item=>present(item,item.owner)),
        outgoing:list.outgoing.map(item=>present(item,item.recipient))});
    }
    if(!accounts.allowsMutation(req)||req.headers['x-authnjs-request']!=='account-consent') {
      return send(res,403,{error:'Open the account manager to change sharing.'});
    }
    const id=path.split('/').at(-1);
    if(req.method==='DELETE' && idPattern.test(id)){
      records.revoke(owner,id);
      return send(res,200,{ok:true});
    }
    if(req.method!=='POST'||path!=='/account/friends/records')return send(res,405,{error:'Method unavailable.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
    const chunks=[];
    let size=0;
    for await(const chunk of req.iterator({destroyOnReturn:false})){
      size+=chunk.length;
      if(size>1024){req.resume();return send(res,413,{error:'Request too large.'});}
      chunks.push(chunk);
    }
    let input;
    try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(res,422,{error:'Invalid share.'});}
    return input && records.share(owner,input)?send(res,200,{ok:true}):send(res,404,{error:'Record or friend unavailable.'});
  };
}
