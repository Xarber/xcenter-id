import {useEffect,useState} from 'react';
import {Pressable,Switch,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {canRestore,type Backups} from './app-backups';
import {nativeReauthenticate,nativeRequest} from './native-account';
import {formatBytes} from './storage-summary';
import {useDialog} from './dialog-model';

export default function AppBackups({client,back,token,colors}:{client:string;back:()=>void;token:string;colors:{ink:string;muted:string;accent:string;line:string}}){
  const [data,setData]=useState<Backups|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  const dialog=useDialog();
  const path='app-backups/'+encodeURIComponent(client);
  const api=(route:string,body?:object,method?:string)=>nativeRequest(route,token,body,method);
  const load=async()=>{setData(await api(path));};
  useEffect(()=>{void load().catch(error=>setStatus(error.message));},[client,token]);
  async function run(work:()=>Promise<unknown>,success:string){
    if(busy)return;
    setBusy(true);
    setStatus('');
    try{const result=await work();if(result===false)return;await load();setStatus(success);}
    catch(error){setStatus(error instanceof Error?error.message:'Backup unavailable.');}
    finally{setBusy(false);}
  }
  function button(label:string,action:()=>void,icon?:'archive-outline'|'trash-outline'){
    return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={action}
      style={{minHeight:44,minWidth:44,justifyContent:'center',alignItems:icon?'center':'flex-start',opacity:busy?0.5:1}}>
      {icon?<Ionicons name={icon} size={19} color={colors.accent}/>:<Text style={{color:colors.accent,fontWeight:'700'}}>{label}</Text>}
    </Pressable>;
  }
  return <View style={{gap:12}}>
    {button('Back to apps',back)}
    <Text accessibilityRole="header" style={{color:colors.ink,fontSize:20,fontWeight:'700'}}>App backups</Text>
    {!data&&!status&&<Text style={{color:colors.muted}}>Loading backups…</Text>}
    {data&&!data.policy&&<Text style={{color:colors.muted}}>This app has not enabled backups.</Text>}
    {data?.policy&&<>
      {button('Create backup',()=>void run(()=>api(path,{}),'Backup created.'))}
      <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
        <Text style={{color:colors.ink,flex:1}}>Allow this app to request backups</Text>
        <Switch accessibilityLabel="Allow this app to request backups" value={data.allowApp} disabled={busy}
          onValueChange={enabled=>void run(()=>api(path+'/permission',{enabled},'PUT'),'Backup permission saved.')}/>
      </View>
    </>}
    {data?.snapshots.map(item=>{
      const when=new Date(item.created).toLocaleString();
      return <View key={item.id} style={{flexDirection:'row',alignItems:'center',gap:8,borderColor:colors.line,borderBottomWidth:1}}>
        <View style={{flex:1,paddingVertical:8}}><Text style={{color:colors.ink,fontWeight:'700'}}>{when}</Text>
          {item.requested&&<Text style={{color:colors.muted}}>Restore requested by app</Text>}
          <Text style={{color:colors.muted}}>{(item.selection.records!==null||item.selection.files!=='all')&&'Partial · '}{item.records} records · {item.files} files · {formatBytes(item.bytes)} · Version {item.version}</Text></View>
        {item.requested&&button('Dismiss request',()=>void run(()=>api(path+'/'+item.id+'/dismiss',{}),'Restore request dismissed.'))}
        {canRestore(data.policy,item)&&button('Restore backup from '+when,()=>dialog('Restore this backup?',
          'This restores the included records and files. Data outside the backup scope stays in place.',[
            {text:'Cancel',style:'cancel'},{text:'Restore',style:'destructive',onPress:()=>void run(async()=>{
              if(!(await api('session/access')).confirmed&&!await nativeReauthenticate(token))return false;
              return api(path+'/'+item.id+'/restore',{});
            },'Backup restored.')},
          ]),'archive-outline')}
        {button('Delete backup from '+when,()=>dialog('Permanently delete this backup?',undefined,[
          {text:'Cancel',style:'cancel'},{text:'Delete backup',style:'destructive',onPress:()=>void run(()=>api(path+'/'+item.id,{},'DELETE'),'Backup deleted.')},
        ]),'trash-outline')}
      </View>;
    })}
    {data&&!data.snapshots.length&&<Text style={{color:colors.muted}}>No backups yet.</Text>}
    {status&&<Text accessibilityLiveRegion="polite" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
