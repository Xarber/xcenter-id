import {ArrowLeft,ChevronRight,Search} from 'lucide-react';
import {api} from './web-account';
import {adminCategories,useAdminSearch,type AdminCategory,type SearchItem} from './admin-search-model';
import ListPages from './ListPages.web';

function destination(category:AdminCategory,item:SearchItem){
  if(category==='support')return '/admin?support='+encodeURIComponent(item.id)+'#support-inbox';
  if(category==='storage')return '/admin#storage-volumes';
  if(category==='usernames')return '/admin#username-requests';
  if(item.username)return '/admin/users/'+encodeURIComponent(item.username)+(category==='apps'?'#app-'+encodeURIComponent(item.id):'');
  return '/admin';
}

export default function AdminSearch(){
  const state=useAdminSearch((path,signal)=>api(path,undefined,'GET',signal));
  const groups=(Object.entries(state.results) as [AdminCategory,NonNullable<(typeof state.results)[AdminCategory]>][]).filter(([,value])=>value.total>0);
  return <section className="xc-card xc-pad xc-stack" aria-labelledby="admin-search-title">
    <div className="xc-row-head"><Search size={20}/><h2 id="admin-search-title">Search Administration</h2></div>
    <form className="xc-inline-form" onSubmit={event=>{event.preventDefault();state.search();}}>
      <label>Search<input type="search" value={state.input} maxLength={120}
        placeholder="Users, registered apps, support requests…" onChange={event=>state.setInput(event.target.value)}/></label>
      <button className="xc-button xc-primary" disabled={state.busy||state.input.trim().length<2}>Search</button>
    </form>
    {state.group&&<button type="button" className="xc-button xc-secondary xc-self-start" disabled={state.busy}
      onClick={()=>state.select()}><ArrowLeft size={16}/> All sections</button>}
    {state.busy&&<p role="status">Searching…</p>}
    {state.status&&<p role="alert">{state.status}</p>}
    {state.query&&!state.busy&&!state.status&&!groups.length&&<p>No results for “{state.query}”.</p>}
    {groups.map(([category,group])=><section key={category} className="xc-stack">
      <h3>{adminCategories[category]} <small>({group.total})</small></h3>
      {group.items.map(item=><a className="xc-list-row" key={item.id} href={destination(category,item)}>
        <span><strong>{item.title}</strong>{item.description&&<p>{item.description}</p>}</span><ChevronRight size={17} aria-hidden/>
      </a>)}
      {!state.group&&group.total>group.items.length&&<button type="button" className="xc-button xc-secondary xc-self-start"
        disabled={state.busy} onClick={()=>state.select(category)}>All {adminCategories[category].toLowerCase()}</button>}
      {state.group===category&&<ListPages state={state.pagination} label={adminCategories[category]}/>}
    </section>)}
  </section>;
}
