export const storageCategories = [
  ['files','Files','#4875ec'],
  ['account','Account information','#9473d6'],
  ['security','Security metadata','#278f75'],
  ['apps','App data and metadata','#bd6b29'],
  ['mail','Mail','#c2547a'],
] as const;

export function formatBytes(bytes:number) {
  if(bytes<1024)return bytes+' B';
  if(bytes<1024**2)return (bytes/1024).toFixed(1)+' KB';
  return (bytes/1024**2).toFixed(1)+' MB';
}
