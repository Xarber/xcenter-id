import {createServer} from 'node:tls';
import {simpleParser} from 'mailparser';
const folders=['INBOX','Sent','Trash','Archive'];
const quote=value=>value==null?'NIL':'"'+String(value).replace(/[\r\n\0]/g,' ').replace(/["\\]/g,'\\$&')+'"';
const flags=new Set(['\\Seen','\\Answered','\\Flagged','\\Deleted','\\Draft']);
const tokens=line=>[...line.matchAll(/"((?:\\.|[^"\\])*)"|([^\s]+)/g)].map(m=>m[1]!==undefined?m[1].replace(/\\(.)/g,'$1'):m[2]);
function selected(set,number,max){return set.split(',').some(range=>{const [a,b=a]=range.split(':').map(v=>v==='*'?max:Number(v));return Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&number>=Math.min(a,b)&&number<=Math.max(a,b);});}
function mime(raw,depth=0){
 const index=raw.indexOf('\r\n\r\n'),header=index<0?raw:raw.subarray(0,index+4),body=index<0?Buffer.alloc(0):raw.subarray(index+4);
 const text=header.toString('latin1').replace(/\r\n[ \t]+/g,' ');const get=name=>new RegExp('^'+name+':([^\\r\\n]*)','im').exec(text)?.[1].trim();
 const content=get('content-type')??'text/plain',parts=content.split(';')[0].trim().toUpperCase().split('/');
 const boundary=/boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(content),children=[];
 if(parts[0]==='MULTIPART'&&boundary&&depth<10){const chunks=body.toString('latin1').split('--'+(boundary[1]??boundary[2]));for(const chunk of chunks.slice(1,101)){if(chunk.startsWith('--'))break;children.push(mime(Buffer.from(chunk.replace(/^\r\n/,'').replace(/\r\n$/,''),'latin1'),depth+1));}}
 const charset=/charset=(?:"([^"]+)"|([^;\s]+))/i.exec(content);
 const structure=children.length?'('+children.map(c=>c.structure).join(' ')+' '+quote(parts[1]??'MIXED')+')':
  '('+quote(parts[0]??'APPLICATION')+' '+quote(parts[1]??'OCTET-STREAM')+' '+(charset?'("CHARSET" '+quote(charset[1]??charset[2])+')':'NIL')+' '+quote(get('content-id'))+' '+quote(get('content-description'))+' '+quote((get('content-transfer-encoding')??'7BIT').toUpperCase())+' '+body.length+(parts[0]==='TEXT'?' '+body.toString('latin1').split('\r\n').length:'')+')';
 return {raw,header,body,children,structure};
}
function section(tree,name){
 if(!name)return tree.raw;
 let node=tree;const segments=name.split('.');
 while(/^\d+$/.test(segments[0]??'')){const n=Number(segments.shift());if(node.children.length)node=node.children[n-1];else if(n!==1)return Buffer.alloc(0);if(!node)return Buffer.alloc(0);}
 const suffix=segments.join('.');if(!suffix||suffix==='TEXT')return node.body;if(suffix==='HEADER'||suffix==='MIME')return node.header;
 const fields=/^HEADER\.FIELDS(?:\.NOT)?\s*\(([^)]+)\)$/i.exec(suffix);
 if(fields){const wanted=new Set(fields[1].toLowerCase().split(/\s+/)),invert=/\.NOT/i.test(suffix);const lines=node.header.toString('latin1').replace(/\r\n\r\n$/,'').split(/\r\n(?![ \t])/).filter(line=>wanted.has(line.split(':')[0].toLowerCase())!==invert);return Buffer.from(lines.join('\r\n')+'\r\n\r\n','latin1');}
 return Buffer.alloc(0);
}
export function createImapServer({tls,credentials,store}){
 let connections=0;
 const server=createServer({...tls,minVersion:'TLSv1.2'},socket=>{
  if(++connections>30){connections--;socket.end('* BYE Server busy\r\n');return;}
  let identity=null,folder=null,readOnly=false,buffer=Buffer.alloc(0),chain=Promise.resolve(),idle=null,append=null,pendingAuth=null;
  const send=text=>socket.write(text+'\r\n');let snapshot=[];
  socket.setTimeout(30*60000,()=>socket.end('* BYE Inactive\r\n'));socket.on('error',()=>{});
  socket.once('close',()=>{connections--;if(idle)clearInterval(idle.timer);});
  send('* OK X-Center ID mail ready');
  const valid=()=>identity&&credentials.valid(identity.owner,identity.id);
  const rows=()=>store.imapList(identity.owner,folder);
  function expunge(){const current=rows();let removed=0;for(let index=0;index<current.length;index++)if(current[index].flags.includes('\\Deleted')){store.remove(identity.owner,current[index].id);send('* '+(index+1-removed++)+' EXPUNGE');}snapshot=rows();}
  async function command(line){
   const authenticate=(tag,username,password)=>{
    folder=null;identity=credentials.authenticate(username,password,socket.remoteAddress);
    send(tag+(identity?' OK Authenticated':' NO Authentication failed'));
   };
   if(pendingAuth){
    const exchange=pendingAuth;
    pendingAuth=null;
    if(line==='*'){send(exchange.tag+' BAD Authentication cancelled');return;}
    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(line)){send(exchange.tag+' BAD Invalid authentication response');return;}
    const decoded=Buffer.from(line,'base64').toString('utf8');
    if(exchange.stage==='login-username'){
     pendingAuth={tag:exchange.tag,stage:'login-password',username:decoded};
     send('+ UGFzc3dvcmQ6');return;
    }
    if(exchange.stage==='login-password'){authenticate(exchange.tag,exchange.username,decoded);return;}
    const fields=decoded.split('\0');
    if(fields.length!==3){send(exchange.tag+' NO Authentication failed');return;}
    authenticate(exchange.tag,fields[1],fields[2]);return;
   }

   if(idle){if(line.toUpperCase()==='DONE'){clearInterval(idle.timer);send(idle.tag+' OK IDLE completed');idle=null;return;}socket.end('* BYE Expected DONE\r\n');return;}
   const match=/^([A-Za-z0-9._-]{1,50})\s+(\S+)(?:\s+(.*))?$/.exec(line);if(!match)return socket.end('* BYE Malformed command\r\n');
   const [,tag,rawCommand,rest='']=match;let cmd=rawCommand.toUpperCase(),args=rest,uid=false;
   if(cmd==='UID'){const n=/^(\S+)\s*(.*)$/.exec(args);if(!n)return send(tag+' BAD Invalid UID command');cmd=n[1].toUpperCase();args=n[2];uid=true;}
   const done=(result='OK',detail=cmd+' completed')=>send(tag+' '+result+' '+detail);
   if(cmd==='CAPABILITY'){send('* CAPABILITY IMAP4rev1 AUTH=PLAIN AUTH=LOGIN SASL-IR IDLE ID MOVE NAMESPACE');return done();}
   if(cmd==='ID'){send('* ID ("name" "X-Center ID Mail")');return done();}
   if(cmd==='LOGOUT'){send('* BYE Signed out');done();return socket.end();}
   if(cmd==='LOGIN'){
    const [username,password]=tokens(args);
    authenticate(tag,username,password);return;
   }
   if(cmd==='AUTHENTICATE'){
    const [method,initial]=tokens(args);
    if(method?.toUpperCase()==='LOGIN'){
     if(initial){
      if(!/^[A-Za-z0-9+/]+={0,2}$/.test(initial))return done('BAD','Invalid authentication response');
      pendingAuth={tag,stage:'login-password',username:Buffer.from(initial,'base64').toString('utf8')};
      send('+ UGFzc3dvcmQ6');
     }else{
      pendingAuth={tag,stage:'login-username'};send('+ VXNlcm5hbWU6');
     }
     return;
    }
    if(method?.toUpperCase()!=='PLAIN')return done('NO','Use LOGIN or AUTHENTICATE PLAIN');
    if(!initial){pendingAuth={tag,stage:'plain'};send('+ ');return;}
    const fields=Buffer.from(initial,'base64').toString('utf8').split('\0');
    if(fields.length!==3)return done('NO','Authentication failed');
    authenticate(tag,fields[1],fields[2]);return;
   }
   if(!valid()){identity=null;return done('NO','Authenticate with a mail-client credential');}
   if(cmd==='NOOP'||cmd==='CHECK')return done();
   if(cmd==='NAMESPACE'){send('* NAMESPACE (("" "/")) NIL NIL');return done();}
   if(cmd==='LIST'||cmd==='LSUB'){for(const name of folders)send('* '+cmd+' (\\HasNoChildren'+(name==='Sent'?' \\Sent':name==='Trash'?' \\Trash':'')+') "/" '+quote(name));return done();}
   if(cmd==='CREATE'||cmd==='SUBSCRIBE'||cmd==='UNSUBSCRIBE'){return folders.includes(tokens(args)[0])?done():done('NO','Only the standard folders are available');}
   if(cmd==='STATUS'){const name=tokens(args)[0];if(!folders.includes(name))return done('NO','Unknown folder');const items=store.imapList(identity.owner,name);send('* STATUS '+quote(name)+' (MESSAGES '+items.length+' UNSEEN '+items.filter(r=>!r.flags.includes('\\Seen')).length+' UIDNEXT '+store.imapNext()+' UIDVALIDITY '+store.imapValidity()+')');return done();}
   if(cmd==='SELECT'||cmd==='EXAMINE'){folder=tokens(args)[0];if(!folders.includes(folder)){folder=null;return done('NO','Unknown folder');}readOnly=cmd==='EXAMINE';snapshot=rows();send('* FLAGS (\\Seen \\Answered \\Flagged \\Deleted \\Draft)');send('* '+snapshot.length+' EXISTS');send('* 0 RECENT');send('* OK [UIDVALIDITY '+store.imapValidity()+'] Stable UIDs');send('* OK [UIDNEXT '+store.imapNext()+'] Next UID');return done('OK',readOnly?'[READ-ONLY] Selected':'[READ-WRITE] Selected');}
   if(cmd==='APPEND'){
    const length=/\{(\d+)\}$/.exec(args),target=tokens(args)[0];if(!folders.includes(target)||!length||Number(length[1])>512*1024)return done('NO','APPEND requires a standard folder and a literal up to 512 KB');
    append={tag,folder:target,length:Number(length[1])};send('+ Send message');return;
   }
   if(!folder)return done('NO','Select a mailbox first');
   if(cmd==='IDLE'){idle={tag,timer:setInterval(()=>{if(!valid()){clearInterval(idle.timer);idle=null;socket.end('* BYE Access revoked\r\n');return;}const current=rows();if(current.length!==snapshot.length){send('* '+current.length+' EXISTS');snapshot=current;}},5000)};send('+ Waiting for mailbox updates');return;}
   if(cmd==='CLOSE'||cmd==='UNSELECT'){if(cmd==='CLOSE'&&!readOnly)expunge();folder=null;return done();}
   if(cmd==='EXPUNGE'){if(readOnly)return done('NO','Read-only mailbox');expunge();return done();}
   const current=rows(),maximum=uid?(current.at(-1)?.uid??0):current.length;
   if(cmd==='SEARCH'){let found=current;if(/UNSEEN/i.test(args))found=found.filter(r=>!r.flags.includes('\\Seen'));else if(!/^(?:CHARSET UTF-8 )?ALL$/i.test(args))return done('NO','Supported searches: ALL and UNSEEN');send('* SEARCH '+found.map(r=>uid?r.uid:current.indexOf(r)+1).join(' '));return done();}
   const set=/^([0-9*:,]+)\s+(.*)$/.exec(args);if(!set||set[1].length>4096)return done('BAD','Invalid sequence set');
   const selectedRows=current.filter((row,index)=>selected(set[1],uid?row.uid:index+1,maximum));
   if(['STORE','MOVE','COPY'].includes(cmd)){
    if(readOnly)return done('NO','Read-only mailbox');
    let moved=0;for(const row of selectedRows){
     if(cmd==='STORE'){const list=[...set[2].matchAll(/\\[A-Za-z]+/g)].map(m=>m[0]).filter(f=>flags.has(f));const operator=/^([+-]?)FLAGS/i.exec(set[2])?.[1];if(operator===undefined)return done('BAD','Invalid flags');const updated=operator==='+'?[...new Set([...row.flags,...list])]:operator==='-'?row.flags.filter(f=>!list.includes(f)):list;store.imapFlags(identity.owner,row.id,updated);if(!/\.SILENT/i.test(set[2]))send('* '+(current.indexOf(row)+1)+' FETCH (UID '+row.uid+' FLAGS ('+updated.join(' ')+'))');}
     else {const target=tokens(set[2])[0];if(!folders.includes(target))return done('NO','Unknown folder');if(cmd==='COPY'){if(!store.imapAppend(identity.owner,target,store.retrieve(identity.owner,row.id)))return done('NO','Mailbox full');}else{store.imapMove(identity.owner,row.id,target);send('* '+(current.indexOf(row)+1-moved++)+' EXPUNGE');}}
    }return done();
   }
   if(cmd!=='FETCH')return done('BAD','Unsupported command');
   set[2]=set[2].replace(/^FAST$/i,'(FLAGS INTERNALDATE RFC822.SIZE)').replace(/^ALL$/i,'(FLAGS INTERNALDATE RFC822.SIZE ENVELOPE)').replace(/^FULL$/i,'(FLAGS INTERNALDATE RFC822.SIZE ENVELOPE BODYSTRUCTURE)');
   for(const row of selectedRows){
    if(!valid())return done('NO','Access revoked');
    const raw=store.retrieve(identity.owner,row.id);if(!raw)continue;const tree=mime(raw);const fields=['UID '+row.uid];
    if(/\bFLAGS\b/i.test(set[2]))fields.push('FLAGS ('+row.flags.join(' ')+')');
    if(/RFC822\.SIZE/i.test(set[2]))fields.push('RFC822.SIZE '+raw.length);
    if(/INTERNALDATE/i.test(set[2]))fields.push('INTERNALDATE '+quote(new Date(row.received).toUTCString().replace(/^[A-Za-z]+, (\d{2}) ([A-Za-z]+) (\d{4}) (.*) GMT$/,'$1-$2-$3 $4 +0000')));
    if(/BODYSTRUCTURE/i.test(set[2]))fields.push('BODYSTRUCTURE '+tree.structure);
    if(/\bENVELOPE\b/i.test(set[2])){const p=await simpleParser(raw,{skipImageLinks:true,skipTextToHtml:true,skipHtmlToText:true});const address=value=>value?.value?.length?'('+value.value.map(a=>'('+quote(a.name)+' NIL '+quote(a.address?.split('@')[0])+' '+quote(a.address?.split('@')[1])+')').join(' ')+')':'NIL';fields.push('ENVELOPE ('+[quote(p.date?.toUTCString()),quote(p.subject),address(p.from),address(p.sender??p.from),address(p.replyTo??p.from),address(p.to),address(p.cc),address(p.bcc),quote(p.inReplyTo),quote(p.messageId)].join(' ')+')');}
    const bodies=[...set[2].matchAll(/BODY(?:\.PEEK)?\[([^\]]*)\](?:<(\d+)\.(\d+)>)?/gi)];
    if(/RFC822(?:\.HEADER|\.TEXT)?\b/i.test(set[2])&&!/RFC822\.SIZE/i.test(set[2]))bodies.push({0:'BODY.PEEK[]',1:/RFC822\.HEADER/i.test(set[2])?'HEADER':/RFC822\.TEXT/i.test(set[2])?'TEXT':''});
    if(!valid())return done('NO','Access revoked');
    socket.write('* '+(current.indexOf(row)+1)+' FETCH ('+fields.join(' '));
    for(const part of bodies){let bytes=section(tree,part[1].toUpperCase());if(part[2]!==undefined)bytes=bytes.subarray(Number(part[2]),Number(part[2])+Math.min(Number(part[3]),512*1024));socket.write(' BODY['+part[1]+']'+(part[2]!==undefined?'<'+part[2]+'>':'')+' {'+bytes.length+'}\r\n');socket.write(bytes);if(!readOnly&&!/PEEK/i.test(part[0]))store.imapFlags(identity.owner,row.id,[...new Set([...row.flags,'\\Seen'])]);}
    send(')');
   }done();
  }
  async function consume(){
   while(buffer.length){
    if(append){if(buffer.length<append.length+2)return;const raw=buffer.subarray(0,append.length);buffer=buffer.subarray(append.length+2);const request=append;append=null;send(request.tag+' '+(valid()&&store.imapAppend(identity.owner,request.folder,raw)?'OK APPEND completed':'NO APPEND failed'));continue;}
    const at=buffer.indexOf('\r\n');if(at<0){if(buffer.length>16384)socket.end('* BYE Command too large\r\n');return;}
    const line=buffer.subarray(0,at).toString('utf8');buffer=buffer.subarray(at+2);if(line.length>16384){socket.end('* BYE Command too large\r\n');return;}await command(line);
   }
  }
  socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);if(buffer.length>600*1024)return socket.destroy();chain=chain.then(consume).catch(()=>socket.end('* BYE Mailbox temporarily unavailable\r\n'));});
 });
 return server;
}
