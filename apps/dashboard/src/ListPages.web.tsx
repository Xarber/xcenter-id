import {useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {pageSizes,readPage,type ListPage,type PageSize} from './list-page';

export default function ListPages({state,label}:{state:ListPage;label:string}){
  const [draft,setDraft]=useState<string|null>(null);
  if(state.total<=pageSizes[0])return null;
  function commit(){
    if(draft!==null){
      const page=readPage(draft);
      if(page!==null)state.go(page);
    }
    setDraft(null);
  }
  return <nav className="xc-list-pages" aria-label={label+' pagination'}>
    <span aria-live="polite">{state.start+1}–{state.end} of {state.total}</span>
    <label>Per page <select value={state.size} onChange={event=>state.setSize(Number(event.target.value) as PageSize)}>
      {pageSizes.map(size=><option key={size} value={size}>{size}</option>)}
    </select></label>
    <div className="xc-list-page-stepper">
      <button className="xc-button xc-secondary" type="button" aria-label="Previous page" disabled={state.page<=1} onClick={()=>state.go(state.page-1)}><ChevronLeft size={17}/></button>
      <label>Page <input inputMode="numeric" value={draft??String(state.page)}
        maxLength={9} onChange={event=>setDraft(event.target.value)} onBlur={commit}
        onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}if(event.key==='Escape')setDraft(null);}}/></label>
      <span>of {state.pages}</span>
      <button className="xc-button xc-secondary" type="button" aria-label="Next page" disabled={state.page>=state.pages} onClick={()=>state.go(state.page+1)}><ChevronRight size={17}/></button>
    </div>
  </nav>;
}
