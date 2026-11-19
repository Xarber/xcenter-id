import TrustBadges from './TrustBadges.web';
import { accountMessage } from './account-locale';
import { useEffect, useRef, useState } from 'react';
import { Download, Link2, Trash2, UserRound, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api } from './web-account';
import { placeLabel, type Friend, type SharedFile, type FriendRecordIndex, type ShareablePlace } from './friends-model';

export default function FriendsPage() {
  const [friends,setFriends]=useState<Friend[]>([]);
  const [incoming,setIncoming]=useState<SharedFile[]>([]);
  const [outgoing,setOutgoing]=useState<SharedFile[]>([]);
  const [code,setCode]=useState(()=>new URLSearchParams(location.hash.slice(1)).get('invite')??'');
  const [invite,setInvite]=useState('');
  const [mode,setMode]=useState<'create'|'accept'|null>(()=>new URLSearchParams(location.hash.slice(1)).has('invite')?'accept':null);
  const [username,setUsername]=useState('');
  const [requests,setRequests]=useState<Friend[]>([]);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(mode&&!dialog.current?.open)dialog.current?.showModal();},[mode]);
  function closeInvite(){setMode(null);if(location.hash.startsWith('#invite='))history.replaceState(null,'',location.pathname);}

  const [confirm,setConfirm]=useState('');
  const [status,setStatus]=useState('');
  const [records,setRecords]=useState<FriendRecordIndex>();
  const [places,setPlaces]=useState<ShareablePlace[]>([]);
  const [publisher,setPublisher]=useState('');
  const [cursor,setCursor]=useState<string|null>(null);
  const [selection,setSelection]=useState('');
  const [busy,setBusy]=useState(false);

  async function load() {
    const [people,shares,index]=await Promise.all([api('friends'),api('files/shared'),api('friends/records')]);
    setRecords(index);
    setFriends(people.friends);setRequests(people.requests??[]);setIncoming(shares.incoming);setOutgoing(shares.outgoing);
  }
  async function action(task:()=>Promise<void>) {
    setBusy(true);setStatus('');
    try { await task(); }
    catch (error) { setStatus(error instanceof Error?error.message:'This action could not be completed.'); }
    finally { setBusy(false); }
  }
  useEffect(()=>{void action(load);},[]);
  return <div className="xc-stack"><section className="xc-card xc-pad xc-stack">
    <h2>{accountMessage('friends','Friends')}</h2>
    <p>Create a one-time code and share it privately. It expires after 15 minutes.</p>
    <button className="xc-button xc-secondary xc-self-start" disabled={busy} onClick={()=>{setMode('create');setInvite('');void action(async()=>setInvite((await api('friends/invite',{})).code));}}>
      <Link2 size={17}/> Create invitation
    </button>
    <button className="xc-button xc-secondary xc-self-start" onClick={()=>setMode('accept')}>Enter invitation code</button>
    <form className="xc-inline-form" onSubmit={event=>{event.preventDefault();void action(async()=>{await api('friends/request',{username});setUsername('');setStatus('Request submitted.');});}}>
      <label>Friend’s username<input value={username} onChange={event=>setUsername(event.target.value)} maxLength={24} required autoComplete="off"/></label>
      <button className="xc-button xc-primary" disabled={busy}>Send request</button>
    </form>
    {requests.map(item=><div className="xc-list-row" key={item.id}><span className="xc-identity-label"><strong>@{item.username}</strong><TrustBadges verified={item.verified} admin={item.admin}/></span><div className="xc-actions">{[true,false].map(accept=><button type="button" key={String(accept)} className="xc-button xc-secondary" onClick={()=>void action(async()=>{await api('friends/respond',{id:item.id,accept});await load();})}>{accept?'Accept':'Decline'}</button>)}</div></div>)}
    {mode&&<dialog ref={dialog} className="xc-intro" onCancel={event=>{event.preventDefault();closeInvite();}} aria-labelledby="friend-invite-title">
    <h2 id="friend-invite-title">{mode==='create'?'Share an invitation':'Accept an invitation'}</h2>
    {mode==='create'?(invite?<div className="xc-stack"><strong>{invite}</strong><button type="button" className="xc-button xc-secondary" onClick={()=>void action(async()=>{await navigator.clipboard.writeText(location.origin+'/friends#invite='+invite);setStatus('Invitation link copied.');})}>Copy invitation link</button></div>:<p>Creating invitation…</p>):
    <form className="xc-stack" onSubmit={event=>{event.preventDefault();void action(async()=>{
      await api('friends/accept',{code:code.trim()});setCode('');await load();closeInvite();
    });}}>
      <label>Invitation from a friend<input value={code} maxLength={32} onChange={event=>setCode(event.target.value)}/></label>
      <button className="xc-button xc-primary xc-self-start" disabled={busy||![10,32].includes(code.trim().length)}>Accept invitation</button>
    </form>}<button type="button" className="xc-button xc-secondary" onClick={closeInvite}>Close</button>{status&&<p role="status">{status}</p>}</dialog>}
    {friends.map(friend=><div className="xc-list-row" key={friend.id}>
      <div className="xc-row-head"><span className="xc-avatar">{friend.avatar?<img src={friend.avatar} alt=""/>:<UserRound size={20}/>}</span><span className="xc-identity-label"><strong>@{friend.username}</strong><TrustBadges verified={friend.verified} admin={friend.admin}/></span></div>
      <button className="xc-button xc-secondary" disabled={busy} onClick={()=>{
        if(confirm!==friend.id){setConfirm(friend.id);return;}
        void action(async()=>{await api('friends/'+friend.id,{},'DELETE');setConfirm('');await load();});
      }}>{confirm===friend.id?'Confirm removal and revoke sharing':'Remove friend'}</button>
    </div>)}
    </section><section className="xc-card xc-pad xc-stack"><h2 className="xc-row-head"><ArrowDownLeft size={20}/> Shared with you</h2>
    {incoming.length===0&&<p>No files have been shared with you.</p>}
    {incoming.map(file=><div className="xc-list-row" key={file.id}>
      <span>{file.name} · @{file.from}</span>
      <a className="xc-button xc-secondary" href={'/account/files/shared/'+file.id} aria-label={'Download '+file.name}><Download size={17}/></a>
    </div>)}
    </section><section className="xc-card xc-pad xc-stack"><h2 className="xc-row-head"><ArrowUpRight size={20}/> Files you shared</h2>
    {outgoing.length===0&&<p>Choose a file in Files to share with a friend.</p>}
    {outgoing.map(file=><div className="xc-list-row" key={file.id}>
      <span>{file.name} · @{file.to}</span>
      <button className="xc-button xc-secondary" disabled={busy} onClick={()=>void action(async()=>{
        await api('files/shared/'+file.id,{},'DELETE');await load();
      })}><Trash2 size={17}/> Revoke access</button>
    </div>)}
    </section>{records && (records.sources.length>0||records.incoming.length>0||records.outgoing.length>0) && <section className="xc-card xc-pad xc-stack">
      <h2>{accountMessage('sharedAppData','Shared app data')}</h2>
      {records.sources.length>0&&<label>App<select value={publisher} disabled={busy} onChange={event=>{
        const source=event.target.value;
        setPublisher(source);setSelection('');setPlaces([]);setCursor(null);
        if(source)void action(async()=>{
          const page=await api('friends/records?source='+encodeURIComponent(source));
          setPlaces(page.records);setCursor(page.nextCursor);
        });
      }}><option value="">Choose an app</option>{records.sources.map(app=><option key={app.id} value={app.id}>{app.name}</option>)}</select></label>}
      {places.map(place=><button type="button" key={place.id} className="xc-button xc-secondary xc-self-start"
        disabled={busy} aria-pressed={selection===place.id} onClick={()=>setSelection(place.id)}>{placeLabel(place.value)}</button>)}
      {cursor&&<button type="button" disabled={busy} className="xc-button xc-secondary xc-self-start" onClick={()=>void action(async()=>{
        const page=await api('friends/records?source='+encodeURIComponent(publisher)+'&cursor='+encodeURIComponent(cursor));
        setPlaces(previous=>[...previous,...page.records]);setCursor(page.nextCursor);
      })}>Load more places</button>}
      {selection&&friends.map(friend=><button type="button" key={friend.id} disabled={busy} className="xc-button xc-secondary xc-self-start" onClick={()=>void action(async()=>{
        await api('friends/records',{friend:friend.id,source:publisher,id:selection});setSelection('');await load();setStatus('Place shared.');
      })}>Share this place with @{friend.username}</button>)}
      {records.incoming.map(item=><p key={item.id}>{placeLabel(item.value)} · From @{item.username}</p>)}
      {records.outgoing.map(item=><div className="xc-list-row" key={item.id}>
        <span>{placeLabel(item.value)} · To @{item.username}</span>
        <button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>void action(async()=>{
          await api('friends/records/'+item.id,{},'DELETE');await load();
        })}>Revoke access</button>
      </div>)}
    </section>}
    {status&&<p role="status">{status}</p>}
  </div>;
}
