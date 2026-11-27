import {useState} from 'react';
import {ActivityIndicator, Image, Pressable, Switch, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Animated, {FadeIn, ReduceMotion} from 'react-native-reanimated';
import {useDialog} from './dialog-model';
import {accountHost} from './native-account';

export type ReviewColors = {ink:string;accent:string;muted:string;soft:string;line:string};
type Permission = {key?:string;label:string;description?:string;enabled:boolean;fixed?:boolean;sensitive?:boolean};
export type DeviceReview = {
  review:string;kind:'account'|'device'|'app';username:string;name:string;description?:string;
  developer?:string;host?:string;icon?:string;verified?:boolean;linked?:boolean;permissions?:Permission[];
  emailChoices?:{value:string;label:string}[]|null;emailRequired?:boolean;sharedEmail?:string;blocked?:boolean;
  saveAccount?:boolean;unsecure?:boolean;unsecureConfirmation?:boolean;
  sources?:{name:string;icon?:string;linked:boolean;permissions:Permission[]}[];
};
export type DeviceDecision = {
  action:'approve'|'deny';permission?:string[];'data-permission'?:string[];'confirm-permission'?:string[];
  email?:string;save_account?:'yes';'confirm-unsecure'?:'yes';
};

export default function DeviceApprovalReview({review,colors,busy,error,decide}:{
  review:DeviceReview;colors:ReviewColors;busy:boolean;error:string;decide:(decision:DeviceDecision)=>void;
}){
  const dialog=useDialog();
  const [selected,setSelected]=useState(()=>new Set((review.permissions??[]).filter(item=>item.key&&!item.fixed&&item.enabled).map(item=>item.key!)));
  const [data,setData]=useState(()=>new Set((review.sources??[]).flatMap(source=>source.linked?source.permissions.filter(item=>item.enabled).map(item=>item.key!):[])));
  const [email,setEmail]=useState(review.emailChoices?.find(item=>item.value==='')?.value);
  const [save,setSave]=useState(false);
  const [unsecure,setUnsecure]=useState(false);
  const account=review.kind==='account';
  const card={borderRadius:14,borderColor:colors.line,borderWidth:1,padding:12,gap:8,backgroundColor:colors.soft};
  const title=account?'Sign in on another device?':review.linked?'Authorize sign-in to '+review.name+'?':'Link '+review.name+'?';
  const label={color:colors.ink,fontWeight:'700' as const};
  const sub={color:colors.muted};
  const icon=(uri?:string)=>uri?.startsWith('/public/app-icons/')?<Image source={{uri:accountHost+uri}} style={{width:40,height:40,borderRadius:10}}/>:
    <Ionicons name={account?'laptop-outline':'apps-outline'} color={colors.accent} size={25}/>;
  const change=(saved:Set<string>,key:string,value:boolean)=>{const next=new Set(saved);if(value)next.add(key);else next.delete(key);return next;};
  function toggle(item:Permission,value:boolean){
    const apply=()=>setSelected(previous=>change(previous,item.key!,value));
    if(item.sensitive&&value){
      dialog('Allow '+item.label.toLowerCase()+'?',item.description,[
        {text:'Cancel',style:'cancel'},{text:'Allow access',onPress:apply},
      ]);
    }else apply();
  }
  function row(item:Permission,state:boolean,changeValue:(value:boolean)=>void){
    return <View key={item.key??item.label} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:9,minHeight:46}}>
      <View style={{flex:1,gap:3}}><Text style={label}>{item.label}</Text>
        {!!item.description&&<Text style={sub}>{item.description}</Text>}</View>
      {item.fixed?<Ionicons name="checkmark" color={colors.accent} size={21} accessibilityLabel="Included"/>:
        <Switch accessibilityLabel={item.label} value={state} onValueChange={changeValue} disabled={busy} trackColor={{true:colors.accent}}/>}
    </View>;
  }
  const canApprove=!review.blocked&&(!review.emailRequired||!review.emailChoices||!!email)&&(!review.unsecureConfirmation||unsecure)&&!busy;
  return <Animated.View entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)} style={{gap:14}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>{icon(review.icon)}
      <Text accessibilityRole="header" style={{...label,fontSize:22,flex:1}}>{title}</Text>
    </View>
    <Text style={sub}>Only approve if you started this sign-in on your other device.</Text>
    <View style={card}><Text style={label}>Signing in as @{review.username}</Text>
      {review.verified&&<Text style={sub}>✓ Verified app</Text>}
      {!!review.developer&&<Text style={sub}>{review.developer}{review.host?' · '+review.host:''}</Text>}
      {!!review.description&&<Text style={sub}>{review.description}</Text>}
    </View>
    {account&&<Text style={sub}>Your X-Center ID will be saved on the device that started the request.</Text>}
    {review.unsecure&&<Text accessibilityRole="alert" style={label}>This app’s hosting domain has not been verified.</Text>}
    {review.permissions&&<View style={card}><Text accessibilityRole="header" style={label}>Permissions</Text>
      {review.permissions.map(item=>row(item,item.fixed?item.enabled:selected.has(item.key!),value=>toggle(item,value)))}
      {!!review.sharedEmail&&<Text style={sub}>Email shared with this app: {review.sharedEmail}</Text>}
    </View>}
    {review.sources?.map(source=><View key={source.name+source.permissions[0]?.key} style={card}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8}}>{icon(source.icon)}<Text style={{...label,flex:1}}>{source.name}</Text></View>
      {source.linked?source.permissions.map(item=>row(item,data.has(item.key!),value=>setData(previous=>change(previous,item.key!,value)))) :
        <Text style={sub}>Access declined. Link this app to your account first.</Text>}
    </View>)}
    {!!review.emailChoices?.length&&<View style={card}><Text accessibilityRole="header" style={label}>Email address to share</Text>
      {review.emailChoices.map(choice=><Pressable key={choice.value} accessibilityRole="radio" accessibilityState={{checked:email===choice.value,disabled:busy}}
        disabled={busy} onPress={()=>setEmail(choice.value)} style={{minHeight:44,flexDirection:'row',gap:8,alignItems:'center'}}>
        <Ionicons name={email===choice.value?'radio-button-on':'radio-button-off'} size={19} color={colors.accent}/><Text style={{...label,flex:1}}>{choice.label}</Text>
      </Pressable>)}
    </View>}
    {review.blocked&&<Text accessibilityRole="alert" style={label}>This app requires a verified email address that is unavailable.</Text>}
    {review.unsecureConfirmation&&row({label:'Allow data access for this unverified host',enabled:false},unsecure,setUnsecure)}
    {review.saveAccount&&row({label:'Also sign in on the original device',description:'Save this X-Center ID on the device that started the request.',enabled:false},save,setSave)}
    {!!error&&<Text accessibilityRole="alert" style={label}>{error}</Text>}
    <Pressable accessibilityRole="button" accessibilityState={{disabled:!canApprove,busy}} disabled={!canApprove}
      onPress={()=>decide({action:'approve',permission:[...selected],'data-permission':[...data],
        'confirm-permission':(review.permissions??[]).filter(item=>item.sensitive&&selected.has(item.key!)).map(item=>item.key!),
        email,save_account:save?'yes':undefined,'confirm-unsecure':unsecure?'yes':undefined})}
      style={({pressed})=>({minHeight:46,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.soft,borderWidth:1,borderColor:colors.accent,opacity:pressed||!canApprove ? 0.55 : 1})}>
      {busy?<ActivityIndicator color={colors.accent}/>:<Text style={{color:colors.accent,fontWeight:'700'}}>Approve sign-in</Text>}
    </Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>decide({action:'deny'})} style={{minHeight:44,justifyContent:'center',alignItems:'center'}}>
      <Text style={label}>Decline</Text>
    </Pressable>
  </Animated.View>;
}
