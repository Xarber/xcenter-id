const deviceCode = /^[A-Z0-9]{6}$/;

export const normalizeDeviceCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const isDeviceCode = (code: string) => deviceCode.test(code);

export function deviceSignInUrl(value: string, issuer: string) {
  try {
    const link = new URL(value);
    if(link.origin!==issuer||link.username||link.password||link.hash)return null;
    if(/^\/(?:account-approval|app-approval)\/[A-Za-z0-9_-]{43}$/.test(link.pathname)&&!link.search)return link.href;
    if(link.pathname!=='/device'||[...link.searchParams.keys()].length!==1)return null;
    const code = link.searchParams.get('code')?.toUpperCase();
    return code && deviceCode.test(code) ? issuer + '/device?code=' + code : null;
  } catch {
    return null;
  }
}
