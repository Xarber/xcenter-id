import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { accountHost } from './native-account';
import { fileAsBase64 } from './web-account';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import Animated, { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated';

type Registration = { id: string; name: string; callback: string; status: string; native?:boolean; client?: string; developerName?:string; icon?:string|null };
const entering = FadeIn.duration(180).easing(Easing.bezier(0.23, 1, 0.32, 1)).reduceMotion(ReduceMotion.System);

export default function DeveloperPortal({ back,token }: { back: () => void;token?:string }) {
  const endpoint=(token?accountHost:'')+'/account/developer/apps';
  function request(path='',init:RequestInit={}){
    return fetch(endpoint+path,{...init,credentials:token?'omit':'same-origin',headers:{
      'X-AuthNJS-Request':'developer-portal',
      ...(token?{'X-AuthNJS-Native':'account-manager',Authorization:'Bearer '+token}:{}),
      ...init.headers,
    }});
  }
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#f4f7ff' : '#142438';
  const accent = dark ? '#b9d0ff' : '#1b469b';
  const border = dark ? '#5a7192' : '#62738c';
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

  async function activate(id: string) {
    setNotice('Checking the DNS record…');
    setSaving(true);
    try {
      const result = await request('/'+id+'/verify', {
        method: 'POST',
        headers: { 'X-AuthNJS-Request': 'developer-portal' },
      });
      if (!result.ok) throw new Error();
      const issued = await result.json();
      setCredentials(issued);
      setApps((previous) => (previous ?? []).map((app) => app.id === id
        ? { ...app, status: 'active', client: issued.clientId } : app));
      setNotice('App activated.');
    } catch {
      setNotice('Verification failed. Confirm that the public TXT record matches and try again after thirty seconds.');
    } finally { setSaving(false); }
  }

  async function revoke(id: string) {
    setSaving(true);
    try {
      const result = await request('/'+id+'/revoke', {method:'POST',headers:{'X-AuthNJS-Request':'developer-portal'}});
      if (!result.ok) throw new Error();
      setApps((previous) => (previous ?? []).map((app) => app.id === id ? { ...app, status:'revoked' } : app));
      setCredentials(null);
      setNotice('App access revoked.');
    } catch { setNotice('Could not revoke this app.'); }
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
      <Text style={{color:ink}}>Developer name shown to users</Text>
      <TextInput accessibilityLabel="Developer name" style={[styles.input,{color:ink,borderColor:border}]}
        value={developerName} onChangeText={setDeveloperName} maxLength={80} placeholder="Use your account name by default"/>
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

  return <Animated.View entering={entering} style={styles.content}>
    {action('Back to X-Center ID', back)}
    <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>Developer apps</Text>
    <Text style={{ color: ink }}>Register an exact HTTPS callback, then verify your domain to activate sign-in.</Text>
    {apps && <>
      {!editing&&<>
      <Text style={{ color: ink }}>Application name</Text>
      <TextInput accessibilityLabel="Application name" style={[styles.input, { color: ink, borderColor: border }]} value={name} onChangeText={setName} maxLength={80} />
      <Text style={{ color: ink }}>HTTPS callback address</Text>
      <TextInput accessibilityLabel="HTTPS callback address" style={[styles.input, { color: ink, borderColor: border }]} value={callback}
        onChangeText={setCallback} autoCapitalize="none" keyboardType="url" maxLength={512} />
      {action(native?'Client type: Native app':'Client type: Website backend',()=>setNative(value=>!value),saving)}
      {native&&<Text style={{color:ink}}>Use a verified HTTPS Universal Link or Android App Link as your callback. Native clients use PKCE.</Text>}
      {branding()}
      {action('Submit for review', () => { void submit(); }, saving || !name.trim() || !callback.trim())}</> }
      {apps.map((app) => <View key={app.id} style={[styles.item, { borderColor: border }]}>
        <Text style={{ color: ink, fontWeight: '700' }}>{app.name}</Text>
        <Text style={{ color: ink }}>{app.status} · {app.native?'Native':'Web'}{app.client ? ' · ' + app.client : ''}</Text>
        {app.developerName&&<Text style={{color:ink}}>Developer: {app.developerName}</Text>}
        {app.status!=='revoked'&& (editing===app.id?<>{branding()}
          {action('Save branding',()=>void saveBrand(app.id),saving)}
          {action('Cancel editing',()=>{setEditing(null);setDeveloperName('');setIcon(null);},saving)}</>
          :action('Edit branding',()=>{setEditing(app.id);setDeveloperName(app.developerName??'');setIcon(app.icon??null);},saving))}
        {app.status === 'active' && (revoking === app.id ? <>
          <Text style={{color:ink}}>This immediately disables sign-in and data access for this client.</Text>
          {action('Confirm revoke', () => { void revoke(app.id); }, saving)}
          {action('Cancel', () => setRevoking(null), saving)}
        </> : action('Revoke app', () => setRevoking(app.id), saving))}
        {app.status === 'pending' && <>
          <Text selectable style={{ color: ink }}>Name: {'_xcenter-id.' + new URL(app.callback).hostname}</Text>
          <Text selectable style={{ color: ink }}>TXT: {'xcenter-id=' + app.id}</Text>
          {action('Verify domain and activate', () => { void activate(app.id); }, saving)}
        </>}
      </View>)}
    </>}
    {credentials && <View style={[styles.item, { borderColor: border }]}>
      <Text style={{ color: ink }}>{credentials.clientSecret?'Save the client secret now. It is displayed once.':'Use the public client ID with PKCE.'}</Text>
      <Text selectable style={{ color: ink }}>{credentials.clientId}</Text>
      {credentials.clientSecret&&<Text selectable style={{ color: ink }}>{credentials.clientSecret}</Text>}
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
