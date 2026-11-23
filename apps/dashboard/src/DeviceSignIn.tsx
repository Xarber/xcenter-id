import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { deviceSignInUrl, isDeviceCode, normalizeDeviceCode } from './device-link';
import { accountHost } from './native-account';

export default function DeviceSignIn({colors,back}: {colors:{ink:string;accent:string;muted:string;soft:string;line:string};back:()=>void}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [code,setCode] = useState('');
  const [focused,setFocused] = useState(false);
  const [status, setStatus] = useState('');
  const opening = useRef(false);
  const action = (label:string, onPress:()=>void) =>
    <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>({
      minHeight:44,justifyContent:'center',paddingHorizontal:12,borderRadius:12,backgroundColor:colors.soft,opacity:pressed ? 0.7 : 1,
    })}><Text style={{color:colors.accent,fontWeight:'700'}}>{label}</Text></Pressable>;

  async function open(url:string) {
    if (opening.current) return;
    opening.current = true;
    setScanning(false);
    setStatus('');
    try { await Linking.openURL(url); }
    catch { setStatus('Could not open the sign-in page.'); }
    finally { opening.current = false; }
  }

  function review(url:string) {
    if (opening.current) return;
    opening.current = true;
    setScanning(false);
    const dismiss = () => { opening.current = false; };
    Alert.alert('Review device sign-in?', 'Continue only if the code is on a device you want to sign in. You’ll review the app on X-Center ID before approving.', [
      {text:'Cancel',style:'cancel',onPress:dismiss},
      {text:'Review sign-in',onPress:()=>{dismiss();void open(url);}},
    ], {cancelable:true,onDismiss:dismiss});
  }

  async function scan() {
    if (!permission?.granted) {
      try {
        if (!(await requestPermission()).granted) {
          setStatus('Camera access is unavailable. You can still enter the code.');
          return;
        }
      } catch { setStatus('Could not open the camera. Enter the code instead.'); return; }
    }
    setStatus('');
    setScanning(true);
  }

  return <View style={{gap:14}}>
    {action('Back to Devices',back)}
    <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Sign in on another device</Text>
    <Text style={{color:colors.muted}}>Use the code shown on your TV or other device.</Text>
    {scanning ? <>
      <CameraView style={{height:240,borderRadius:16,overflow:'hidden'}} barcodeScannerSettings={{barcodeTypes:['qr']}}
        onBarcodeScanned={({data})=>{
          const url=deviceSignInUrl(data,accountHost);
          if (url) review(url);
          else setStatus('Scan the X-Center ID QR code shown on your device.');
        }}/>
      {action('Close scanner',()=>{setScanning(false);setStatus('');})}
    </> : action('Scan QR code',()=>void scan())}
    <Text style={{color:colors.ink,fontWeight:'700'}}>Enter a device code</Text>
    <View style={{flexDirection:'row',gap:6,position:'relative',maxWidth:350}}>
      {Array.from({length:6},(_,index)=><View key={index} accessible={false} importantForAccessibility="no-hide-descendants"
        style={{flex:1,minHeight:52,borderWidth:1,borderColor:focused&&index===Math.min(code.length,5)?colors.accent:colors.line,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:colors.soft}}>
        <Text style={{color:colors.ink,fontSize:22,fontWeight:'700'}}>{code[index]}</Text>
      </View>)}
      <TextInput accessibilityLabel="Six-character device code" value={code} onChangeText={value=>setCode(normalizeDeviceCode(value))}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} autoCapitalize="characters" autoCorrect={false}
        autoComplete="one-time-code" caretHidden selectionColor="transparent" returnKeyType="go"
        onSubmitEditing={()=>{if(isDeviceCode(code))review(accountHost+'/device?code='+code);}}
        style={{position:'absolute',left:0,right:0,top:0,bottom:0,color:'transparent',fontSize:20}}/>
    </View>
    <Pressable accessibilityRole="button" disabled={!isDeviceCode(code)} onPress={()=>review(accountHost+'/device?code='+code)}
      style={({pressed})=>({minHeight:44,justifyContent:'center',paddingHorizontal:12,borderRadius:12,backgroundColor:colors.soft,opacity:pressed||!isDeviceCode(code)?0.55:1})}>
      <Text style={{color:colors.accent,fontWeight:'700'}}>Review sign-in</Text>
    </Pressable>
    {!!status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
