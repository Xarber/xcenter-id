import {Ionicons} from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {useState} from 'react';
import {Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {currentRelease,releaseByVersion,releaseHistory,releaseOverview,releaseStatus} from './release-info';
import technicalNotes from './release-commits.json';

const icons={mail:'mail-outline',people:'people-outline',history:'book-outline',shield:'shield-checkmark-outline',key:'key-outline',storage:'server-outline'} as const;
const notes=technicalNotes as Record<string,{revision:string;commits:{id:string;title:string;detail:string}[]}>;

export default function ReleaseNotes({mode,rows,colors,developer,close,open}:{
  mode:string|null;rows:string[][];colors:{panel:string;ink:string;muted:string;accent:string;line:string};
  developer:boolean;close:()=>void;open:(mode:string)=>void;
}){
  const [copyStatus,setCopyStatus]=useState('');
  const latest=mode==='latest';
  const archive=mode==='history';
  const technical=mode?.startsWith('developer:');
  const version=technical?mode!.slice(10):mode;
  const release=latest?currentRelease:releaseByVersion(version??'');
  const details=technical&&developer&&version?notes[version]:null;
  function button(label:string,press:()=>void){
    return <Pressable accessibilityRole="button" onPress={press} style={{minHeight:44,justifyContent:'center'}}>
      <Text style={{color:colors.accent,fontWeight:'700'}}>{label}</Text>
    </Pressable>;
  }
  function entries(items:string[][]){
    return items.map(([category,title,description])=><View key={title+description} style={{flexDirection:'row',gap:10}}>
      <Ionicons name={icons[category as keyof typeof icons]??'book-outline'} size={20} color={colors.accent}/>
      <View style={{flex:1,gap:3}}><Text style={{color:colors.ink,fontWeight:'700'}}>{title}</Text>
        <Text style={{color:colors.muted}}>{description}</Text></View>
    </View>);
  }
  function copyId(id:string){
    return <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
      <Text selectable style={{color:colors.muted,flex:1}}>{id}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Copy commit ID" onPress={()=>{
        void Clipboard.setStringAsync(id).then(copied=>setCopyStatus(copied?'Copied commit ID':'Could not copy commit ID')).catch(()=>setCopyStatus('Could not copy commit ID'));
      }} style={{padding:12}}><Ionicons name="copy-outline" size={20} color={colors.accent}/></Pressable>
    </View>;
  }
  const title=latest?'What’s new in '+currentRelease.version:archive?'Version history':technical?'Developer notes':release?.version+' · '+release?.title;
  if(!mode||(!archive&&!release)||(technical&&!details))return null;
  return <Modal visible onRequestClose={close} presentationStyle={latest?'pageSheet':'fullScreen'}>
    <SafeAreaView style={{flex:1,backgroundColor:colors.panel}}>
      <ScrollView contentContainerStyle={{padding:22,gap:16}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'800',fontSize:23,flex:1}}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close release notes" onPress={close} style={{padding:12}}>
            <Ionicons name="close" size={22} color={colors.accent}/>
          </Pressable>
        </View>
        {latest?<>{entries(rows)}{button('Full changelog',()=>open(currentRelease.version))}{button('Done',close)}</>:
          archive?releaseHistory.map(item=><View key={item.version} style={{gap:10,paddingTop:16,borderTopWidth:1,borderColor:colors.line}}>
            <Text accessibilityRole="header" style={{color:colors.ink,fontSize:18,fontWeight:'700'}}>{item.version} · {item.title}</Text>
            <Text style={{color:colors.muted}}>{releaseStatus(item)} · {item.date}</Text>
            {entries(releaseOverview(item))}
            {button('Full changelog for '+item.version,()=>open(item.version))}
            {developer&&button('Developer notes for '+item.version,()=>open('developer:'+item.version))}
          </View>):
          details?<>{button('Version history',()=>open('history'))}{copyId(details.revision)}
            <Text accessibilityLiveRegion="polite" style={{color:colors.muted}}>{copyStatus}</Text>
            {details.commits.map(commit=><View key={commit.id} style={{gap:6,paddingTop:12,borderTopWidth:1,borderColor:colors.line}}>
              <Text style={{color:colors.ink,fontWeight:'700'}}>{commit.title}</Text>
              <Text style={{color:colors.muted}}>{commit.detail}</Text>{copyId(commit.id)}
            </View>)}</>:
          release&&<>{button('Version history',()=>open('history'))}
            <Text style={{color:colors.muted}}>{releaseStatus(release)} · {release.date}</Text>
            {entries(release.features)}
            {release.fixes.length>0&&<><Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Fixes &amp; Improvements</Text>
              {release.fixes.map(fix=><Text key={fix} style={{color:colors.muted}}>{fix}</Text>)}</>}</>}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
