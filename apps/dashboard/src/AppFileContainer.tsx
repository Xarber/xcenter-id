import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AppIcon from './AppIcon';
import { useAppFileContainer, type AppFileContainer as Container } from './account-file-containers';
import { nativeRequest } from './native-account';
import { shareDownload } from './native-files';
import type { DashboardTheme } from './native-surfaces';
import { formatBytes } from './storage-summary';

export default function AppFileContainer({ app, token, colors, back }: {
  app: Container; token: string; colors: DashboardTheme; back: () => void;
}) {
  const request = useCallback((path: string) => nativeRequest(path, token), [token]);
  const { collection, setCollection, folder, loading, error, more, path } = useAppFileContainer(app.client, request);
  const [downloadError, setDownloadError] = useState('');
  const action = (label: string, onPress: () => void, icon: 'folder-outline' | 'download-outline' | 'arrow-back' | 'ellipsis-horizontal') =>
    <Pressable accessibilityRole="button" disabled={loading} onPress={onPress}
      style={({pressed})=>({minHeight:44,flexDirection:'row',alignItems:'center',gap:8,padding:8,borderRadius:10,backgroundColor:pressed?colors.soft:colors.panel})}>
      <Ionicons accessible={false} name={icon} size={19} color={colors.accent}/>
      <Text style={{color:colors.ink,flexShrink:1}}>{label}</Text>
    </Pressable>;
  return <View style={{gap:12}}>
    <Pressable accessibilityRole="button" onPress={back} style={{minHeight:44,justifyContent:'center'}}>
      <Text style={{color:colors.accent}}>Back to your files</Text>
    </Pressable>
    {collection && action('Back to '+app.name,()=>setCollection(''),'arrow-back')}
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <AppIcon icon={app.icon} color={colors.accent}/>
      <Text accessibilityRole="header" style={{fontWeight:'700',fontSize:18,color:colors.ink,flex:1}}>{collection || app.name}</Text>
    </View>
    <Text style={{color:colors.muted}}>Read-only app data</Text>
    {folder?.collections.map(item=><View key={item.collection}>{action(item.collection,()=>setCollection(item.collection),'folder-outline')}</View>)}
    {folder?.records.map(record=><View key={record.id} style={{borderTopWidth:1,borderColor:colors.line,paddingTop:6}}>
      {action('Download '+record.id+'.json',()=>{
        setDownloadError('');
        void shareDownload(path+'/'+encodeURIComponent(record.id),record.id+'.json',token).catch(()=>setDownloadError('Could not download this record.'));
      },'download-outline')}
      <Text style={{color:colors.muted}}>{formatBytes(record.bytes)}</Text>
    </View>)}
    {!!folder?.nextCursor&&action('Load more',()=>void more(),'ellipsis-horizontal')}
    {folder&&!loading&&!folder.collections.length&&!folder.records.length&&<Text style={{color:colors.muted}}>This folder is empty.</Text>}
    {loading&&<Text accessibilityRole="progressbar" style={{color:colors.muted}}>Loading folder…</Text>}
    {!!(error||downloadError)&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{error||downloadError}</Text>}
  </View>;
}
