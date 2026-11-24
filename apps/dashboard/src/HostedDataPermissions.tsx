import {useDialog} from './dialog-model';
import {Ionicons} from '@expo/vector-icons';
import {groupHostedPermissions,permissionDirections,type HostedPermission} from './hosted-permission-groups';
import {useEffect,useState} from 'react';
import {Switch,Text,View} from 'react-native';
import AppIcon from './AppIcon';
import {nativeRequest} from './native-account';

export default function HostedDataPermissions({token,colors,client}:{token:string;client:string;colors:{ink:string;muted:string;accent:string;line:string}}){
  const showDialog=useDialog();
  const [items,setItems]=useState<HostedPermission[]>([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const load=()=>nativeRequest('app-data-permissions',token).then(result=>setItems(result.permissions));
  useEffect(()=>{void load().catch(error=>setStatus(error.message));},[token]);
  function change(item:HostedPermission,enabled:boolean){
    const save=()=>{
      setBusy(true);
      void nativeRequest('app-data-permissions',token,{source:item.source,destination:item.destination,collection:item.collection,enabled,confirmUnsecure:item.unsecure},'PUT')
        .then(load).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
    };
    if(item.unsecure)showDialog('Unsecure app','Its hosting domain has not been verified.',[{text:'Cancel',style:'cancel'},{text:'Change permission',onPress:save}]);
    else save();
  }
  return <View style={{gap:12}}>
    {permissionDirections.map(([direction,title,empty])=>{
      const groups=groupHostedPermissions(items,client,direction);
      return <View key={direction} style={{gap:10}}>
        <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>{title}</Text>
        {groups.map(group=><View key={group.id} style={{borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,gap:8}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
            <AppIcon icon={group.icon} color={colors.accent}/>
            <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700',flex:1}}>{group.name}</Text>
          </View>
          {group.permissions.map(item=><View key={item.collection}
            style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,borderTopWidth:1,borderColor:colors.line}}>
            <Text style={{color:colors.ink,flex:1}}>{item.label}</Text>
            <Switch accessibilityLabel={item.label+' · '+group.name} value={item.enabled} disabled={busy}
              onValueChange={enabled=>change(item,enabled)}/>
          </View>)}
        </View>)}
        {!groups.length&&<View style={{flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:colors.line,borderRadius:10,padding:10}}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.muted}/>
          <Text style={{color:colors.muted}}>{empty}</Text>
        </View>}
      </View>;
    })}
    {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
