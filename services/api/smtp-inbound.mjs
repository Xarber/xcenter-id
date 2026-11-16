import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SMTPServer } from 'smtp-server';
import { openMailStore } from './mail-store.mjs';

const maxMessage = 2 * 1024 * 1024;
function smtpError(responseCode, message) { return Object.assign(new Error(message),{ responseCode }); }

export function createInboundServer({ store, tls = {}, name }) {
  const server = new SMTPServer({
    ...tls, name, banner:'X-Center ID inbound mail', disabledCommands:['AUTH', ...(tls.disabledCommands ?? [])],
    size:maxMessage, maxClients:40, socketTimeout:30_000,
    disableReverseLookup:true,
    onRcptTo({address},session,callback) {
      if (session.envelope.rcptTo.length >= 20) return callback(smtpError(452,'Too many recipients'));
      if (!store.resolveRecipient(address)) return callback(smtpError(550,'Recipient unavailable'));
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
      stream.on('end',() => {
        if (size > maxMessage || stream.sizeExceeded) return callback(smtpError(552,'Message exceeds the size limit'));
        try {
          const delivered = store.receive(session.envelope.rcptTo.map(({address}) => address),Buffer.concat(data));
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
  const { tlsKeyFile, tlsCertificateFile } = configuration;
  if (!tlsKeyFile || !tlsCertificateFile) throw new Error('Configure an SMTP STARTTLS certificate and key');
  const server = createInboundServer({ store, name:'mail.xcenter.it',
    tls:{ key:readFileSync(tlsKeyFile),cert:readFileSync(tlsCertificateFile) } });
  server.on('error',() => { console.error('Inbound mail listener failed'); process.exitCode=1; });
  server.listen(Number(process.env.AUTHNJS_SMTP_PORT ?? 2525),process.env.AUTHNJS_SMTP_BIND ?? '127.0.0.1');
}
