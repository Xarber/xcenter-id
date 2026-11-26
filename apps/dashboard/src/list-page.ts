import {useState} from 'react';

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
