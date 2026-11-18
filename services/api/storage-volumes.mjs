import {constants, accessSync, lstatSync, readFileSync, statfsSync} from 'node:fs';
import {isAbsolute, join} from 'node:path';

const markerName = '.xcenter-volume-id';

export function storageVolumeStatus(primary, additional = []) {
  return [{id:'primary', label:'Current storage', root:primary}, ...additional].map(volume => {
    const {id,label,root} = volume;
    const invalid = {id,label,status:'unavailable'};
    try {
      if(typeof root!=='string'||!isAbsolute(root)||!lstatSync(root).isDirectory())return invalid;
      if(id!=='primary'){
        const marker=join(root,markerName);
        const state=lstatSync(marker);
        if(!state.isFile()||state.size>64||readFileSync(marker,'utf8').trim()!==id)return invalid;
      }
      const stat=statfsSync(root);
      const space={total:stat.blocks*stat.bsize, free:stat.bavail*stat.bsize, freeFiles:stat.files>0?stat.ffree:null};
      let writable=true;
      try{accessSync(root,constants.W_OK);}catch{writable=false;}
      const status=!writable?'read-only':space.free<256*1024**2||space.freeFiles===0?'full':'available';
      return {id,label,status,...space};
    }catch{return invalid;}
  });
}

export function parseStorageVolumes(raw) {
  if(!raw)return [];
  const volumes=JSON.parse(raw);
  const ids=new Set(['primary']);
  if(!Array.isArray(volumes)||volumes.length>16)throw Error('Invalid storage volume list');
  return volumes.map(({id,label,root})=>{
    if(typeof id!=='string'||!/^[a-z][a-z0-9-]{1,31}$/.test(id)||ids.has(id)||
      typeof label!=='string'||!label.trim()||label.length>80||typeof root!=='string'||!isAbsolute(root))
      throw Error('Invalid storage volume');
    ids.add(id);
    return {id,label,root};
  });
}
