import {Ionicons} from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {useState} from 'react';
import {AccessibilityInfo,Pressable} from 'react-native';

export default function CopyButton({value,label,color}:{value:string;label:string;color:string}){
  const [copied,setCopied]=useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}
    onPress={()=>void Clipboard.setStringAsync(value).then(ok=>{
      setCopied(ok);
      AccessibilityInfo.announceForAccessibility(ok?'Copied':'Could not copy');
    }).catch(()=>AccessibilityInfo.announceForAccessibility('Could not copy'))}>
    <Ionicons name={copied?'checkmark':'copy-outline'} color={color} size={19}/>
  </Pressable>;
}
