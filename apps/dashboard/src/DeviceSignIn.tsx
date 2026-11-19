import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { deviceSignInUrl } from './device-link';
import { accountHost } from './native-account';

export default function DeviceSignIn({colors}: {colors:{ink:string;accent:string;muted:string;soft:string}}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
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

  return <View style={{gap:10}}>
    <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Sign in on another device</Text>
    <Text style={{color:colors.muted}}>Use the code shown on your TV or other device.</Text>
    {scanning ? <>
      <CameraView style={{height:240,borderRadius:16,overflow:'hidden'}} barcodeScannerSettings={{barcodeTypes:['qr']}}
        onBarcodeScanned={({data})=>{
          const url=deviceSignInUrl(data,accountHost);
          if (url) void open(url);
          else setStatus('Scan the X-Center ID QR code shown on your device.');
        }}/>
      {action('Close scanner',()=>{setScanning(false);setStatus('');})}
    </> : action('Scan QR code',()=>void scan())}
    {action('Enter a device code',()=>void open(accountHost+'/device'))}
    {!!status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
