import AppIcon from './AppIcon';
import type {AppFileContainer as Container} from './account-file-containers';
import {Surface,SurfaceTitle,type DashboardTheme} from './native-surfaces';
import {formatBytes} from './storage-summary';
import TrustBadges from './TrustBadges';
import ApplicationStorage from './ApplicationStorage';
import {useEffect,useState} from 'react';
import {Alert,Image,Pressable,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {accountHost,nativeRequest} from './native-account';
import type {ManagedAccount} from './support-model';

type Colors=DashboardTheme;
type User=ManagedAccount&{developerVerified?:boolean;admin:boolean;rootAdmin:boolean;verified:boolean;externalMailLimits?:{daily:number|null;monthly:number|null};name:string;devices:number;passkeys:number;apps:{client:string;label:string;icon?:string|null;verified?:boolean}[]};
type App={icon?:string|null;verified:boolean;id:string;name:string;status:string;restricted:boolean};
function Avatar({user,token,colors}:{user:ManagedAccount;token:string;colors:Colors}){
  const [failed,setFailed]=useState(false);
  return user.hasPicture&&!failed?<Image accessibilityLabel="Profile photo" onError={()=>setFailed(true)} source={{
    uri:accountHost+'/account/admin/accounts/'+user.username+'/avatar',
    headers:{Authorization:'Bearer '+token,'X-AuthNJS-Native':'account-manager'},
  }} style={{width:44,height:44,borderRadius:22}}/>:<View style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:colors.soft}}><Ionicons accessible={false} name="person-outline" size={23} color={colors.accent}/></View>;
}
export default function NativeAdminUsers({token,colors,onDetail}:{token:string;colors:Colors;onDetail:(open:boolean)=>void}){
  const [users,setUsers]=useState<ManagedAccount[]>([]);
  const [capacity,setCapacity]=useState<string|null>(null);
  const [unit,setUnit]=useState(2);
  const [storageApp,setStorageApp]=useState('');
  const [mailLimits,setMailLimits]=useState<{daily:string;monthly:string}|null>(null);
  const [filter,setFilter]=useState('');
  const [visibleLimit,setVisibleLimit]=useState(40);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState('');
  const [details,setDetails]=useState<{account:User;registered:App[];containers?:Container[]}|null>(null);
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
  useEffect(()=>{
    let active=true;
    setLoading(true);
    setStatus('');
    const request=selected?api('admin/users/'+selected):api('admin/accounts');
    void request.then(result=>{
      if(!active)return;
      if(selected)setDetails(result);
      else setUsers(result.accounts);
    }).catch(error=>{if(active)setStatus(error.message);})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[selected,token]);
  function run(work:()=>Promise<void>,refresh=true){
    setBusy(true);setStatus('');
    void work().then(()=>refresh?load():undefined).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
  }
  function icon(label:string,name:React.ComponentProps<typeof Ionicons>['name'],press:()=>void,disabled=busy){
    return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={press}
      style={({pressed})=>({minHeight:44,paddingHorizontal:10,paddingVertical:8,flexDirection:'row',gap:6,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center',borderRadius:10,
        backgroundColor:pressed?colors.soft:colors.panel,opacity:disabled?0.6:1})}><Ionicons accessible={false} name={name} size={17} color={label.startsWith('Delete')?colors.danger:colors.accent}/><Text style={{color:label.startsWith('Delete')?colors.danger:colors.ink,fontSize:13,fontWeight:'600',flexShrink:1}}>{label}</Text></Pressable>;
  }
  if(storageApp)return <ApplicationStorage id={storageApp} token={token} colors={colors} admin back={()=>setStorageApp('')}/>;
  const user=details?.account;
  const input={color:colors.ink,borderColor:colors.line,borderWidth:1,borderRadius:10,paddingHorizontal:12,minHeight:48};
  const divider={borderTopWidth:1,borderColor:colors.line,paddingTop:12};
  const registered=details?.registered.filter(app=>app.status!=='revoked')??[];
  const visible=users.filter(user=>user.username.includes(filter.trim().toLowerCase()));
  return <Surface colors={colors}>
    {selected?<>{icon('All accounts','arrow-back',()=>{setSelected('');onDetail(false);setDetails(null);setDeleting(false);setWarning(null);setCapacity(null);setMailLimits(null);})}
      {loading&&<Text accessibilityRole="progressbar" style={{color:colors.muted}}>Loading account…</Text>}
      {user&&<>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
          <Avatar user={user} token={token} colors={colors}/>
          <View style={{flex:1,gap:4}}>
            <Text accessibilityRole="header" style={{color:colors.ink,fontSize:22,fontWeight:'700'}}>{user.name}</Text>
            <Text style={{color:user.locked?colors.danger:colors.muted}}>@{user.username} · {user.locked?'Locked':'Active'}</Text>
            <TrustBadges verified={user.verified} admin={user.admin} color={colors.ink}/>
          </View>
        </View>
        <Text style={{color:colors.muted}}>{user.passkeys} passkeys · {user.devices} sessions · {formatBytes(user.capacity)} capacity</Text>
        <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>
          {icon(user.verified?'Remove user verification':'Verify user','checkmark-circle-outline',()=>run(async()=>{await api('admin/users/'+user.username,{action:'verify-user',enabled:!user.verified});}))}
          {user.developerVerified!==undefined&&icon(user.developerVerified?'Remove developer verification':'Verify developer','ribbon-outline',()=>run(async()=>{
            await api('admin/users/'+user.username,{action:'verify-developer',enabled:!user.developerVerified});
          }))}
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
        {capacity!==null&&<View style={{gap:10}}><TextInput accessibilityLabel="Storage capacity" keyboardType="decimal-pad" value={capacity} onChangeText={setCapacity} style={input}/>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{['B','KB','MB','GB','TB'].map((label,i)=> <View key={label}>{icon((unit===i?'Selected ':'')+label,'server-outline',()=>setUnit(i))}</View>)}</View>
          {icon('Save capacity','checkmark',()=>run(async()=>{await api('admin/storage',{username:user.username,capacity:Number(capacity)*1024**unit});setCapacity(null);} ))}{icon('Cancel capacity','close',()=>setCapacity(null))}</View>}
        {mailLimits&&<View style={{gap:10}}><Text style={{color:colors.muted}}>Blank means no individual limit. The shared free-plan limit remains.</Text>
          <TextInput accessibilityLabel="External emails per day" keyboardType="number-pad" value={mailLimits.daily} onChangeText={daily=>setMailLimits({...mailLimits,daily})} style={input}/>
          <TextInput accessibilityLabel="External emails per month" keyboardType="number-pad" value={mailLimits.monthly} onChangeText={monthly=>setMailLimits({...mailLimits,monthly})} style={input}/>
          {icon('Save mail limits','checkmark',()=>run(async()=>{await api('admin/users/'+user.username,{action:'external-mail-limits',daily:mailLimits.daily.trim()?Number(mailLimits.daily):null,monthly:mailLimits.monthly.trim()?Number(mailLimits.monthly):null});setMailLimits(null);} ))}{icon('Cancel mail limits','close',()=>setMailLimits(null))}</View>}
        {deleting&&<><Text style={{color:colors.ink}}>Type @{user.username} without @ to delete this identity and credentials.</Text>
          <TextInput accessibilityLabel="Confirm username" autoCapitalize="none" value={typed} onChangeText={setTyped} style={input}/>
          <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>
            {icon('Confirm deletion','checkmark',()=>run(async()=>{
              await api('admin/account-status',{username:user.username,action:'delete',confirmation:typed});
              setSelected('');onDetail(false);setDetails(null);setDeleting(false);
            },false),busy||typed!==user.username)}
            {icon('Cancel deletion','close',()=>setDeleting(false))}
          </View></>}
        {warning!==null&&<><TextInput accessibilityLabel="Warning" value={warning} onChangeText={setWarning} multiline maxLength={3000}
          style={[input,{minHeight:72,paddingTop:10,textAlignVertical:'top'}]}/>
          <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>
            {icon('Send warning','send-outline',()=>run(async()=>{await api('admin/users/'+user.username,{action:'warn',text:warning});setWarning(null);}),busy||!warning.trim())}
            {icon('Cancel warning','close',()=>setWarning(null))}
          </View></>}
        {!!details?.containers?.length&&<><View style={divider}><SurfaceTitle colors={colors} title="App storage in this account" icon="server-outline"/></View>
          {details.containers.map(app=><View key={app.client} style={[divider,{flexDirection:'row',alignItems:'center',gap:12}]}>
            <AppIcon icon={app.icon} color={colors.accent}/><Text style={{color:colors.ink,flex:1}}>{app.name}</Text><Text style={{color:colors.muted}}>{formatBytes(app.bytes)}</Text>
          </View>)}</>}
        <View style={divider}><SurfaceTitle colors={colors} title="Connected apps" icon="apps-outline" tint="lavender"/></View>
        {!user.apps.length&&<Text style={{color:colors.muted}}>No connected apps.</Text>}
        {user.apps.map(app=><View key={app.client} style={[divider,{gap:8,flexDirection:'row',alignItems:'center'}]}><AppIcon icon={app.icon} color={colors.accent}/><Text style={{color:colors.ink}}>{app.label}</Text><TrustBadges kind="app" verified={app.verified} color={colors.ink}/></View>)}
        <View style={divider}><SurfaceTitle colors={colors} title="Registered apps" icon="ribbon-outline" tint="mint"/></View>
        {!registered.length&&<Text style={{color:colors.muted}}>No registered apps.</Text>}
        {registered.map(app=><View key={app.id} style={[divider,{gap:8}]}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}><AppIcon icon={app.icon} color={colors.accent}/><Text style={{color:colors.ink,flex:1}}>{app.name} · {app.status}{app.restricted?' · Restricted':''}</Text><TrustBadges kind="app" verified={app.verified} color={colors.ink}/></View>
          <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{icon(app.verified?'Remove app verification':'Verify app','checkmark-circle-outline',()=>run(async()=>{await api('admin/apps',{type:'app',id:app.id,verified:!app.verified});}))}{app.status==='active'&&app.verified&&!app.restricted&&icon('Manage app storage','server-outline',()=>setStorageApp(app.id))}</View>
          {<View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>
            {app.status==='active'&&icon(app.restricted?'Restore app':'Restrict app',app.restricted?'lock-open-outline':'lock-closed-outline',()=>run(async()=>{
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
    </>:<><SurfaceTitle colors={colors} title="Accounts" icon="people-outline"/>
      <TextInput accessibilityLabel="Find an account" autoCapitalize="none" value={filter} onChangeText={value=>{setFilter(value);setVisibleLimit(40);}}
      placeholder="Find an account" placeholderTextColor={colors.muted} style={input}/>
      {loading&&<Text accessibilityRole="progressbar" style={{color:colors.muted}}>Loading accounts…</Text>}
      {!loading&&!status&&!visible.length&&<Text style={{color:colors.muted}}>No accounts found.</Text>}
      {visible.slice(0,visibleLimit).map(user=>
        <Pressable accessibilityRole="button" key={user.username} onPress={()=>{setSelected(user.username);onDetail(true);setDetails(null);}}
          style={({pressed})=>[divider,{minHeight:60,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:pressed?colors.soft:colors.panel}]}>
          <Avatar user={user} token={token} colors={colors}/><View style={{flex:1,gap:4}}><Text style={{color:colors.ink}}>@{user.username}</Text><TrustBadges verified={user.verified} admin={user.admin} color={colors.ink}/></View>
          {user.locked?<Ionicons accessibilityLabel="Locked" name="lock-closed-outline" size={20} color={colors.danger}/>:<Ionicons accessible={false} name="chevron-forward" size={19} color={colors.muted}/>}
        </Pressable>)}
      {visible.length>visibleLimit&&icon('Show more accounts','chevron-down',()=>setVisibleLimit(limit=>limit+40))}</>}
    {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </Surface>;
}
