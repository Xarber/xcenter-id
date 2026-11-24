import {Ionicons} from '@expo/vector-icons';
import {Pressable,Text,TextInput,View} from 'react-native';
import CopyButton from './CopyButton';
import {useAppConfiguration,type ConfigurationRequest} from './app-configuration-editor';
import {useConfirmDialog} from './dialog-model';
import {nativeReauthenticate,nativeRequest} from './native-account';

export default function AppConfiguration({request,token,back,colors}:{
  request: ConfigurationRequest;token:string;back:()=>void;colors:{ink:string;muted:string;accent:string;soft:string};
}){
  const confirm=useConfirmDialog();
  const editor=useAppConfiguration(async body=>{
    if(body&&!(await nativeRequest('session/access',token)).confirmed)await nativeReauthenticate(token);
    return request(body);
  },warn=>confirm('Apply this configuration?','Apply configuration',warn
    ?'Review changes to sharing and app trust. Changing profile details requires app verification again.'
    :'Changing profile details requires app verification again.',false));
  const action=(label:string,onPress:()=>void,icon:React.ComponentProps<typeof Ionicons>['name'])=>
    <Pressable accessibilityRole="button" onPress={onPress} disabled={editor.busy}
      style={{flexDirection:'row',gap:8,alignItems:'center',minHeight:44,padding:10,borderRadius:10,backgroundColor:colors.soft}}>
      <Ionicons name={icon} size={20} color={colors.accent}/><Text style={{color:colors.accent}}>{label}</Text>
    </Pressable>;
  return <View style={{gap:12}}>
    {action('Back to app',back,'arrow-back')}
    <Text accessibilityRole="header" style={{color:colors.ink,fontSize:23,fontWeight:'700'}}>App configuration</Text>
    <Text style={{color:colors.muted}}>Copy or paste the JSON configuration for this registration. It contains no credentials.</Text>
    {editor.ready&&<>
      <TextInput accessibilityLabel="Configuration JSON" multiline autoCapitalize="none" autoCorrect={false} spellCheck={false}
        editable={!editor.busy} maxLength={150000} value={editor.text} onChangeText={editor.setText}
        style={{minHeight:260,maxHeight:420,padding:10,borderRadius:10,backgroundColor:colors.soft,color:colors.ink,textAlignVertical:'top'}}/>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {action('Apply configuration',()=>void editor.save(),'save-outline')}
        {action('Format JSON',editor.format,'code-slash-outline')}
        <CopyButton value={editor.text} label="Copy app configuration" color={colors.accent}/>
      </View>
    </>}
    {editor.status&&<Text accessibilityLiveRegion="polite" style={{color:colors.ink}}>{editor.status}</Text>}
  </View>;
}
