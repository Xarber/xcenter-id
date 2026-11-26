import ListPages from './ListPages.web';
import {useListPage} from './list-page';
import { IconAction } from './AdminUsers.web';
import { ArrowLeft, Check, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './web-account';
import type { SupportMessage, SupportRequest } from './support-model';

export function SupportPage() {
  const [requests,setRequests]=useState<{id:string;subject:string;reply:string|null}[]>([]);
  useEffect(()=>{void api('support').then(result=>setRequests(result.requests)).catch(()=>{});},[]);
  const [subject,setSubject]=useState('');
  const [text,setText]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  return <form className="xc-card xc-pad xc-stack" onSubmit={event=>{
    event.preventDefault();setBusy(true);setStatus('');
    void api('support',{subject,text}).then(()=>{
      setSubject('');setText('');setStatus('Request sent. Check Mail for a reply.');
    }).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
  }}>
    <h2>Contact support</h2>
    {requests.map(request=><div key={request.id}><strong>{request.subject}</strong><p style={{whiteSpace:'pre-wrap'}}>{request.reply??'Awaiting a reply.'}</p></div>)}
    <p>Send feedback or get help with your account. X-Center administrators can read your request.</p>
    <label>Subject<input required maxLength={120} value={subject} onChange={event=>setSubject(event.target.value)}/></label>
    <label>Message<textarea required rows={5} maxLength={3000} value={text} onChange={event=>setText(event.target.value)}/></label>
    <button className="xc-button xc-primary xc-self-start" disabled={busy||!subject.trim()||!text.trim()}>Send to support</button>
    {status&&<p role="status">{status}</p>}
  </form>;
}

export function AdminSupport() {
  const [requests,setRequests]=useState<SupportRequest[]>([]);
  const page=useListPage(requests.length);
  const [open,setOpen]=useState<{id:string;message:SupportMessage}|null>(null);
  const [text,setText]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState(false);
  async function load(){setRequests((await api('admin/support')).requests);}
  function run(work:()=>Promise<void>){
    setBusy(true);setStatus('');
    void work().catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
  }
  useEffect(()=>{
    const id=new URLSearchParams(location.search).get('support');
    run(async()=>{
      await load();
      if(id&&/^[0-9a-f-]{36}$/.test(id)){
        setOpen({id,message:await api('admin/support/'+id)});
        requestAnimationFrame(()=>document.getElementById('support-inbox')?.scrollIntoView());
      }
    });
  },[]);
  return <section id="support-inbox" className="xc-card xc-pad xc-stack">
    <h2>Support inbox</h2>
    {open?<article className="xc-stack">
      <IconAction label="All requests" disabled={busy} onClick={()=>{setOpen(null);setConfirm(false);}}><ArrowLeft size={20}/></IconAction>
      <h3>{open.message.subject||'(No subject)'}</h3>
      <p>{open.message.sender}{open.message.external?' · Unverified email sender':''}</p>
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{open.message.text}</p>
      {open.message.canReply&&<form className="xc-stack" onSubmit={event=>{
        event.preventDefault();
        run(async()=>{await api('admin/support/'+open.id,{text});setOpen(null);setText('');await load();setStatus('Reply delivered to Mail.');});
      }}>
        <label>Reply<textarea required rows={4} maxLength={3000} value={text} onChange={event=>setText(event.target.value)}/></label>
        <IconAction type="submit" label="Send mailbox reply" disabled={busy||!text.trim()}><Send size={20}/></IconAction>
      </form>}
      {open.message.external&&<p>External replies require a configured email sender.</p>}
      <IconAction label={confirm?'Confirm removal':'Remove request'} disabled={busy} onClick={()=>{
        if(!confirm){setConfirm(true);return;}
        run(async()=>{await api('admin/support/'+open.id,{},'DELETE');setOpen(null);setConfirm(false);await load();});
      }}>{confirm?<Check size={20}/>:<Trash2 size={20}/>}</IconAction>
    </article>:<>
      <IconAction label="Refresh requests" disabled={busy} onClick={()=>run(load)}><RefreshCw size={20}/></IconAction>
      {requests.length===0&&!busy&&<p>No support requests.</p>}
      {requests.slice(page.start,page.end).map(request=><button type="button" className="xc-button xc-secondary xc-self-start" key={request.id} disabled={busy}
        onClick={()=>run(async()=>{setOpen({id:request.id,message:await api('admin/support/'+request.id)});setText('');setConfirm(false);})}>
        {request.external?'Incoming email':request.replied?'Answered request':'Account request'} · {new Date(request.received).toLocaleString()}
      </button>)}
      <ListPages state={page} label="Support requests"/>
    </>}
    {status&&<p role="status">{status}</p>}
  </section>;
}
