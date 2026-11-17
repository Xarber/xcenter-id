import { useEffect, useState } from 'react';
import { Download, Link2, Trash2 } from 'lucide-react';
import { api } from './web-account';
import type { Friend, SharedFile } from './friends-model';

export default function FriendsPage() {
  const [friends,setFriends]=useState<Friend[]>([]);
  const [incoming,setIncoming]=useState<SharedFile[]>([]);
  const [outgoing,setOutgoing]=useState<SharedFile[]>([]);
  const [code,setCode]=useState('');
  const [invite,setInvite]=useState('');
  const [confirm,setConfirm]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);

  async function load() {
    const [people,shares]=await Promise.all([api('friends'),api('files/shared')]);
    setFriends(people.friends);setIncoming(shares.incoming);setOutgoing(shares.outgoing);
  }
  async function action(task:()=>Promise<void>) {
    setBusy(true);setStatus('');
    try { await task(); }
    catch (error) { setStatus(error instanceof Error?error.message:'This action could not be completed.'); }
    finally { setBusy(false); }
  }
  useEffect(()=>{void action(load);},[]);
  return <section className="xc-card xc-pad xc-stack">
    <h2>Friends</h2>
    <p>Create a one-time code and share it privately. It expires after 15 minutes.</p>
    <button className="xc-button xc-secondary xc-self-start" disabled={busy} onClick={()=>void action(async()=>setInvite((await api('friends/invite',{})).code))}>
      <Link2 size={17}/> Create invitation
    </button>
    {invite&&<label>Invitation code<input readOnly value={invite} onFocus={event=>event.target.select()}/></label>}
    <form className="xc-stack" onSubmit={event=>{event.preventDefault();void action(async()=>{
      await api('friends/accept',{code:code.trim()});setCode('');await load();
    });}}>
      <label>Invitation from a friend<input value={code} maxLength={32} onChange={event=>setCode(event.target.value)}/></label>
      <button className="xc-button xc-primary xc-self-start" disabled={busy||code.trim().length!==32}>Accept invitation</button>
    </form>
    {friends.map(friend=><div className="xc-list-row" key={friend.id}>
      <strong>@{friend.username}</strong>
      <button className="xc-button xc-secondary" disabled={busy} onClick={()=>{
        if(confirm!==friend.id){setConfirm(friend.id);return;}
        void action(async()=>{await api('friends/'+friend.id,{},'DELETE');setConfirm('');await load();});
      }}>{confirm===friend.id?'Confirm removal and revoke sharing':'Remove friend'}</button>
    </div>)}
    <h2>Shared with you</h2>
    {incoming.length===0&&<p>No files have been shared with you.</p>}
    {incoming.map(file=><div className="xc-list-row" key={file.id}>
      <span>{file.name} · @{file.from}</span>
      <a className="xc-button xc-secondary" href={'/account/files/shared/'+file.id} aria-label={'Download '+file.name}><Download size={17}/></a>
    </div>)}
    <h2>Files you shared</h2>
    {outgoing.length===0&&<p>Choose a file in Files to share with a friend.</p>}
    {outgoing.map(file=><div className="xc-list-row" key={file.id}>
      <span>{file.name} · @{file.to}</span>
      <button className="xc-button xc-secondary" disabled={busy} onClick={()=>void action(async()=>{
        await api('files/shared/'+file.id,{},'DELETE');await load();
      })}><Trash2 size={17}/> Revoke access</button>
    </div>)}
    {status&&<p role="status">{status}</p>}
  </section>;
}
