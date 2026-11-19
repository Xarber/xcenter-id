import {useEffect,useState} from 'react';
import {developerApi} from './developer-web';
import {api} from './web-account';

type Access = {readerTrust:'secure'|'verified'|'any';private:boolean;requests:boolean;members:{username:string;approved:boolean}[]};

export default function DeveloperAppAccess({id}:{id:string}){
  const [access,setAccess]=useState<Access|null>(null);
  const [friends,setFriends]=useState<{username:string}[]>([]);
  const [username,setUsername]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const path='apps/'+id+'/access';
  useEffect(()=>{
    let active=true;
    void developerApi(path).then(data=>{if(active)setAccess(data);}).catch(error=>{if(active)setStatus(error.message);});
    void api('friends').then(data=>{if(active)setFriends(data.friends);}).catch(()=>{});
    return ()=>{active=false;};
  },[path]);
  async function change(body:object){
    setBusy(true);setStatus('');
    try{setAccess(await developerApi(path,body,'PUT'));setUsername('');}
    catch(error){setStatus(error instanceof Error?error.message:'Could not update app access.');}
    finally{setBusy(false);}
  }
  return <section className="xc-stack">
    <h3>Who can use this app</h3>
    {access&&<><label>Apps allowed to read shared data
      <select value={access.readerTrust} disabled={busy} onChange={event=>{
        const mode=event.target.value;
        if(mode==='any'&&!window.confirm('Allow unsecure apps to request access to shared records? Users must still approve.'))return;
        void change({action:'reader-trust',mode});
      }}><option value="secure">Secure apps</option><option value="verified">Verified apps only</option><option value="any">All apps, including unsecure apps</option></select>
    </label><label className="xc-device-option"><span>Private app</span>
      <input type="checkbox" role="switch" checked={access.private} disabled={busy} onChange={event=>void change({action:'settings',private:event.target.checked,requests:access.requests})}/></label>
      {access.private&&<>
        <p>Only you and approved accounts can sign in to this app.</p>
        <label><span>Allow requesting access</span><input type="checkbox" role="switch" checked={access.requests} disabled={busy}
          onChange={event=>void change({action:'settings',private:true,requests:event.target.checked})}/></label>
        <form className="xc-inline-form" onSubmit={event=>{event.preventDefault();void change({action:'approve',username:username.trim().toLowerCase()});}}>
          <label>X-Center ID username<input value={username} onChange={event=>setUsername(event.target.value.replace(/^@/,''))} required pattern="[a-zA-Z][a-zA-Z0-9]{2,23}"/></label>
          {!!friends.length&&<label>Choose a friend<select value="" onChange={event=>setUsername(event.target.value)}>
            <option value="">Select friend</option>{friends.map(friend=><option key={friend.username} value={friend.username}>@{friend.username}</option>)}
          </select></label>}
          <button className="xc-button xc-primary" disabled={busy}>Allow access</button>
        </form>
        {access.members.map(member=><div className="xc-list-row" key={member.username}>
          <div><strong>@{member.username}</strong><p>{member.approved?'Approved':'Request pending'}</p></div>
          <div className="xc-actions">
            {!member.approved&&<button className="xc-button xc-primary" disabled={busy} onClick={()=>void change({action:'approve',username:member.username})}>Approve</button>}
            <button className="xc-button xc-secondary" disabled={busy} onClick={()=>void change({action:'remove',username:member.username})}>{member.approved?'Remove access':'Decline'}</button>
          </div>
        </div>)}
      </>}
    </>}
    {status&&<p role="alert">{status}</p>}
  </section>;
}
