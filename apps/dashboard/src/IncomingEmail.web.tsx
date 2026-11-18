import {useEffect,useState} from 'react';
import {api} from './web-account';

export default function IncomingEmail({updated}:{updated:()=>Promise<void>}){
  const [enabled,setEnabled]=useState(false);
  const [email,setEmail]=useState('');
  const [addresses,setAddresses]=useState<{address:string;verified:number}[]>([]);
  const [draft,setDraft]=useState<{mailto:string;address:string;expires:number}|null>(null);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  async function check(){
    const info=await api('email/incoming');
    setEnabled(info.enabled);
    const data=await api('me');setAddresses(data.account?.emails??[]);
    if(info.result?.status==='superseded')setStatus('This verification was canceled because another account completed verification of this address.');
    if(draft&&!info.pending){
      const {account}=await api('me');
      if(account?.emails.some((item:{address:string;verified:number})=>item.address===draft.address&&!!item.verified)){
        setStatus('Email verified.');setDraft(null);await updated();
      }else if(Date.now()>draft.expires){setStatus('The verification expired. Create another message.');setDraft(null);}
    }
  }
  useEffect(()=>{void check().catch(error=>setStatus(error.message));},[]);
  useEffect(()=>{
    if(!draft)return;
    const timer=setInterval(()=>void check().catch(()=>{}),15000);
    return ()=>clearInterval(timer);
  },[draft]);
  if(!enabled)return null;
  return <section className="xc-card xc-pad xc-stack">
    <h2>Email addresses</h2>
    <p>While outgoing verification mail is unavailable, send a prepared message from the address you want to verify. Keep its subject and code unchanged.</p>
    <form className="xc-inline-form" onSubmit={event=>{
      event.preventDefault();setBusy(true);setStatus('');
      void api('email/add',{email}).then(async()=>{setEmail('');setStatus('Address added · Unverified');await check();await updated();}).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
    }}>
      <label>Email to verify<input type="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>
      <button className="xc-button xc-secondary" disabled={busy}>Add email</button>
    </form>
    {addresses.map(item=><div key={item.address} className="xc-list-row"><div><strong>{item.address}</strong><p>{item.verified?'Verified':'Unverified · Cannot be used for sign-in or shared with apps'}</p></div>{!item.verified&&<button className="xc-button xc-secondary" disabled={busy} onClick={()=>{setBusy(true);void api('email/incoming',{email:item.address}).then(result=>{setDraft(result);window.location.href=result.mailto;}).catch(e=>setStatus(e.message)).finally(()=>setBusy(false));}}>Verify email</button>}<button className="xc-button xc-secondary" disabled={busy} onClick={()=>{if(!window.confirm('Remove this email address from your account?'))return;setBusy(true);void api('email/remove',{email:item.address}).then(async()=>{await check();await updated();}).catch(e=>setStatus(e.message)).finally(()=>setBusy(false));}}>Remove</button></div>)}
    {draft&&<><p>Send from <strong>{draft.address}</strong>. Your email provider must authenticate the message.</p>
      <a className="xc-button xc-primary xc-self-start" href={draft.mailto}>Open verification email</a>
      <button type="button" className="xc-button xc-secondary xc-self-start" disabled={busy} onClick={()=>void check().catch(error=>setStatus(error.message))}>Check delivery</button>
      <p>Expires {new Date(draft.expires).toLocaleTimeString()}. Delivery normally takes a few minutes.</p></>}
    {status&&<p role="status">{status}</p>}
  </section>;
}
