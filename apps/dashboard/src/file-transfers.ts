import {useEffect,useRef,useState} from 'react';

export type Source = {name:string;size:number;read:(offset:number,size:number)=>Promise<string>;dispose?:()=>void};
type Request = (path:string,data:object,method:string,signal?:AbortSignal)=>Promise<{id?:string;chunkSize?:number}>;
type Transfer = {key:number;name:string;size:number;sent:number;finishing?:boolean;folder:string|null};
type UploadTarget = {path:string;body:object};
type Task = {target:UploadTarget;row:Transfer;source:Source;controller:AbortController;request:Request;done:()=>void;report:(error:unknown)=>void};

export function useFileTransfers(){
  const [rows,setRows]=useState<Transfer[]>([]);
  const queue=useRef<Task[]>([]);
  const active=useRef(new Map<number,Task>());
  const nextKey=useRef(0);
  useEffect(()=>()=>{for(const task of [...queue.current,...active.current.values()])task.controller.abort();},[]);

  function advance(){
    while(active.current.size<3&&queue.current.length){
      const task=queue.current.shift()!;
      active.current.set(task.row.key,task);
      void transfer(task).finally(()=>{
        active.current.delete(task.row.key);
        advance();
      });
    }
  }

  async function transfer({target,row,source,controller,request,done,report}:Task){
    let id:string|undefined;
    try{
      if(controller.signal.aborted)return;
      const result=await request(target.path,target.body,'POST');
      id=result.id;
      const chunkSize=result.chunkSize;
      if(!id||!chunkSize)throw new Error('Could not start the upload.');
      for(let offset=0;offset<row.size;offset+=chunkSize){
        if(controller.signal.aborted)return;
        const length=Math.min(chunkSize,row.size-offset);
        const content=await source.read(offset,length);
        if(controller.signal.aborted)return;
        await request(target.path+'/'+id,{position:offset,content},'PUT',controller.signal);
        setRows(items=>items.map(item=>item.key===row.key?{...item,sent:offset+length}:item));
      }
      if(controller.signal.aborted)return;
      setRows(items=>items.map(item=>item.key===row.key?{...item,finishing:true}:item));
      await request(target.path+'/'+id,{},'POST');
      id=undefined;
      done();
    }catch(error){
      if(!controller.signal.aborted)report(new Error(row.name+': '+(error instanceof Error?error.message:'Could not upload the file.')));
    }finally{
      setRows(items=>items.filter(item=>item.key!==row.key));
      if(id)void request(target.path+'/'+id,{},'DELETE').catch(()=>{});
      try{source.dispose?.();}catch{}
    }
  }

  return {rows,
    add(sources:readonly Source[],folder:string|null,request:Request,done:()=>void,report:(error:unknown)=>void,target?:(source:Source)=>UploadTarget){
      const items=sources.map(source=>({
        row:{key:++nextKey.current,name:source.name,size:source.size,sent:0,folder},
        target:target?.(source)??{path:'files/uploads',body:{name:source.name,size:source.size,folder}},
        source,controller:new AbortController(),request,done,report,
      }));
      setRows(previous=>[...previous,...items.map(task=>task.row)]);
      queue.current.push(...items);
      advance();
    },
    cancel(key:number){
      (active.current.get(key)??queue.current.find(task=>task.row.key===key))?.controller.abort();
      setRows(items=>items.filter(row=>row.key!==key));
    },
  };
}
