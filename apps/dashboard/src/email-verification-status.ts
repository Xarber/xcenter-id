export type VerificationStatus = {
  enabled:boolean;
  canSendLink:boolean;
  pending:{address:string;expires:number}|null;
  outgoing:{address:string;expires:number}|null;
  result:{address:string;status:string}|null;
  emails:{address:string;verified:number}[];
};

export function verificationStatus(info:VerificationStatus,address?:string){
  const target=address??info.pending?.address??info.outgoing?.address??info.result?.address;
  if(target&&info.emails.some(email=>email.address===target&&email.verified))return 'Email verified.';
  if(info.result?.address===target&&info.result?.status==='superseded')return 'Another account verified this address. Start a new request if you still own it.';
  if(info.pending&&info.pending.address===target)return 'Waiting for your verification email. Send the prepared message without changing the subject or code.';
  if(info.outgoing&&info.outgoing.address===target)return 'Verification link sent. Open it from your inbox and confirm it while signed into this account.';
  return target?'No active verification for this address. Request a new link or message.':'No active email verification.';
}
