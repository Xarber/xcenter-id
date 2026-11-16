import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import Animated, { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated';

type Registration = { id: string; name: string; callback: string; status: string; client?: string };
const endpoint = '/account/developer/apps';
const entering = FadeIn.duration(180).easing(Easing.bezier(0.23, 1, 0.32, 1)).reduceMotion(ReduceMotion.System);

export default function DeveloperPortal({ back }: { back: () => void }) {
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#f4f7ff' : '#142438';
  const accent = dark ? '#b9d0ff' : '#1b469b';
  const border = dark ? '#5a7192' : '#62738c';
  const [apps, setApps] = useState<Registration[] | null>(null);
  const [notice, setNotice] = useState('Checking developer access…');
  const [name, setName] = useState('');
  const [callback, setCallback] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!Array.isArray(result.apps)) throw new Error();
        setApps(result.apps);
        setNotice('');
      })
      .catch(() => { if (!controller.signal.aborted) setNotice('Sign in through the developer account service to register an app.'); });
    return () => controller.abort();
  }, []);

  async function submit() {
    if (saving || !apps) return;
    setSaving(true);
    setNotice('Submitting…');
    try {
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-AuthNJS-Request': 'developer-portal' },
        body: JSON.stringify({ name, callback }),
      });
      if (!response.ok) throw new Error();
      const item: Registration = await response.json();
      setApps((previous) => [...(previous ?? []), item]);
      setName('');
      setCallback('');
      setNotice('Registration submitted for review.');
    } catch {
      setNotice('Could not submit. Check the callback address and your developer session.');
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: string) {
    setNotice('Checking the DNS record…');
    setSaving(true);
    try {
      const result = await fetch(endpoint + '/' + id + '/verify', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'X-AuthNJS-Request': 'developer-portal' },
      });
      if (!result.ok) throw new Error();
      const issued = await result.json();
      setCredentials(issued);
      setApps((previous) => (previous ?? []).map((app) => app.id === id
        ? { ...app, status: 'active', client: issued.clientId } : app));
      setNotice('App activated.');
    } catch {
      setNotice('Verification failed. Confirm that the public TXT record matches and try again after thirty seconds.');
    } finally { setSaving(false); }
  }

  async function revoke(id: string) {
    setSaving(true);
    try {
      const result = await fetch(endpoint + '/' + id + '/revoke', {method:'POST',headers:{'X-AuthNJS-Request':'developer-portal'}});
      if (!result.ok) throw new Error();
      setApps((previous) => (previous ?? []).map((app) => app.id === id ? { ...app, status:'revoked' } : app));
      setCredentials(null);
      setNotice('App access revoked.');
    } catch { setNotice('Could not revoke this app.'); }
    finally { setSaving(false); setRevoking(null); }
  }

  function action(label: string, handler: () => void, disabled = false) {
    return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
      onPress={handler} style={({ pressed }) => [styles.button, { borderColor: border, opacity: disabled || pressed ? 0.6 : 1 }]}>
      <Text style={{ color: accent, fontWeight: '700' }}>{label}</Text>
    </Pressable>;
  }

  return <Animated.View entering={entering} style={styles.content}>
    {action('Back to X-Center ID', back)}
    <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>Developer apps</Text>
    <Text style={{ color: ink }}>Register an exact HTTPS callback. 1. Register an exact HTTPS callback. 2. Publish the DNS ownership record. 3. Activate your app and save its one-time credentials in your backend’s secret storage.</Text>
    {apps && <>
      <Text style={{ color: ink }}>Application name</Text>
      <TextInput accessibilityLabel="Application name" style={[styles.input, { color: ink, borderColor: border }]} value={name} onChangeText={setName} maxLength={80} />
      <Text style={{ color: ink }}>HTTPS callback address</Text>
      <TextInput accessibilityLabel="HTTPS callback address" style={[styles.input, { color: ink, borderColor: border }]} value={callback}
        onChangeText={setCallback} autoCapitalize="none" keyboardType="url" maxLength={512} />
      {action('Submit for review', () => { void submit(); }, saving || !name.trim() || !callback.trim())}
      {apps.map((app) => <View key={app.id} style={[styles.item, { borderColor: border }]}>
        <Text style={{ color: ink, fontWeight: '700' }}>{app.name}</Text>
        <Text style={{ color: ink }}>{app.status}{app.client ? ' · ' + app.client : ''}</Text>
        {app.status === 'active' && (revoking === app.id ? <>
          <Text style={{color:ink}}>This immediately disables sign-in and data access for this client.</Text>
          {action('Confirm revoke', () => { void revoke(app.id); }, saving)}
          {action('Cancel', () => setRevoking(null), saving)}
        </> : action('Revoke app', () => setRevoking(app.id), saving))}
        {app.status === 'pending' && <>
          <Text selectable style={{ color: ink }}>Name: {'_xcenter-id.' + new URL(app.callback).hostname}</Text>
          <Text selectable style={{ color: ink }}>TXT: {'xcenter-id=' + app.id}</Text>
          {action('Verify domain and activate', () => { void activate(app.id); }, saving)}
        </>}
      </View>)}
    </>}
    {credentials && <View style={[styles.item, { borderColor: border }]}>
      <Text style={{ color: ink }}>Save the client secret now. It is displayed once.</Text>
      <Text selectable style={{ color: ink }}>{credentials.clientId}</Text>
      <Text selectable style={{ color: ink }}>{credentials.clientSecret}</Text>
      {action('Hide credentials', () => setCredentials(null))}
    </View>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: ink }}>{notice}</Text>}
  </Animated.View>;
}

const styles = StyleSheet.create({
  content: { gap: 14, maxWidth: 650 },
  title: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  button: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 12, minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 },
  item: { gap: 5, borderWidth: 1, borderRadius: 12, padding: 14 },
});
