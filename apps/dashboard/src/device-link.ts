const deviceCode = /^[BCDFGHJKLMNPQRSTVWXZ]{6}$/;

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
