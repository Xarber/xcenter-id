import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { deviceSignInUrl, isDeviceCode, normalizeDeviceCode } from './device-link';
import { accountHost, nativeRequest } from './native-account';
import DeviceApprovalReview, {type DeviceDecision, type DeviceReview, type ReviewColors} from './DeviceApprovalReview';

export default function DeviceSignIn({token,colors,back}: {token:string;colors:ReviewColors;back:()=>void}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [characters,setCharacters] = useState<string[]>(()=>Array(6).fill(''));
  const inputs=useRef<Array<ComponentRef<typeof TextInput>|null>>([]);
  const code=characters.join('');
  const [status, setStatus] = useState('');
  const opening = useRef(false);
  const [review,setReview]=useState<DeviceReview|null>(null);
  const [busy,setBusy]=useState(false);
  const [resolved,setResolved]=useState<boolean|null>(null);
  const action = (label:string, onPress:()=>void) =>
    <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>({
      minHeight:44,justifyContent:'center',paddingHorizontal:12,borderRadius:12,backgroundColor:colors.soft,opacity:pressed ? 0.7 : 1,
    })}><Text style={{color:colors.accent,fontWeight:'700'}}>{label}</Text></Pressable>;

  async function open(url:string) {
    if (opening.current) return;
    opening.current = true;
    setScanning(false);
    setStatus('');
    setBusy(true);
    Keyboard.dismiss();
    try {
      const review=new URL(url);
      const request=review.pathname==='/device'?{code:review.searchParams.get('code')}:{target:review.pathname};
      setReview(await nativeRequest('device/review',token,request));
    }
    catch(error) { setStatus(error instanceof Error?error.message:'Could not load this sign-in request.'); }
    finally { opening.current = false;setBusy(false); }
  }

  async function decide(decision:DeviceDecision){
    if(!review||opening.current)return;
    opening.current=true;setBusy(true);setStatus('');
    try{
      const result=await nativeRequest('device/review',token,{...decision,review:review.review});
      setReview(null);setResolved(result.approved);setCharacters(Array(6).fill(''));
    }catch(error){setStatus(error instanceof Error?error.message:'Could not complete this request.');}
    finally{opening.current=false;setBusy(false);}
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

  if(resolved!==null)return <View style={{gap:14}}>
    <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700',fontSize:22}}>{resolved?'Sign-in approved':'Sign-in declined'}</Text>
    {resolved&&<Text style={{color:colors.muted}}>Return to the device where you started.</Text>}
    {action('Done',back)}
  </View>;
  if(review)return <View style={{gap:14}}>
    {!busy&&action('Back to code entry',()=>{setReview(null);setStatus('');})}
    <DeviceApprovalReview key={review.review} review={review} colors={colors} busy={busy} error={status} decide={value=>void decide(value)}/>
  </View>;
  return <View style={{gap:14}}>
    {action('Back to Devices',back)}
    <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Sign in on another device</Text>
    <Text style={{color:colors.muted}}>Use the code shown on the other device to approve an account or app sign-in.</Text>
    {scanning ? <>
      <CameraView zoom={zoom} style={{height:240,borderRadius:16,overflow:'hidden'}} barcodeScannerSettings={{barcodeTypes:['qr']}}
        onBarcodeScanned={({data})=>{
          const url=deviceSignInUrl(data,accountHost);
          if (url) void open(url);
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
        onSubmitEditing={()=>{if(isDeviceCode(code))void open(accountHost+'/device?code='+code);}}
        style={{flex:1,minWidth:0,minHeight:52,borderWidth:1,borderColor:colors.line,borderRadius:10,
          backgroundColor:colors.soft,color:colors.ink,fontSize:22,fontWeight:'700',textAlign:'center',paddingHorizontal:0}}/>
      )}
    </View>
    <Pressable accessibilityRole="button" disabled={busy||!isDeviceCode(code)} onPress={()=>void open(accountHost+'/device?code='+code)}
      style={({pressed})=>({minHeight:44,justifyContent:'center',paddingHorizontal:12,borderRadius:12,backgroundColor:colors.soft,opacity:pressed||!isDeviceCode(code)?0.55:1})}>
      {busy?<ActivityIndicator color={colors.accent}/>:<Text style={{color:colors.accent,fontWeight:'700'}}>Review sign-in</Text>}
    </Pressable>
    {!!status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
