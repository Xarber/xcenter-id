import ApplicationStorage from './ApplicationStorage';
import {useEffect,useState} from 'react';
import {Alert,Image,Pressable,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {accountHost,nativeRequest} from './native-account';
import type {ManagedAccount} from './support-model';

type Colors={ink:string;muted:string;accent:string;soft:string};
type User=ManagedAccount&{admin:boolean;rootAdmin:boolean;verified:boolean;externalMailLimits?:{daily:number|null;monthly:number|null};name:string;devices:number;passkeys:number;apps:{client:string;label:string}[]};
type App={verified:boolean;id:string;name:string;status:string;restricted:boolean};
function Avatar({user,token,colors}:{user:ManagedAccount;token:string;colors:Colors}){
  const [failed,setFailed]=useState(false);
  return user.hasPicture&&!failed?<Image accessibilityLabel="Profile photo" onError={()=>setFailed(true)} source={{
    uri:accountHost+'/account/admin/accounts/'+user.username+'/avatar',
    headers:{Authorization:'Bearer '+token,'X-AuthNJS-Native':'account-manager'},
  }} style={{width:44,height:44,borderRadius:22}}/>:<Ionicons name="person-circle-outline" size={44} color={colors.muted}/>;
}
export default function NativeAdminUsers({token,colors}:{token:string;colors:Colors}){
  const [users,setUsers]=useState<ManagedAccount[]>([]);
  const [capacity,setCapacity]=useState<string|null>(null);
  const [unit,setUnit]=useState(2);
  const [storageApp,setStorageApp]=useState('');
  const [mailLimits,setMailLimits]=useState<{daily:string;monthly:string}|null>(null);
  const [filter,setFilter]=useState('');
  const [selected,setSelected]=useState('');
  const [details,setDetails]=useState<{account:User;registered:App[]}|null>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [deleting,setDeleting]=useState(false);
  const [typed,setTyped]=useState('');
  const [warning,setWarning]=useState<string|null>(null);
  const api=(path:string,data?:object)=>nativeRequest(path,token,data);
  async function load(){
    if(selected)setDetails(await api('admin/users/'+selected));
    else setUsers((await api('admin/accounts')).accounts);
  }
  useEffect(()=>{void load().catch(error=>setStatus(error.message));},[selected,token]);
  function run(work:()=>Promise<void>,refresh=true){
    setBusy(true);setStatus('');
    void work().then(()=>refresh?load():undefined).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
  }
  function icon(label:string,name:React.ComponentProps<typeof Ionicons>['name'],press:()=>void,disabled=busy){
    return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={press}
      style={({pressed})=>({minWidth:90,minHeight:62,padding:8,alignItems:'center',justifyContent:'center',borderRadius:10,
        backgroundColor:colors.soft,opacity:pressed||disabled?0.6:1})}><Ionicons name={name} size={22} color={colors.accent}/><Text style={{color:colors.accent,fontSize:12,textAlign:'center'}}>{label}</Text></Pressable>;
  }
  if(storageApp)return <ApplicationStorage id={storageApp} token={token} colors={colors} admin back={()=>setStorageApp('')}/>;
  const user=details?.account;
  return <View style={{gap:14}}>
    {selected?<>{icon('All accounts','arrow-back',()=>{setSelected('');setDetails(null);setDeleting(false);setWarning(null);})}
      {user&&<>
        <Avatar user={user} token={token} colors={colors}/><Text accessibilityRole="header" style={{color:colors.ink,fontSize:22,fontWeight:'700'}}>{user.name} · @{user.username}</Text>
        <Text style={{color:colors.muted}}>{user.locked?'Locked':'Active'} · {user.passkeys} passkeys · {user.devices} sessions</Text>
        <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>
          {icon(user.verified?'Remove user verification':'Verify user','checkmark-circle-outline',()=>run(async()=>{await api('admin/users/'+user.username,{action:'verify-user',enabled:!user.verified});}))}
          {!user.rootAdmin&&icon(user.admin?'Remove admin access':'Grant admin access','shield-checkmark-outline',()=>Alert.alert('Change administrator access?','Administrators can manage accounts, apps and support.',[{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>run(async()=>{await api('admin/users/'+user.username,{action:'set-admin',enabled:!user.admin});})}]))}
          {icon('Change storage','server-outline',()=>{setCapacity(String(user.capacity/1024**2));setUnit(2);})}
          {icon('External email limits','mail-open-outline',()=>setMailLimits({daily:user.externalMailLimits?.daily==null?'':String(user.externalMailLimits.daily),monthly:user.externalMailLimits?.monthly==null?'':String(user.externalMailLimits.monthly)}))}
          {icon(user.premium?'Disable premium aliases':'Enable premium aliases','eye-off-outline',()=>run(async()=>{await api('admin/premium',{username:user.username,enabled:!user.premium});}))}
          {!user.protected&&<>{icon(user.locked?'Unlock account':'Lock account',user.locked?'lock-open-outline':'lock-closed-outline',()=>run(async()=>{
            await api('admin/account-status',{username:user.username,action:user.locked?'unlock':'lock'});
          }))}
          {icon('Sign out all devices','log-out-outline',()=>Alert.alert('Sign out all devices?','The user can sign in again.',[
            {text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>run(async()=>{await api('admin/account-status',{username:user.username,action:'revoke-sessions'});})},
          ]))}
          {icon('Delete account','trash-outline',()=>{setDeleting(true);setTyped('');})}</>}
          {icon('Send warning','mail-outline',()=>setWarning(''))}
        </View>
        {capacity!==null&&<View style={{gap:10}}><TextInput accessibilityLabel="Storage capacity" keyboardType="decimal-pad" value={capacity} onChangeText={setCapacity} style={{color:colors.ink,minHeight:48}}/>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{['B','KB','MB','GB','TB'].map((label,i)=>icon((unit===i?'Selected ':'')+label,'server-outline',()=>setUnit(i)))}</View>
          {icon('Save capacity','checkmark',()=>run(async()=>{await api('admin/storage',{username:user.username,capacity:Number(capacity)*1024**unit});setCapacity(null);} ))}{icon('Cancel capacity','close',()=>setCapacity(null))}</View>}
        {mailLimits&&<View style={{gap:10}}><Text style={{color:colors.muted}}>Blank means no individual limit. The shared free-plan limit remains.</Text>
          <TextInput accessibilityLabel="External emails per day" keyboardType="number-pad" value={mailLimits.daily} onChangeText={daily=>setMailLimits({...mailLimits,daily})} style={{color:colors.ink,minHeight:48}}/>
          <TextInput accessibilityLabel="External emails per month" keyboardType="number-pad" value={mailLimits.monthly} onChangeText={monthly=>setMailLimits({...mailLimits,monthly})} style={{color:colors.ink,minHeight:48}}/>
          {icon('Save mail limits','checkmark',()=>run(async()=>{await api('admin/users/'+user.username,{action:'external-mail-limits',daily:mailLimits.daily.trim()?Number(mailLimits.daily):null,monthly:mailLimits.monthly.trim()?Number(mailLimits.monthly):null});setMailLimits(null);} ))}{icon('Cancel mail limits','close',()=>setMailLimits(null))}</View>}
        {deleting&&<><Text style={{color:colors.ink}}>Type @{user.username} without @ to delete this identity and credentials.</Text>
          <TextInput accessibilityLabel="Confirm username" autoCapitalize="none" value={typed} onChangeText={setTyped} style={{minHeight:48,color:colors.ink}}/>
          <View style={{flexDirection:'row',gap:10}}>
            {icon('Confirm deletion','checkmark',()=>run(async()=>{
              await api('admin/account-status',{username:user.username,action:'delete',confirmation:typed});
              setSelected('');setDetails(null);setDeleting(false);
            },false),busy||typed!==user.username)}
            {icon('Cancel deletion','close',()=>setDeleting(false))}
          </View></>}
        {warning!==null&&<><TextInput accessibilityLabel="Warning" value={warning} onChangeText={setWarning} multiline maxLength={3000}
          style={{minHeight:60,color:colors.ink}}/>
          <View style={{flexDirection:'row',gap:10}}>
            {icon('Send warning','send-outline',()=>run(async()=>{await api('admin/users/'+user.username,{action:'warn',text:warning});setWarning(null);}),busy||!warning.trim())}
            {icon('Cancel warning','close',()=>setWarning(null))}
          </View></>}
        <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Connected apps</Text>
        {user.apps.map(app=><Text key={app.client} style={{color:colors.ink}}>{app.label}</Text>)}
        <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Registered apps</Text>
        {details.registered.map(app=><View key={app.id} style={{gap:8}}>
          <Text style={{color:colors.ink}}>{app.name} · {app.status}{app.restricted?' · Restricted':''}</Text>
          <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{icon(app.verified?'Remove app verification':'Verify app','checkmark-circle-outline',()=>run(async()=>{await api('admin/apps',{type:'app',id:app.id,verified:!app.verified});}))}{icon('App storage','server-outline',()=>setStorageApp(app.id))}</View>
          {app.status==='active'&&<View style={{flexDirection:'row',gap:10}}>
            {icon(app.restricted?'Restore app':'Restrict app',app.restricted?'lock-open-outline':'lock-closed-outline',()=>run(async()=>{
              await api('admin/users/'+user.username,{action:app.restricted?'restore':'restrict',app:app.id});
            }))}
            {icon('Delete app','trash-outline',()=>Alert.alert('Delete this app?','Future sign-in through this registration will stop.',[
              {text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>run(async()=>{
                await api('admin/users/'+user.username,{action:'delete',app:app.id,confirmation:app.id});
              })},
            ]))}
          </View>}
        </View>)}
      </>}
    </>:<><TextInput accessibilityLabel="Find an account" autoCapitalize="none" value={filter} onChangeText={setFilter}
      placeholder="Find an account" placeholderTextColor={colors.muted} style={{color:colors.ink,minHeight:48}}/>
      {users.filter(user=>user.username.includes(filter.trim().toLowerCase())).slice(0,40).map(user=>
        <Pressable accessibilityRole="button" key={user.username} onPress={()=>{setSelected(user.username);setDetails(null);}}
          style={{minHeight:60,flexDirection:'row',alignItems:'center',gap:12}}>
          <Avatar user={user} token={token} colors={colors}/><Text style={{color:colors.ink}}>@{user.username}</Text>
          {user.locked&&<Ionicons name="lock-closed-outline" size={20} color={colors.muted}/>}
        </Pressable>)}</>}
    {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
