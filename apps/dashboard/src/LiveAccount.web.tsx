import { AccountEntry } from '@authnjs/expo';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

type Account = {
  name: string;
  passkeys: { id: string; label: string }[];
  emails: { address: string; verified: number }[];
};

async function request(path: string, body?: object) {
  const response = await fetch('/account/' + path, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Account request failed.');
  return result;
}

export default function LiveAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [available, setAvailable] = useState(false);
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [remove, setRemove] = useState<string | null>(null);
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#f4f7ff' : '#142438';
  const border = dark ? '#6380a2' : '#71839d';

  async function refresh() {
    const result = await request('me');
    setAccount(result.account);
    setAvailable(true);
  }

  useEffect(() => {
    void refresh().catch(() => setNotice('Could not reach the account service.'));
  }, []);

  async function act(operation: () => Promise<void>) {
    setPending(true);
    setNotice('');
    try { await operation(); }
    catch (error) {
      setNotice(error instanceof Error && error.name === 'NotAllowedError'
        ? 'The passkey request was canceled or timed out.'
        : error instanceof Error ? error.message : 'The operation could not be completed.');
    } finally { setPending(false); }
  }

  async function passkey(action: 'signup' | 'login' | 'add') {
    await act(async () => {
      const optionsJSON = await request(action + '/options', { name });
      const response = action === 'login'
        ? await startAuthentication({ optionsJSON })
        : await startRegistration({ optionsJSON });
      await request(action + '/finish', { response });
      setCreating(false);
      setName('');
      await refresh();
    });
  }

  function button(title: string, onPress: () => void, disabled = pending) {
    return <Pressable style={({ pressed }) => [styles.button, { borderColor: border, opacity: disabled || pressed ? 0.65 : 1 }]}
      accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}>
      <Text style={{ color: ink, fontWeight: '700' }}>{title}</Text>
    </Pressable>;
  }

  function input(label: string, value: string, setValue: (value: string) => void, isEmail = false) {
    return <>
      <Text style={{ color: ink }}>{label}</Text>
      <TextInput accessibilityLabel={label} autoCapitalize={isEmail ? 'none' : 'sentences'} keyboardType={isEmail ? 'email-address' : 'default'}
        value={value} onChangeText={setValue} maxLength={isEmail ? 254 : 64} style={[styles.input, { color: ink, borderColor: border }]} />
    </>;
  }

  if (!account) return <AccountEntry
    onSignIn={available && !creating ? () => { void passkey('login'); } : undefined}
    onCreateAccount={available && !creating ? () => { setName(''); setCreating(true); } : undefined}
    pending={pending} error={notice || undefined}>
    {creating && <View style={styles.group}>
      {input('Account name', name, setName)}
      {button('Register passkey', () => { void passkey('signup'); }, pending || !name.trim())}
      {button('Cancel', () => setCreating(false))}
    </View>}
  </AccountEntry>;

  return <View style={styles.group}>
    <Text accessibilityRole="header" style={[styles.heading, { color: ink }]}>{account.name}</Text>
    <Text accessibilityRole="header" style={[styles.heading, { color: ink }]}>Passkeys</Text>
    {account.passkeys.map((key) => <View key={key.id} style={[styles.item, { borderColor: border }]}>
      <Text style={{ color: ink }}>{key.label}</Text>
      {account.passkeys.length > 1 && (remove === key.id ? <>
        {button('Confirm removal', () => { void act(async () => { await request('passkey/remove', { id: key.id }); setRemove(null); await refresh(); }); })}
        {button('Cancel removal', () => setRemove(null))}
      </> : button('Remove ' + key.label, () => setRemove(key.id)))}
    </View>)}
    {input('New passkey name', name, setName)}
    {button('Add passkey', () => { void passkey('add'); }, pending || !name.trim())}
    <Text accessibilityRole="header" style={[styles.heading, { color: ink }]}>Verified email</Text>
    {account.emails.map(({ address }) => <Text key={address} style={{ color: ink }}>{address}</Text>)}
    {input('Email address', email, setEmail, true)}
    {button('Verify email', () => { void act(async () => { await request('email', { email }); await refresh(); }); }, pending || !email.trim())}
    {!!notice && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: ink }}>{notice}</Text>}
    {button('Sign out', () => { void act(async () => { await request('logout', {}); setEmail(''); setName(''); setRemove(null); await refresh(); }); })}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 12 }, heading: { fontSize: 21, fontWeight: '800' },
  item: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  button: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 12, minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 },
});
