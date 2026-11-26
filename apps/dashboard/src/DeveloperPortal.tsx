import {dashboardThemes,type DashboardTheme} from './native-surfaces';
import AppConfiguration from './AppConfiguration';
import CopyButton from './CopyButton';
import { optionalClaims, type ClaimRequirements, type DeveloperIdentity } from './developer-web';
import TrustBadges from './TrustBadges';
import ApplicationStorage from './ApplicationStorage';
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { accountHost, nativeReauthenticate, nativeRequest } from './native-account';
import { fileAsBase64 } from './web-account';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Switch, Text, TextInput, useColorScheme, View } from 'react-native';
import Animated, { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated';

type Registration = { id: string; name: string; callback: string; callbackApproved?:boolean; status: string; native?:boolean; client?: string; developerName?:string; icon?:string|null; verified?:boolean; requirements?:ClaimRequirements };
const entering = FadeIn.duration(180).easing(Easing.bezier(0.23, 1, 0.32, 1)).reduceMotion(ReduceMotion.System);

export default function DeveloperPortal({ back,token,colors }: { back: () => void;token?:string;colors?:DashboardTheme }) {
  const endpoint=(token?accountHost:'')+'/account/developer/apps';
  function request(path='',init:RequestInit={}){
    const url=path==='/developer-profile'?endpoint.replace(/\/apps$/,'/profile'):endpoint+path;
    return fetch(url,{...init,credentials:token?'omit':'same-origin',headers:{
      'X-AuthNJS-Request':'developer-portal',
      ...(token?{'X-AuthNJS-Native':'account-manager',Authorization:'Bearer '+token}:{}),
      ...init.headers,
    }});
  }
  const dark = useColorScheme() === 'dark';
  const ink = colors?.ink??(dark ? '#f4f7ff' : '#142438');
  const accent = colors?.accent??(dark ? '#b9d0ff' : '#1b469b');
  const border = dark ? '#5a7192' : '#62738c';
  const [profile,setProfile]=useState<DeveloperIdentity|null>(null);
  const [profileName,setProfileName]=useState('');
  const [githubProfile,setGitHubProfile]=useState('');
  const [editingDeveloper,setEditingDeveloper]=useState(false);
  const [permissionApp,setPermissionApp]=useState('');
  const [requirements,setRequirements]=useState(optionalClaims);
  const [creating,setCreating]=useState(false);
  const [configuration,setConfiguration]=useState('');
  const [storage,setStorage]=useState('');
  const [apps, setApps] = useState<Registration[] | null>(null);
  const [notice, setNotice] = useState('Checking developer access…');
  const [name, setName] = useState('');
  const [developerName,setDeveloperName]=useState('');
  const [icon,setIcon]=useState<string|null>(null);
  const [native,setNative]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const [callback, setCallback] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ clientId: string; clientSecret: string|null } | null>(null);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    const controller = new AbortController();
    request('',{signal:controller.signal})
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!Array.isArray(result.apps)) throw new Error();
        setApps(result.apps);
        setNotice('');
      })
      .catch(() => { if (!controller.signal.aborted) setNotice('Sign in through the developer account service to register an app.'); });
    return () => controller.abort();
  }, [token]);

  async function openDeveloper(){
    setSaving(true);
    try{
      const response=await request('/developer-profile');
      if(!response.ok)throw new Error();
      const result=await response.json();
      setProfile(result);setProfileName(result.name);setGitHubProfile(result.githubProfile??'');setEditingDeveloper(true);setNotice('');
    }catch{setNotice('Could not load the developer profile.');}
    finally{setSaving(false);}
  }

  async function saveDeveloper(requestVerification=false){
    setSaving(true);
    try{
      const response=await request('/developer-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:profileName,githubProfile,requestVerification})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error);
      setProfile(result);setProfileName(result.name);setGitHubProfile(result.githubProfile??'');setNotice(requestVerification?'Verification request submitted.':'Developer profile saved.');
    }catch(error){setNotice(error instanceof Error?error.message:'Could not save the developer profile.');}
    finally{setSaving(false);}
  }

  async function savePermissions(id:string){
    setSaving(true);
    try{
      const response=await request('/'+id+'/permissions',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(requirements)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error);
      setApps(previous=>previous?.map(app=>app.id===id?{...app,requirements:result.requirements}:app)??null);
      setPermissionApp('');setNotice('App permissions saved.');
    }catch(error){setNotice(error instanceof Error?error.message:'Could not save app permissions.');}
    finally{setSaving(false);}
  }

  async function submit() {
    if (saving || !apps) return;
    setSaving(true);
    setNotice('Submitting…');
    try {
      const response = await request('',{
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AuthNJS-Request': 'developer-portal' },
        body: JSON.stringify({ name, callback, developerName, icon, native }),
      });
      if (!response.ok) throw new Error();
      const item: Registration = await response.json();
      setApps((previous) => [...(previous ?? []), item]);
      setName('');
      setCallback('');setDeveloperName('');setIcon(null);setNative(false);
      setNotice('Registration submitted for review.');
    } catch {
      setNotice('Could not submit. Check the callback address and your developer session.');
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: string, callbackApproved=false) {
    setNotice(callbackApproved?'Activating this registration…':'Checking the DNS record…');
    setSaving(true);
    try {
      if(callbackApproved&&token&&!(await nativeRequest('session/access',token)).confirmed)await nativeReauthenticate(token);
      const result = await request('/'+id+'/verify', {
        method: 'POST',
        headers: { 'X-AuthNJS-Request': 'developer-portal' },
      });
      const issued = await result.json();
      if (!result.ok) throw new Error(issued.error??'Could not activate this registration.');
      setCredentials(issued);
      setApps((previous) => (previous ?? []).map((app) => app.id === id
        ? { ...app, status: 'active', client: issued.clientId } : app));
      setNotice('App activated.');
    } catch(error) {
      setNotice(error instanceof Error?error.message:'Could not activate this registration.');
    } finally { setSaving(false); }
  }

  async function revoke(id: string) {
    setSaving(true);
    try {
      const result = await request('/'+id+'/revoke', {method:'POST',headers:{'X-AuthNJS-Request':'developer-portal'}});
      if (!result.ok) throw new Error();
      setApps(previous=>(previous??[]).filter(app=>app.id!==id));
      setCredentials(null);
      setNotice('App deleted.');
    } catch { setNotice('Could not delete this app.'); }
    finally { setSaving(false); setRevoking(null); }
  }

  async function selectIcon(){
    try{
      const result=await getDocumentAsync({type:['image/png','image/jpeg'],copyToCacheDirectory:true});
      if(result.canceled)return;
      const asset=result.assets[0];
      if(!asset.size||asset.size>32_000)throw new Error('Choose a PNG or JPEG up to 32 KB.');
      const file=asset.file?null:new File(asset.uri);
      try {setIcon(asset.file?await fileAsBase64(asset.file):await file!.base64());}
      finally {if(file?.exists)file.delete();}
    }catch(error){setNotice(error instanceof Error?error.message:'Choose a PNG or JPEG.');}
  }
  async function saveBrand(id:string){
    setSaving(true);
    try{
      const result=await request('/'+id+'/brand',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({developerName,icon})});
      if(!result.ok)throw new Error();
      const brand=await result.json();
      setApps(previous=>previous?.map(app=>app.id===id?{...app,...brand}:app)??null);
      setEditing(null);setDeveloperName('');setIcon(null);setNotice('App branding saved.');
    }catch{setNotice('Could not save app branding. Check the name and icon.');}
    finally{setSaving(false);}
  }
  function branding(){
    return <>
      <Text style={{color:ink}}>Developer name fallback</Text>
      <TextInput accessibilityLabel="Developer name" style={[styles.input,{color:ink,borderColor:border}]}
        value={developerName} onChangeText={setDeveloperName} maxLength={80} placeholder="Your developer profile takes priority"/>
      {icon&&<Image accessibilityLabel="Selected app icon" source={{uri:'data:image/'+(icon.startsWith('/9j/')?'jpeg':'png')+';base64,'+icon}} style={styles.icon}/>}
      {action('Choose app icon',()=>void selectIcon(),saving)}
      {icon&&action('Remove app icon',()=>setIcon(null),saving)}
    </>;
  }
  function action(label: string, handler: () => void, disabled = false) {
    return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
      onPress={handler} style={({ pressed }) => [styles.button, { borderColor: border, opacity: disabled || pressed ? 0.6 : 1 }]}>
      <Text style={{ color: accent, fontWeight: '700' }}>{label}</Text>
    </Pressable>;
  }

  if(editingDeveloper)return <View style={styles.content}>
    {action('Back to developer apps',()=>setEditingDeveloper(false),saving)}
    <Text accessibilityRole="header" style={[styles.title,{color:ink}]}>Developer profile</Text>
    <TrustBadges kind="developer" verified={profile?.status==='verified'} color={accent}/>
    {profile?.status==='requested'&&<Text style={{color:ink}}>Verification in review</Text>}
    <Text style={{color:ink}}>Developer display name</Text>
    <TextInput accessibilityLabel="Developer display name" value={profileName} onChangeText={setProfileName} maxLength={80} style={[styles.input,{color:ink,borderColor:border}]}/>
    {!!profile?.githubProfile&&action('View GitHub profile',()=>void Linking.openURL(profile.githubProfile!).catch(()=>setNotice('Could not open GitHub.')))}
    <Text style={{color:ink}}>GitHub profile URL</Text>
    <TextInput accessibilityLabel="GitHub profile URL" value={githubProfile} onChangeText={setGitHubProfile} autoCapitalize="none" keyboardType="url" maxLength={80} style={[styles.input,{color:ink,borderColor:border}]}/>
    {profile?.status==='verified'&&(profile.name!==profileName.trim()||(profile.githubProfile??'')!==githubProfile.trim().replace(/\/$/,'').toLowerCase())&&<Text accessibilityLiveRegion="polite" style={{color:ink}}>Changing your developer name or GitHub profile removes the verified developer badge. You’ll need to request verification again.</Text>}
    {action('Save developer profile',()=>void saveDeveloper(),saving||!profileName.trim())}
    {profile?.status==='unverified'&&action('Request verification',()=>void saveDeveloper(true),saving||!profileName.trim())}
    {notice&&<Text accessibilityLiveRegion="polite" style={{color:ink}}>{notice}</Text>}
  </View>;
  if(configuration&&token)return <AppConfiguration key={configuration} token={token}
    colors={colors??{ink,accent,muted:border,soft:dark?'#23355d':'#e9f0ff'}} back={()=>{
      setConfiguration('');
      void request().then(async response=>{if(response.ok)setApps((await response.json()).apps);}).catch(()=>setNotice('Could not refresh apps.'));
    }} request={async body=>{
      const response=await request('/'+configuration+'/configuration',body?{
        method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
      }:undefined);
      const result=await response.json();
      if(!response.ok)throw new Error(result.error??'Could not load configuration.');
      return result;
    }}/>;
  if(storage&&token)return <ApplicationStorage id={storage} token={token} colors={colors??dashboardThemes[dark?'dark':'light']} back={()=>setStorage('')}/>;
  return <Animated.View entering={entering} style={styles.content}>
    {action('Back to X-Center ID', back)}
    <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>Developer apps</Text>
    <Text style={{ color: ink }}>Register an exact HTTPS callback, then verify your domain to activate sign-in.</Text>
    {action('Manage developer profile',()=>void openDeveloper(),saving)}
    {apps && <>
      {action(creating?'Cancel registration':'Register a new app',()=>setCreating(!creating))}
      {!editing&&creating&&<>
      <Text style={{ color: ink }}>Application name</Text>
      <TextInput accessibilityLabel="Application name" style={[styles.input, { color: ink, borderColor: border }]} value={name} onChangeText={setName} maxLength={80} />
      <Text style={{ color: ink }}>HTTPS callback address</Text>
      <TextInput accessibilityLabel="HTTPS callback address" style={[styles.input, { color: ink, borderColor: border }]} value={callback}
        onChangeText={setCallback} autoCapitalize="none" keyboardType="url" maxLength={512} />
      {action(native?'Client type: Native app':'Client type: Website backend',()=>setNative(value=>!value),saving)}
      {native&&<Text style={{color:ink}}>Use a verified HTTPS Universal Link or Android App Link as your callback. Native clients use PKCE.</Text>}
      {branding()}
      {action('Submit for review', () => { void submit(); }, saving || !name.trim() || !callback.trim())}</> }
      {apps.filter(app=>app.status!=='revoked').map((app) => <View key={app.id} style={[styles.item, { borderColor: border }]}>
        <Text style={{ color: ink, fontWeight: '700' }}>{app.name}</Text><TrustBadges kind="app" verified={app.verified} color={accent}/>
        <Text style={{ color: ink }}>{app.status} · {app.native?'Native':'Web'}{app.client ? ' · ' + app.client : ''}</Text>
        {app.developerName&&<Text style={{color:ink}}>Developer: {app.developerName}</Text>}
        {app.status!=='revoked'&& (editing===app.id?<>{branding()}
          {action('Save branding',()=>void saveBrand(app.id),saving)}
          {action('Cancel editing',()=>{setEditing(null);setDeveloperName('');setIcon(null);},saving)}</>
          :action('Edit branding',()=>{setEditing(app.id);setDeveloperName(app.developerName??'');setIcon(app.icon??null);},saving))}
        {permissionApp===app.id?<View style={{gap:10}}>
          <Text accessibilityRole="header" style={{color:ink,fontWeight:'700'}}>Permissions</Text>
          <Text style={{color:ink}}>The app must request the scopes you mark as required.</Text>
          {([['email','Require a verified email address'],['age_range','Require age range']] as const).map(([key,label])=><View key={key} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <Text style={{color:ink,flex:1}}>{label}</Text><Switch accessibilityLabel={label} value={requirements[key]} disabled={saving} onValueChange={value=>setRequirements({...requirements,[key]:value})}/>
          </View>)}
          {action('Save permissions',()=>void savePermissions(app.id),saving)}
          {action('Cancel',()=>setPermissionApp(''),saving)}
        </View>:action('Edit permissions',()=>{setRequirements(app.requirements??optionalClaims);setPermissionApp(app.id);},saving)}
        {token&&action('App configuration',()=>setConfiguration(app.id),saving)}
        {app.status==='active'&&action('Manage application database',()=>setStorage(app.id))}
        {action('Manage app access and credentials on the web',()=>void Linking.openURL(accountHost+'/developer?app='+app.id).catch(()=>setNotice('Could not open the developer portal.')))}
        {app.status !== 'revoked' && (revoking === app.id ? <>
          <Text style={{color:ink}}>This disables sign-in and API access. Stored records are retained.</Text>
          {action('Confirm app deletion', () => { void revoke(app.id); }, saving)}
          {action('Cancel', () => setRevoking(null), saving)}
        </> : action('Delete app', () => setRevoking(app.id), saving))}
        {app.status==='pending'&&app.callbackApproved&&<>
          <Text style={{color:ink,fontWeight:'700'}}>An administrator approved your callback URLs</Text>
          <Text style={{color:ink}}>You can now activate this app and get its sign-in credentials.</Text>
          {action(app.native?'Get client ID':'Get client ID and secret',()=>void activate(app.id,true),saving)}
        </>}
        {app.status === 'pending' && !app.callbackApproved && <>
          <Text selectable style={{ color: ink }}>Name: {'_xcenter-id.' + new URL(app.callback).hostname}</Text><CopyButton value={'_xcenter-id.'+new URL(app.callback).hostname} label="Copy DNS record name" color={accent}/>
          <Text selectable style={{ color: ink }}>TXT: {'xcenter-id=' + app.id}</Text><CopyButton value={'xcenter-id='+app.id} label="Copy DNS verification code" color={accent}/>
          {action('Verify domain and activate', () => { void activate(app.id); }, saving)}
        </>}
      </View>)}
    </>}
    {credentials && <View style={[styles.item, { borderColor: border }]}>
      <Text style={{ color: ink }}>{credentials.clientSecret?'Save the client secret now. It is displayed once.':'Use the public client ID with PKCE.'}</Text>
      <Text selectable style={{ color: ink }}>{credentials.clientId}</Text><CopyButton value={credentials.clientId} label="Copy client ID" color={accent}/>
      {credentials.clientSecret&&<Text selectable style={{ color: ink }}>{credentials.clientSecret}</Text>}
      {!!credentials.clientSecret&&<CopyButton value={credentials.clientSecret} label="Copy client secret" color={accent}/>}
      {action('Hide credentials', () => setCredentials(null))}
    </View>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: ink }}>{notice}</Text>}
  </Animated.View>;
}

const styles = StyleSheet.create({
  content: { gap: 14, maxWidth: 650 },
  title: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  button: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 12, minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 },
  icon: {width:48,height:48,borderRadius:10},
  item: { gap: 5, borderWidth: 1, borderRadius: 12, padding: 14 },
});
