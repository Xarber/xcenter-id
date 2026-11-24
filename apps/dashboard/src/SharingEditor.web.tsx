import {Database, Plus, ShieldCheck, Trash2} from 'lucide-react';
import {blankRequest,sharingIcons,type SharingEditorProps,type SharingRequest} from './sharing-config';

export default function SharingEditor({value,onChange,sources,canPublish}: SharingEditorProps){
  const {shared,requests}=value;
  const setRequest=(index:number,update:Partial<SharingRequest>)=>onChange({...value,
    requests:requests.map((item,i)=>i===index?{...item,...update}:item),
  });
  return <div className="xc-stack">
    {canPublish&&<fieldset className="xc-callbacks">
      <legend><Database size={17} aria-hidden="true"/> Published collections</legend>
      <p>Choose which collection names other apps can request. Each user still approves access.</p>
      {shared.map((collection,index)=><div className="xc-callback-row" key={index}>
        <label>Collection {index+1}<input value={collection} maxLength={80} onChange={event=>onChange({...value,
          shared:shared.map((name,i)=>i===index?event.target.value:name),
        })}/></label>
        <button type="button" className="xc-button xc-secondary" aria-label={'Remove collection '+(index+1)}
          onClick={()=>onChange({...value,shared:shared.filter((_,i)=>i!==index)})}><Trash2 size={17}/></button>
      </div>)}
      <button type="button" className="xc-button xc-secondary xc-self-start" disabled={shared.length>=30}
        onClick={()=>onChange({...value,shared:[...shared,'']})}><Plus size={17}/> Add collection</button>
    </fieldset>}
    <fieldset className="xc-callbacks">
      <legend><ShieldCheck size={17} aria-hidden="true"/> Permissions requested from other apps</legend>
      <p>Select a collection published by another app. Give the permission a title that users can understand on the authorization screen.</p>
      {requests.map((request,index)=>{
        const collections=sources.find(source=>source.client===request.source)?.collections??[];
        return <section key={index} className="xc-permission-editor-item">
          <div className="xc-row-head"><h3>{request.label||'New permission'}</h3>
            <button type="button" className="xc-button xc-secondary" aria-label={'Remove permission '+(index+1)}
              onClick={()=>onChange({...value,requests:requests.filter((_,i)=>i!==index)})}><Trash2 size={17}/></button>
          </div>
          <div className="xc-permission-editor-grid">
            <label>Source app<select value={request.source} onChange={event=>setRequest(index,{source:event.target.value,collection:''})}>
              <option value="">Select an app</option>
              {!!request.source&&!sources.some(source=>source.client===request.source)&&<option value={request.source}>{request.source} · unavailable</option>}
              {sources.map(source=><option value={source.client} key={source.client}>{source.name}</option>)}
            </select></label>
            <label>Collection<select value={request.collection} disabled={!request.source} onChange={event=>setRequest(index,{collection:event.target.value})}>
              <option value="">Select a collection</option>
              {!!request.collection&&!collections.includes(request.collection)&&<option value={request.collection}>{request.collection} · unavailable</option>}
              {collections.map(name=><option key={name}>{name}</option>)}
            </select></label>
            <label>Permission name <small>Optional identifier</small><input value={request.name??''} maxLength={80}
              placeholder="read_trip_history" onChange={event=>setRequest(index,{name:event.target.value})}/></label>
            <label>Title<input value={request.label} maxLength={160} placeholder="Read trip history"
              onChange={event=>setRequest(index,{label:event.target.value})}/></label>
            <label>Description <small>Optional</small><textarea rows={2} value={request.description??''} maxLength={300}
              onChange={event=>setRequest(index,{description:event.target.value})}/></label>
            <label>Icon<select value={request.icon??''} onChange={event=>setRequest(index,{icon:(event.target.value||undefined) as SharingRequest['icon']})}>
              <option value="">Default</option>{sharingIcons.map(([icon,name])=><option key={icon} value={icon}>{name}</option>)}
            </select></label>
          </div>
        </section>;
      })}
      <button type="button" className="xc-button xc-secondary xc-self-start" disabled={requests.length>=30||!sources.length}
        onClick={()=>onChange({...value,requests:[...requests,blankRequest()]})}><Plus size={17}/> Add permission</button>
      {!sources.length&&<p>No verified apps currently publish collections this app can request.</p>}
    </fieldset>
  </div>;
}
