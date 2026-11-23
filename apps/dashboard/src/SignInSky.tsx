import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {cancelAnimation,Easing,useAnimatedStyle,useSharedValue,withRepeat,withTiming} from 'react-native-reanimated';

const stars = Array.from({length:36}, (_,index)=>({
  top:((index*251+73)%997)/10,
  left:((index*317+181)%983)/10,
  size:index%7===0?3:1.5,
}));

export default function SignInSky({animate}:{animate:boolean}){
  const glow=useSharedValue(.32);
  const glowStyle=useAnimatedStyle(()=>({opacity:glow.value}));
  useEffect(()=>{
    if(animate)glow.value=withRepeat(withTiming(.66,{duration:7200,easing:Easing.inOut(Easing.sin)}),-1,true);
    else glow.value=.32;
    return ()=>cancelAnimation(glow);
  },[animate,glow]);
  return <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    style={[StyleSheet.absoluteFill,{backgroundColor:'#101c36'}]}>
    <View style={[StyleSheet.absoluteFill,{backgroundColor:'#162547',top:'44%'}]}/>
    <Animated.View style={[StyleSheet.absoluteFill,glowStyle]}>
      {stars.map(({top,left,size})=><View key={top} style={{position:'absolute',top:`${top}%`,left:`${left}%`,width:size,height:size,
        borderRadius:size,backgroundColor:'#dbe9ff'}}/>)}
    </Animated.View>
  </View>;
}
