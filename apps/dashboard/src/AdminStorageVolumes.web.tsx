import {useEffect,useState} from 'react';
import {HardDrive,RefreshCw} from 'lucide-react';
import {api} from './web-account';
import {formatBytes} from './storage-summary';

type Volume = {id:string;label:string;status:'available'|'unavailable'|'read-only'|'full';total?:number;free?:number;freeFiles?:number};
const descriptions = {available:'Available','read-only':'Read-only',unavailable:'Temporarily unavailable',full:'Full'};

export default function AdminStorageVolumes(){
  const [volumes,setVolumes]=useState<Volume[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function refresh(){
    setBusy(true);setError('');
    try{setVolumes((await api('admin/storage-volumes')).volumes);}
    catch(failure){setError(failure instanceof Error?failure.message:'Storage status unavailable.');}
    finally{setBusy(false);}
  }
  useEffect(()=>{void refresh();},[]);
  return <section id="storage-volumes" className="xc-card xc-pad xc-stack">
    <div className="xc-row-head"><HardDrive size={21}/><h2>Server storage</h2></div>
    <p>View the capacity and health of storage connected to X-Center ID.</p>
    {volumes.map(volume=><div className="xc-list-row" key={volume.id}>
      <div><strong>{volume.label}</strong><p>{descriptions[volume.status]}</p></div>
      {volume.free!==undefined&&volume.total!==undefined&&<div>
        <strong>{formatBytes(volume.free)} free</strong><p>{formatBytes(volume.total)} total{volume.freeFiles===0?' · No free file entries':''}</p>
      </div>}
    </div>)}
    {error&&<p role="alert">{error}</p>}
    <button className="xc-button xc-secondary xc-self-start" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={17}/> {busy?'Checking…':'Refresh storage status'}</button>
  </section>;
}
