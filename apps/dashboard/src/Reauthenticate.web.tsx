import {useState} from 'react';
import {startAuthentication} from '@simplewebauthn/browser';
import {api} from './web-account';

export default function Reauthenticate({complete,request}:{complete?:()=>void;request?:string}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  return <section className="xc-card xc-pad xc-stack">
    <h2>Confirm your identity</h2>
    <p>Use a passkey to open protected controls for this session.</p>
    <button type="button" className="xc-button xc-primary xc-self-start" disabled={busy} onClick={()=>{
      setBusy(true);setError('');
      void (async()=>{
        const optionsJSON=await api('reauth/options',{request});
        const response=await startAuthentication({optionsJSON});
        const result=await api('reauth/finish',{response});
        if(result.returnTo)window.location.assign(result.returnTo);
        else complete?.();
      })().catch(error=>setError(error.name==='NotAllowedError'?'Confirmation canceled.':error.message)).finally(()=>setBusy(false));
    }}>Authenticate</button>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
