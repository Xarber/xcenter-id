import { validateApplicationBrand } from './application-brand.mjs';

export async function validateApplicationProfile(input) {
  const name=typeof input.name==='string'?input.name.trim():'';
  const description=typeof input.description==='string'?input.description.trim():'';
  const repository=typeof input.repository==='string'?input.repository.trim():'';
  const raw=Array.isArray(input.callbacks)?input.callbacks:[input.callback];
  if(!name||name.length>80||description.length>500||/[\p{Cc}\p{Cf}]/u.test(name)||raw.length<1||raw.length>8){
    throw new Error('Enter a name and up to eight callback addresses.');
  }
  const callbacks=[...new Set(raw.map(value=>{
    if(typeof value!=='string'||value.length>512)throw new Error('Enter a valid callback.');
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname==='/'||url.pathname.includes('*')){
      throw new Error('Callbacks must use exact HTTPS paths.');
    }
    return url.href;
  }))];
  if(callbacks.some(value=>new URL(value).origin!==new URL(callbacks[0]).origin)){
    throw new Error('Use the same verified origin for all callbacks.');
  }
  if(repository&&!/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}\/?$/.test(repository)){
    throw new Error('Enter a GitHub repository URL.');
  }
  return {name,description,repository,callbacks,...await validateApplicationBrand(input)};
}
