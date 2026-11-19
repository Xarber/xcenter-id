import TrustBadges from './TrustBadges.web';
import { BadgeCheck, Code2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { developerApi, type DeveloperIdentity } from './developer-web';

export default function DeveloperIdentityPanel(){
  const [name,setName]=useState('');
  const [profile,setProfile]=useState<DeveloperIdentity|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    void developerApi('profile').then(result=>{setProfile(result);setName(result.name);}).catch(error=>setNotice(error.message));
  },[]);
  const losesVerification=profile?.status==='verified'&&profile.name!==name.trim();
  function save(requestVerification=false){
    setBusy(true);setNotice('');
    void developerApi('profile',{name,requestVerification}).then(result=>{
      setProfile(result);setName(result.name);
      setNotice(requestVerification?'Verification request submitted.':losesVerification?'Developer name saved. Request verification for this name.':'Developer profile saved.');
    }).catch(error=>setNotice(error.message)).finally(()=>setBusy(false));
  }
  return <section className="xc-card xc-pad" id="developer-profile">
    <div className="xc-row-head"><span className="xc-symbol xc-lavender"><Code2 size={20}/></span>
      <div><h2>Developer profile</h2><p>Your developer name appears on the linking screen for all your apps.</p></div>
    </div>
    <TrustBadges kind="developer" verified={profile?.status==='verified'}/>
    {profile?.status==='requested'&&<p className="xc-pill">Verification in review</p>}
    {losesVerification&&<p role="status">Changing your developer name removes its verified badge. You’ll need to request verification again.</p>}
    <form className="xc-inline-form" onSubmit={event=>{event.preventDefault();save();}}>
      <label>Developer display name<input value={name} onChange={event=>setName(event.target.value)} maxLength={80} required/></label>
      <button className="xc-button xc-primary" disabled={busy||!profile||!name.trim()}>Save developer name</button>
      {profile?.status==='unverified'&&<button type="button" className="xc-button xc-secondary" disabled={busy||!name.trim()}
        onClick={()=>save(true)}><BadgeCheck size={16}/> Request verification</button>}
    </form>
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
