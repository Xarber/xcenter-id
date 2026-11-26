import {useDialog} from './dialog-model';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { deviceSignInUrl, isDeviceCode, normalizeDeviceCode } from './device-link';
import { accountHost } from './native-account';

export default function DeviceSignIn({colors,back}: {colors:{ink:string;accent:string;muted:string;soft:string;line:string};back:()=>void}) {
  const showDialog=useDialog();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [characters,setCharacters] = useState<string[]>(()=>Array(6).fill(''));
  const inputs=useRef<Array<ComponentRef<typeof TextInput>|null>>([]);
  const code=characters.join('');
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
    try { await openBrowserAsync(url, {presentationStyle: WebBrowserPresentationStyle.PAGE_SHEET}); }
    catch { setStatus('Could not open the sign-in page.'); }
    finally { opening.current = false; }
  }

  function review(url:string) {
    if (opening.current) return;
    opening.current = true;
    setScanning(false);
    const dismiss = () => { opening.current = false; };
    showDialog('Review device sign-in?', 'Continue only if the code is on a device you want to sign in. You’ll review the app on X-Center ID before approving.', [
      {text:'Cancel',style:'cancel',onPress:dismiss},
      {text:'Review sign-in',onPress:()=>{dismiss();void open(url);}},
    ]);
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
      <CameraView zoom={zoom} style={{height:240,borderRadius:16,overflow:'hidden'}} barcodeScannerSettings={{barcodeTypes:['qr']}}
        onBarcodeScanned={({data})=>{
          const url=deviceSignInUrl(data,accountHost);
          if (url) review(url);
          else setStatus('Scan the X-Center ID QR code shown on your device.');
        }}/>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {[{label:'1×',value:0},{label:'Closer',value:0.18},{label:'Closest',value:0.35}].map(level=>
          <Pressable key={level.label} accessibilityRole="button" accessibilityLabel={'Camera zoom: '+level.label}
            accessibilityState={{selected:zoom===level.value}} onPress={()=>setZoom(level.value)}
            style={{minHeight:44,justifyContent:'center',paddingHorizontal:12,borderRadius:12,
              borderWidth:1,borderColor:zoom===level.value?colors.accent:colors.line,backgroundColor:colors.soft}}>
            <Text style={{color:colors.accent,fontWeight:'700'}}>{level.label}</Text>
          </Pressable>)}
      </View>
      {action('Close scanner',()=>{setScanning(false);setStatus('');})}
    </> : action('Scan QR code',()=>void scan())}
    <Text style={{color:colors.ink,fontWeight:'700'}}>Enter a device code</Text>
    <View style={{flexDirection:'row',gap:6,maxWidth:350}}>
      {characters.map((character,index)=><TextInput key={index}
        ref={input=>{inputs.current[index]=input;}} accessibilityLabel={`Character ${index+1} of 6`}
        value={character} selectTextOnFocus autoCapitalize="characters" autoCorrect={false}
        autoComplete={index===0?'one-time-code':'off'} returnKeyType="go"
        onKeyPress={({nativeEvent})=>{
          if(index>0&&nativeEvent.key==='Backspace'&&!character)inputs.current[index-1]?.focus();
        }}
        onChangeText={value=>{
          const text=normalizeDeviceCode(value);
          const start=text.length===6?0:index;
          const letters=text.slice(0,6-start);
          setCharacters(previous=>{
            const next=[...previous];
            if(!letters)next[index]='';
            else Array.from(letters).forEach((letter,offset)=>{next[start+offset]=letter;});
            return next;
          });
          if(letters)inputs.current[Math.min(start+letters.length,5)]?.focus();
        }}
        onSubmitEditing={()=>{if(isDeviceCode(code))review(accountHost+'/device?code='+code);}}
        style={{flex:1,minWidth:0,minHeight:52,borderWidth:1,borderColor:colors.line,borderRadius:10,
          backgroundColor:colors.soft,color:colors.ink,fontSize:22,fontWeight:'700',textAlign:'center',paddingHorizontal:0}}/>
      )}
    </View>
    <Pressable accessibilityRole="button" disabled={!isDeviceCode(code)} onPress={()=>review(accountHost+'/device?code='+code)}
      style={({pressed})=>({minHeight:44,justifyContent:'center',paddingHorizontal:12,borderRadius:12,backgroundColor:colors.soft,opacity:pressed||!isDeviceCode(code)?0.55:1})}>
      <Text style={{color:colors.accent,fontWeight:'700'}}>Review sign-in</Text>
    </Pressable>
    {!!status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
