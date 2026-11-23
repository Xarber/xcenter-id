import AppIcon from './AppIcon';
import CopyButton from './CopyButton';
import {useEffect,useState} from 'react';import {Alert,Pressable,Switch,Text,TextInput,View} from 'react-native';
import {nativeRequest,nativeReauthenticate} from './native-account';import {formatBytes} from './storage-summary';
type Colors={ink:string;muted:string;accent:string;soft:string};
export default function ApplicationStorage({id,token,colors,admin=false,back}:{id:string;token:string;colors:Colors;admin?:boolean;back:()=>void}){
 const [data,setData]=useState<{name?:string;icon?:string|null;used:number;capacity:number;records:number;hasKey:boolean;showInFiles:boolean;canShowInFiles:boolean;shared:string[];requests:unknown[]}|null>(null);
 const [editing,setEditing]=useState(false),[status,setStatus]=useState(''),[secret,setSecret]=useState('');
 const [capacity,setCapacity]=useState('10'),[unit,setUnit]=useState(2),[shared,setShared]=useState(''),[requests,setRequests]=useState('[]');
 async function load(){const value=await nativeRequest('app-storage/'+id,token);setData(value);setCapacity(String(value.capacity/1024**2));setShared(value.shared.join('\n'));setRequests(JSON.stringify(value.requests));}
 useEffect(()=>{void load().catch(e=>setStatus(e.message));},[id,token]);
 async function change(body:object){try{if(!(await nativeRequest('session/access',token)).confirmed)await nativeReauthenticate(token);const result=await nativeRequest('app-storage/'+id,token,body);if(result.secret)setSecret(result.secret);await load();setStatus('Saved.');}catch(e){setStatus(e instanceof Error?e.message:'Could not save.');}}
 const action=(label:string,onPress:()=>void)=><Pressable accessibilityRole="button" onPress={onPress} style={{minHeight:44,padding:12,borderRadius:10,backgroundColor:colors.soft}}><Text style={{color:colors.accent}}>{label}</Text></Pressable>;
 const field=(label:string,value:string,set:(value:string)=>void)=><View><Text style={{color:colors.ink}}>{label}</Text><TextInput accessibilityLabel={label} multiline value={value} onChangeText={set} style={{minHeight:48,color:colors.ink,borderWidth:1,borderColor:colors.muted,padding:10,borderRadius:10}}/></View>;
 return <View style={{gap:12}}>{action('Back to app',back)}<View style={{flexDirection:'row',alignItems:'center',gap:10}}>
  <AppIcon icon={data?.icon} color={colors.accent}/><Text accessibilityRole="header" style={{color:colors.ink,fontSize:22,fontWeight:'700',flex:1}}>{data?.name??'Application database'}</Text>
 </View>
 {data&&<><Text style={{color:colors.muted}}>{formatBytes(data.used)} of {formatBytes(data.capacity)} · {data.records} records</Text>{action(editing?'Close settings':'Edit database settings',()=>setEditing(!editing))}
 {editing&&<>{field('Shared collections (one per line)',shared,setShared)}{field('Requested permissions (JSON)',requests,setRequests)}
 {action('Save sharing',()=>{try{void change({action:'sharing',shared:shared.split(/\s+/).filter(Boolean),requests:JSON.parse(requests)});}catch{setStatus('Check the JSON.');}})}
 {data.canShowInFiles&&<View style={{gap:6}}>
  <Text style={{color:colors.ink}}>Show this app’s data in the Files browser</Text>
  <Text style={{color:colors.muted}}>Users see the icon and storage used. You can manage records stored in your own account.</Text>
  <Switch accessibilityLabel="Show this app’s data in the Files browser" value={data.showInFiles} onValueChange={enabled=>void change({action:'file-visibility',enabled})}/>
 </View>}
 {admin&&<>{field('App capacity',capacity,setCapacity)}<View style={{flexDirection:'row',gap:6}}>{['B','KB','MB','GB','TB'].map((name,i)=>action((unit===i?'✓ ':'')+name,()=>setUnit(i)))}</View>{action('Save capacity',()=>void change({action:'capacity',capacity:Number(capacity)*1024**unit}))}</>}
 <Text style={{color:colors.muted}}>Backend credentials must stay on a server. Native apps use their user's OAuth token.</Text>
 {action(data.hasKey?'Replace backend key':'Create backend key',()=>Alert.alert('Create a backend key?','The previous key will stop working.',[{text:'Cancel',style:'cancel'},{text:'Create',onPress:()=>void change({action:'rotate-key'})}]))}
 {data.hasKey&&action('Revoke key',()=>void change({action:'revoke-key'}))}{secret&&<><View style={{flexDirection:'row',alignItems:'center'}}><Text selectable style={{flex:1,color:colors.ink}}>{secret}</Text><CopyButton value={secret} label="Copy database key" color={colors.accent}/></View>{action('Hide key',()=>setSecret(''))}</>}</>}</>}
 {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}</View>;
}
