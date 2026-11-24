import {developerModeKey,useDeveloperPanel} from './developer-panel';
import { dashboardThemes } from './native-surfaces';
import ReleaseNotes from './ReleaseNotes';
import {currentRelease,onboardingKey,releaseAnnouncement,releaseByVersion,seenReleaseKey} from './release-info';
import SignInSky from './SignInSky';
import {StatusBar} from 'react-native';
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
import { AccessibilityInfo, ActivityIndicator, Alert, AppState, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AccountEntry } from '@authnjs/expo';
import { sample } from './sample';
import NativeSections, { type NativeSection } from './NativeSections';
import { AccountRequestError, accountHost, nativePasskeySession, nativeRequest, nativeReauthenticate, readStoredAccounts, saveStoredAccounts, type StoredAccount } from './native-account';
import type {Account} from './web-account';

type Icon = ComponentProps<typeof Ionicons>['name'];
const pages = [
  ['dashboard','Overview','person-circle-outline'],['profile','Profile','id-card-outline'],
  ['devices','Devices','phone-portrait-outline'],['device-signin','Device sign-in','qr-code-outline'],['security','Sign-in & security','key-outline'],
  ['apps','Apps','apps-outline'],['permissions','Permissions','shield-checkmark-outline'],
  ['storage','Data usage','server-outline'],['files','Files','folder-open-outline'],['friends','Friends','people-outline'],['mail','Mail','mail-outline'],
  ['mail-clients','Mail clients','mail-open-outline'],['settings','Settings','settings-outline'],['support','Support','help-circle-outline'],['admin','Admin','shield-outline'],['developer','Developer apps','code-slash-outline'],
] as const satisfies ReadonlyArray<readonly [string,string,Icon]>;
const copy:Record<string,string> = {
  dashboard:'Review your passkeys, profile, and connected apps.', profile:'Edit your photo, name, birthday, and email.',
  'device-signin':'Use a QR code or enter the code shown on your other device.',
  devices:'Review active sessions and sign out other devices.', security:'Manage enrolled passkeys and security keys.',
  apps:'Review connected apps and open the developer portal.', permissions:'Choose what each app can access.',
  storage:'Review file storage used by your account.', files:'Upload, download, and manage private files.',
  friends:'Manage invitations and shared files.',
  mail:'Read and send mail from your mailbox.', settings:'Manage your X-Center ID experience.',developer:'Register and manage your integrations.',support:'Send feedback or get help.',admin:'Manage accounts and support requests.',
};


function NativeAccount() {
  const [reducedMotion,setReducedMotion]=useState(true);
  useEffect(()=>{void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',setReducedMotion);return ()=>subscription.remove();},[]);
  const systemTheme=useColorScheme();
  const [preferences,setPreferences]=useState(()=>parsePreferences(null));
  const [sidebar,setSidebar]=useState(false);
  const [switching,setSwitching]=useState(false);
  const [picker,setPicker]=useState<'theme'|'language'|null>(null);
  const [deleteName,setDeleteName]=useState<string|null>(null);
  const [stored,setStored]=useState<StoredAccount[]>([]);
  const storedRef=useRef<StoredAccount[]>([]);
  const activeRef=useRef<string|null>(null);
  const setStoredAccounts=(value:StoredAccount[])=>{storedRef.current=value;setStored(value);};
  setAccountLanguage(preferences.language);
  useEffect(()=>{void AsyncStorage.getItem(preferencesKey).then(raw=>{const value=parsePreferences(raw);setAccountLanguage(value.language);setPreferences(value);});},[]);
  function preference(value:typeof preferences){setAccountLanguage(value.language);setPreferences(value);void AsyncStorage.setItem(preferencesKey,JSON.stringify(value));}
  const dark=preferences.theme==='dark'||preferences.theme==='system'&&systemTheme==='dark';
  const colors=dashboardThemes[dark?'dark':'light'];
  const [tab,setTab]=useState<(typeof pages)[number]>(pages[0]);
  const [token,setToken]=useState<string|null>(null);
  const [account,setAccount]=useState<Account|null>(null);
  const [locked,setLocked]=useState(false);
  const [loading,setLoading]=useState(true);
  const [pending,setPending]=useState(false);
  const [pendingAction,setPendingAction]=useState<'passkey'|'signup'>('passkey');
  const [intro,setIntro]=useState(false);
  const [releaseNotes,setReleaseNotes]=useState<string|null>(null);
  const [releaseRows,setReleaseRows]=useState<string[][]>([]);
  const [startup,setStartup]=useState<{onboarded:string|null;seen:string|null}|null>(null);
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  const [incomingVersion,setIncomingVersion]=useState<string|null>(null);
  const [entryBusy,setEntryBusy]=useState(false);
  const [introStep,setIntroStep]=useState(0);
  const [developer,setDeveloper]=useState(false);
  const developerPanel=useDeveloperPanel();
  useEffect(()=>{void AsyncStorage.getItem(developerModeKey).then(value=>setDeveloper(value==='on')).catch(()=>{});},[]);
  useEffect(()=>{
    if(tab[0]!=='settings'||!foreground)developerPanel.hide();
  },[tab,foreground,developerPanel.hide]);
  function toggleDeveloper(enabled:boolean){
    setDeveloper(enabled);
    if(!enabled)setSampleMode(false);
    void AsyncStorage.setItem(developerModeKey,enabled?'on':'off').catch(()=>{});
  }
  const [sampleMode,setSampleMode]=useState(false);
  const [error,setError]=useState('');
  const [releaseBack,setReleaseBack]=useState<string|null>(null);

  useEffect(()=>{
    let live=true;
    void Promise.all([AsyncStorage.getItem(onboardingKey),AsyncStorage.getItem(seenReleaseKey)]).then(([onboarded,seen])=>{
      if(live)setStartup({onboarded,seen});
    }).catch(()=>{if(live)setStartup({onboarded:null,seen:null});});
    return ()=>{live=false;};
  },[]);
  useEffect(()=>{
    const update=(url:string)=>{
      const version=/^authnjs-dashboard:\/\/(?:\/)?changelog\/(\d+\.\d+\.\d+)$/.exec(url)?.[1];
      if(version&&releaseByVersion(version))setIncomingVersion(version);
    };
    void Linking.getInitialURL().then(value=>{if(value)update(value);}).catch(()=>{});
    const subscription=Linking.addEventListener('url',event=>update(event.url));
    const visibility=AppState.addEventListener('change',state=>setForeground(state==='active'));
    return ()=>{subscription.remove();visibility.remove();};
  },[]);
  useEffect(()=>{
    if(loading||pending||entryBusy||locked||!foreground||!startup)return;
    if(incomingVersion){
      setReleaseNotes(incomingVersion);setIncomingVersion(null);setStartup(null);return;
    }
    if(!account?.profile)return;
    if(!startup.onboarded)setIntro(true);
    else{
      const rows=releaseAnnouncement(startup.seen);
      if(rows.length){setReleaseRows(rows);setReleaseNotes('latest');}
    }
    setStartup(null);
  },[loading,pending,entryBusy,locked,foreground,startup,incomingVersion,account?.profile]);
  useEffect(()=>{
    if(!loading&&!pending&&foreground&&incomingVersion&&!startup){
      setReleaseNotes(incomingVersion);setIncomingVersion(null);
    }
  },[loading,pending,foreground,incomingVersion,startup]);
  function acknowledge(){
    void AsyncStorage.setItem(seenReleaseKey,currentRelease.version).catch(()=>{});
  }
  function dismissIntro(){
    setIntro(false);
    void AsyncStorage.multiSet([[onboardingKey,'complete'],[seenReleaseKey,currentRelease.version]]).catch(()=>{});
  }
  function openRelease(mode:string|null){
    if(releaseNotes==='latest')acknowledge();
    setReleaseBack(releaseNotes==='history'&&mode!=='history'?releaseNotes:null);
    setReleaseNotes(mode);
  }
  async function remember(value:string|null,entries:StoredAccount[]){
    await saveStoredAccounts({active:value,entries});
    activeRef.current=value;
    setStoredAccounts(entries);
  }
  async function forget(value:string){
    if(activeRef.current!==value)return;
    await remember(null,storedRef.current.filter(entry=>entry.token!==value));
    setAccount(null);setToken(null);setLocked(false);setTab(pages[0]);developerPanel.hide();setSampleMode(false);
  }
  async function load(value:string,select=false){
    const result=await nativeRequest('me',value);
    if(!select&&activeRef.current!==value)return;
    if(result.locked){
      if(select)await remember(value,storedRef.current);
      setToken(value);setAccount(null);setLocked(true);return;
    }
    if(!result.account){
      if(select&&activeRef.current!==value){
        await remember(activeRef.current,storedRef.current.filter(entry=>entry.token!==value));
        throw new Error('This sign-in expired. Sign in again.');
      }
      await forget(value);return;
    }
    const person=result.account.profile;
    const id=result.account.id??person?.username??value;
    const entry={id,token:value,name:person?[person.givenName,person.surname].join(' '):result.account.name,
      username:person?.username??'',hasPicture:!!person?.hasPicture};
    const existing=storedRef.current.find(item=>item.id===id||item.token===value);
    if(!existing&&storedRef.current.length>=3){
      if(select)void nativeRequest('logout',value,{}).catch(()=>{});
      throw new Error('Sign out of one account before adding another.');
    }
    const next=existing?storedRef.current.map(item=>item===existing?entry:item):[...storedRef.current,entry];
    if(select||JSON.stringify(next)!==JSON.stringify(storedRef.current))await remember(value,next);
    if(existing&&existing.token!==value)void nativeRequest('logout',existing.token,{}).catch(()=>{});
    setLocked(false);setToken(value);setAccount(result.account);
  }
  useEffect(()=>{
    void readStoredAccounts().then(async saved=>{
      setStoredAccounts(saved.entries);activeRef.current=saved.active;
      if(saved.active)await load(saved.active);
    }).catch(()=>setError('Could not restore your session. Sign in to try again.'))
      .finally(()=>setLoading(false));
  },[]);
  useEffect(()=>{
    if(!token)return;
    const listener=AppState.addEventListener('change',state=>{
      if(state==='active'&&!pending)void load(token).catch(()=>{});
    });
    return ()=>listener.remove();
  },[token,pending]);
  async function useSession(value:string){
    await load(value,true);
    setSidebar(false);setSwitching(false);setTab(pages[0]);developerPanel.hide();setSampleMode(false);
  }
  async function selectAccount(value:string){
    if(pending)return;
    setPending(true);setError('');
    try{await useSession(value);}
    catch(error){setError(error instanceof Error?error.message:'Could not switch accounts.');}
    finally{setPending(false);}
  }
  async function signIn(signUp=false,adding=false){
    if(pending||storedRef.current.length>=3)return;
    setPending(true);setError('');
    try {
      const value=await nativePasskeySession(signUp,adding);
      if(value)await useSession(value);
    } catch(failure){
      setError(failure instanceof Error?failure.message:'Could not sign in.');
    } finally {setPending(false);}
  }
  async function signOut(){
    if(!token||pending)return;
    setPending(true);setError('');
    try {await nativeRequest('logout',token,{});await forget(token);setSidebar(false);}
    catch(failure){
      if(failure instanceof AccountRequestError&&failure.status===403)await forget(token);
      else setError('Could not sign out. Try again when you are online.');
    } finally {setPending(false);}
  }
  async function deleteAccount(){
    if(!token||!account?.profile||deleteName!==account.profile.username)return;
    setPending(true);setError('');
    try{
      if(!await nativeReauthenticate(token))return;
      await nativeRequest('delete',token,{confirmation:deleteName});
      await forget(token);setDeleteName(null);
    }catch(failure){setError(failure instanceof Error?failure.message:'Could not delete the account.');}
    finally{setPending(false);}
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
  function accountRows(entries:StoredAccount[]){
    return <View style={{gap:8}}>
      {entries.map(entry=><Pressable key={entry.id} accessibilityRole="button" onPress={()=>void selectAccount(entry.token)}
        style={{minHeight:48,flexDirection:'row',alignItems:'center',gap:10}}>
        {entry.hasPicture?<Image source={{uri:accountHost+'/account/avatar',headers:{Authorization:'Bearer '+entry.token,'X-AuthNJS-Native':'account-manager'}}}
          style={{width:36,height:36,borderRadius:18}}/>:<Ionicons name="person-circle-outline" size={36} color={colors.accent}/>}
        <View style={{flex:1}}><Text style={{fontWeight:'700',color:colors.ink}}>{entry.name}</Text>
          {!!entry.username&&<Text style={{color:colors.muted}}>@{entry.username}</Text>}</View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
      </Pressable>)}
      {stored.length<3&&action('Add another account','add-outline',()=>void signIn(false,true))}
    </View>;
  }
  const signedOut=!loading&&!locked&&(!token||!account);
  if(intro)return <SafeAreaView style={[styles.screen,{backgroundColor:colors.background}]}>
    <ScrollView contentContainerStyle={[styles.content,styles.tour]}>
      <Image source={require('../public/authnjs-192.png')} accessibilityLabel="X-Center ID" style={styles.tourLogo}/>
      <Animated.View style={{gap:12}} key={introStep} entering={FadeIn.duration(180).easing(Easing.bezier(.23,1,.32,1)).reduceMotion(ReduceMotion.System)}>
        <Ionicons name={(['person-circle-outline','apps-outline','shield-checkmark-outline','code-slash-outline'] as const)[introStep]} size={35} color={colors.accent}/>
        <Text accessibilityLiveRegion="polite" style={{color:colors.muted}}>Step {introStep+1} of {introduction.length}</Text>
        <Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>{introduction[introStep].title}</Text>
        <Text style={{color:colors.muted,fontSize:17,lineHeight:25}}>{introduction[introStep].description}</Text>
      </Animated.View>
      <View aria-hidden style={{flexDirection:'row',gap:6}}>{introduction.map((step,index)=><View key={step.title}
        style={{flex:1,height:4,borderRadius:6,backgroundColor:index<=introStep?colors.accent:colors.line}}/>)}</View>
      <View style={styles.preferenceChoices}>
        {action('Skip','close-outline',dismissIntro)}
        {introStep>0&&action('Back','arrow-back-outline',()=>setIntroStep(introStep-1))}
        {action(introStep===introduction.length-1?'Open app':'Continue','arrow-forward-outline',()=>introStep===introduction.length-1?dismissIntro():setIntroStep(introStep+1))}
      </View>
    </ScrollView>
  </SafeAreaView>;
  return <SafeAreaView style={[styles.screen,{backgroundColor:signedOut?'#101c36':colors.background}]}>
    <StatusBar barStyle={signedOut||dark?'light-content':'dark-content'}/>
    {signedOut&&<SignInSky animate={!reducedMotion&&foreground}/>}
    <View style={styles.header}>
      {token&&account&&<Pressable accessibilityLabel="Open page sidebar" accessibilityRole="button" onPress={()=>setSidebar(true)} style={{padding:10}}><Ionicons name="menu-outline" size={26} color={colors.accent}/></Pressable>}
      <Ionicons name="id-card-outline" color={signedOut?'#a9c6ff':colors.accent} size={28}/>
      <Text style={[styles.brand,{color:signedOut?'#f5f8ff':colors.ink}]}>X-Center ID</Text>
    </View>
    {token&&account&&<Modal visible={sidebar} transparent animationType={reducedMotion?'none':'fade'} onRequestClose={()=>setSidebar(false)}>
      <SafeAreaView style={{flex:1,flexDirection:'row',backgroundColor:'#0006'}}>
        <View style={{width:280,maxWidth:'85%',backgroundColor:colors.panel,padding:14}}>
          {action('Close sidebar','close-outline',()=>setSidebar(false))}
          <ScrollView>{pages.filter(page=>page[0]!=='admin'||account.admin).map(page=><Pressable key={page[0]} accessibilityRole="button"
            onPress={()=>{setTab(page);setSidebar(false);setSampleMode(false);}}
            style={{minHeight:48,flexDirection:'row',gap:12,alignItems:'center',paddingHorizontal:12,borderRadius:10,backgroundColor:tab[0]===page[0]?colors.soft:colors.panel}}>
            <Ionicons name={page[2]} size={21} color={colors.accent}/><Text style={{color:colors.ink}}>{accountMessage(page[0],page[1])}</Text>
          </Pressable>)}</ScrollView>
          {switching&&<View style={[styles.card,{backgroundColor:colors.soft}]}>{accountRows(stored.filter(entry=>entry.token!==token))}</View>}
          <View style={{flexDirection:'row',alignItems:'center',gap:8,borderTopWidth:1,borderColor:colors.line}}>
            <Pressable accessibilityRole="button" accessibilityState={{expanded:switching}} onPress={()=>setSwitching(!switching)}
              style={{minHeight:48,flex:1,flexDirection:'row',alignItems:'center',gap:8}}>
              {account.profile?.hasPicture?<Image source={{uri:accountHost+'/account/avatar',headers:{Authorization:'Bearer '+token,'X-AuthNJS-Native':'account-manager'}}}
                style={{width:30,height:30,borderRadius:15}}/>:<Ionicons name="person-circle-outline" size={30} color={colors.accent}/>}
              <Text numberOfLines={1} style={{color:colors.ink,flex:1}}>@{account.profile?.username??'Account'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={()=>void signOut()} style={{padding:12}}>
              <Ionicons name="log-out-outline" size={22} color={colors.accent}/>
            </Pressable>
          </View>
        </View><Pressable style={{flex:1}} accessibilityLabel="Close sidebar" onPress={()=>setSidebar(false)}/>
      </SafeAreaView>
    </Modal>}
    <ReleaseNotes mode={releaseNotes} rows={releaseRows} colors={colors} developer={developer}
      close={()=>openRelease(null)} open={openRelease} back={releaseBack?()=>{setReleaseNotes(releaseBack);setReleaseBack(null);}:()=>openRelease(null)}/>
    <ScrollView contentContainerStyle={[styles.content,signedOut&&styles.signInContent]} keyboardShouldPersistTaps="handled">
        {loading?<ActivityIndicator accessibilityLabel="Opening account"/>:locked&&token?
          <View style={[styles.card,{backgroundColor:colors.panel,borderColor:colors.line,borderWidth:1}]}>
            <Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>Account locked</Text>
            <NativeSupport token={token} colors={colors}/>
            {action('Check again','refresh-outline',()=>void load(token).catch(()=>setError('Could not check your account.')))}
            {action('Sign out','log-out-outline',()=>void signOut())}
          </View>:!token||!account?
          <View style={styles.signInGroup}>
          {stored.length>0?<View style={[styles.card,{backgroundColor:colors.panel}]}>
            <Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>Select an account</Text>
            {accountRows(stored)}
            {!!error&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>}
          </View>:<>
          <Image source={require('../public/authnjs-192.png')} style={styles.signInLogo} accessibilityLabel="X-Center ID"/>
          <AccountEntry transparent={false} onSignIn={()=>{setPendingAction('passkey');void signIn();}} onCreateAccount={()=>{setPendingAction('signup');void signIn(true);}} pending={pending} pendingAction={pendingAction} error={error}
            onUsernameSubmit={async username=>{setEntryBusy(true);try{return await nativeRequest('login/username',undefined,{username});}finally{setEntryBusy(false);}}}
            onCodeSubmit={async(ticket,code)=>{setEntryBusy(true);try{const session=await nativeRequest('login/code',undefined,{ticket,code});await useSession(session.token);}finally{setEntryBusy(false);}}}/>
          </>}
          </View>:
          <><Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>{accountMessage(tab[0],tab[1])}</Text>
          <Text style={{color:colors.muted}}>{tab[0]==='dashboard'?accountMessage('overviewSummary',copy.dashboard):copy[tab[0]]}</Text>
          {tab[0]==='settings'?<View style={[styles.card,{backgroundColor:colors.panel,borderColor:colors.line,borderWidth:1}]}>
          <Modal visible={!!picker} transparent animationType={reducedMotion?'none':'fade'} onRequestClose={()=>setPicker(null)}>
            <View style={{flex:1,justifyContent:'center',padding:22,backgroundColor:'#0007'}}>
              <View style={[styles.card,{backgroundColor:colors.panel}]}>
                <Text accessibilityRole="header" style={{color:colors.ink,fontSize:20,fontWeight:'700'}}>{picker==='theme'?'Theme':'Language'}</Text>
                {(picker==='theme'?[['system','System theme'],['light','Light'],['dark','Dark']]:languages).map(([id,label])=>
                  <Pressable key={id} accessibilityRole="radio" accessibilityState={{checked:picker==='theme'?preferences.theme===id:preferences.language===id}}
                    style={{minHeight:44,justifyContent:'center'}} onPress={()=>{
                      if(picker==='theme')preference({...preferences,theme:id as typeof preferences.theme});
                      else preference({...preferences,language:id});
                      setPicker(null);
                    }}><Text style={{color:colors.ink}}>{label}</Text></Pressable>)}
                {action('Done','checkmark-outline',()=>setPicker(null))}
              </View>
            </View>
          </Modal>
          {action('Theme · '+preferences.theme,'contrast-outline',()=>setPicker('theme'))}
          {action('Language · '+(languages.find(([id])=>id===preferences.language)?.[1]??'System language'),'language-outline',()=>setPicker('language'))}
          {action('Mail app access','mail-open-outline',()=>setTab(pages.find(page=>page[0]==='mail-clients')!))}
          {action('Support','help-circle-outline',()=>setTab(pages.find(page=>page[0]==='support')!))}
          {action('Developer documentation','book-outline',()=>void openBrowserAsync(accountHost+'/docs'))}
          {action('View introduction' ,'information-circle-outline',()=>{setIntroStep(0);setIntro(true);})}
          {action('Version history','book-outline',()=>openRelease('history'))}
          {action('Version '+currentRelease.version,'information-circle-outline',developerPanel.tap)}
          {developerPanel.revealed&&<View onTouchStart={developerPanel.refresh}>
            <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Text style={{color:colors.ink,flex:1}}>Developer Mode</Text>
              <Switch accessibilityLabel="Developer Mode" value={developer} onValueChange={toggleDeveloper}/></View>
            {developer&&action('Developer Options','code-slash-outline',()=>{setSampleMode(false);developerPanel.show();})}
          </View>}
          <Modal visible={developer&&developerPanel.open} presentationStyle="pageSheet" onRequestClose={developerPanel.hide}>
            <SafeAreaView style={{flex:1,backgroundColor:colors.panel}} onTouchStart={developerPanel.refresh}>
              <ScrollView contentContainerStyle={[styles.content,{gap:16}]}>
                {action('Back to Settings','arrow-back-outline',developerPanel.hide)}
                <Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>Developer Options</Text>
                {action(sampleMode?'Exit sample dashboard':'Open sample dashboard','eye-outline',()=>setSampleMode(!sampleMode))}
                {sampleMode&&<View style={styles.card}><Text style={{color:colors.ink,fontWeight:'700'}}>Sample data</Text>
                  {Object.values(sample).flat().map(item=><Text key={item.id} style={{color:colors.muted}}>{item.title}</Text>)}</View>}
              </ScrollView>
            </SafeAreaView>
          </Modal>
          {account.profile&&action('Delete account','trash-outline',()=>setDeleteName(''))}
          {deleteName!==null&&<View style={{gap:10}}>
            <Text style={{color:colors.ink}}>Permanently remove your profile, account files, mail, and linked app data. Enter @{account.profile?.username} to confirm.</Text>
            <TextInput accessibilityLabel="Enter your username to confirm deletion" value={deleteName} onChangeText={setDeleteName}
              autoCapitalize="none" autoCorrect={false} style={{minHeight:44,color:colors.ink,borderWidth:1,borderColor:colors.line,padding:8}}/>
            {action('Cancel','close-outline',()=>setDeleteName(null))}
            {deleteName===account.profile?.username&&action('Permanently delete account','trash-outline',()=>Alert.alert('Delete your account?','This cannot be undone.',[
              {text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void deleteAccount()},
            ]))}
          </View>}
        </View>:<NativeSections key={(account.id??token)+':'+tab[0]} section={tab[0] as NativeSection} account={account} token={token} colors={colors}
          expired={()=>void load(token).catch(()=>setError('Could not check your account.'))} reload={()=>load(token)} passkeys={()=>void openPasskeyEnrollment()}
          navigate={id=>{const next=pages.find(page=>page[0]===id);if(next)setTab(next);}}/>}
        {error&&!signedOut&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{error}</Text>}</>}
    </ScrollView>
    {token&&account&&<View accessibilityRole="tablist" style={{flexDirection:'row',borderTopWidth:1,borderColor:colors.line,backgroundColor:colors.panel,paddingVertical:8}}>
      {(['dashboard','apps','settings',...(account.admin?['admin']:[])]).map(id=>{const page=pages.find(page=>page[0]===id)!;
        const selected=id==='dashboard'?!['apps','permissions','developer','settings','support','mail-clients','admin'].includes(tab[0]):id==='apps'?['apps','permissions','developer'].includes(tab[0]):id==='settings'?['settings','support','mail-clients'].includes(tab[0]):tab[0]==='admin';
        return <Pressable key={id} accessibilityRole="tab" accessibilityState={{selected}} onPress={()=>{setTab(page);setSampleMode(false);}}
          style={{flex:1,alignItems:'center',justifyContent:'center',minHeight:52,gap:3,backgroundColor:selected?colors.soft:colors.panel,borderRadius:12}}>
          <Ionicons name={page[2]} size={23} color={selected?colors.accent:colors.muted}/><Text style={{color:selected?colors.accent:colors.muted,fontSize:12}}>{id==='dashboard'?'Account':accountMessage(id,page[1])}</Text>
        </Pressable>;})}
    </View>}
  </SafeAreaView>;
}

export default function App(){return <SafeAreaProvider><NativeAccount/></SafeAreaProvider>;}

const styles=StyleSheet.create({
  screen:{flex:1},
  tour:{flexGrow:1,justifyContent:'center',gap:24},
  tourLogo:{width:58,height:58,borderRadius:15},
  signInContent:{flexGrow:1,justifyContent:'center',maxWidth:520},
  signInGroup:{gap:18},
  signInLogo:{width:52,height:52,borderRadius:14,alignSelf:'center'},
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
