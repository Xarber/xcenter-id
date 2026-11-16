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
  const [saving, setSaving] = useState(false);
  const enabled = process.env.EXPO_PUBLIC_AUTHNJS_DEVELOPER_PORTAL === 'enabled';

  useEffect(() => {
    if (!enabled) {
      setNotice('Registration opens when the identity service is connected.');
      return;
    }
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
  }, [enabled]);

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

  function action(label: string, handler: () => void, disabled = false) {
    return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
      onPress={handler} style={({ pressed }) => [styles.button, { borderColor: border, opacity: disabled || pressed ? 0.6 : 1 }]}>
      <Text style={{ color: accent, fontWeight: '700' }}>{label}</Text>
    </Pressable>;
  }

  return <Animated.View entering={entering} style={styles.content}>
    {action('Back to AuthNJS', back)}
    <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>Developer apps</Text>
    <Text style={{ color: ink }}>Register your application and its HTTPS callback. Review and activation are required before your app can request access to shared data.</Text>
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
      </View>)}
    </>}
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
