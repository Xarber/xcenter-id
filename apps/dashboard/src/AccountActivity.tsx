import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {activitySummary,activityTitle,type ActivityEvent} from './account-activity';
import {nativeRequest} from './native-account';

export default function AccountActivity({token,colors}:{
  token:string;colors:{ink:string;muted:string;line:string;accent:string};
}){
  const [open,setOpen]=useState(false);
  const [events,setEvents]=useState<ActivityEvent[]|null>(null);
  const [error,setError]=useState('');
  async function load(){
    setError('');
    setEvents(null);
    try{setEvents((await nativeRequest('activity',token)).events);}
    catch(error){setError(error instanceof Error?error.message:'Activity unavailable.');}
  }
  return <View style={{gap:10,borderTopWidth:1,borderColor:colors.line,paddingTop:8}}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:44}} onPress={()=>{
      setOpen(!open);
      if(!open)void load();
    }}><Ionicons name="time-outline" size={20} color={colors.accent}/><Text style={{color:colors.accent,fontWeight:'700'}}>{open?'Hide activity':'View account activity'}</Text></Pressable>
    {open&&(error?<Text accessibilityRole="alert" style={{color:colors.ink}}>{error}</Text>:
      !events?<Text accessibilityLiveRegion="polite" style={{color:colors.muted}}>Loading activity…</Text>:
      events.length===0?<Text style={{color:colors.muted}}>No recent activity.</Text>:
      events.map(event=><View key={event.id} style={{borderColor:colors.line,borderBottomWidth:1,paddingBottom:8,gap:4}}>
        <Text style={{color:colors.ink,fontWeight:'700'}}>{activityTitle[event.kind]}{event.subject&&' · '+event.subject}</Text>
        <Text style={{color:colors.muted}}>{new Date(event.created).toLocaleString()}{activitySummary(event)&&' · '+activitySummary(event)}</Text>
      </View>))}
  </View>;
}
