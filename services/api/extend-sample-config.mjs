import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [input,output,notesHost='https://notes-id.xcenter.it',tripsHost='https://trips-id.xcenter.it']=process.argv.slice(2);
const config=JSON.parse(readFileSync(input,'utf8'));
for(const [client_id,client_name,host] of [
  ['notes-external','Notes Lab',notesHost],
  ['trips-external','Trips Lab',tripsHost],
]){
  const url=new URL(host);
  if(url.protocol!=='https:'||url.origin!==host||url.username||url.password)throw new Error('Expected an HTTPS app origin');
  const original=config.clients.find(client=>client.client_id===client_id);
  if(original){
    if(original.redirect_uris[0]!==host+'/callback')throw new Error('Refusing to replace an existing app callback');
  }else{
    config.clients.push({client_id,client_name,client_secret:randomBytes(32).toString('hex'),redirect_uris:[host+'/callback']});
  }
}
writeFileSync(output,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});
