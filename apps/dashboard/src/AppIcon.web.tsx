import {useState} from 'react';
import {Grid2X2} from 'lucide-react';

export default function AppIcon({icon,compact=false}:{icon?:string|null;compact?:boolean}){
  const [failed,setFailed]=useState<string|null>(null);
  const size=compact?18:32;
  const content=icon&&icon!==failed?<img width={size} height={size} style={{borderRadius:compact?3:8}} src={icon.startsWith('/')?icon:'data:image/png;base64,'+icon} alt="" onError={()=>setFailed(icon)}/>:<Grid2X2 size={compact?18:22} aria-hidden="true"/>;
  return compact?content:<span className="xc-symbol xc-lavender">{content}</span>;
}
