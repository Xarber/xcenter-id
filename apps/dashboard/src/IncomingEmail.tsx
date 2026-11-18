import {useEffect,useState} from 'react';
import {Linking,Pressable,Text,TextInput,View} from 'react-native';
import {nativeRequest} from './native-account';

export default function IncomingEmail({token,updated,colors}:{token:string;updated:()=>Promise<void>;colors:{ink:string;accent:string;muted:string;soft:string}}){
  const [enabled,setEnabled]=useState(false);
  const [email,setEmail]=useState('');
  const [draft,setDraft]=useState<{mailto:string;address:string;expires:number}|null>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  async function check(){
    const info=await nativeRequest('email/incoming',token);
    setEnabled(info.enabled);
    if(draft&&!info.pending){
      const {account}=await nativeRequest('me',token);
      if(account?.emails.some((item:{address:string})=>item.address===draft.address)){
        setDraft(null);setStatus('Email verified.');await updated();
      }else if(Date.now()>draft.expires){setDraft(null);setStatus('Verification expired. Prepare a new message.');}
    }
  }
  useEffect(()=>{void check().catch(error=>setStatus(error.message));},[token]);
  useEffect(()=>{
    if(!draft)return;
    const timer=setInterval(()=>void check().catch(()=>{}),15000);
    return ()=>clearInterval(timer);
  },[draft,token]);
  function action(label:string,work:()=>Promise<void>){
    return <Pressable accessibilityRole="button" disabled={busy} style={{minHeight:44,padding:12,borderRadius:10,backgroundColor:colors.soft}}
      onPress={()=>{setBusy(true);setStatus('');void work().catch(error=>setStatus(error.message)).finally(()=>setBusy(false));}}>
      <Text style={{color:colors.accent}}>{label}</Text></Pressable>;
  }
  if(!enabled)return null;
  return <View style={{gap:12}}>
    <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Verify by sending an email</Text>
    <Text style={{color:colors.muted}}>Send a prepared message from the email address you want to verify. Keep its subject and code unchanged.</Text>
    <TextInput accessibilityLabel="Email to verify" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
      maxLength={254} style={{minHeight:48,color:colors.ink,borderWidth:1,borderColor:colors.muted,borderRadius:10,padding:12}}/>
    {action('Prepare verification email',async()=>setDraft(await nativeRequest('email/incoming',token,{email})))}
    {draft&&<><Text style={{color:colors.ink}}>Send from {draft.address}. Expires {new Date(draft.expires).toLocaleTimeString()}.</Text>
      {action('Open verification email',async()=>{await Linking.openURL(draft.mailto);})}
      {action('Check delivery',check)}</>}
    {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
