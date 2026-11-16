import { AccountEntry } from '@authnjs/expo';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';

const accountUrl = 'https://xcenter-main-server-acer.tail91c405.ts.net:8443/';

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
