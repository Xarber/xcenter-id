import {Pressable,Text,TextInput,View} from 'react-native';
import {nativeRequest} from './native-account';
import {adminCategories,useAdminSearch,type AdminCategory,type SearchItem} from './admin-search-model';
import {Surface,SurfaceTitle,type DashboardTheme} from './native-surfaces';
import ListPages from './ListPages';

export default function AdminSearch({token,colors,open}:{token:string;colors:DashboardTheme;open:(category:AdminCategory,item:SearchItem)=>void}){
  const state=useAdminSearch((path,signal)=>nativeRequest(path,token,undefined,'GET',signal));
  const groups=(Object.entries(state.results) as [AdminCategory,NonNullable<(typeof state.results)[AdminCategory]>][]).filter(([,value])=>value.total>0);
  function button(label:string,action:()=>void,disabled=state.busy){
    return <Pressable accessibilityRole="button" onPress={action} disabled={disabled}
      style={{minHeight:44,borderRadius:10,justifyContent:'center',paddingHorizontal:12,backgroundColor:colors.soft,opacity:disabled?.55:1}}>
      <Text style={{color:colors.accent,fontWeight:'600'}}>{label}</Text>
    </Pressable>;
  }
  return <Surface colors={colors}>
    <SurfaceTitle colors={colors} icon="search-outline" title="Search Administration"/>
    <TextInput value={state.input} onChangeText={state.setInput} accessibilityLabel="Search Administration"
      placeholder="Users, apps, support requests…" placeholderTextColor={colors.muted} returnKeyType="search"
      onSubmitEditing={()=>{if(!state.busy)state.search();}} maxLength={120}
      style={{minHeight:48,paddingHorizontal:10,color:colors.ink,borderColor:colors.line,borderWidth:1,borderRadius:10}}/>
    {button('Search',state.search,state.busy||state.input.trim().length<2)}
    {state.group&&button('All sections',()=>state.select())}
    {!!state.status&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{state.status}</Text>}
    {state.query&&!state.busy&&!state.status&&!groups.length&&<Text style={{color:colors.muted}}>No results.</Text>}
    {groups.map(([category,group])=><View key={category} style={{gap:8}}>
      <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>{adminCategories[category]} ({group.total})</Text>
      {group.items.map(item=><Pressable key={item.id} accessibilityRole="button" onPress={()=>open(category,item)}
        style={{borderTopWidth:1,borderColor:colors.line,minHeight:48,justifyContent:'center',gap:3}}>
        <Text style={{color:colors.accent,fontWeight:'600'}}>{item.title}</Text>
        {!!item.description&&<Text style={{color:colors.muted}}>{item.description}</Text>}
      </Pressable>)}
      {!state.group&&group.total>group.items.length&&button('All '+adminCategories[category].toLowerCase(),()=>state.select(category))}
      {state.group===category&&<ListPages colors={colors} state={state.pagination} label={adminCategories[category]}/>}
    </View>)}
  </Surface>;
}
