import {KeyRound} from 'lucide-react';
import {useConfirmDialog} from './dialog-model';

export type ReviewedRegistration = {
  id:string;status:string;callback?:string;callbacks?:string[];callbackApproved?:boolean;local?:boolean;
};

export default function CallbackApproval({app,disabled,save}:{
  app:ReviewedRegistration;disabled:boolean;save:(body:{type:string;id:string;verified:boolean;callbacks:string[]})=>void;
}){
  const confirm=useConfirmDialog();
  if(app.status!=='pending'||app.local||!app.callback)return null;
  const approved=!!app.callbackApproved;
  const callbacks=app.callbacks??[app.callback];
  const title=approved?'Remove callback approval':'Approve callback URLs';
  return <button type="button" className="xc-button xc-secondary xc-icon-action" disabled={disabled} aria-label={title} title={title} onClick={async()=>{
    const message=approved?'The developer will need DNS verification or a new approval to activate this registration.'
      :'Approve only URLs whose ownership you verified independently. '+callbacks.join(' · ');
    if(await confirm(title+'?',title,message,approved))save({type:'callback',id:app.id,verified:!approved,callbacks});
  }}><KeyRound size={19}/><span>{title}</span></button>;
}
