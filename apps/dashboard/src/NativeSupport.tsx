import {useEffect,useState} from 'react';
import {Pressable,Text,TextInput,View,StyleSheet} from 'react-native';
import {nativeRequest} from './native-account';

export default function NativeSupport({token,colors}:{token:string;colors:{ink:string;muted:string;accent:string;soft:string}}){
  const [subject,setSubject]=useState('');
  const [text,setText]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [requests,setRequests]=useState<{id:string;subject:string;reply:string|null}[]>([]);
  async function load(){setRequests((await nativeRequest('support',token)).requests);}
  useEffect(()=>{void load().catch(error=>setStatus(error.message));},[token]);
  return <View style={{gap:12}}>
    <Text accessibilityRole="header" style={{fontSize:22,fontWeight:'700',color:colors.ink}}>Contact support</Text>
    <Text style={{color:colors.muted}}>Administrators can read your request and reply here.</Text>
    {requests.map(item=><View key={item.id}><Text style={{color:colors.ink,fontWeight:'600'}}>{item.subject}</Text>
      <Text style={{color:colors.ink}}>{item.reply??'Awaiting a reply.'}</Text></View>)}
    <Text style={{color:colors.ink}}>Subject</Text>
    <TextInput accessibilityLabel="Subject" value={subject} onChangeText={setSubject} maxLength={120} editable={!busy}
      style={[styles.input,{color:colors.ink,borderColor:colors.muted}]}/>
    <Text style={{color:colors.ink}}>Message</Text>
    <TextInput accessibilityLabel="Message" value={text} onChangeText={setText} maxLength={3000} multiline editable={!busy}
      style={[styles.input,{color:colors.ink,borderColor:colors.muted}]}/>
    <Pressable accessibilityRole="button" disabled={busy||!subject.trim()||!text.trim()} style={[styles.button,{backgroundColor:colors.soft}]}
      onPress={()=>{setBusy(true);setStatus('');
        void nativeRequest('support',token,{subject,text}).then(async()=>{
          setText('');setSubject('');await load();setStatus('Request sent.');
        }).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));}}>
      <Text style={{color:colors.accent}}>Send to support</Text>
    </Pressable>
    <Pressable accessibilityRole="button" style={[styles.button,{backgroundColor:colors.soft}]} onPress={()=>void load().catch(error=>setStatus(error.message))}>
      <Text style={{color:colors.accent}}>Refresh replies</Text>
    </Pressable>
    {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
const styles=StyleSheet.create({input:{minHeight:48,borderWidth:1,borderRadius:10,padding:12},
  button:{minHeight:44,borderRadius:10,padding:12,justifyContent:'center'}});
