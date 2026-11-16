import { AccountEntry } from '@authnjs/expo';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';

const accountUrl = process.env.EXPO_PUBLIC_XCENTER_ID_URL ?? 'https://id.xcenter.it/';

export default function LiveAccount() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function open() {
    setPending(true);
    setError('');
    try { await openBrowserAsync(accountUrl); }
    catch { setError('Could not open the X-Center ID account site.'); }
    finally { setPending(false); }
  }
  return <AccountEntry onSignIn={() => { void open(); }} onCreateAccount={() => { void open(); }} pending={pending} error={error} />;
}
