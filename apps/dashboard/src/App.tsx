import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { openBrowserAsync } from 'expo-web-browser';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AccountEntry } from '@authnjs/expo';
import { sample } from './sample';

type Icon = ComponentProps<typeof Ionicons>['name'];
const pages = [
  ['dashboard','Account status','person-circle-outline'],['profile','Profile','id-card-outline'],
  ['devices','Devices','phone-portrait-outline'],['security','Sign-in & security','key-outline'],
  ['apps','Apps','apps-outline'],['permissions','Permissions','shield-checkmark-outline'],
  ['storage','Data usage','server-outline'],['files','Files','folder-open-outline'],['mail','Mail','mail-outline'],
  ['settings','Settings','settings-outline'],
] as const satisfies ReadonlyArray<readonly [string,string,Icon]>;
const copy:Record<string,string> = {
  dashboard:'Review your passkeys, profile, and connected apps.', profile:'Edit your photo, name, birthday, and email.',
  devices:'Review active sessions and sign out other devices.', security:'Manage enrolled passkeys and security keys.',
  apps:'Review connected apps and open the developer portal.', permissions:'Choose what each app can access.',
  storage:'Review file storage used by your account.', files:'Upload, download, and manage private files.',
  mail:'Open your X-Center mailbox.', settings:'Manage your X-Center ID experience.',
};
const pref = 'authnjs.dashboard.onboarding.v1';
const host = 'https://id.xcenter.it';

function NativeAccount() {
  const dark=useColorScheme()==='dark';
  const colors=dark?{background:'#101522',panel:'#192132',ink:'#f3f6ff',muted:'#b1c1dc',accent:'#9ebcff',soft:'#23355d'}
    :{background:'#f6f8fc',panel:'#fff',ink:'#141b2e',muted:'#526078',accent:'#214fbe',soft:'#e9f0ff'};
  const [tab,setTab]=useState<(typeof pages)[number]>(pages[0]);
  const [pending,setPending]=useState(false);
  const [intro,setIntro]=useState(false);
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
  async function open(path:string) {
    setPending(true);setError('');
    try {await openBrowserAsync(host+'/'+path);}
    catch {setError('Could not open X-Center ID.');}
    finally {setPending(false);}
  }
  function action(label:string,icon:Icon,press:()=>void){
    return <Pressable accessibilityRole="button" onPress={press} disabled={pending} style={({pressed})=>[
      styles.button,{backgroundColor:colors.soft,opacity:pressed || pending ? 0.65 : 1},
    ]}><Ionicons name={icon} size={18} color={colors.accent}/>
      <Text style={{color:colors.accent,fontWeight:'700'}}>{label}</Text></Pressable>;
  }
  return <SafeAreaView style={[styles.screen,{backgroundColor:colors.background}]}>
    <View style={styles.header}>
      <Ionicons name="id-card-outline" color={colors.accent} size={28}/>
      <Text style={[styles.brand,{color:colors.ink}]}>X-Center ID</Text>
    </View>
    <View><ScrollView horizontal showsHorizontalScrollIndicator accessibilityRole="tablist" contentContainerStyle={styles.tabs}>
      {pages.map(page=><Pressable key={page[0]} accessibilityRole="tab" accessibilityState={{selected:page===tab}}
        style={[styles.tab,page===tab&&{backgroundColor:colors.soft}]}
        onPress={()=>{setTab(page);setDeveloper(false);setSampleMode(false);taps.current=0;if(timer.current)clearTimeout(timer.current);}}>
        <Ionicons name={page[2]} size={20} color={page===tab?colors.accent:colors.muted}/>
        <Text style={{color:page===tab?colors.accent:colors.muted,fontWeight:page===tab?'700':'600'}}>{page[1]}</Text>
      </Pressable>)}
    </ScrollView></View>
    <ScrollView contentContainerStyle={styles.content}>
      {intro?<View style={[styles.card,{backgroundColor:colors.panel}]}>
        <Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>Your X-Center ID</Text>
        <Text style={{color:colors.muted}}>Manage profile, devices, apps and permissions in one account.</Text>
        {action('Open dashboard','arrow-forward-outline',()=>setIntro(false))}
        {action('Skip introduction','close-outline',()=>setIntro(false))}
      </View>:<>
        <Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>{tab[1]}</Text>
        <Text style={{color:colors.muted}}>{copy[tab[0]]}</Text>
        {tab[0]==='dashboard'?<AccountEntry onSignIn={()=>void open('signin')} onCreateAccount={()=>void open('signup')} pending={pending} error={error}/>:null}
        {tab[0]==='settings'?<View style={[styles.card,{backgroundColor:colors.panel}]}>
          {action('View introduction','information-circle-outline',()=>setIntro(true))}
          {action('Version 0.1.0','code-slash-outline',()=>{
            if(++taps.current===3){setDeveloper(true);taps.current=0;}
            if(timer.current)clearTimeout(timer.current);
            timer.current=setTimeout(()=>{setDeveloper(false);setSampleMode(false);taps.current=0;},30_000);
          })}
          {developer&&action(sampleMode?'Exit sample dashboard':'Open sample dashboard','eye-outline',()=>setSampleMode(!sampleMode))}
          {sampleMode&&<View style={styles.card}><Text style={{color:colors.ink,fontWeight:'700'}}>Sample data</Text>
            {Object.values(sample).flat().map(item=><Text key={item.id} style={{color:colors.muted}}>{item.title}</Text>)}</View>}
        </View>:action('Open '+tab[1]+' on X-Center ID','open-outline',()=>void open(tab[0]))}
        {error&&tab[0]!=='dashboard'&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{error}</Text>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}

export default function App(){return <SafeAreaProvider><NativeAccount/></SafeAreaProvider>;}

const styles=StyleSheet.create({
  screen:{flex:1},
  header:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:20,paddingVertical:15},
  brand:{fontSize:22,fontWeight:'800',letterSpacing:-.7},
  tabs:{gap:7,paddingHorizontal:14,paddingVertical:8},
  tab:{paddingHorizontal:13,paddingVertical:11,borderRadius:13,minHeight:48,gap:7,flexDirection:'row',alignItems:'center'},
  content:{width:'100%',maxWidth:720,alignSelf:'center',paddingHorizontal:18,paddingVertical:26,gap:14},
  title:{fontSize:31,fontWeight:'800',letterSpacing:-.9},
  card:{gap:12,padding:17,borderRadius:20},
  button:{alignSelf:'flex-start',minHeight:48,alignItems:'center',flexDirection:'row',paddingHorizontal:14,
    paddingVertical:10,borderRadius:12,gap:8},
});
