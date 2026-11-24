import {Ionicons} from '@expo/vector-icons';
import {Pressable,Text,TextInput,View} from 'react-native';
import {useDialog} from './dialog-model';
import {blankRequest,sharingIcons,type SharingEditorProps,type SharingRequest} from './sharing-config';

export default function SharingEditor({value,onChange,sources,canPublish,colors}: SharingEditorProps & {
  colors:{ink:string;muted:string;accent:string;soft:string},
}){
  const showDialog=useDialog();
  const {shared,requests}=value;
  const update=(index:number,fields:Partial<SharingRequest>)=>onChange({...value,
    requests:requests.map((item,i)=>i===index?{...item,...fields}:item),
  });
  const field=(title:string,content:string,change:(text:string)=>void,maxLength:number)=><View style={{gap:4}}>
    <Text style={{color:colors.ink}}>{title}</Text>
    <TextInput accessibilityLabel={title} autoCapitalize="none" maxLength={maxLength} value={content} onChangeText={change}
      style={{padding:10,minHeight:44,borderRadius:10,backgroundColor:colors.soft,color:colors.ink}}/>
  </View>;
  const action=(title:string,onPress:()=>void,icon:React.ComponentProps<typeof Ionicons>['name'],disabled=false)=>
    <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
      style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:44,opacity:disabled?.55:1}}>
      <Ionicons name={icon} size={20} color={colors.accent}/><Text style={{color:colors.accent}}>{title}</Text>
    </Pressable>;
  function pick(title:string,options:readonly (readonly [string,string])[],onSelect:(value:string)=>void){
    showDialog(title,undefined,[...options.map(([key,text])=>({text,onPress:()=>onSelect(key)})),{text:'Cancel',style:'cancel'}]);
  }
  return <View style={{gap:14}}>
    {canPublish&&<>
      <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700',fontSize:17}}>Published collections</Text>
      {shared.map((name,index)=><View key={index}>
        {field('Collection '+(index+1),name,next=>onChange({...value,shared:shared.map((item,i)=>i===index?next:item)}),80)}
        {action('Remove collection '+(index+1),()=>onChange({...value,shared:shared.filter((_,i)=>i!==index)}),'trash-outline')}
      </View>)}
      {action('Add collection',()=>onChange({...value,shared:[...shared,'']}),'add-circle-outline',shared.length>=30)}
    </>}
    <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700',fontSize:17}}>Permissions requested from other apps</Text>
    {requests.map((request,index)=>{
      const source=sources.find(item=>item.client===request.source);
      return <View key={index} style={{gap:8,padding:12,borderWidth:1,borderColor:colors.muted,borderRadius:12}}>
        <Text style={{color:colors.ink,fontWeight:'700'}}>{request.label||'New permission'}</Text>
        {action('Source app · '+(source?.name??(request.source||'Select')),()=>pick('Source app',sources.map(item=>[item.client,item.name]),
          client=>update(index,{source:client,collection:''})),'apps-outline')}
        {action('Collection · '+(request.collection||'Select'),()=>pick('Collection',source?.collections.map(name=>[name,name])??[],
          collection=>update(index,{collection})),'folder-outline',!source)}
        {field('Permission name (optional)',request.name??'',name=>update(index,{name}),80)}
        {field('Title',request.label,label=>update(index,{label}),160)}
        {field('Description (optional)',request.description??'',description=>update(index,{description}),300)}
        {action('Icon · '+(sharingIcons.find(([id])=>id===request.icon)?.[1]??'Default'),
          ()=>pick('Icon',[['','Default'],...sharingIcons],icon=>update(index,{icon:(icon||undefined) as SharingRequest['icon']})),'image-outline')}
        {action('Remove permission '+(index+1),()=>onChange({...value,requests:requests.filter((_,i)=>i!==index)}),'trash-outline')}
      </View>;
    })}
    {action('Add permission',()=>onChange({...value,requests:[...requests,blankRequest()]}),'add-circle-outline',requests.length>=30||!sources.length)}
    {!sources.length&&<Text style={{color:colors.muted}}>No verified apps currently publish collections this app can request.</Text>}
  </View>;
}
