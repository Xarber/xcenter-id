import {useEffect,useState} from 'react';

export const pageSizes=[10,25,50,100] as const;
export type PageSize=typeof pageSizes[number];

export function pageWindow(total:number,requested:number,size:PageSize){
  const pages=Math.max(1,Math.ceil(total/size));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,start:(page-1)*size,end:Math.min(total,page*size),total};
}

export function readPage(value:string):number|null{
  if(!/^\d{1,9}$/.test(value.trim()))return null;
  const number=Number(value);
  return number>=1?number:null;
}

export function useListPage(total:number,key=''){
  const [selection,setSelection]=useState({key,page:1});
  const [size,setPageSize]=useState<PageSize>(25);
  const view=pageWindow(total,key===selection.key?selection.page:1,size);
  const go=(page:number)=>setSelection({key,page:pageWindow(total,page,size).page});
  return {...view,size,go,setSize:(next:PageSize)=>{setPageSize(next);setSelection({key,page:1});}};
}

export type ListPage=ReturnType<typeof useListPage>;


export function useRemoteListPage<T>(
  key:string,
  enabled:boolean,
  load:(path:string, signal:AbortSignal)=>Promise<{accounts:T[];total:number;page:number}>,
){
  const [selection,setSelection]=useState({key,page:1});
  const [size,setSize]=useState<PageSize>(25);
  const [state,setState]=useState<{request:string;items:T[];total:number;page:number;error:string}|null>(null);
  const requested=selection.key===key?selection.page:1;
  const request='admin/accounts?'+new URLSearchParams({q:key,page:String(requested),size:String(size)});
  useEffect(()=>{
    if(!enabled)return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      void load(request,controller.signal).then(({accounts:items,total,page})=>{
        if(!controller.signal.aborted)setState({request,items,total,page,error:''});
      }).catch(error=>{
        if(!controller.signal.aborted)setState({request,items:[],total:0,page:1,error:error.message});
      });
    },180);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[enabled,request,load]);
  const current=state?.request===request?state:null;
  const view=pageWindow(current?.total??state?.total??0,current?.page??requested,size);
  return {...view,size,items:current?.items??[],loading:enabled&&!current,error:current?.error??'',
    go:(page:number)=>setSelection({key,page:pageWindow(view.total,page,size).page}),
    setSize:(next:PageSize)=>{setSize(next);setSelection({key,page:1});}};
}
