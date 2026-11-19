import {useEffect,useState} from 'react';
import {developerApi} from './developer-web';
import {api} from './web-account';

type Access = {readerTrust:'secure'|'verified'|'any';private:boolean;requests:boolean;members:{username:string;approved:boolean}[]};

export default function DeveloperAppAccess({id}:{id:string}){
  const [access,setAccess]=useState<Access|null>(null);
  const [friends,setFriends]=useState<{username:string}[]>([]);
  const [username,setUsername]=useState('');
  const [status,setStatus]=useState('');
  const [match,setMatch]=useState<string|null>(null);
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
    try{setAccess(await developerApi(path,body,'PUT'));}
    catch(error){setStatus(error instanceof Error?error.message:'Could not update app access.');}
    finally{setBusy(false);}
  }
  const query=username.trim().replace(/^@/,'').toLowerCase();
  const members=new Map(access?.members.map(item=>[item.username,item.approved]));
  const friendNames=new Set(friends.map(person=>person.username));
  const rows=[...new Set([...friendNames,...members.keys()])].filter(name=>name.includes(query)).sort();
  const lookUp=!!access?.private&&/^[a-z][a-z0-9]{2,23}$/.test(query)&&!friendNames.has(query)&&!members.has(query);
  useEffect(()=>{
    if(!lookUp)return;
    let active=true;
    const timer=window.setTimeout(()=>{
      void developerApi(path+'?username='+encodeURIComponent(query)).then(result=>{
        if(active)setMatch(result.username);
      }).catch(error=>{if(active)setStatus(error.message);});
    },300);
    return ()=>{active=false;window.clearTimeout(timer);};
  },[path,query,lookUp]);
  if(lookUp&&match===query)rows.push(query);
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
        <label>Search for friends or other users
          <input type="search" autoComplete="off" placeholder="Friend or exact X-Center ID username" value={username} maxLength={25} onChange={event=>{setUsername(event.target.value);setMatch(null);setStatus('');}}/>
        </label>
        <div className="xc-allowlist" aria-label="App access list">
          <div className="xc-allowlist-heading"><strong>Friends and users</strong><strong>Allow access</strong></div>
          {rows.map(name=>{
            const approved=members.get(name)===true;
            const pending=members.get(name)===false;
            return <div className="xc-allowlist-row" key={name}>
              <div><strong>@{name}</strong><p>{pending?'Access requested':friendNames.has(name)?'Friend':members.has(name)?'Approved user':'Exact username'}</p></div>
              <div className="xc-actions">
                {pending&&<button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>void change({action:'remove',username:name})}>Decline</button>}
                <button type="button" role="switch" aria-checked={approved} aria-label={'Allow access for @'+name}
                  className="xc-permission-switch" disabled={busy} onClick={()=>void change({action:approved?'remove':'approve',username:name})}><span aria-hidden="true"/></button>
              </div>
            </div>;
          })}
          {!rows.length&&<p>Search by username to add someone.</p>}
        </div>
      </>}
    </>}
    {status&&<p role="alert">{status}</p>}
  </section>;
}
