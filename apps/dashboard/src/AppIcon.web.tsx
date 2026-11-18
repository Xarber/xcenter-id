import {useState} from 'react';import {Grid2X2} from 'lucide-react';
export default function AppIcon({icon}:{icon?:string|null}){const [failed,setFailed]=useState(false);return <span className="xc-symbol xc-lavender">{icon&&!failed?<img style={{width:32,height:32,borderRadius:8}} src={'data:image/png;base64,'+icon} alt="" onError={()=>setFailed(true)}/>:<Grid2X2 size={22}/>}</span>;}
