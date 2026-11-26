import {useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {useDialog} from './dialog-model';
import {pageSizes,readPage,type ListPage} from './list-page';
import type {DashboardTheme} from './native-surfaces';

export default function ListPages({state,label,colors}:{state:ListPage;label:string;colors:DashboardTheme}){
  const showDialog=useDialog();
  const [draft,setDraft]=useState<string|null>(null);
  if(state.total<=pageSizes[0])return null;
  function commit(){
    if(draft!==null){
      const page=readPage(draft);
      if(page!==null)state.go(page);
    }
    setDraft(null);
  }
  function button(text:string,onPress:()=>void,disabled=false){
    return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={{minHeight:44,justifyContent:'center',paddingHorizontal:10,borderRadius:9,backgroundColor:colors.soft,opacity:disabled?.5:1}}>
      <Text style={{color:colors.accent}}>{text}</Text>
    </Pressable>;
  }
  return <View accessibilityLabel={label+' pagination'} style={{gap:8,paddingVertical:8}}>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'}}>
      <Text accessibilityLiveRegion="polite" style={{color:colors.muted}}>{state.start+1}–{state.end} of {state.total}</Text>
      {button(state.size+' per page',()=>showDialog('Items per page','Choose how many '+label.toLowerCase()+' to show.',
        [...pageSizes.map(size=>({text:String(size),onPress:()=>state.setSize(size)})),{text:'Cancel',style:'cancel'}]))}
    </View>
    <View style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8}}>
      {button('Previous',()=>state.go(state.page-1),state.page<=1)}
      <Text style={{color:colors.muted}}>Page</Text>
      <TextInput value={draft??String(state.page)} onChangeText={setDraft} accessibilityLabel="Page number"
        selectTextOnFocus maxLength={9} inputMode="numeric" returnKeyType="go" onBlur={commit}
        onSubmitEditing={commit} style={{minHeight:44,minWidth:44,textAlign:'center',paddingHorizontal:8,
          color:colors.ink,borderColor:colors.line,borderWidth:1,borderRadius:9}}/>
      <Text style={{color:colors.muted}}>of {state.pages}</Text>
      {button('Next',()=>state.go(state.page+1),state.page>=state.pages)}
    </View>
  </View>;
}
