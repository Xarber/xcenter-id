import {SMTPServer} from 'smtp-server';
import {simpleParser} from 'mailparser';
export function createMailSubmission({tls,credentials,accounts,outbound,name='mail.xcenter.it'}){
 const error=(message,code=550)=>Object.assign(new Error(message),{responseCode:code});
 return new SMTPServer({...tls,name,secure:tls.secure!==false,authOptional:false,allowInsecureAuth:tls.allowInsecureAuth===true,disableReverseLookup:true,
  size:512*1024,maxClients:20,socketTimeout:30000,
  onAuth(auth,session,done){const user=credentials.authenticate(auth.username,auth.password,session.remoteAddress);done(user?null:error('Authentication failed',535),user?{user}:undefined);},
  onMailFrom(address,session,done){const user=session.user;
   if(!user||!credentials.valid(user.owner,user.id)||!accounts.mailboxSender(user.owner,address.address.toLowerCase()))return done(error('Sender unavailable'));done();},
  onRcptTo(address,session,done){if(session.envelope.rcptTo.length>=1)return done(error('Submit one recipient per message',452));done();},
  onData(stream,session,done){const parts=[];let size=0;stream.on('data',part=>{size+=part.length;if(size<=512*1024)parts.push(part);});stream.on('error',()=>done(error('Message unavailable',451)));
   stream.on('end',async()=>{try{
    if(size>512*1024||stream.sizeExceeded)return done(error('Message too large',552));
    const user=session.user;if(!user||!credentials.valid(user.owner,user.id))return done(error('Authentication expired',535));
    const raw=Buffer.concat(parts),parsed=await simpleParser(raw,{skipTextToHtml:true,skipImageLinks:true});
    const from=parsed.from?.value;
    if(parsed.headerLines.filter(h=>h.key==='from').length!==1||from?.length!==1||from[0].address?.toLowerCase()!==session.envelope.mailFrom.address.toLowerCase())return done(error('Message sender does not match authenticated sender'));
    if(parsed.attachments.length>1||parsed.attachments.some(a=>a.size>256*1024))return done(error('Use one attachment up to 256 KB',552));
    const result=await outbound.send(user.owner,user.username,{from:from[0].address,to:session.envelope.rcptTo[0].address,subject:parsed.subject??'',text:parsed.text??'',
      attachment:parsed.attachments[0]?{name:parsed.attachments[0].filename??'attachment',content:parsed.attachments[0].content.toString('base64')}:undefined});
    done(result.ok?null:error(result.error,result.status===429?452:451));
   }catch{done(error('Message temporarily unavailable',451));}});
  },
 });
}
