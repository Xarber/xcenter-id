import {Ionicons} from '@expo/vector-icons';
import {Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {currentRelease,releaseHistory} from './release-info';

const icons={mail:'mail-outline',people:'people-outline',history:'book-outline',shield:'shield-checkmark-outline',key:'key-outline',storage:'server-outline'} as const;

export default function ReleaseNotes({mode,colors,close,openHistory}:{
  mode:'latest'|'history'|null;colors:{panel:string;ink:string;muted:string;accent:string};close:()=>void;openHistory:()=>void;
}){
  const latest=mode==='latest';
  return <Modal visible={!!mode} onRequestClose={close} presentationStyle="pageSheet">
    <SafeAreaView style={{flex:1,backgroundColor:colors.panel}}>
      <ScrollView contentContainerStyle={{padding:22,gap:16}}>
        <View style={{flexDirection:'row',alignItems:'center'}}>
          <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'800',fontSize:23,flex:1}}>{latest?'What’s new in '+currentRelease.version:'Version history'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close release notes" onPress={close} style={{padding:12}}>
            <Ionicons name="close" size={22} color={colors.accent}/>
          </Pressable>
        </View>
        {(latest?[currentRelease]:releaseHistory).map(release=><View key={release.version} style={{gap:8}}>
          {!latest&&<Text style={{color:colors.muted}}>{'legacy' in release?'AuthNJS ':''}{release.version} · {release.date}</Text>}
          <Text accessibilityRole="header" style={{color:colors.ink,fontSize:18,fontWeight:'700'}}>{release.title}</Text>
          {release.features.map(([category,line])=><View key={line} style={{flexDirection:'row',gap:10}}>
            <Ionicons name={icons[category as keyof typeof icons]??'book-outline'} size={19} color={colors.accent}/>
            <Text style={{color:colors.ink,flex:1}}>{line}</Text>
          </View>)}
          {release.fixes.length>0&&<><Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Fixes &amp; improvements</Text>
            {release.fixes.map(line=><Text key={line} style={{color:colors.muted}}>{line}</Text>)}</>}
        </View>)}
        {latest&&<Pressable accessibilityRole="button" onPress={openHistory} style={{minHeight:44,justifyContent:'center'}}>
          <Text style={{color:colors.accent,fontWeight:'700'}}>View changelog</Text></Pressable>}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
