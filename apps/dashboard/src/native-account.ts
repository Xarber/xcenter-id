import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { openAuthSessionAsync } from 'expo-web-browser';

export const accountHost = 'https://id.xcenter.it';
const sessionKey = 'authnjs.dashboard.nativeSession';
const returnTo = 'authnjs-dashboard://session';

export class AccountRequestError extends Error {
  constructor(readonly status:number,message:string) { super(message); }
}

export async function nativeRequest(path:string, token?:string, data?:object, method=data?'POST':'GET') {
  const response=await fetch(accountHost+'/account/'+path,{
    method, credentials:'omit',
    headers:{
      'X-AuthNJS-Native':'account-manager','X-AuthNJS-Request':'account-consent',
      ...(token?{Authorization:'Bearer '+token}:{}),
      ...(data?{'Content-Type':'application/json'}:{}),
    },
    ...(data?{body:JSON.stringify(data)}:{}),
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw new AccountRequestError(response.status,result?.error??'X-Center ID could not complete this request.');
  return result;
}

const randomSecret=()=>btoa(String.fromCharCode(...Crypto.getRandomBytes(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export async function nativePasskeySession(signUp=false) {
  const verifier=randomSecret();
  const state=randomSecret();
  const base64=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,verifier,{encoding:Crypto.CryptoEncoding.BASE64});
  const challenge=base64.replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const params=new URLSearchParams({challenge,state});
  const next='/native-session?'+params;
  const result=await openAuthSessionAsync(accountHost+(signUp?'/signup':'/signin')+'?continue='+encodeURIComponent(next),returnTo);
  if(result.type!=='success')return null;
  const callback=new URL(result.url);
  const code=callback.searchParams.get('code');
  if(callback.protocol!=='authnjs-dashboard:'||callback.host!=='session'||callback.pathname||callback.searchParams.get('state')!==state||!code){
    throw new Error('Could not validate the X-Center ID return.');
  }
  const exchanged=await nativeRequest('native/exchange',undefined,{code,state,verifier});
  return exchanged.token as string;
}

export const readSession=()=>SecureStore.getItemAsync(sessionKey);
export const saveSession=(token:string)=>SecureStore.setItemAsync(sessionKey,token,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
export const clearSession=()=>SecureStore.deleteItemAsync(sessionKey);
