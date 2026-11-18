import { openInboundVerification } from './inbound-verification.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SMTPServer } from 'smtp-server';
import { openMailStore } from './mail-store.mjs';

const maxMessage = 2 * 1024 * 1024;
function smtpError(responseCode, message) { return Object.assign(new Error(message),{ responseCode }); }

export function createInboundServer({ store, tls = {}, name, verification }) {
  const server = new SMTPServer({
    ...tls, name, banner:'X-Center ID inbound mail', disabledCommands:['AUTH', ...(tls.disabledCommands ?? [])],
    size:maxMessage, maxClients:40, socketTimeout:30_000,
    disableReverseLookup:true,
    onRcptTo({address},session,callback) {
      if (session.envelope.rcptTo.length >= 20) return callback(smtpError(452,'Too many recipients'));
      if (!(verification?.enabled&&address.toLowerCase()===verification.recipient)&&!store.resolveRecipient(address)) return callback(smtpError(550,'Recipient unavailable'));
      callback();
    },
    onData(stream,session,callback) {
      const data = [];
      let size = 0;
      stream.on('data',(chunk) => {
        size += chunk.length;
        if (size <= maxMessage) data.push(chunk);
      });
      stream.on('error',() => callback(smtpError(451,'Could not read message')));
      stream.on('end',async () => {
        if (size > maxMessage || stream.sizeExceeded) return callback(smtpError(552,'Message exceeds the size limit'));
        try {
          const raw=Buffer.concat(data);
          const recipients=session.envelope.rcptTo.map(({address})=>address.toLowerCase());
          const incoming=verification?.enabled&&recipients.includes(verification.recipient);
          const ordinary=recipients.filter(address=>!incoming||address!==verification.recipient);
          if(incoming)await verification.receive(raw,{ip:session.remoteAddress,helo:session.hostNameAppearsAs,sender:session.envelope.mailFrom?.address??''});
          const delivered = !ordinary.length||store.receive(ordinary,raw);
          callback(delivered ? null : smtpError(452,'Mailbox temporarily unavailable'));
        } catch {
          callback(smtpError(451,'Mailbox temporarily unavailable'));
        }
      });
    },
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const configuration = JSON.parse(readFileSync(process.env.AUTHNJS_MAIL_CONFIG,'utf8'));
  const directory = process.env.AUTHNJS_DATA_DIR;
  const store = openMailStore({ configuration, accountsPath:join(directory,'accounts.sqlite'),mailPath:join(directory,'mail.sqlite') });
  const verification=openInboundVerification(join(directory,'accounts.sqlite'),{enabled:!!configuration.inboundVerification});
  const { tlsKeyFile, tlsCertificateFile } = configuration;
  if (!tlsKeyFile || !tlsCertificateFile) throw new Error('Configure an SMTP STARTTLS certificate and key');
  const server = createInboundServer({ store, verification, name:'mail.xcenter.it',
    tls:{ key:readFileSync(tlsKeyFile),cert:readFileSync(tlsCertificateFile) } });
  server.on('error',error => {
    const code=typeof error.code==='string'&&/^E[A-Z_]{2,24}$/.test(error.code)?error.code:'UNKNOWN';
    const listenerFailure=['EADDRINUSE','EACCES','EADDRNOTAVAIL'].includes(code);
    console.error(JSON.stringify({timestamp:new Date().toISOString(),service:'xcenter-id-smtp',
      severity:listenerFailure?'error':'warning',operation:listenerFailure?'listen':'connection',code}));
    if(listenerFailure)process.exitCode=1;
  });
  server.listen(Number(process.env.AUTHNJS_SMTP_PORT ?? 2525),process.env.AUTHNJS_SMTP_BIND ?? '127.0.0.1');
}
