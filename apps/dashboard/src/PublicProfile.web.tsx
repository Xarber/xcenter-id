import {useEffect,useState} from 'react';import {api} from './web-account';
export default function PublicProfile(){
 const [fields,setFields]=useState<string[]>([]),[status,setStatus]=useState('');
 useEffect(()=>{void api('profile/visibility').then(result=>setFields(result.fields)).catch(e=>setStatus(e.message));},[]);
 return <details className="xc-card xc-pad"><summary>Public profile</summary><p>Choose what anyone can read without signing in. Email addresses and birthday always remain private.</p>
 {['username','givenName','surname','picture'].map(field=><label key={field}><input type="checkbox" checked={fields.includes(field)} onChange={e=>setFields(old=>field==='username'?(e.target.checked?['username']:[]):e.target.checked?[...new Set(['username',...old,field])]:old.filter(x=>x!==field))}/>{field==='givenName'?'Given name':field==='surname'?'Surname':field==='picture'?'Profile picture':'Enable public profile (username)'}</label>)}
 <button className="xc-button xc-primary" onClick={()=>void api('profile/visibility',{fields:fields.length?[...new Set(['username',...fields])]:[]}).then(()=>setStatus('Public profile updated.')).catch(e=>setStatus(e.message))}>Save visibility</button>{status&&<p role="status">{status}</p>}</details>;
}
