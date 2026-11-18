import Animated, {Easing, FadeIn, ReduceMotion} from 'react-native-reanimated';
import {introduction} from './introduction';
import {languages,parsePreferences,preferencesKey} from './preferences';
import {setAccountLanguage} from './account-locale';
import NativeSupport from './NativeSupport';
import { accountMessage } from './account-locale';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { openBrowserAsync } from 'expo-web-browser';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AccountEntry } from '@authnjs/expo';
import { sample } from './sample';
import NativeSections, { type NativeSection } from './NativeSections';
import { AccountRequestError, accountHost, clearSession, nativePasskeySession, nativeRequest, readSession, saveSession } from './native-account';
import type {Account} from './web-account';

type Icon = ComponentProps<typeof Ionicons>['name'];
const pages = [
  ['dashboard','Overview','person-circle-outline'],['profile','Profile','id-card-outline'],
  ['devices','Devices','phone-portrait-outline'],['security','Sign-in & security','key-outline'],
  ['apps','Apps','apps-outline'],['permissions','Permissions','shield-checkmark-outline'],
  ['storage','Data usage','server-outline'],['files','Files','folder-open-outline'],['friends','Friends','people-outline'],['mail','Mail','mail-outline'],
  ['mail-clients','Mail clients','mail-open-outline'],['settings','Settings','settings-outline'],['support','Support','help-circle-outline'],['admin','Admin','shield-outline'],['developer','Developer apps','code-slash-outline'],
] as const satisfies ReadonlyArray<readonly [string,string,Icon]>;
const copy:Record<string,string> = {
  dashboard:'Review your passkeys, profile, and connected apps.', profile:'Edit your photo, name, birthday, and email.',
  devices:'Review active sessions and sign out other devices.', security:'Manage enrolled passkeys and security keys.',
  apps:'Review connected apps and open the developer portal.', permissions:'Choose what each app can access.',
  storage:'Review file storage used by your account.', files:'Upload, download, and manage private files.',
  friends:'Manage invitations and shared files.',
  mail:'Read and send mail from your mailbox.', settings:'Manage your X-Center ID experience.',developer:'Register and manage your integrations.',support:'Send feedback or get help.',admin:'Manage accounts and support requests.',
};
const pref = 'authnjs.dashboard.onboarding.v1';

function NativeAccount() {
  const [reducedMotion,setReducedMotion]=useState(true);
  useEffect(()=>{void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',setReducedMotion);return ()=>subscription.remove();},[]);
  const systemTheme=useColorScheme();
  const [preferences,setPreferences]=useState(()=>parsePreferences(null));
  const [sidebar,setSidebar]=useState(false);
  setAccountLanguage(preferences.language);
  useEffect(()=>{void AsyncStorage.getItem(preferencesKey).then(raw=>{const value=parsePreferences(raw);setAccountLanguage(value.language);setPreferences(value);});},[]);
  function preference(value:typeof preferences){setAccountLanguage(value.language);setPreferences(value);void AsyncStorage.setItem(preferencesKey,JSON.stringify(value));}
  const dark=preferences.theme==='dark'||preferences.theme==='system'&&systemTheme==='dark';
  const colors=dark?{background:'#101522',panel:'#192132',ink:'#f3f6ff',muted:'#b1c1dc',accent:'#9ebcff',soft:'#23355d'}
    :{background:'#f6f8fc',panel:'#fff',ink:'#141b2e',muted:'#526078',accent:'#214fbe',soft:'#e9f0ff'};
  const [tab,setTab]=useState<(typeof pages)[number]>(pages[0]);
  const [token,setToken]=useState<string|null>(null);
  const [account,setAccount]=useState<Account|null>(null);
  const [locked,setLocked]=useState(false);
  const [loading,setLoading]=useState(true);
  const [pending,setPending]=useState(false);
  const [intro,setIntro]=useState(false);
  const [introStep,setIntroStep]=useState(0);
  const [developer,setDeveloper]=useState(false);
  const [sampleMode,setSampleMode]=useState(false);
  const [error,setError]=useState('');
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const taps=useRef(0);

  useEffect(()=>{
    let live=true;
    void AsyncStorage.getItem(pref).then(seen=>{
      if(live&&!seen){setIntro(true);return AsyncStorage.setItem(pref,'complete');}
    }).catch(()=>{});
    return ()=>{live=false;if(timer.current)clearTimeout(timer.current);};
  },[]);
  function expired(){
    setAccount(null);setToken(null);setLocked(false);setTab(pages[0]);
    void clearSession().catch(()=>{});
  }
  const load=async (value:string)=>{
    const result=await nativeRequest('me',value);
    if(result.locked){setToken(value);setAccount(null);setLocked(true);return;}
    if(!result.account){expired();return;}
    setLocked(false);setToken(value);setAccount(result.account);
  };
  useEffect(()=>{
    void readSession().then(value=>value?load(value):undefined)
      .catch(()=>setError('Could not restore your session. Sign in to try again.'))
      .finally(()=>setLoading(false));
  },[]);
  useEffect(()=>{
    if(!token)return;
    const listener=AppState.addEventListener('change',state=>{
      if(state==='active')void load(token).catch(()=>{});
    });
    return ()=>listener.remove();
  },[token]);
  async function useSession(value:string){
    await saveSession(value);
    await load(value);
    setTab(pages[0]);
    if(token&&token!==value)void nativeRequest('logout',token,{}).catch(()=>{});
  }
  async function signIn(signUp=false){
    if(pending)return;
    setPending(true);setError('');
    try {
      const value=await nativePasskeySession(signUp);
      if(value)await useSession(value);
    } catch(failure){
      setError(failure instanceof Error?failure.message:'Could not sign in.');
    } finally {setPending(false);}
  }
  async function signOut(){
    if(!token||pending)return;
    setPending(true);setError('');
    try {await nativeRequest('logout',token,{});expired();}
    catch(failure){
      if(failure instanceof AccountRequestError&&failure.status===403)expired();
      else setError('Could not sign out. Try again when you are online.');
    } finally {setPending(false);}
  }
  async function openPasskeyEnrollment(){
    try {await openBrowserAsync(accountHost+'/security');if(token)await load(token);}
    catch{setError('Could not open secure passkey enrollment.');}
  }
  function action(label:string,icon:Icon,press:()=>void){
    return <Pressable accessibilityRole="button" onPress={press} disabled={pending} style={({pressed})=>[
      styles.button,{backgroundColor:colors.soft,opacity:pressed || pending ? 0.65 : 1},
    ]}><Ionicons name={icon} size={18} color={colors.accent}/>
      <Text style={{color:colors.accent,fontWeight:'700'}}>{label}</Text></Pressable>;
  }
  return <SafeAreaView style={[styles.screen,{backgroundColor:colors.background}]}>
    <View style={styles.header}>
      {token&&account&&<Pressable accessibilityLabel="Open page sidebar" accessibilityRole="button" onPress={()=>setSidebar(true)} style={{padding:10}}><Ionicons name="menu-outline" size={26} color={colors.accent}/></Pressable>}
      <Ionicons name="id-card-outline" color={colors.accent} size={28}/>
      <Text style={[styles.brand,{color:colors.ink}]}>X-Center ID</Text>
    </View>
    {token&&account&&<Modal visible={sidebar} transparent animationType={reducedMotion?'none':'fade'} onRequestClose={()=>setSidebar(false)}>
      <SafeAreaView style={{flex:1,flexDirection:'row',backgroundColor:'#0006'}}>
        <View style={{width:280,maxWidth:'85%',backgroundColor:colors.panel,padding:14}}>
          {action('Close sidebar','close-outline',()=>setSidebar(false))}
          <ScrollView>{pages.filter(page=>page[0]!=='admin'||account.admin).map(page=><Pressable key={page[0]} accessibilityRole="button"
            onPress={()=>{setTab(page);setSidebar(false);setDeveloper(false);setSampleMode(false);}}
            style={{minHeight:48,flexDirection:'row',gap:12,alignItems:'center',paddingHorizontal:12,borderRadius:10,backgroundColor:tab[0]===page[0]?colors.soft:colors.panel}}>
            <Ionicons name={page[2]} size={21} color={colors.accent}/><Text style={{color:colors.ink}}>{accountMessage(page[0],page[1])}</Text>
          </Pressable>)}</ScrollView>
        </View><Pressable style={{flex:1}} accessibilityLabel="Close sidebar" onPress={()=>setSidebar(false)}/>
      </SafeAreaView>
    </Modal>}
    <ScrollView contentContainerStyle={styles.content}>
      {intro?<View style={[styles.card,{backgroundColor:colors.panel}]}>
        <Animated.View key={introStep} entering={FadeIn.duration(200).easing(Easing.bezier(.23,1,.32,1)).reduceMotion(ReduceMotion.System)}>
          <Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>{introduction[introStep].title}</Text>
          <Text style={{color:colors.muted}}>{introduction[introStep].description}</Text>
        </Animated.View>
        <Text style={{color:colors.muted}}>{introStep+1} of {introduction.length}</Text>
        {introStep>0&&action('Back','arrow-back-outline',()=>setIntroStep(introStep-1))}
        {action(introStep===introduction.length-1?'Open dashboard':'Next','arrow-forward-outline',()=>introStep===introduction.length-1?setIntro(false):setIntroStep(introStep+1))}
        {action('Skip introduction','close-outline',()=>setIntro(false))}
      </View>:<>
        {loading?<ActivityIndicator accessibilityLabel="Opening account"/>:locked&&token?
          <View style={[styles.card,{backgroundColor:colors.panel}]}>
            <Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>Account locked</Text>
            <NativeSupport token={token} colors={colors}/>
            {action('Check again','refresh-outline',()=>void load(token).catch(()=>setError('Could not check your account.')))}
            {action('Sign out','log-out-outline',()=>void signOut())}
          </View>:!token||!account?
          <AccountEntry onSignIn={()=>void signIn()} onCreateAccount={()=>void signIn(true)} pending={pending} error={error}
            onUsernameSubmit={username=>nativeRequest('login/username',undefined,{username})}
            onCodeSubmit={async(ticket,code)=>{const session=await nativeRequest('login/code',undefined,{ticket,code});await useSession(session.token);}}/>:
          <><Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>{accountMessage(tab[0],tab[1])}</Text>
          <Text style={{color:colors.muted}}>{tab[0]==='dashboard'?accountMessage('overviewSummary',copy.dashboard):copy[tab[0]]}</Text>
          {tab[0]==='settings'?<View style={[styles.card,{backgroundColor:colors.panel}]}>
          <Text style={{color:colors.ink,fontWeight:'700'}}>Theme</Text>
          <View style={styles.preferenceChoices}>{(['system','light','dark'] as const).map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:preferences.theme===value}} onPress={()=>preference({...preferences,theme:value})} style={[styles.button,{backgroundColor:preferences.theme===value?colors.soft:colors.panel}]}><Text style={{color:colors.ink}}>{value}</Text></Pressable>)}</View>
          <Text style={{color:colors.ink,fontWeight:'700'}}>Language</Text>
          <View style={styles.preferenceChoices}>{languages.map(([id,label])=><Pressable key={id} accessibilityRole="radio" accessibilityState={{checked:preferences.language===id}} onPress={()=>preference({...preferences,language:id})} style={[styles.button,{backgroundColor:preferences.language===id?colors.soft:colors.panel}]}><Text style={{color:colors.ink}}>{label}</Text></Pressable>)}</View>
          {action('Mail app access','mail-open-outline',()=>setTab(pages.find(page=>page[0]==='mail-clients')!))}
          {action('Support','help-circle-outline',()=>setTab(pages.find(page=>page[0]==='support')!))}
          {action('Developer documentation','book-outline',()=>void openBrowserAsync(accountHost+'/docs'))}
          {action('View introduction' ,'information-circle-outline',()=>{setIntroStep(0);setIntro(true);})}
          {action('Version 0.1.0','code-slash-outline',()=>{
            if(++taps.current===3){setDeveloper(true);taps.current=0;}
            if(timer.current)clearTimeout(timer.current);
            timer.current=setTimeout(()=>{setDeveloper(false);setSampleMode(false);taps.current=0;},30_000);
          })}
          {developer&&action(sampleMode?'Exit sample dashboard':'Open sample dashboard','eye-outline',()=>setSampleMode(!sampleMode))}
          {sampleMode&&<View style={styles.card}><Text style={{color:colors.ink,fontWeight:'700'}}>Sample data</Text>
            {Object.values(sample).flat().map(item=><Text key={item.id} style={{color:colors.muted}}>{item.title}</Text>)}</View>}
          {action('Sign out','log-out-outline',()=>void signOut())}
        </View>:<NativeSections key={tab[0]} section={tab[0] as NativeSection} account={account} token={token} colors={colors}
          expired={()=>void load(token).catch(()=>setError('Could not check your account.'))} reload={()=>load(token)} passkeys={()=>void openPasskeyEnrollment()}
          navigate={id=>{const next=pages.find(page=>page[0]===id);if(next)setTab(next);}}/>}
        {error&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{error}</Text>}</>}
      </>}
    </ScrollView>
    {token&&account&&<View accessibilityRole="tablist" style={{flexDirection:'row',borderTopWidth:1,borderColor:colors.soft,backgroundColor:colors.panel,paddingVertical:8}}>
      {(['dashboard','apps','settings',...(account.admin?['admin']:[])]).map(id=>{const page=pages.find(page=>page[0]===id)!;
        const selected=id==='dashboard'?!['apps','permissions','developer','settings','support','mail-clients','admin'].includes(tab[0]):id==='apps'?['apps','permissions','developer'].includes(tab[0]):id==='settings'?['settings','support','mail-clients'].includes(tab[0]):tab[0]==='admin';
        return <Pressable key={id} accessibilityRole="tab" accessibilityState={{selected}} onPress={()=>{setTab(page);setDeveloper(false);setSampleMode(false);taps.current=0;}}
          style={{flex:1,alignItems:'center',justifyContent:'center',minHeight:52,gap:3,backgroundColor:selected?colors.soft:colors.panel,borderRadius:12}}>
          <Ionicons name={page[2]} size={23} color={selected?colors.accent:colors.muted}/><Text style={{color:selected?colors.accent:colors.muted,fontSize:12}}>{id==='dashboard'?'Account':accountMessage(id,page[1])}</Text>
        </Pressable>;})}
    </View>}
  </SafeAreaView>;
}

export default function App(){return <SafeAreaProvider><NativeAccount/></SafeAreaProvider>;}

const styles=StyleSheet.create({
  screen:{flex:1},
  header:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:20,paddingVertical:15},
  brand:{fontSize:22,fontWeight:'800',letterSpacing:-.7},
  preferenceChoices:{flexDirection:'row',flexWrap:'wrap',gap:6},
  tabs:{gap:7,paddingHorizontal:14,paddingVertical:8},
  tab:{paddingHorizontal:13,paddingVertical:11,borderRadius:13,minHeight:48,gap:7,flexDirection:'row',alignItems:'center'},
  content:{width:'100%',maxWidth:720,alignSelf:'center',paddingHorizontal:18,paddingVertical:26,gap:14},
  title:{fontSize:31,fontWeight:'800',letterSpacing:-.9},
  card:{gap:12,padding:17,borderRadius:20},
  button:{alignSelf:'flex-start',minHeight:48,alignItems:'center',flexDirection:'row',paddingHorizontal:14,
    paddingVertical:10,borderRadius:12,gap:8},
});
