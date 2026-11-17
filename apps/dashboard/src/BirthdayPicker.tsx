import { accountMessage } from './account-locale';
import DatePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

function storedDate(value:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(2000,0,1,12);
  const [year,month,day]=value.split('-').map(Number);
  return new Date(year,month-1,day,12);
}

function calendarDate(date:Date) {
  const two=(value:number)=>String(value).padStart(2,'0');
  return date.getFullYear()+'-'+two(date.getMonth()+1)+'-'+two(date.getDate());
}

export default function BirthdayPicker({value,onChange,ink,accent}:{value:string;onChange:(value:string)=>void;ink:string;accent:string}) {
  const [draft,setDraft]=useState<Date|null>(null);
  function accept(date:Date) {
    onChange(calendarDate(date));
    setDraft(null);
  }
  return <View style={{gap:8}}>
    <Text style={{color:ink,fontWeight:'600'}}>{accountMessage('birthday','Birthday')}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={accountMessage('chooseBirthday','Choose birthday')} accessibilityState={{expanded:!!draft}}
      onPress={()=>setDraft(storedDate(value))} style={{minHeight:44,justifyContent:'center'}}>
      <Text style={{color:accent}}>{value ? new Intl.DateTimeFormat(undefined,{dateStyle:'long'}).format(storedDate(value))  : accountMessage('chooseBirthday','Choose birthday')}</Text>
    </Pressable>
    {draft&&<DatePicker value={draft} mode="date" maximumDate={new Date()} display={Platform.OS==='ios'?'spinner':'default'}
      onDismiss={()=>setDraft(null)} onValueChange={(_event,date)=>Platform.OS==='android'?accept(date):setDraft(date)}/>}
    {draft&&Platform.OS==='ios'&&<View style={{flexDirection:'row',gap:16}}>
      <Pressable accessibilityRole="button" onPress={()=>accept(draft)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:accent}}>{accountMessage('useDate','Use this date')}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={()=>setDraft(null)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:ink}}>{accountMessage('cancel','Cancel')}</Text></Pressable>
    </View>}
  </View>;
}
