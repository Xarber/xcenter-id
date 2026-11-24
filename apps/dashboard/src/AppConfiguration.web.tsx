import {ArrowLeft,Braces,Save} from 'lucide-react';
import {useAppConfiguration} from './app-configuration-editor';
import CopyButton from './CopyButton.web';
import {developerApi} from './developer-web';
import {useConfirmDialog} from './dialog-model';
import {confirmIdentity} from './Reauthenticate.web';
import {api} from './web-account';

export default function AppConfiguration({id,back}:{id:string;back:()=>void}){
  const confirm=useConfirmDialog();
  const editor=useAppConfiguration(async body=>{
    if(body&&!(await api('session/access')).confirmed)await confirmIdentity();
    return developerApi('apps/'+id+'/configuration',body,body?'PUT':'GET');
  }, warn=>confirm('Apply this configuration?','Apply configuration',warn
    ? 'Review the sharing and trust changes. They can affect which apps have access. Changing profile details requires app verification again.'
    : 'Review the profile and callback changes. Changing profile details requires app verification again.',false));
  return <section className="xc-card xc-pad xc-stack">
    <button type="button" className="xc-button xc-secondary xc-self-start" onClick={back} disabled={editor.busy}><ArrowLeft size={17}/> Back to app</button>
    <div className="xc-row-head"><Braces size={22} aria-hidden="true"/><h2>App configuration</h2></div>
    <p>Copy or paste a complete JSON configuration for this registration. It contains no credentials.</p>
    {editor.ready&&<>
      <label htmlFor="app-configuration">Configuration JSON</label>
      <textarea id="app-configuration" rows={20} wrap="off" className="xc-config-code" value={editor.text}
        onChange={event=>editor.setText(event.currentTarget.value)} disabled={editor.busy} spellCheck={false} autoCapitalize="off" maxLength={150000}/>
      <div className="xc-actions">
        <button className="xc-button xc-primary" disabled={editor.busy} onClick={()=>void editor.save()}><Save size={16}/> Apply configuration</button>
        <button className="xc-button xc-secondary" disabled={editor.busy} onClick={editor.format}>Format JSON</button>
        <CopyButton value={editor.text} label="Copy app configuration"/>
      </div>
    </>}
    {editor.status&&<p role="status">{editor.status}</p>}
  </section>;
}
