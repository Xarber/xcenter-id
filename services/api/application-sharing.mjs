const collectionName=/^[A-Za-z0-9_-]{1,80}$/;
const permissionName=/^[a-z0-9_-]{1,80}$/;
const icons=new Set(['records','folder','photo','calendar','location','heart','shield']);
const controls=/[\p{Cc}\p{Cf}]/u;

function text(value,max){
  return typeof value==='string'&&value.trim().length>0&&value.length<=max&&!controls.test(value);
}

export function validateSharing(input,{client,verified,published,existing=[]}){
  if(!Array.isArray(input.shared)||input.shared.length>30||!input.shared.every(item=>typeof item==='string'&&collectionName.test(item))){
    throw new Error('Enter up to 30 valid shared collection names.');
  }
  if(input.shared.length&&!verified(client))throw new Error('Publishing shared collections requires a verified app.');
  if(!Array.isArray(input.requests)||input.requests.length>30)throw new Error('Enter up to 30 permission requests.');
  const seen=new Set(), names=new Set();
  const requests=input.requests.map(item=>{
    if(!item||typeof item.source!=='string'||item.source===client||typeof item.collection!=='string'||!collectionName.test(item.collection)||
        !text(item.label,160)||item.name!==undefined&&(typeof item.name!=='string'||!permissionName.test(item.name))||
        item.description!==undefined&&!text(item.description,300)||item.icon!==undefined&&!icons.has(item.icon)){
      throw new Error('Check each permission’s source, collection, name and title.');
    }
    const id=item.source+'/'+item.collection;
    const previous=existing.some(entry=>entry.source===item.source&&entry.collection===item.collection);
    if(!previous&&!published(item.source,item.collection))throw new Error('New requests must use collections published for sharing by verified apps.');
    if(seen.has(id)||item.name&&names.has(item.name))throw new Error('Use unique permission names and request each collection once.');
    seen.add(id);
    if(item.name)names.add(item.name);
    return {source:item.source,collection:item.collection,label:item.label.trim(),
      ...(item.name?{name:item.name}:{}),...(item.description?{description:item.description.trim()}:{}),...(item.icon?{icon:item.icon}:{})};
  });
  return {shared:[...new Set(input.shared)],requests};
}

// Takes the caller's transaction so config edits and grant revocation commit together.
export function writeSharing(db,schema,client,{shared,requests}){
  const storage=schema+'.app_storage',grants=schema+'.app_data_grants';
  const previous=db.prepare('SELECT shared,requests FROM '+storage+' WHERE client=?').get(client);
  db.prepare('INSERT INTO '+storage+'(client,shared,requests) VALUES(?,?,?) ON CONFLICT(client) DO UPDATE SET shared=excluded.shared,requests=excluded.requests')
    .run(client,JSON.stringify(shared),JSON.stringify(requests));
  for(const collection of JSON.parse(previous?.shared??'[]')){
    if(!shared.includes(collection))db.prepare('DELETE FROM '+grants+' WHERE source=? AND collection=?').run(client,collection);
  }
  for(const {source,collection} of JSON.parse(previous?.requests??'[]')){
    if(!requests.some(item=>item.source===source&&item.collection===collection)){
      db.prepare('DELETE FROM '+grants+' WHERE source=? AND destination=? AND collection=?').run(source,client,collection);
    }
  }
}
