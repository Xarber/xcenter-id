import {useState} from 'react';
import {useFileTransfers,type Source} from './file-transfers';
import type {ContainerFile} from './account-file-containers';

type Request=(path:string,data?:object,method?:string,signal?:AbortSignal)=>Promise<{id?:string;chunkSize?:number}>;

export function useAppFileEdits(path:string,request:Request,reload:()=>void){
  const [rename,setRename]=useState<{file:ContainerFile;name:string}>();
  const [failure,setFailure]=useState('');
  const [busy,setBusy]=useState(false);
  const transfer=useFileTransfers();
  const report=(error:unknown)=>setFailure(error instanceof Error?error.message:'Could not update this file.');
  async function change(file:ContainerFile,method:'PUT'|'DELETE',data:object){
    setBusy(true);
    setFailure('');
    try{
      await request(path+'/'+file.id,data,method);
      setRename(undefined);
      reload();
    }catch(error){report(error);}
    finally{setBusy(false);}
  }
  function replace(file:ContainerFile,source:Source){
    setFailure('');
    transfer.add([source],null,request,reload,report,()=>({path:path+'/uploads',body:{replace:file.id,size:source.size}}));
  }
  return {rename,setRename,busy,failure,change,replace,transfer,report};
}
