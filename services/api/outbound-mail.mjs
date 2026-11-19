import { composeContent } from './mail-compose.mjs';
import nodemailer from 'nodemailer';

const recipientPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;

export function createOutboundMail(config,{limits,deliverLocal,allowSender,senderName}={}) {
  if (!config?.userSubmission && !config?.localDelivery) return null;
  const domain = config.mailboxDomain ?? 'mail.xcenter.it';
  if(!['mail.xcenter.it','xcenter.it'].includes(domain)||!config.inboundDomains?.includes(domain)){
    throw new Error('Invalid user SMTP submission domain');
  }
  const options={requireTLS:true,connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000,
    disableFileAccess:true,disableUrlAccess:true};
  let upstream;
  if(config.userSubmission){
    const {host,user,password,port=465}=config.userSubmission;
    if(!host||!user||!password||![465,587].includes(port))throw new Error('Invalid authenticated SMTP configuration');
    upstream=nodemailer.createTransport({...options,host,port,secure:port===465,auth:{user,pass:password}});
  }
  const local=config.localDelivery?nodemailer.createTransport({...options,host:config.localDelivery.host,
    port:config.localDelivery.port??25,secure:false,tls:{servername:'mail.xcenter.it'}}):null;
  const rates = new Map();
  let minute=0, total=0;

  return {
    domain,
    external:!!upstream,
    limits,
    async send(owner,username,input) {
      if (!/^[a-z][a-z0-9]{2,23}$/.test(username)) return {status:403,error:'Sender is unavailable.'};
      const recipient = typeof input.to === 'string' ? input.to.trim() : '';
      const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
      const text = typeof input.text === 'string' ? input.text.trim() : '';
      if (recipient.length > 254 || !recipientPattern.test(recipient) || !subject || subject.length > 120 ||
          /[\r\n\u0000]/.test(subject) || !text || text.length > 30_000) return {status:422,error:'Check the recipient, subject and message.'};
      const content = composeContent(text,input);
      if (!content) return {status:422,error:'Choose one attachment of up to 256 KB.'};
      const destination=recipient.split('@').at(-1).toLowerCase();
      const client=config.inboundDomains.includes(destination)&&local?local:upstream;
      if(!client)return {status:503,error:'Sending to external email addresses is unavailable.'};
      const external=!config.inboundDomains.includes(destination);
      const from=typeof input.from==='string'?input.from.toLowerCase():username+'@'+domain;
      const displayName=from===username+'@'+domain?senderName?.(owner)?.replace(/[\r\n\u0000]/g,' ').trim():undefined;
      const fromHeader=displayName?{name:displayName,address:from}:from;
      if(from!==username+'@'+domain&&!allowSender?.(owner,from))return {status:403,error:'Sender is unavailable.'};
      if(external&&limits&&!limits.reserve(owner))return {status:429,error:'Your external mail allowance or the service free-plan allowance has been reached.'};
      const now = Date.now();
      if (now-minute >= 60_000) { minute=now; total=0; }
      for (const [id,record] of rates) if (record.until <= now) rates.delete(id);
      let rate = rates.get(owner);
      if (!rate) {
        if (rates.size >= 5000) return {status:429,error:'Please try again later.'};
        rate = { count:0, until:now+60*60*1000 };
        rates.set(owner,rate);
      }
      if (rate.count >= 12 || total >= 30) return {status:429,error:'Mail sending limit reached.'};
      rate.count++;
      total++;
      try {
        if(!external&&deliverLocal){
          const composer=nodemailer.createTransport({streamTransport:true,buffer:true,disableFileAccess:true,disableUrlAccess:true});
          const raw=await composer.sendMail({from:fromHeader,to:recipient,subject,...content});
          if(!deliverLocal(recipient,raw.message,from))throw new Error('Local mailbox unavailable');
        }else await client.sendMail({from:fromHeader,to:recipient,subject,...content,envelope:{from,to:[recipient]}});
        return {ok:true};
      } catch { return {status:503,error:'The mail provider did not accept the message.'}; }
    },
  };
}
