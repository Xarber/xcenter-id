import { Check, Copy, Link } from 'lucide-react';
import { useState } from 'react';

export default function CopyButton({value,label,link=false}: {value:string;label:string;link?:boolean}) {
  const [feedback,setFeedback]=useState('');
  const Icon=feedback==='Copied'?Check:link?Link:Copy;
  return <>
    <button type="button" className="xc-copy" aria-label={label} title={label} onClick={()=>{
      setFeedback('');
      if(!navigator.clipboard){setFeedback('Could not copy');return;}
      void navigator.clipboard.writeText(value).then(()=>setFeedback('Copied')).catch(()=>setFeedback('Could not copy'));
    }}>
      <Icon size={17} aria-hidden="true"/>
    </button>
    <span className="xc-sr" role="status">{feedback}</span>
  </>;
}
