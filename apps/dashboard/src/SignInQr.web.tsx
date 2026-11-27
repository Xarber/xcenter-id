import {ArrowLeft, QrCode} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

export type SignInApp = {name:string;icon:string|null;canApproveRemotely:boolean};
type Approval = {image:string;code:string;expires:number};

export default function SignInQr({continuation,back}:{continuation:string|null;back:()=>void}){
  const [attempt,setAttempt]=useState(0);
  const [approval,setApproval]=useState<Approval|null>(null);
  const [message,setMessage]=useState('');
  const heading=useRef<HTMLHeadingElement>(null);
  const finish=useRef<HTMLFormElement>(null);
  const app=continuation?.startsWith('/interaction/')?continuation:null;
  const start=app?app+'?qr=start':'/account-approval/start'+(continuation?'?continue='+encodeURIComponent(continuation):'');
  const status=app?app+'?qr=status':'/account-approval/status';
  useEffect(()=>{heading.current?.focus();},[]);
  useEffect(()=>{
    const request=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    async function poll(expires:number){
      if(request.signal.aborted)return;
      if(Date.now()>=expires){setMessage('This code expired. Generate a new code to try again.');return;}
      try{
        const response=await fetch(status,{cache:'no-store',signal:request.signal});
        const state=response.ok?(await response.json()).state:response.status===400?'expired':null;
        if(request.signal.aborted)return;
        if(state==='ready'){finish.current?.requestSubmit();return;}
        if(state==='expired'){setMessage('This request expired. Generate a new code to try again.');return;}
      }catch{if(request.signal.aborted)return;}
      timer=setTimeout(()=>void poll(expires),1800);
    }
    async function begin(){
      try{
        const response=await fetch(start,{method:'POST',cache:'no-store',signal:request.signal});
        if(!response.ok)throw new Error();
        const result:Approval=await response.json();
        if(request.signal.aborted)return;
        setApproval(result);
        void poll(result.expires);
      }catch{
        if(!request.signal.aborted)setMessage('Could not show a QR code. Try again or sign in on this device.');
      }
    }
    void begin();
    return ()=>{request.abort();clearTimeout(timer);};
  },[attempt,start,status]);
  return <div className="xc-auth-qr">
    <span className="xc-symbol xc-lavender"><QrCode size={24}/></span>
    <h1 ref={heading} tabIndex={-1}>Sign in on another device</h1>
    <p>Scan with X-Center ID or enter the code in Devices on a device where you’re already signed in.</p>
    {approval&&!message&&<><img className="xc-auth-qr-image" src={approval.image} width={220} height={220} alt="QR code for this sign-in request"/>
      <p className="xc-auth-qr-code" aria-label={'Device code '+approval.code.split('').join(' ')}>{approval.code}</p></>}
    <p role="status">{message||(approval?'Waiting for approval…':'Creating your code…')}</p>
    <form ref={finish} action={app?app+'?qr=finish':'/account-approval/finish'} method="post"/>
    {message&&<button type="button" className="xc-button xc-primary xc-full" onClick={()=>{setMessage('');setApproval(null);setAttempt(attempt+1);}}>Generate a new code</button>}
    <button type="button" className="xc-button xc-secondary xc-full" onClick={back}><ArrowLeft size={17}/> Back to sign-in</button>
  </div>;
}
