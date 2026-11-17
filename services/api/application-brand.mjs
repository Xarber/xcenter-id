import sharp from 'sharp';

export async function validateApplicationBrand({developerName, icon}) {
  const name=typeof developerName==='string'?developerName.trim():'';
  if(name.length>80 || /[\p{Cc}\p{Cf}]/u.test(name)) throw new Error('Invalid developer name');
  if(!icon)return {developerName:name,icon:null};
  if(typeof icon!=='string'||icon.length>46_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(icon))throw new Error('Invalid icon');
  const bytes=Buffer.from(icon,'base64');
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=bytes[0]===255&&bytes[1]===216;
  if(!png&&!jpeg)throw new Error('Select a PNG or JPEG');
  const result=await sharp(bytes,{limitInputPixels:1024*1024}).resize(96,96,{fit:'contain',background:'#00000000'}).png().toBuffer();
  return {developerName:name,icon:result.toString('base64')};
}
