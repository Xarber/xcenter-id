import {useDialog} from './dialog-model';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import AppIcon from './AppIcon';
import { useAppFileContainer, useAppRecordEditor, useContainerFiles, type AppFileContainer as Container } from './account-file-containers';
import { nativeRequest } from './native-account';
import { shareDownload } from './native-files';
import type { DashboardTheme } from './native-surfaces';
import { formatBytes } from './storage-summary';

export default function AppFileContainer({ app, token, colors, back, service }: {
  app: Container; token: string; colors: Pick<DashboardTheme,'ink'|'muted'|'accent'|'soft'|'danger'|'panel'|'line'>; back: () => void; service?:string;
}) {
  const showDialog=useDialog();
  const request = useCallback((path: string, data?:object, method?:string) => nativeRequest(path, token, data, method), [token]);
  const root=service?'app-storage/'+service+'/browse':'file-containers/'+encodeURIComponent(app.client);
  const filePath=service?'app-storage/'+service+'/files':'app-files/'+encodeURIComponent(app.client);
  const { collection, setCollection, folder, loading, error, more, path, refresh } = useAppFileContainer(root, !!(service||app.canManage), request);
  const {page:files,failure,moreFiles}=useContainerFiles(filePath,!collection,request);
  const editor=useAppRecordEditor(app.client,request,refresh);
  const {draft,setDraft,busy}=editor;
  const [downloadError, setDownloadError] = useState('');
  const action = (label: string, onPress: () => void, icon: 'folder-outline' | 'document-outline' | 'arrow-back' | 'ellipsis-horizontal' | 'add-outline' | 'checkmark-outline' | 'close-outline' | 'trash-outline' | 'pencil-outline') =>
    <Pressable accessibilityRole="button" disabled={loading||busy} onPress={onPress}
      style={({pressed})=>({minHeight:44,flexDirection:'row',alignItems:'center',gap:8,padding:8,borderRadius:10,backgroundColor:pressed?colors.soft:colors.panel})}>
      <Ionicons accessible={false} name={icon} size={19} color={colors.accent}/>
      <Text style={{color:colors.ink,flexShrink:1}}>{label}</Text>
    </Pressable>;
  const fileRow={flexDirection:'row' as const,alignItems:'center' as const,borderTopWidth:1,borderColor:colors.line,minHeight:45,gap:8};
  return <View style={{gap:12}}>
    <Pressable accessibilityRole="button" onPress={back} style={{minHeight:44,justifyContent:'center'}}>
      <Text style={{color:colors.accent}}>{service?'Back to storage':'Back to your files'}</Text>
    </Pressable>
    {collection && action('Back to '+app.name,()=>setCollection(''),'arrow-back')}
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <AppIcon icon={app.icon} color={colors.accent}/>
      <Text accessibilityRole="header" style={{fontWeight:'700',fontSize:18,color:colors.ink,flex:1}}>{collection || app.name}</Text>
    </View>
    <Text style={{color:colors.muted}}>{service?'Service storage':'App folder'} · {formatBytes(service?app.bytes:app.visibleBytes??app.bytes)}</Text>
    {app.canManage&&!service&&action('New record',()=>editor.create(collection),'add-outline')}
    {app.canManage&&!service&&draft&&<View style={{gap:8}}>
      {!draft.revision&&<>
        <TextInput accessibilityLabel="Collection" placeholder="Collection" placeholderTextColor={colors.muted} value={draft.collection}
          onChangeText={value=>setDraft({...draft,collection:value})} autoCapitalize="none" style={{color:colors.ink,minHeight:44,borderColor:colors.line,borderWidth:1,paddingHorizontal:8}}/>
        <TextInput accessibilityLabel="Record ID" placeholder="Record ID" placeholderTextColor={colors.muted} value={draft.id}
          onChangeText={value=>setDraft({...draft,id:value})} autoCapitalize="none" style={{color:colors.ink,minHeight:44,borderColor:colors.line,borderWidth:1,paddingHorizontal:8}}/>
      </>}
      <TextInput accessibilityLabel="JSON data" multiline value={draft.json} onChangeText={json=>setDraft({...draft,json})}
        autoCapitalize="none" autoCorrect={false} style={{color:colors.ink,minHeight:110,borderColor:colors.line,borderWidth:1,padding:8}}/>
      {action('Save record',()=>void editor.submit(),'checkmark-outline')}
      {action('Cancel',()=>setDraft(undefined),'close-outline')}
      {!!draft.revision&&action('Remove record',()=>showDialog('Remove this record?','This permanently deletes the record.',[
        {text:'Cancel',style:'cancel'},{text:'Remove',style:'destructive',onPress:()=>void editor.submit(true)},
      ]),'trash-outline')}
    </View>}
    {!!editor.message&&<Text accessibilityLiveRegion="polite" style={{color:colors.ink}}>{editor.message}</Text>}
    <View style={fileRow}><Text accessibilityRole="header" style={{flex:1,color:colors.muted}}>Name</Text>
      <Text accessibilityRole="header" style={{color:colors.muted}}>Size</Text></View>
    {folder?.collections.map(item=><View style={fileRow} key={item.collection}><View style={{flex:1}}>
      {action(item.collection,()=>setCollection(item.collection),'folder-outline')}</View>
      <Text style={{color:colors.muted}}>{formatBytes(item.bytes)}</Text>
    </View>)}
    {folder?.records.map(record=><View key={record.id} style={fileRow}>
      <View style={{flex:1}}>{action(record.id+'.json',()=>{
        setDownloadError('');
        void shareDownload(path+'/'+encodeURIComponent(record.id),record.id+'.json',token).catch(()=>setDownloadError('Could not download this record.'));
      },'document-outline')}</View>
      <Text style={{color:colors.muted}}>{formatBytes(record.bytes)}</Text>
      {app.canManage&&!service&&<Pressable accessibilityRole="button" accessibilityLabel={'Edit '+record.id} onPress={()=>void editor.edit(collection,record.id)} style={{padding:12}} disabled={busy}>
        <Ionicons name="pencil-outline" size={19} color={colors.accent}/>
      </Pressable>}
    </View>)}
    {!!folder?.nextCursor&&action('Load more',()=>void more(),'ellipsis-horizontal')}
    {!collection&&files?.files.map(file=><View style={fileRow} key={file.id}>
      <View style={{flex:1}}>{action(file.name,()=>{
        setDownloadError('');
        void shareDownload(filePath+'/'+file.id,file.name,token).catch(()=>setDownloadError('Could not download this file.'));
      },'document-outline')}</View>
      <Text style={{color:colors.muted}}>{formatBytes(file.size)}</Text>
    </View>)}
    {!collection&&files?.nextCursor&&action('Load more files',()=>void moreFiles(),'ellipsis-horizontal')}
    {!loading&&!folder?.collections.length&&!folder?.records.length&&(collection||files&&!files.files.length)&&<Text style={{color:colors.muted}}>This folder is empty.</Text>}
    {loading&&<Text accessibilityRole="progressbar" style={{color:colors.muted}}>Loading folder…</Text>}
    {!!(error||failure||downloadError)&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{error||failure||downloadError}</Text>}
  </View>;
}
