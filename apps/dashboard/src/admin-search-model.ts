import {useEffect,useRef,useState} from 'react';
import {pageWindow,type PageSize} from './list-page';

export type AdminCategory = 'users' | 'apps' | 'developers' | 'support' | 'usernames' | 'storage';
export type SearchItem={id:string;title:string;description?:string;username?:string};
type SearchGroup={total:number;page:number;items:SearchItem[]};
type SearchResult={groups:Partial<Record<AdminCategory,SearchGroup>>};

export const adminCategories:Record<AdminCategory,string>={
  users:'Users',apps:'Registered apps',developers:'Developers',support:'Support requests',usernames:'Username requests',storage:'Storage volumes',
};

export function useAdminSearch(load:(path:string,signal:AbortSignal)=>Promise<SearchResult>){
  const [input,setInput]=useState('');
  const [query,setQuery]=useState('');
  const [group,setGroup]=useState<AdminCategory>();
  const [size,setSize]=useState<PageSize>(10);
  const [requested,setRequested]=useState(1);
  const [results,setResults]=useState<SearchResult['groups']>({});
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [revision,rerun]=useState(0);
  const send=useRef(load);
  send.current=load;
  useEffect(()=>{
    if(!query)return;
    const controller=new AbortController();
    const params=new URLSearchParams({q:query,page:String(requested),size:String(size)});
    if(group)params.set('section',group);
    setBusy(true);setStatus('');
    void send.current('admin/search?'+params,controller.signal).then(response=>{
      if(!controller.signal.aborted)setResults(response.groups);
    }).catch(error=>{
      if(!controller.signal.aborted){setResults({});setStatus(error.message);}
    }).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>controller.abort();
  },[query,group,size,requested,revision]);
  const section=group?results[group]:undefined;
  return {
    input,setInput,query,group,results,status,busy,
    search(){const next=input.trim();if(next.length<2)return;setResults({});setGroup(undefined);setRequested(1);setQuery(next);rerun(value=>value+1);},
    select(category?:AdminCategory){setResults({});setGroup(category);setRequested(1);},
    pagination:{...pageWindow(section?.total??0,section?.page??1,size),size,go:setRequested,
      setSize:(next:PageSize)=>{setSize(next);setRequested(1);}},
  };
}
