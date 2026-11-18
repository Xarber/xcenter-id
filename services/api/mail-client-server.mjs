import {readFileSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {createAccounts} from './accounts.mjs';import {openMailStore} from './mail-store.mjs';import {openMailCredentials} from './mail-credentials.mjs';
import {openMailLimits} from './mail-limits.mjs';import {createOutboundMail} from './outbound-mail.mjs';import {createMailSubmission} from './mail-submission.mjs';import {createImapServer} from './imap-server.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const config=JSON.parse(readFileSync(process.env.AUTHNJS_MAIL_CONFIG)),directory=process.env.AUTHNJS_DATA_DIR;
 const database=join(directory,'accounts.sqlite'),credentials=openMailCredentials(database),limits=openMailLimits(database,config.externalLimits);
 const identity=JSON.parse(readFileSync(process.env.AUTHNJS_OIDC_CONFIG,'utf8'));
 const accounts=createAccounts({database,origin:process.env.AUTHNJS_ACCOUNT_ORIGIN,profileKey:Buffer.from(identity.profileKey,'hex')});
 const mail=openMailStore({accountsPath:database,mailPath:join(directory,'mail.sqlite'),configuration:config,accountService:accounts});
 const outbound=createOutboundMail({...config,localDelivery:{host:process.env.AUTHNJS_LOCAL_SMTP_HOST??'172.17.0.1'}},{limits,
  allowSender:(owner,from)=>accounts.mailboxSender(owner,from),deliverLocal:(recipient,raw,from)=>mail.receive([recipient],raw,accounts.badgeForAddress(from))});
 const tls={key:readFileSync(config.tlsKeyFile),cert:readFileSync(config.tlsCertificateFile)};
 const submission=createMailSubmission({tls,credentials,accounts,outbound}),imap=createImapServer({tls,credentials,store:mail});
 for(const [server,port,service]of [[submission,2465,'submission'],[imap,2993,'imap']]){
  server.on('error',()=>{console.error(JSON.stringify({service:'xcenter-mail-'+service,error:'listener_failed'}));process.exitCode=1;});
  server.listen(port,process.env.AUTHNJS_SMTP_BIND??'127.0.0.1');
 }
}
