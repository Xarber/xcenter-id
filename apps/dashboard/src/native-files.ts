import { randomUUID } from 'expo-crypto';
import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { accountHost, AccountRequestError } from './native-account';

export async function pickDocumentAsync() {
  const result=await getDocumentAsync({copyToCacheDirectory:true});
  if(result.canceled)return null;
  const asset=result.assets[0];
  const file=new File(asset.uri);
  try {
    if(!file.size||file.size>2*1024**2)throw new Error('Choose a file between 1 byte and 2 MB.');
    return {name:asset.name,content:await file.base64()};
  } finally {
    if(file.exists)file.delete();
  }
}

export async function pickProfilePhoto() {
  const response=await getDocumentAsync({type:['image/jpeg','image/png'],copyToCacheDirectory:true});
  if(response.canceled)return null;
  const original=new File(response.assets[0].uri);
  try{
    if(!original.size||original.size>12*1024**2)throw new Error('Choose a JPEG or PNG under 12 MB.');
    const edit=ImageManipulator.manipulate(original.uri).resize({width:256});
    const rendered=await edit.renderAsync();
    const output=await rendered.saveAsync({format:SaveFormat.JPEG,compress:.7,base64:true});
    const cache=new File(output.uri);
    try{
      if(!output.base64||output.base64.length>45_000)throw new Error('Choose a smaller profile photo.');
      return output.base64;
    }finally{if(cache.exists)cache.delete();}
  }finally{if(original.exists)original.delete();}
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
    file.write(new Uint8Array(await response.arrayBuffer()));
    await shareAsync(file.uri);
  } finally {if(folder.exists)folder.delete();}
}
