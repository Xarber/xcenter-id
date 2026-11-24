import {useEffect, useRef, useState, type ReactNode} from 'react';
import {AccessibilityInfo, Modal, Pressable, ScrollView, Text, View, useColorScheme} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {DialogContext, type Dialog, type DialogAction} from './dialog-model';

export default function DialogProvider({children}: {children: ReactNode}) {
  const [request,setRequest] = useState<Dialog | null>(null);
  const [reduceMotion,setReduceMotion] = useState(true);
  const next = useRef<Dialog | null>(null);
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#f0f3ff' : '#161d34';
  const muted = dark ? '#b4bfd8' : '#52617f';
  const surface = dark ? '#202940' : '#fff';
  const soft = dark ? '#303b57' : '#eef1fa';
  const blue = dark ? '#b9c6ff' : '#304db0';
  const red = dark ? '#ffb2ba' : '#a32134';

  useEffect(()=>{
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    return ()=>listener.remove();
  },[]);

  function dismiss(action?: DialogAction) {
    if (!request) return;
    next.current = null;
    setRequest(null);
    const selected = action ?? request.actions.find(item => item.style === 'cancel');
    if (selected?.onPress) requestAnimationFrame(()=>selected.onPress?.());
  }

  return <DialogContext.Provider value={(title,message,actions)=>{
    if (next.current) { actions.find(item => item.style==='cancel')?.onPress?.(); return; }
    const dialog = {title,message,actions};
    next.current = dialog;
    setRequest(dialog);
  }}>
    {children}
    {request && <Modal transparent visible animationType={reduceMotion?'none':'fade'} onRequestClose={()=>dismiss()}>
      <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:18,backgroundColor:'#111a3578'}}>
        <View accessibilityViewIsModal style={{width:'100%',maxWidth:410,maxHeight:'85%',backgroundColor:surface,borderRadius:22,padding:20}}>
          <ScrollView style={{flexGrow:0}} contentContainerStyle={{gap:12}}>
            <Ionicons name={request.actions.some(action=>action.style==='destructive')?'alert-circle-outline':'information-circle-outline'}
              size={28} color={blue} importantForAccessibility="no"/>
            <Text accessibilityRole="header" style={{color:ink,fontSize:22,fontWeight:'700'}}>{request.title}</Text>
            {request.message && <Text style={{color:muted,fontSize:16}}>{request.message}</Text>}
            <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-end',gap:8,marginTop:4}}>
              {request.actions.map(action=><Pressable key={action.text} accessibilityRole="button" onPress={()=>dismiss(action)}
                style={({pressed})=>({paddingHorizontal:14,paddingVertical:12,minHeight:44,borderRadius:11,backgroundColor:soft,opacity:pressed?.7:1})}>
                <Text style={{color:action.style==='destructive'?red:action.style==='cancel'?muted:blue,fontWeight:'600'}}>{action.text}</Text>
              </Pressable>)}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>}
  </DialogContext.Provider>;
}
