import {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {cancelAnimation,Easing,useAnimatedStyle,useSharedValue,withRepeat,withTiming} from 'react-native-reanimated';

const stars = Array.from({length:46}, (_,index)=>({
  top:((index*251+73)%997)/10,
  left:((index*317+181)%983)/10,
  size:index%7===0?3:1.5,
}));

export default function SignInSky({animate}:{animate:boolean}){
  const phase=useSharedValue(0);
  const shimmer=useAnimatedStyle(()=>({opacity:.4+phase.value*.37,transform:[{translateX:phase.value*4},{translateY:phase.value*-3}]}));
  const counter=useAnimatedStyle(()=>({opacity:.66-phase.value*.29,transform:[{translateX:phase.value*-3}]}));
  useEffect(()=>{
    phase.value=animate?withRepeat(withTiming(1,{duration:8000,easing:Easing.inOut(Easing.sin)}),-1,true):0;
    return ()=>cancelAnimation(phase);
  },[animate,phase]);
  return <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    style={[StyleSheet.absoluteFill,{backgroundColor:'#101a30',overflow:'hidden'}]}>
    {[shimmer,counter].map((effect,layer)=><Animated.View key={layer} style={[StyleSheet.absoluteFill,effect]}>
      {stars.filter((_,index)=>index%2===layer).map(({top,left,size})=><View key={top} style={{position:'absolute',top:`${top}%`,left:`${left}%`,width:size,height:size,
        borderRadius:size,backgroundColor:'#dbe9ff'}}/>)}
    </Animated.View>)}
  </View>;
}
