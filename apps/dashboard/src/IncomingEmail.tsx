import {useDialog} from './dialog-model';
import {hasPendingDelivery,verificationStatus,type VerificationAddress,type VerificationStatus} from './email-verification-status';
import {useEffect,useState} from 'react';
import {Linking,Pressable,Text,TextInput,View} from 'react-native';
import {nativeRequest,nativeReauthenticate} from './native-account';

export default function IncomingEmail({token,updated,addresses,colors}:{token:string;updated:()=>Promise<void>;addresses:VerificationAddress[];colors:{ink:string;accent:string;muted:string;soft:string}}){
  const showDialog=useDialog();
  const [info,setInfo]=useState<VerificationStatus|null>(null);
  const [email,setEmail]=useState('');
  const [draft,setDraft]=useState<{mailto:string;address:string;expires:number}|null>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  async function check(report=false,address?:string){
    const next:VerificationStatus=await nativeRequest('email/incoming',token);
    setInfo(next);
    const target=address??draft?.address??info?.pending?.address??info?.outgoing?.address;
    const message=verificationStatus(next,target);
    if(draft&&(!next.pending||next.pending.address!==draft.address))setDraft(null);
    const completed=!!target&&!hasPendingDelivery(next)&&!!(info?.pending||info?.outgoing||draft);
    if(report||completed||message==='Email verified.'&&!!target)setStatus(message);
    if(report||message==='Email verified.'&&!!target)await updated();
  }
  async function removeAddress(address:string){
    setBusy(true);setStatus('');
    try{
      if(!(await nativeRequest('session/access',token)).confirmed&&!await nativeReauthenticate(token))return;
      await nativeRequest('email/remove',token,{email:address});
      await check();await updated();
      setStatus('Email address removed.');
    }catch(error){
      setStatus(error instanceof Error?error.message:'Could not remove the email address.');
    }finally{setBusy(false);}
  }
  useEffect(()=>{void check().catch(error=>setStatus(error.message));},[token]);
  useEffect(()=>{
    if(!info?.pending&&!info?.outgoing)return;
    const timer=setInterval(()=>void check().catch(()=>{}),15000);
    return ()=>clearInterval(timer);
  },[info?.pending?.address,info?.outgoing?.address,draft,token]);
  function action(label:string,work:()=>Promise<void>){
    return <Pressable accessibilityRole="button" disabled={busy} style={{minHeight:44,padding:12,borderRadius:10,backgroundColor:colors.soft}}
      onPress={()=>{setBusy(true);setStatus('');void work().catch(error=>setStatus(error.message)).finally(()=>setBusy(false));}}>
      <Text style={{color:colors.accent}}>{label}</Text></Pressable>;
  }
  if(!info?.enabled&&!info?.canSendLink&&!status&&!addresses.length)return null;
  return <View style={{gap:12}}>
    <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Verify an email address</Text>
    <Text style={{color:colors.muted}}>Open a link sent to your address, or send a prepared message from it.</Text>
    <TextInput accessibilityLabel="Email to verify" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
      maxLength={254} style={{minHeight:48,color:colors.ink,borderWidth:1,borderColor:colors.muted,borderRadius:10,padding:12}}/>
    {action('Add email',async()=>{await nativeRequest('email/add',token,{email});setEmail('');await check();await updated();setStatus('Address added · Unverified');})}
    {addresses.map(item=><View key={item.address} style={{gap:8}}><Text style={{color:colors.ink}}>{item.address} · {item.verified?'Verified':'Unverified'}</Text>{!item.verified&&info?.canSendLink&&action('Email me a link',async()=>{await nativeRequest('email',token,{email:item.address});await check(true,item.address);})}{!item.verified&&info?.enabled&&action('Send a verification email',async()=>{const result=await nativeRequest('email/incoming',token,{email:item.address});setDraft(result);await check(true,result.address);await Linking.openURL(result.mailto);})}{action('Remove email',async()=>showDialog('Remove email address?','It will no longer be used by your account.',[{text:'Cancel',style:'cancel'},{text:'Remove',style:'destructive',onPress:()=>void removeAddress(item.address)}]))}</View>)}
    {draft&&<><Text style={{color:colors.ink}}>Send from {draft.address}. Expires {new Date(draft.expires).toLocaleTimeString()}.</Text>
      {action('Open verification email',async()=>{await Linking.openURL(draft.mailto);})}</>}
    {hasPendingDelivery(info,Date.now(),addresses)&&action('Check delivery',()=>check(true))}
    {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
