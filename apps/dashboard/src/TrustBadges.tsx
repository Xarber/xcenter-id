import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export default function TrustBadges({verified,admin,kind='profile',color}:{
  verified?:boolean|null; admin?:boolean; kind?:'profile'|'app'|'developer'; color:string;
}) {
  if(!verified&&!admin)return null;
  return <View style={styles.group}>
    {verified&&<Text style={[styles.badge,{color}]}><Ionicons name={kind==='developer'?'code-slash-outline':'checkmark-circle-outline'} size={15} accessible={false}/> Verified {kind}</Text>}
    {admin&&<Text style={[styles.badge,{color}]}><Ionicons name="shield-checkmark-outline" size={15} accessible={false}/> Administrator</Text>}
  </View>;
}

const styles=StyleSheet.create({
  group:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6},
  badge:{fontWeight:'600',fontSize:13,borderWidth:StyleSheet.hairlineWidth,borderRadius:12,paddingHorizontal:8,paddingVertical:3},
});
