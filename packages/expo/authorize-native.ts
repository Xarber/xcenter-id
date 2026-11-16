import { AuthRequest, CodeChallengeMethod, ResponseType, fetchDiscoveryAsync } from 'expo-auth-session';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

export type NativeAuthorizationOptions = {
  issuer: string;
  clientId: string;
  redirectUri: string;
};

export type NativeAuthorizationCode = {
  code: string;
  verifier: string;
  nonce: string;
  redirectUri: string;
};

function https(value: string) {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
}

/** Obtain a code for the host's approved public sign-in client. */
export async function authorizeNative({ issuer, clientId, redirectUri }: NativeAuthorizationOptions):
  Promise<NativeAuthorizationCode | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Use the website backend to start web sign-in');
  }
  if (!https(issuer) || !https(redirectUri) || !clientId) {
    throw new Error('Expected an HTTPS issuer, verified HTTPS app link and registered public client');
  }
  const discovery = await fetchDiscoveryAsync(issuer);
  if (discovery.discoveryDocument?.issuer !== issuer ||
    !discovery.authorizationEndpoint || !https(discovery.authorizationEndpoint) ||
    !discovery.tokenEndpoint || !https(discovery.tokenEndpoint)) {
    throw new Error('Invalid issuer discovery');
  }
  const nonce = randomUUID();
  const request = new AuthRequest({
    clientId, redirectUri, responseType: ResponseType.Code, scopes: ['openid'],
    usePKCE: true, codeChallengeMethod: CodeChallengeMethod.S256, extraParams: { nonce },
  });
  const result = await request.promptAsync(discovery);
  if (result.type === 'cancel' || result.type === 'dismiss') return null;
  if (result.type !== 'success' || result.params.state !== request.state ||
    !result.params.code || !request.codeVerifier) {
    throw new Error('Authorization could not be completed');
  }
  return { code: result.params.code, verifier: request.codeVerifier, nonce, redirectUri };
}
