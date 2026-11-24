import {useDialog} from './dialog-model';
import CopyButton from './CopyButton';
import {mailClientSettings} from './mail-client-settings';
import {useEffect,useState} from 'react';import {Image,Pressable,Text,TextInput,View} from 'react-native';import {accountHost,nativeReauthenticate,nativeRequest} from './native-account';
export default function MailClients({token,colors,username}:{username?:string;token:string;colors:{ink:string;muted:string;accent:string;soft:string}}){
  const showDialog=useDialog();
 const [clients,setClients]=useState<{id:string;label:string}[]>([]),[label,setLabel]=useState(''),[secret,setSecret]=useState(''),[editing,setEditing]=useState(false),[status,setStatus]=useState('');
 const [profile,setProfile]=useState<{name:string;username:string;hasPicture:boolean}|null>(null);
 const load=()=>nativeRequest('mail/clients',token).then(r=>{setClients(r.clients);setProfile(r.profile);});useEffect(()=>{void load().catch(e=>setStatus(e.message));},[token]);
 async function act(body:object){try{if(!(await nativeRequest('session/access',token)).confirmed)await nativeReauthenticate(token);const result=await nativeRequest('mail/clients',token,body);if(result.password)setSecret(result.password);setEditing(false);setLabel('');await load();}catch(e){setStatus(e instanceof Error?e.message:'Could not update mail clients.');}}
 const button=(text:string,press:()=>void)=><Pressable accessibilityRole="button" onPress={press} style={{minHeight:44,padding:12,borderRadius:10,backgroundColor:colors.soft}}><Text style={{color:colors.accent}}>{text}</Text></Pressable>;
 return <View style={{gap:12}}><Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Mail clients</Text><Text style={{color:colors.muted}}>Create a separate credential for each mail app.</Text>{button('Add mail client',()=>{setEditing(!editing);setSecret('');})}
 {editing&&<><TextInput accessibilityLabel="Client name" value={label} maxLength={64} onChangeText={setLabel} style={{color:colors.ink,minHeight:48}}/>{button('Create client credential',()=>void act({action:'create',label}))}</>}
 {secret&&<View style={{gap:6,padding:12,borderRadius:12,backgroundColor:colors.soft}}>
   <Text style={{color:colors.ink}}>Save this password now. It is shown once.</Text><View style={{flexDirection:'row',alignItems:'center'}}>
   <Text selectable style={{flex:1,color:colors.ink}}>{secret}</Text><CopyButton value={secret} label="Copy mail password" color={colors.accent}/></View>
   {button('Hide credential',()=>setSecret(''))}</View>}
 {clients.map(client=><View key={client.id} style={{gap:6}}><Text style={{color:colors.ink}}>{client.label}</Text>{button('Revoke client',()=>showDialog('Revoke '+client.label+'?','This mail app will lose access.',[{text:'Cancel',style:'cancel'},{text:'Revoke',style:'destructive',onPress:()=>void act({action:'revoke',id:client.id})}]))}</View>)}
 <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Mail app connection settings</Text>
 {profile&&<View style={{flexDirection:'row',alignItems:'center',gap:10}}>{profile.hasPicture&&<Image accessible={false}
   source={{uri:accountHost+'/account/avatar',headers:{'X-AuthNJS-Native':'account-manager',Authorization:'Bearer '+token}}}
   style={{width:36,height:36,borderRadius:18}}/>}<Text style={{color:colors.ink,fontWeight:'700'}}>{profile.name}</Text></View>}
 {mailClientSettings(profile?.username??username).map(([label,value])=><View key={label} style={{padding:10,borderRadius:8,backgroundColor:colors.soft}}>
   <Text style={{color:colors.muted}}>{label}</Text><Text selectable style={{color:colors.ink}}>{value}</Text>
 </View>)}{status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}</View>;
}
