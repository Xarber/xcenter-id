export type DeveloperIdentity={name:string;githubProfile?:string;status:'unverified'|'requested'|'verified'};
export type ClaimRequirements={email:boolean;age_range:boolean};
export const optionalClaims:ClaimRequirements={email:false,age_range:false};
export type AppRegistration={id:string;name:string;description:string;repository:string;icon:string|null;callbacks:string[];
  callback:string;native?:boolean;local?:boolean;client?:string;status:'active'|'pending'|'revoked';verified?:boolean;requirements?:ClaimRequirements};

export async function developerApi(path:string,body?:object,method=body?'POST':'GET'){
  const response=await fetch('/account/developer/'+path,{
    method,cache:'no-store',headers:{'X-AuthNJS-Request':'developer-portal',...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  const value=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(value?.error??'X-Center ID could not complete this request.');
  return value;
}
export async function readAppIcon(file:File){
  if(file.size>12*1024**2||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPEG or WebP under 12 MB.');
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();
    image.src=url;
    await image.decode();
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=88;
    const ratio=88/Math.max(image.naturalWidth,image.naturalHeight);
    const width=image.naturalWidth*ratio;
    const height=image.naturalHeight*ratio;
    canvas.getContext('2d')?.drawImage(image,(88-width)/2,(88-height)/2,width,height);
    return canvas.toDataURL('image/png').split(',')[1];
  }finally{URL.revokeObjectURL(url);}
}
