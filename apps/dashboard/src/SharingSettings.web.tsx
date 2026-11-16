import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, useColorScheme, View } from 'react-native';

type App = { client: string; name: string };
type Grant = { source: string; destination: string; expires: number; dataset: string };
const before = () => Date.now() + 24 * 60 * 60 * 1000;
async function json(path: string) {
  const response = await fetch('/account/' + path, { cache: 'no-store' });
  if (!response.ok) throw new Error();
  return response.json();
}

export default function SharingSettings() {
  const [apps, setApps] = useState<App[] | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const dark = useColorScheme() === 'dark';
  const text = dark ? '#f4f7ff' : '#142438';
  const tint = dark ? '#203a61' : '#e4edff';

  useEffect(() => {
    Promise.all([json('apps'), json('data-grants')]).then(
      ([listed, existing]) => { setApps(listed.apps); setGrants(existing.grants); },
      () => setStatus('App permissions are unavailable right now.'),
    );
  }, []);

  async function change(method: 'PUT' | 'DELETE', from: string, to: string) {
    setPending(true);
    setStatus('');
    try {
      const response = await fetch('/account/data-grants', { method, headers: {
        'Content-Type': 'application/json', 'X-AuthNJS-Request': 'account-consent',
      }, body: JSON.stringify({source:from,destination:to,expires:before()}) });
      if (!response.ok) throw new Error();
      setGrants((await json('data-grants')).grants);
      setStatus(method === 'PUT' ? 'Read access granted for one day.' : 'Access revoked.');
    } catch { setStatus('Could not update the permission.'); }
    finally { setPending(false); }
  }

  function button(label: string, onPress: () => void, disabled = false, selected?: boolean) {
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} onPress={onPress} disabled={disabled}
      style={({pressed}) => ({ alignSelf:'flex-start', minHeight:48, justifyContent:'center', paddingHorizontal:14,
        borderRadius:12, backgroundColor:tint, opacity: pressed || disabled ? .66 : 1 })}>
      <Text style={{ color:text, fontWeight:selected ? '800' : '600' }}>{label}</Text>
    </Pressable>;
  }

  return <View style={{gap:10}}>
    <Text accessibilityRole="header" style={{color:text,fontSize:21,fontWeight:'800'}}>App data access</Text>
    {apps && apps.length < 2 && <Text style={{color:text}}>Two verified apps are needed for a cross-app grant.</Text>}
    {apps && apps.length >= 2 && <>
      <Text style={{color:text}}>Choose the app that owns the saved places</Text>
      <View style={{gap:8,flexDirection:'row',flexWrap:'wrap'}}>
        {apps.map((app) => <View key={app.client}>{button(app.name,() => setSource(app.client),pending,source===app.client)}</View>)}
      </View>
      <Text style={{color:text}}>Choose the app that may read them</Text>
      <View style={{gap:8,flexDirection:'row',flexWrap:'wrap'}}>
        {apps.filter((app) => app.client !== source).map((app) => <View key={app.client}>{button(app.name,() => setDestination(app.client),pending,destination===app.client)}</View>)}
      </View>
      {button('Allow read access for one day', () => { void change('PUT',source,destination); }, pending || !source || !destination || source===destination)}
    </>}
    {grants.filter(({dataset}) => dataset === 'saved-place.v1').map((grant) => <View key={grant.source+'/'+grant.destination} style={{gap:5}}>
      <Text style={{color:text}}>{apps?.find(({client}) => client===grant.source)?.name ?? grant.source} → {apps?.find(({client}) => client===grant.destination)?.name ?? grant.destination}</Text>
      {button('Revoke access',() => { void change('DELETE',grant.source,grant.destination); },pending)}
    </View>)}
    {!!status && <Text accessibilityLiveRegion="polite" style={{color:text}}>{status}</Text>}
    {button('Try the sample apps', () => { void Linking.openURL(window.location.origin+'/samples'); })}
  </View>;
}
