import {useEffect,useState} from 'react';
import {Alert,Switch,Text,View} from 'react-native';
import AppIcon from './AppIcon';
import {nativeRequest} from './native-account';

type Permission={source:string;destination:string;collection:string;label:string;sourceName:string;destinationName:string;sourceIcon?:string;destinationIcon?:string;enabled:boolean;unsecure?:boolean};
export default function HostedDataPermissions({token,colors,client}:{token:string;client:string;colors:{ink:string;muted:string;accent:string;line:string}}){
  const [items,setItems]=useState<Permission[]>([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const load=()=>nativeRequest('app-data-permissions',token).then(result=>setItems(result.permissions));
  useEffect(()=>{void load().catch(error=>setStatus(error.message));},[token]);
  function change(item:Permission,enabled:boolean){
    const save=()=>{
      setBusy(true);
      void nativeRequest('app-data-permissions',token,{source:item.source,destination:item.destination,collection:item.collection,enabled,confirmUnsecure:item.unsecure},'PUT')
        .then(load).catch(error=>setStatus(error.message)).finally(()=>setBusy(false));
    };
    if(item.unsecure)Alert.alert('Unsecure app','Its hosting domain has not been verified.',[{text:'Cancel',style:'cancel'},{text:'Change permission',onPress:save}]);
    else save();
  }
  return <View style={{gap:12}}>
    {([['destination','Data this app can access'],['source','Data shared from this app']] as const).map(([direction,title])=>{
      const permissions=items.filter(item=>item[direction]===client);
      const incoming=direction==='destination';
      return <View key={direction} style={{gap:10}}>
        <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>{title}</Text>
        {permissions.map(item=><View key={item.source+':'+item.destination+':'+item.collection}
          style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8,borderBottomWidth:1,borderColor:colors.line}}>
          <AppIcon icon={incoming?item.sourceIcon:item.destinationIcon} color={colors.accent}/>
          <View style={{flex:1}}><Text style={{color:colors.ink,fontWeight:'700'}}>{item.label}</Text>
            <Text style={{color:colors.muted}}>{incoming?item.sourceName:item.destinationName}</Text></View>
          <Switch accessibilityLabel={item.label+' · '+(incoming?item.sourceName:item.destinationName)} value={item.enabled} disabled={busy} onValueChange={enabled=>change(item,enabled)}/>
        </View>)}
        {!permissions.length&&<Text style={{color:colors.muted}}>No requested data access.</Text>}
      </View>;
    })}
    {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
  </View>;
}
