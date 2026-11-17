export const accountShortcuts = [
  { id:'profile', label:'Your profile', description:'Edit your photo and personal information' },
  { id:'security', label:'Sign-in & security', description:'Manage the passkeys on your account' },
  { id:'permissions', label:'Permissions', description:'Control what each app can access' },
  { id:'devices', label:'Devices', description:'Review active sign-ins' },
] as const;

export function accountStatus(passkeys:number, emails:number) {
  return passkeys+' '+(passkeys===1?'passkey':'passkeys')+' enrolled · '+emails+' verified '+(emails===1?'email':'emails');
}
