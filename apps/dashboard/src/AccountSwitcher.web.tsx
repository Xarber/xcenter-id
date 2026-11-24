import {ChevronRight,Plus,UserRound} from 'lucide-react';
import {api} from './web-account';

export type BrowserAccount={slot:number;current:boolean;username:string;givenName:string;surname:string;hasPicture:boolean};
export default function AccountSwitcher({entries,add,onError}:{entries:BrowserAccount[];add?:string;onError:(message:string)=>void}){
  return <div className="xc-stack xc-switcher-list" aria-label="Choose an account">
    {entries.map(account=><button key={account.slot} type="button" className="xc-list-row"
      onClick={()=>void api('switcher',{slot:account.slot}).then(()=>window.location.assign('/dashboard')).catch(error=>onError(error.message))}>
      <span className="xc-avatar">{account.hasPicture?<img alt="" src={'/account/switcher/avatar/'+account.slot}/>:<UserRound size={18}/>}</span>
      <span><strong>{account.givenName} {account.surname}</strong><small>@{account.username}</small></span>
      <ChevronRight size={17} aria-hidden="true"/>
    </button>)}
    {add&&<a className="xc-button xc-secondary" href={add}><Plus size={17}/> Add another account</a>}
  </div>;
}
