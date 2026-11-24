const deviceCode = /^[A-Z0-9]{6}$/;

export const normalizeDeviceCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const isDeviceCode = (code: string) => deviceCode.test(code);

export function deviceSignInUrl(value: string, issuer: string) {
  try {
    const link = new URL(value);
    if (link.origin !== issuer || link.pathname !== '/device' || link.username || link.password ||
        link.hash || [...link.searchParams.keys()].length !== 1) return null;
    const code = link.searchParams.get('code')?.toUpperCase();
    return code && deviceCode.test(code) ? issuer + '/device?code=' + code : null;
  } catch {
    return null;
  }
}
