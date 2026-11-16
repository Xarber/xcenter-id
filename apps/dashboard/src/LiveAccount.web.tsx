import SharingSettings from './SharingSettings';
import { AccountEntry } from '@authnjs/expo';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

type Account = {
  name: string;
  profile: null | { username: string; givenName: string; surname: string; ageRange: string };
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
  const [givenName, setGivenName] = useState('');
  const [surname, setSurname] = useState('');
  const [username, setUsername] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [email, setEmail] = useState('');
  const [showSharing, setShowSharing] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [messages, setMessages] = useState<{ id: string; received: number; size: number }[] | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const emailToken = new URLSearchParams(window.location.hash.slice(1)).get('verify-email');
  const candidate = new URLSearchParams(window.location.search).get('continue') ?? '';
  const continuation = /^\/interaction\/[A-Za-z0-9_-]{10,160}$/.test(candidate) ? candidate : null;
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
      const optionsJSON = await request(action + '/options', action === 'signup'
        ? { name: givenName, givenName, surname, username, ageRange } : { name });
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
      {input('Given name', givenName, setGivenName)}
      {input('Surname', surname, setSurname)}
      {input('X-Center username', username, setUsername)}
      <Text style={{ color: ink }}>Your username reserves an account name. Mailbox activation is separate.</Text>
      <Text style={{ color: ink }}>Age range</Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {['child', 'teen', 'adult'].map((range) => (
          <Pressable key={range} accessibilityRole="radio" accessibilityState={{ checked: ageRange === range }}
            onPress={() => setAgeRange(range)} style={[styles.button, { borderColor: border,
              backgroundColor: ageRange === range ? (dark ? '#203a61' : '#e4edff') : 'transparent' }]}>
            <Text style={{ color: ink, textTransform: 'capitalize' }}>{range}</Text>
          </Pressable>
        ))}
      </View>
      {button('Register passkey', () => { void passkey('signup'); },
        pending || !givenName.trim() || !surname.trim() || !username.trim() || !ageRange)}
      {button('Cancel', () => setCreating(false))}
    </View>}
  </AccountEntry>;

  return <View style={styles.group}>
    <Text accessibilityRole="header" style={[styles.heading, { color: ink }]}>{account.profile ? account.profile.givenName + ' ' + account.profile.surname : account.name}</Text>
    {emailToken && button('Confirm this email address', () => { void act(async () => {
      await request('email/confirm', { token: emailToken });
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      await refresh();
      setNotice('Email verified.');
    }); })}
    {continuation && button('Continue to the app', () => window.location.assign(continuation))}
    {!!account.profile && <Text style={{ color: ink }}>@{account.profile.username}</Text>}
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
    {button('Verify email', () => { void act(async () => { await request('email', { email }); setNotice('Check your email for a verification link.'); }); }, pending || !email.trim())}
    {!!notice && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: ink }}>{notice}</Text>}
    {button(showSharing ? 'Hide app permissions' : 'Manage app permissions', () => setShowSharing(!showSharing))}
    {showSharing && <SharingSettings />}
    {button(showInbox ? 'Hide inbox' : 'Open inbox', () => {
      if (showInbox) { setShowInbox(false); return; }
      void act(async () => {
        const response = await fetch('/account/inbox');
        if (!response.ok) throw new Error('Mail delivery is unavailable.');
        setMessages((await response.json()).messages);
        setShowInbox(true);
      });
    })}
    {showInbox && (messages?.length ? messages.map(({id,received,size}) => <View key={id}>
      {button(`Download email received ${new Date(received).toLocaleString()} (${size} bytes)`,
        () => window.location.assign('/account/inbox/' + id))}
    </View>) : <Text style={{color:ink}}>Your inbox is empty.</Text>)}
    {button('Sign out', () => { void act(async () => { await request('logout', {}); setEmail(''); setName(''); setRemove(null); setShowInbox(false); setShowSharing(false); setMessages(null); await refresh(); }); })}
  </View>;
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { gap: 12 }, heading: { fontSize: 21, fontWeight: '800' },
  item: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  button: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 12, minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 },
});
