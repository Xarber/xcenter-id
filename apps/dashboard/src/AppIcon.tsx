import {useState} from 'react';
import {Image} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {accountHost} from './native-account';

export default function AppIcon({icon,color,compact=false}:{icon?:string|null;color:string;compact?:boolean}){
  const [failed,setFailed]=useState<string|null>(null);
  const size=compact?20:40;
  return icon&&icon!==failed?
    <Image onError={()=>setFailed(icon)} source={{uri:icon.startsWith('/')?accountHost+icon:'data:image/png;base64,'+icon}}
      style={{width:size,height:size,borderRadius:compact?3:10}}/>:
    <Ionicons name="apps-outline" size={compact?20:36} color={color} accessible={false}/>;
}
