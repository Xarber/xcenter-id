import {hasPendingDelivery,verificationStatus,type VerificationAddress,type VerificationStatus} from './email-verification-status';
import {useEffect,useState} from 'react';
import {api} from './web-account';

export default function IncomingEmail({updated,addresses}:{updated:()=>Promise<void>;addresses:VerificationAddress[]}){
  const [info,setInfo]=useState<VerificationStatus|null>(null);
  const [email,setEmail]=useState('');
  const [draft,setDraft]=useState<{mailto:string;address:string;expires:number}|null>(null);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  async function check(report=false,address?:string){
    const next:VerificationStatus=await api('email/incoming');
    setInfo(next);
    const target=address??draft?.address??info?.pending?.address??info?.outgoing?.address;
    const message=verificationStatus(next,target);
    if(draft&&(!next.pending||next.pending.address!==draft.address))setDraft(null);
    const completed=!!target&&!hasPendingDelivery(next)&&!!(info?.pending||info?.outgoing||draft);
    if(report||completed||message==='Email verified.'&&!!target)setStatus(message);
    if(report||message==='Email verified.'&&!!target)await updated();
  }
  useEffect(()=>{void check().catch(error=>setStatus(error.message));},[]);
  useEffect(()=>{
    if(!info?.pending&&!info?.outgoing)return;
    const timer=setInterval(()=>void check().catch(()=>{}),15000);
    return ()=>clearInterval(timer);
  },[info?.pending?.address,info?.outgoing?.address,draft]);
  if(!info?.enabled&&!info?.canSendLink&&!status)return null;
  return <section className="xc-card xc-pad xc-stack">
    <h2>Email addresses</h2>
    <p>Verify an address by opening a link sent to it, or by sending a prepared message from that address.</p>
    <form className="xc-inline-form" onSubmit={event=>{
      event.preventDefault();setBusy(true);setStatus('');
      void api('email/add',{email}).then(async()=>{setEmail('');setStatus('Address added · Unverified');await check();await updated();}).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
    }}>
      <label>Email to verify<input type="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>
      <button className="xc-button xc-secondary" disabled={busy}>Add email</button>
    </form>
    {addresses.map(item=><div key={item.address} className="xc-list-row"><div><strong>{item.address}</strong><p>{item.verified?'Verified':'Unverified · Cannot be used for sign-in or shared with apps'}</p></div>{!item.verified&&info?.canSendLink&&<button type="button" className="xc-button xc-primary" disabled={busy} onClick={()=>{setBusy(true);setStatus('Sending verification link…');void api('email',{email:item.address}).then(()=>check(true,item.address)).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));}}>Email me a link</button>}{!item.verified&&info?.enabled&&<button className="xc-button xc-secondary" disabled={busy} onClick={()=>{setBusy(true);void api('email/incoming',{email:item.address}).then(result=>{setDraft(result);window.location.href=result.mailto;return check(true,result.address);}).catch(e=>setStatus(e.message)).finally(()=>setBusy(false));}}>Send a verification email</button>}<button className="xc-button xc-secondary" disabled={busy} onClick={()=>{if(!window.confirm('Remove this email address from your account?'))return;setBusy(true);void api('email/remove',{email:item.address}).then(async()=>{await check();await updated();}).catch(e=>setStatus(e.message)).finally(()=>setBusy(false));}}>Remove</button></div>)}
    {draft&&<><p>Send from <strong>{draft.address}</strong>. Your email provider must authenticate the message.</p>
      <a className="xc-button xc-primary xc-self-start" href={draft.mailto}>Open verification email</a>
      <p>Expires {new Date(draft.expires).toLocaleTimeString()}. Delivery normally takes a few minutes.</p></>}
    {hasPendingDelivery(info,Date.now(),addresses)&&<button type="button" className="xc-button xc-secondary xc-self-start" disabled={busy} onClick={()=>{setBusy(true);setStatus('Checking verification…');void check(true).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));}}>Check delivery</button>}
    {status&&<p role="status">{status}</p>}
  </section>;
}
