import {useState} from 'react';
import {History} from 'lucide-react';
import {activitySummary,activityTitle,type ActivityEvent} from './account-activity';
import {api} from './web-account';

export default function AccountActivity(){
  const [open,setOpen]=useState(false);
  const [events,setEvents]=useState<ActivityEvent[]|null>(null);
  const [error,setError]=useState('');
  async function load(){
    setError('');
    setEvents(null);
    try{setEvents((await api('activity')).events);}
    catch(error){setError(error instanceof Error?error.message:'Activity unavailable.');}
  }
  return <section className="xc-card xc-pad xc-stack">
    <div className="xc-row-head"><History size={20} aria-hidden/><h2>Account activity</h2></div>
    <button type="button" className="xc-button xc-secondary xc-self-start" aria-expanded={open} onClick={()=>{
      setOpen(!open);
      if(!open)void load();
    }}>{open?'Hide activity':'View activity'}</button>
    {open&&(error?<p role="alert">{error}</p>:!events?<p role="status">Loading activity…</p>:events.length===0?<p>No recent activity.</p>:
      <ul className="xc-stack">{events.map(event=><li key={event.id}>
        <strong>{activityTitle[event.kind]}</strong>{event.subject&&' · '+event.subject}
        <p>{new Date(event.created).toLocaleString()}{activitySummary(event)&&' · '+activitySummary(event)}</p>
      </li>)}</ul>)}
  </section>;
}
