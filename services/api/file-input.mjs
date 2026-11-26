export function fileName(input) {
  const name=typeof input==='string'?input.trim().normalize('NFC'):'';
  return name&&name!=='.'&&name!=='..'&&name.length<=160&&!/[\\/\p{Cc}\p{Cf}\p{Cs}]/u.test(name)?name:null;
}

export async function readFileInput(req,max) {
  const chunks=[];
  let size=0;
  for await(const chunk of req.iterator({destroyOnReturn:false})){
    size+=chunk.length;
    if(size>max){req.resume();throw new Error('Request exceeds allowed size.');}
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

export function fileDownloadHeaders(name,size) {
  const encoded=encodeURIComponent(name).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16));
  return {'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'Content-Disposition':"attachment; filename*=UTF-8''"+encoded,'Content-Length':size};
}
