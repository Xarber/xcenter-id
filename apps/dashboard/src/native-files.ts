import {launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync} from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import {fetch} from 'expo/fetch';
import { accountHost, AccountRequestError } from './native-account';

export async function pickDocumentAsync(maxBytes=2*1024**2) {
  const result=await getDocumentAsync({copyToCacheDirectory:true});
  if(result.canceled)return null;
  const asset=result.assets[0];
  const file=new File(asset.uri);
  try {
    if(!file.size||file.size>maxBytes)throw new Error('Choose a file within the stated size limit.');
    return {name:asset.name,content:await file.base64()};
  } finally {
    if(file.exists)file.delete();
  }
}

export async function pickDocumentsAsync() {
  const result=await getDocumentAsync({copyToCacheDirectory:true,multiple:true});
  return result.canceled?[]:result.assets.map(asset=>{
    const file=new File(asset.uri);
    return {
      name:asset.name,
      size:file.size,
      async read(offset:number,length:number){
        const handle=file.open();
        try {
          handle.offset=offset;
          const bytes=await handle.readBytes(length);
          if(bytes.length!==length)throw new Error('The selected file changed.');
          let raw='';
          for(let start=0;start<bytes.length;start+=8192)raw+=String.fromCharCode(...bytes.subarray(start,start+8192));
          return btoa(raw);
        }finally{handle.close();}
      },
      dispose(){if(file.exists)file.delete();},
    };
  });
}

export type ProfilePhotoSource = 'library' | 'camera' | 'files';

export async function pickProfilePhoto(source: ProfilePhotoSource) {
  if(source==='camera' && !(await requestCameraPermissionsAsync()).granted){
    throw new Error('Allow camera access in Settings to take a photo.');
  }

  const response=source==='files'
    ? await getDocumentAsync({type:'image/*',copyToCacheDirectory:true})
    : source==='camera'
      ? await launchCameraAsync({mediaTypes:['images'],quality:1})
      : await launchImageLibraryAsync({mediaTypes:['images'],quality:1});
  if(response.canceled)return null;
  const original=new File(response.assets[0].uri);
  try{
    if(!original.size||original.size>40*1024**2)throw new Error('Choose an image under 40 MB.');
    const image=ImageManipulator.manipulate(original.uri);
    const input=await image.renderAsync();
    const side=Math.min(input.width,input.height);
    const output=await ImageManipulator.manipulate(input)
      .crop({originX:Math.floor((input.width-side)/2),originY:Math.floor((input.height-side)/2),width:side,height:side})
      .resize({width:256,height:256}).renderAsync();
    const saved=await output.saveAsync({format:SaveFormat.JPEG,compress:.7,base64:true});
    const cache=new File(saved.uri);
    try{
      if(!saved.base64||saved.base64.length>45_000)throw new Error('Choose a smaller profile photo.');
      return saved.base64;
    }finally{if(cache.exists)cache.delete();}
  }finally{
    // DocumentPicker copies to cache. Other platforms may return a provider-owned URI.
    if(source==='files'&&original.exists)original.delete();
  }
}

export async function shareDownload(path:string,name:string,token:string) {
  if(!await isAvailableAsync())throw new Error('Sharing files is unavailable on this device.');
  const response=await fetch(accountHost+'/account/'+path,{credentials:'omit',redirect:'error',headers:{
    Authorization:'Bearer '+token,'X-AuthNJS-Native':'account-manager',
  }});
  if(!response.ok)throw new AccountRequestError(response.status,'This item is unavailable.');
  const folder=new Directory(Paths.cache,'authnjs-'+randomUUID());
  folder.create();
  const safeName=name.replace(/[\\/:\u0000-\u001f]/g,'_');
  const file=new File(folder,safeName==='.'||safeName==='..'?'download':safeName);
  try {
    file.create();
    if(!response.body)throw new Error('No file content was returned.');
    const reader=response.body.getReader();
    const handle=file.open();
    try{
      for(;;){
        const {done,value}=await reader.read();
        if(done)break;
        if(value)await handle.writeBytes(value);
      }
    }finally{
      handle.close();
      await reader.cancel().catch(()=>{});
      reader.releaseLock();
    }
    await shareAsync(file.uri);
  } finally {if(folder.exists)folder.delete();}
}
