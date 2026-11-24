export type Identity = { username:string; givenName:string; surname:string; birthday?:string; ageRange?:string; hasPicture:boolean };
export type Account = {id?:string;verified?:boolean;externalMailLimits?:{daily:number|null;monthly:number|null;usedToday:number;usedMonth:number}; name:string; profile:Identity|null; pendingUsername?:string; passkeys:{id:string;label:string;created:number}[];
  emails:{address:string;verified:number}[]; canSendMail?:boolean; canReceiveMail?:boolean; externalMail?:boolean; externalMailSubmission?:boolean; mailbox?:string; admin?:boolean };

export async function api(path:string, payload?:object, method = payload ? 'POST' : 'GET', signal?:AbortSignal) {
  const response = await fetch('/account/'+path,{ method, signal, cache:'no-store', ...(payload ? {
    headers:{'Content-Type':'application/json','X-AuthNJS-Request':'account-consent'},body:JSON.stringify(payload),
  } : {}) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error ?? 'This action could not be completed.');
  return result;
}

export function fileAsBase64(file: Blob) {
  return new Promise<string>((resolve,reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });
}

export async function profilePhoto(file: File) {
  if (file.size > 12 * 1024 * 1024 || !/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
    throw new Error('Choose a JPEG, PNG, WebP or AVIF image under 12 MB.');
  }
  const source = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = source;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const size = Math.min(img.naturalWidth,img.naturalHeight);
    canvas.getContext('2d')?.drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,256,256);
    return canvas.toDataURL('image/jpeg',.78).split(',')[1];
  } finally { URL.revokeObjectURL(source); }
}
