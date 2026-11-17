import { Camera, Check, CircleHelp, Mail, Save, UserRound } from 'lucide-react';
import { useState } from 'react';
import DeveloperIdentityPanel from './DeveloperIdentity.web';
import { api, profilePhoto, type Account } from './web-account';

export default function ProfilePage({ account, update, complete }: {
  account:Account; update:()=>Promise<void>; complete?:()=>void;
}) {
  const [picture,setPicture] = useState<string|null|undefined>();
  const [revision,setRevision] = useState(0);
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [saveState,setSaveState] = useState<'ready'|'saving'|'saved'>('ready');
  const [email,setEmail] = useState('');
  const profile = account.profile;
  const image = picture === null ? null : picture ? 'data:image/jpeg;base64,'+picture :
    profile?.hasPicture ? '/account/avatar?v='+revision : null;
  async function perform(task:()=>Promise<void>) {
    setBusy(true); setNotice('');
    try { await task(); }
    catch(error) { setNotice(error instanceof Error ? error.message : 'Could not complete this action.'); }
    finally { setBusy(false); }
  }
  return <>
    <section className="xc-card xc-profile-card">
      <div className="xc-profile-head">
        <div className="xc-avatar xc-avatar-large">{image ? <img src={image} alt="Your profile"/> : <UserRound size={36}/>}</div>
        <div><h2>Profile picture</h2><p>This photo appears on your X-Center ID dashboard.</p>
          <div className="xc-actions">
            <label className="xc-button xc-secondary"><Camera size={16}/> Choose photo
              <input className="xc-sr" type="file" disabled={busy} accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => { const file=event.target.files?.[0]; if(file) void perform(async()=>{setPicture(await profilePhoto(file));setSaveState('ready');}); }} />
            </label>
            {image && <button type="button" className="xc-quiet" disabled={busy} onClick={()=>{setPicture(null);setSaveState('ready');}}>Remove photo</button>}
          </div>
        </div>
      </div>
      <form className="xc-profile-form" onChange={()=>setSaveState('ready')} onSubmit={(event)=>{
        event.preventDefault(); const fields=Object.fromEntries(new FormData(event.currentTarget));
        setSaveState('saving');
        void perform(async()=>{
          try { await api('profile',{...fields,...(picture!==undefined ? {picture} : {})}); }
          catch(error){setSaveState('ready');throw error;}
          setSaveState('saved');
          await update();setPicture(undefined);setRevision(prev=>prev+1);
          complete?.();
        });
      }}>
        <h2>Personal information</h2>
        <fieldset className="xc-form-grid xc-profile-fields" disabled={busy}>
          <label>Given name<input name="givenName" autoComplete="given-name" maxLength={64} required defaultValue={profile?.givenName}/></label>
          <label>Surname<input name="surname" autoComplete="family-name" maxLength={64} required defaultValue={profile?.surname}/></label>
          <label>X-Center username<input name="username" autoComplete="username" pattern="[A-Za-z][A-Za-z0-9]{2,23}"
            maxLength={24} required defaultValue={profile?.username} readOnly={!!profile?.username}/></label>
          <label>Birthday<input name="birthday" type="date" autoComplete="bday" max={new Date().toISOString().slice(0,10)}
            required defaultValue={profile?.birthday}/></label>
        </fieldset>
        <p className="xc-hint"><CircleHelp size={15}/> Apps can request your age range. Your exact birthday stays in your account.</p>
        <button className="xc-button xc-primary xc-save-profile" disabled={busy||saveState==='saved'}
          aria-busy={saveState==='saving'} data-save-state={saveState}>
          {saveState==='saved'?<Check size={16} aria-hidden="true"/>:<Save size={16} aria-hidden="true"/>}
          {saveState==='saving'?'Saving…':saveState==='saved'?'Saved':complete?'Finish setup':'Save changes'}
        </button>
        <span className="xc-sr" role="status">{saveState==='saved'?'Profile changes saved.':''}</span>
      </form>
    </section>
    {!complete && <section className="xc-card xc-pad">
      <div className="xc-row-head"><span className="xc-symbol xc-sky"><Mail size={20}/></span><div><h2>Email addresses</h2>
        <p>Only addresses you verify can be shared when signing in.</p></div></div>
      {account.mailbox && <div className="xc-info"><strong>Your X-Center mailbox</strong><span>{account.mailbox}</span>
        <small>External delivery depends on mail routing.</small></div>}
      {account.emails.map(({address}) => <div className="xc-list-row" key={address}><span>{address}</span><span className="xc-pill"><Check size={13}/> Verified</span></div>)}
      <form className="xc-inline-form" onSubmit={event=>{event.preventDefault();
        void perform(async()=>{await api('email',{email});setNotice('Check your email for a verification link.');});}}>
        <label>Add email<input aria-label="Email address" type="email" value={email} onChange={event=>setEmail(event.target.value)} required/></label>
        <button className="xc-button xc-secondary" disabled={busy}><Mail size={16}/> Verify email</button>
      </form>
    </section>}
    {!complete&&<DeveloperIdentityPanel/>}
    {notice && <div className="xc-notice" role="status">{notice}</div>}
  </>;
}
