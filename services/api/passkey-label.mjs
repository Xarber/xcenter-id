const catalogUrl = 'https://raw.githubusercontent.com/passkeydeveloper/passkey-authenticator-aaguids/refs/heads/main/combined_aaguid.json';
const refreshInterval = 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const anonymous = '00000000-0000-0000-0000-000000000000';

export function passkeyLabel(value) {
  const label = typeof value === 'string' ? value.trim() : '';
  return label.length > 0 && label.length <= 64 && !/[\u0000-\u001f\u007f]/.test(label) ? label : null;
}

export function createPasskeyLabelResolver({ fetchCatalog = fetch, now = Date.now } = {}) {
  let catalog = new Map();
  let expires = 0;
  let pending;

  async function refresh() {
    try {
      const response = await fetchCatalog(catalogUrl, { signal: AbortSignal.timeout(1200) });
      if (!response.ok) throw new Error('Passkey provider catalog unavailable');
      const parsed = await response.json();
      const names = Object.entries(parsed).flatMap(([id, item]) => {
        const label = passkeyLabel(item?.name);
        return uuid.test(id) && label ? [[id, label]] : [];
      });
      if (names.length) catalog = new Map(names);
    } catch {
      // A catalog outage must not prevent adding a passkey.
    } finally {
      expires = now() + (catalog.size ? refreshInterval : 60_000);
    }
  }

  return async ({ aaguid, transports }) => {
    const id = typeof aaguid === 'string' ? aaguid.toLowerCase() : '';
    if (uuid.test(id) && id !== anonymous) {
      if (now() >= expires) {
        pending ??= refresh().finally(() => { pending = undefined; });
        await pending;
      }
      if (catalog.has(id)) return catalog.get(id);
    }
    return transports?.some(transport => ['usb','nfc','ble'].includes(transport)) ? 'Security key' : 'Passkey';
  };
}
